import { execa } from "execa";
import type {
  PREnriched,
  Repo,
  ReviewerStat,
  OrgTeam,
  OrgMember,
  ViewerInfo,
  OrgStats,
  OrgStatUser,
  OrgStatRepo,
} from "./types.js";

// Keep your existing ghRepos() (CLI list). You can migrate it later if you want.
// --- Repo list via CLI (unchanged) ---
export async function ghRepos(org: string): Promise<Repo[]> {
  const { stdout } = await execa("gh", [
    "repo",
    "list",
    org,
    "--limit",
    "200",
    "--json",
    "name,description,isPrivate,updatedAt,pushedAt",
  ]);
  const repos = JSON.parse(stdout) as any[];
  return repos.map((r) => ({
    name: r.name,
    fullName: `${org}/${r.name}`,
    description: r.description ?? null,
    isPrivate: !!r.isPrivate,
    updatedAt: r.updatedAt ?? null,
    pushedAt: r.pushedAt ?? null,
  }));
}

// --- PRs via GraphQL (batched) ---
const ghBin = process.env.GH_BIN ?? "gh";
const PR_LIMIT = Number(process.env.PR_LIMIT ?? 50);      // PRs per repo
const REPO_BATCH = Number(process.env.REPO_BATCH ?? 8);   // repos per GraphQL query
const DEFAULT_STALE_PR_WINDOW_DAYS = 14;
const staleWindowDaysRaw = Number(process.env.STALE_PR_WINDOW_DAYS);
const STALE_PR_WINDOW_DAYS =
  Number.isFinite(staleWindowDaysRaw) && staleWindowDaysRaw > 0
    ? staleWindowDaysRaw
    : DEFAULT_STALE_PR_WINDOW_DAYS;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function buildQuery(owner: string, repos: string[], states: ("open" | "merged")[]) {
  const statesEnum = states.map((s) => (s === "merged" ? "MERGED" : "OPEN")).join(", ");
  let q = `query { rateLimit { remaining resetAt cost }`;
  repos.forEach((name, i) => {
    q += `
r${i}: repository(owner: "${esc(owner)}", name: "${esc(name)}") {
  name
  nameWithOwner
  isPrivate
  pushedAt
  updatedAt
  pullRequests(first: ${PR_LIMIT}, states: [${statesEnum}], orderBy: {field: UPDATED_AT, direction: DESC}) {
    nodes {
      number
      title
      url
      isDraft
      createdAt
      updatedAt
      closedAt
      mergedAt
      baseRefName
      headRefName
      author { login }
      reviewRequests(first: 20) {
        nodes {
          requestedReviewer {
            __typename
            ... on User { login }
            ... on Team { slug }
          }
        }
      }
      reviews(first: 50) {
        nodes {
          state
          author { login }
          submittedAt
          updatedAt
        }
      }
      additions
      deletions
      changedFiles
    }
  }
}`;
  });
  q += `}`;
  return q;
}

// async function runGraphQL(query: string): Promise<any> {
//   const { stdout } = await execa(ghBin, ["api", "graphql", "-f", `query=${query}`]);
//   // gh returns a top-level JSON with "data" field
//   const parsed = JSON.parse(stdout);
//   return parsed.data ?? parsed;
// }

export async function ghPRsAcross(
  org: string,
  repos: string[],
  _withEnrich = true,
  states: ('open'|'merged')[] = ['open'],
  window: '24h'|'7d'|'30d' = '24h'
): Promise<PREnriched[]> {
  const batches = chunk(repos, REPO_BATCH);
  const all: PREnriched[] = [];

  for (const batch of batches) {
    const q = buildQuery(org, batch, states);
    const data = await runGraphQL(q);

    batch.forEach((name, i) => {
      const alias = `r${i}`;
      const repoData = data?.[alias];
      if (!repoData) return;

      const repoSlug = repoData.nameWithOwner ?? `${org}/${name}`;
      const nodes = repoData.pullRequests?.nodes ?? [];

      for (const pr of nodes) {
        const approvals =
          (pr.reviews?.nodes ?? []).filter((n: any) => n.state === "APPROVED").length ?? 0;

        const requestedReviewers: string[] = (pr.reviewRequests?.nodes ?? [])
          .map((n: any) => {
            const rr = n?.requestedReviewer;
            if (!rr) return null;
            if (rr.__typename === "User") return rr.login;
            if (rr.__typename === "Team") return `team:${rr.slug}`;
            return null;
          })
          .filter(Boolean);

        const lastReviewedAt =
          (pr.reviews?.nodes ?? [])
            .map((n: any) => n.submittedAt ?? n.updatedAt ?? "")
            .filter(Boolean)
            .sort()
            .pop() ?? null;

        all.push({
          id: `${repoSlug}#${pr.number}`,
          number: pr.number,
          repo: repoSlug,
          title: pr.title,
          url: pr.url,
          author: pr.author?.login ?? "unknown",
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          isDraft: pr.isDraft,
          baseRefName: pr.baseRefName,
          headRefName: pr.headRefName,
          requestedReviewers,
          approvals,
          additions: pr.additions ?? 0,
          deletions: pr.deletions ?? 0,
          changedFiles: pr.changedFiles ?? 0,
          state: pr.mergedAt ? "merged" : "open",
          mergedAt: pr.mergedAt ?? null,
          closedAt: pr.closedAt ?? null,
          lastReviewedAt,
        });
      }
    });
  }

  // apply window filter after fetch
  const since = buildSinceISO(window);
  if (!since) return all;

  return all.filter(pr => {
    if (states.includes('merged') && pr.state === 'merged') {
      // for merged view: honor mergedAt first, fall back to updatedAt
      return (pr.mergedAt && pr.mergedAt >= since) || (pr.updatedAt >= since);
    }
    // for open view: updatedAt since window
    return pr.updatedAt >= since;
  });
}

function buildSinceISO(window: "24h" | "7d" | "30d"): string {
  const ms = { "24h": 24*60*60e3, "7d": 7*24*60*60e3, "30d": 30*24*60*60e3 }[window];
  return new Date(Date.now() - ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildSinceISOFromDays(days: number): string {
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_STALE_PR_WINDOW_DAYS;
  const ms = safeDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function batch<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}

async function runGraphQL(query: string, vars: Record<string,string|null|undefined> = {}): Promise<any> {
  const args = ["api","graphql","-f",`query=${query}`];
  for (const [k,v] of Object.entries(vars)) {
    if (v != null) args.push("-F", `${k}=${v}`);
  }
  const { stdout } = await execa(ghBin, args);
  const json = JSON.parse(stdout);
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data ?? json;
}

const orgIdCache = new Map<string, string>();

async function getOrgId(org: string): Promise<string> {
  if (orgIdCache.has(org)) {
    return orgIdCache.get(org)!;
  }

  const query = `
    query($org:String!) {
      organization(login:$org) {
        id
      }
    }
  `;

  const data = await runGraphQL(query, { org });
  const id = data?.organization?.id;

  if (!id) {
    throw new Error(`Unable to resolve organization id for ${org}`);
  }

  orgIdCache.set(org, id);
  return id;
}

export async function ghTopReviewers(
  org: string,
  window: "24h" | "7d" | "30d",
  users?: string[] | null
): Promise<{ since: string; reviewers: ReviewerStat[] }> {
  const since = buildSinceISO(window);
  const sanitizedUsers = Array.from(
    new Map(
      (users ?? [])
        .map(u => u?.trim())
        .filter((u): u is string => !!u)
        .map(u => [u.toLowerCase(), u] as const)
    ).values()
  );

  if (!sanitizedUsers.length) {
    return { since, reviewers: [] };
  }

  const orgId = await getOrgId(org);

  const usersPerQuery = Math.max(1, Number(process.env.REVIEWER_USER_BATCH ?? 8) || 0);

  const buildReviewerQuery = (logins: string[]) => {
    let query = "query { rateLimit { remaining resetAt cost }";
    logins.forEach((login, index) => {
      query += `
u${index}: user(login:"${esc(login)}") {
  login
  name
  ...ReviewerContribs
}`;
    });
    query += "}\n";
    query += `fragment ReviewerContribs on User {
  contributionsCollection(from:"${esc(since)}", organizationID:"${esc(orgId)}") {
    totalCommitContributions
    pullRequestReviewContributions(first:100) {
      totalCount
      nodes {
        occurredAt
        pullRequestReview {
          databaseId
          state
          submittedAt
          updatedAt
          author {
            login
            ... on User { name }
          }
          comments { totalCount }
          pullRequest {
            number
            url
            repository { nameWithOwner }
          }
        }
      }
    }
  }
}`;
    return query;
  };

  const summarizeUser = (
    userNode: any,
    userLogin: string
  ) => {
    const seenReviewIds = new Set<number | string>();
    const lastCommentReviewAtByPR = new Map<string, number>();
    const entry = {
      user: userLogin,
      approvals: 0,
      changesRequested: 0,
      commented: 0,
      comments: 0,
      lastReviewAt: null as string | null,
      repos: new Set<string>(),
      displayName: null as string | null,
    };

    if (!userNode) {
      return entry;
    }

    if (!entry.displayName && userNode?.name) {
      entry.displayName = userNode.name;
    }

    type ReviewContribution = {
      occurredAt?: string | null;
      pullRequestReview?: {
        databaseId?: number | null;
        state?: string | null;
        submittedAt?: string | null;
        updatedAt?: string | null;
        author?: { login?: string | null; name?: string | null } | null;
        comments?: { totalCount?: number | null } | null;
        pullRequest?: {
          number?: number | null;
          url?: string | null;
          repository?: { nameWithOwner?: string | null } | null;
        } | null;
      } | null;
    };

    const contribNodes = (
      userNode?.contributionsCollection?.pullRequestReviewContributions?.nodes ?? []
    ) as ReviewContribution[];

    for (const node of contribNodes) {
      const review = node.pullRequestReview;
      if (!review) continue;
      const repoSlug = review.pullRequest?.repository?.nameWithOwner ?? "";
      if (!repoSlug) continue;

      const reviewId = review.databaseId ?? null;
      if (reviewId != null) {
        if (seenReviewIds.has(reviewId)) continue;
        seenReviewIds.add(reviewId);
      }

      const when =
        review.submittedAt ??
        review.updatedAt ??
        node.occurredAt ??
        null;
      if (!when || when < since) continue;

      const whenMs = Date.parse(when);
      const reviewState = review.state ?? "";

      if (reviewState === "APPROVED") entry.approvals++;
      else if (reviewState === "CHANGES_REQUESTED") entry.changesRequested++;
      else if (reviewState === "COMMENTED") {
        const key = `${review.pullRequest?.url ?? repoSlug}`;
        const prev = Number.isNaN(whenMs) ? null : lastCommentReviewAtByPR.get(key) ?? null;
        const withinWindow = prev != null && Math.abs(whenMs - prev) <= 5 * 60 * 1000;
        if (!withinWindow) {
          entry.commented++;
        }
        if (!Number.isNaN(whenMs)) {
          const latest = prev == null ? whenMs : Math.max(prev, whenMs);
          lastCommentReviewAtByPR.set(key, latest);
        }
      }

      entry.comments += review.comments?.totalCount ?? 0;

      if (!entry.lastReviewAt || when > entry.lastReviewAt) entry.lastReviewAt = when;
      entry.repos.add(repoSlug);

      if (!entry.displayName && review.author?.name) {
        entry.displayName = review.author.name;
      }
    }

    return entry;
  };

  const counts = [] as ReturnType<typeof summarizeUser>[];

  for (const chunk of batch(sanitizedUsers, usersPerQuery)) {
    const data = await runGraphQL(buildReviewerQuery(chunk));
    chunk.forEach((userLogin, index) => {
      const alias = `u${index}`;
      const userNode = data?.[alias];
      counts.push(summarizeUser(userNode, userLogin));
    });
  }

  const reviewers: ReviewerStat[] = counts
    .map(entry => ({
      user: entry.user,
      displayName: entry.displayName,
      total: entry.approvals + entry.changesRequested + entry.commented,
      approvals: entry.approvals,
      changesRequested: entry.changesRequested,
      comments: entry.comments,
      commented: entry.commented,
      lastReviewAt: entry.lastReviewAt,
      repos: Array.from(entry.repos).sort(),
    }))
    .sort((a, b) => b.total - a.total || (b.lastReviewAt ?? "").localeCompare(a.lastReviewAt ?? ""));

  return { since, reviewers };
}

export async function ghViewerInfo(): Promise<ViewerInfo> {
  const ORGS_PER_PAGE = Number(process.env.ORGS_PER_PAGE ?? 100);
  const orgs: ViewerInfo["organizations"] = [];
  let cursor: string | null = null;
  let login: string | null = null;
  let name: string | null = null;
  let avatarUrl: string | null = null;

  const QUERY = `
    query($cursor:String) {
      viewer {
        login
        name
        avatarUrl
        organizations(first:${ORGS_PER_PAGE}, after:$cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { login name avatarUrl }
        }
      }
    }
  `;

  do {
    const data = await runGraphQL(QUERY, { cursor });
    const viewer = data?.viewer ?? null;
    if (!viewer) break;
    if (!login) login = viewer.login ?? null;
    if (!name) name = viewer.name ?? null;
    if (!avatarUrl) avatarUrl = viewer.avatarUrl ?? null;

    const nodes = viewer.organizations?.nodes ?? [];
    for (const node of nodes) {
      const orgLogin = node?.login ?? null;
      if (!orgLogin) continue;
      orgs.push({
        login: orgLogin,
        name: node?.name ?? null,
        avatarUrl: node?.avatarUrl ?? null,
      });
    }

    const pageInfo = viewer.organizations?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo?.endCursor ?? null : null;
  } while (cursor);

  if (!login) {
    throw new Error("Unable to determine authenticated user via gh CLI");
  }

  return {
    login,
    name,
    avatarUrl,
    organizations: Array.from(new Map(orgs.map((o) => [o.login, o] as const)).values()).sort((a, b) =>
      (a.name ?? a.login).localeCompare(b.name ?? b.login)
    ),
  };
}

export async function ghOrgMembers(org: string): Promise<OrgMember[]> {
  const MEMBERS_PER_PAGE = Number(process.env.ORG_MEMBERS_PER_PAGE ?? 100);
  const members: OrgMember[] = [];
  let cursor: string | null = null;

  const QUERY = `
    query($org:String!, $cursor:String) {
      organization(login:$org) {
        membersWithRole(first:${MEMBERS_PER_PAGE}, after:$cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            login
            name
            avatarUrl
          }
        }
      }
    }
  `;

  do {
    const data = await runGraphQL(QUERY, { org, cursor });
    const nodes = data?.organization?.membersWithRole?.nodes ?? [];
    for (const node of nodes) {
      const login = node?.login ?? null;
      if (!login) continue;
      members.push({
        login,
        name: node?.name ?? null,
        avatarUrl: node?.avatarUrl ?? null,
      });
    }

    const pageInfo = data?.organization?.membersWithRole?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo?.endCursor ?? null : null;
  } while (cursor);

  return Array.from(new Map(members.map((m) => [m.login, m] as const)).values()).sort((a, b) =>
    (a.name ?? a.login).localeCompare(b.name ?? b.login)
  );
}

export async function ghOrgTeams(org: string): Promise<OrgTeam[]> {
  const TEAMS_PER_PAGE = Number(process.env.TEAMS_PER_PAGE ?? 50);
  const MEMBERS_PER_PAGE = Number(process.env.TEAM_MEMBERS_PER_PAGE ?? 100);

  const out: OrgTeam[] = [];
  let teamCursor: string | null = null;

  const TEAMS_Q = `
    query($org:String!, $teamCursor:String) {
      organization(login:$org) {
        teams(first:${TEAMS_PER_PAGE}, after:$teamCursor, privacy:VISIBLE) {
          pageInfo { hasNextPage endCursor }
          nodes { slug name id }
        }
      }
    }
  `;

  const MEMBERS_Q = `
    query($org:String!, $slug:String!, $memberCursor:String) {
      organization(login:$org) {
        team(slug:$slug) {
          name
          members(first:${MEMBERS_PER_PAGE}, after:$memberCursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              ... on User { login name avatarUrl }
            }
          }
        }
      }
    }
  `;

  // page through teams
  do {
    const d = await runGraphQL(TEAMS_Q, { org, teamCursor });
    const teams = d?.organization?.teams?.nodes ?? [];
    for (const t of teams) {
      // page through members
      const members: OrgTeam["members"] = [];
      let memberCursor: string | null = null;
      do {
        const md = await runGraphQL(MEMBERS_Q, { org, slug: t.slug, memberCursor });
        const nodes = md?.organization?.team?.members?.nodes ?? [];
        for (const m of nodes) {
          const login = m?.login ?? null;
          if (!login) continue;
          members.push({
            login,
            name: m?.name ?? null,
            avatarUrl: m?.avatarUrl ?? null,
          });
        }
        const pi = md?.organization?.team?.members?.pageInfo;
        memberCursor = pi?.hasNextPage ? pi?.endCursor : null;
      } while (memberCursor);

      out.push({ slug: t.slug, name: t.name, members });
    }

    const pi = d?.organization?.teams?.pageInfo;
    teamCursor = pi?.hasNextPage ? pi?.endCursor : null;
  } while (teamCursor);

  return out;
}

type MemberContributionNode = {
  login?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  contributionsCollection?: {
    totalCommitContributions?: number | null;
    totalPullRequestContributions?: number | null;
    totalPullRequestReviewContributions?: number | null;
    commitContributionsByRepository?: Array<{
      repository?: { nameWithOwner?: string | null } | null;
      contributions?: { totalCount?: number | null } | null;
    }> | null;
    pullRequestContributionsByRepository?: Array<{
      repository?: { nameWithOwner?: string | null } | null;
      contributions?: { totalCount?: number | null } | null;
    }> | null;
    pullRequestReviewContributionsByRepository?: Array<{
      repository?: { nameWithOwner?: string | null } | null;
      contributions?: { totalCount?: number | null } | null;
    }> | null;
  } | null;
};

function addToMap(map: Map<string, number>, key: string, amount: number) {
  if (!key || !Number.isFinite(amount) || amount <= 0) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function recordUserStat(
  map: Map<string, OrgStatUser>,
  login: string,
  name: string | null,
  avatarUrl: string | null,
  count: number
) {
  if (!login || !Number.isFinite(count) || count <= 0) return;
  const existing = map.get(login);
  if (!existing || count > existing.count) {
    map.set(login, { login, name: name ?? undefined, avatarUrl: avatarUrl ?? undefined, count });
  }
}

function mapToTopUsers(map: Map<string, OrgStatUser>, limit = 3) {
  return [...map.values()].filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count).slice(0, limit);
}

function mapToTopRepos(map: Map<string, number>, limit = 3): OrgStatRepo[] {
  return [...map.entries()]
    .map(([nameWithOwner, count]) => ({ nameWithOwner, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function ghOrgStats(org: string, window: "24h" | "7d" | "30d"): Promise<OrgStats> {
  const since = buildSinceISO(window);
  const staleSince = buildSinceISOFromDays(STALE_PR_WINDOW_DAYS);

  const SEARCH_Q = `
    query($open:String!, $stale:String!, $opened:String!, $merged:String!, $closed:String!) {
      open: search(query:$open, type:ISSUE) { issueCount }
      stale: search(query:$stale, type:ISSUE) { issueCount }
      opened: search(query:$opened, type:ISSUE) { issueCount }
      merged: search(query:$merged, type:ISSUE) { issueCount }
      closed: search(query:$closed, type:ISSUE) { issueCount }
    }
  `;

  const searchData = await runGraphQL(SEARCH_Q, {
    open: `org:${org} is:pr is:open`,
    stale: `org:${org} is:pr is:open updated:<${staleSince}`,
    opened: `org:${org} is:pr created:>=${since}`,
    merged: `org:${org} is:pr is:merged merged:>=${since}`,
    closed: `org:${org} is:pr is:closed -is:merged closed:>=${since}`,
  });

  const totals = {
    openPRs: Number(searchData?.open?.issueCount ?? 0) || 0,
    stalePRs: Number(searchData?.stale?.issueCount ?? 0) || 0,
    prsOpened: Number(searchData?.opened?.issueCount ?? 0) || 0,
    prsMerged: Number(searchData?.merged?.issueCount ?? 0) || 0,
    prsClosed: Number(searchData?.closed?.issueCount ?? 0) || 0,
    commits: 0,
    commitRepos: 0,
    reviews: 0,
    reviewRepos: 0,
  } satisfies OrgStats["totals"];

  const orgId = await getOrgId(org);
  const orgLower = org.toLowerCase();

  const MEMBERS_PER_PAGE = Math.min(100, Math.max(1, Number(process.env.ORG_STATS_MEMBERS_PER_PAGE ?? 50)));
  const REPO_LIMIT = Math.min(100, Math.max(1, Number(process.env.ORG_STATS_REPO_LIMIT ?? 50)));

  const MEMBERS_Q = `
    query($org:String!, $since:DateTime!, $orgId:ID!, $cursor:String) {
      organization(login:$org) {
        membersWithRole(first:${MEMBERS_PER_PAGE}, after:$cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            login
            name
            avatarUrl(size:96)
            contributionsCollection(from:$since, organizationID:$orgId) {
              totalCommitContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              commitContributionsByRepository(maxRepositories:${REPO_LIMIT}) {
                repository { nameWithOwner }
                contributions { totalCount }
              }
              pullRequestContributionsByRepository(maxRepositories:${REPO_LIMIT}) {
                repository { nameWithOwner }
                contributions { totalCount }
              }
              pullRequestReviewContributionsByRepository(maxRepositories:${REPO_LIMIT}) {
                repository { nameWithOwner }
                contributions { totalCount }
              }
            }
          }
        }
      }
    }
  `;

  const members: MemberContributionNode[] = [];
  let cursor: string | null = null;

  do {
    const data = await runGraphQL(MEMBERS_Q, { org, since, cursor, orgId });
    const connection = data?.organization?.membersWithRole;
    const nodes = (connection?.nodes ?? []) as MemberContributionNode[];
    members.push(...nodes);
    const pageInfo = connection?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo?.endCursor ?? null : null;
  } while (cursor);

  const reviewerStats = new Map<string, OrgStatUser>();
  const committerStats = new Map<string, OrgStatUser>();
  const prOpenerStats = new Map<string, OrgStatUser>();

  const repoReviews = new Map<string, number>();
  const repoCommits = new Map<string, number>();
  const repoPROpens = new Map<string, number>();

  for (const member of members) {
    const login = member?.login ?? null;
    if (!login) continue;
    const name = member?.name ?? null;
    const avatarUrl = member?.avatarUrl ?? null;
    const contrib = member?.contributionsCollection ?? null;

    const commitCount = Number(contrib?.totalCommitContributions ?? 0) || 0;
    const prCount = Number(contrib?.totalPullRequestContributions ?? 0) || 0;
    const reviewCount = Number(contrib?.totalPullRequestReviewContributions ?? 0) || 0;

    totals.commits += commitCount;
    totals.reviews += reviewCount;

    recordUserStat(reviewerStats, login, name, avatarUrl, reviewCount);
    recordUserStat(committerStats, login, name, avatarUrl, commitCount);
    recordUserStat(prOpenerStats, login, name, avatarUrl, prCount);

    const commitRepos = contrib?.commitContributionsByRepository ?? [];
    for (const entry of commitRepos ?? []) {
      const slug = entry?.repository?.nameWithOwner ?? "";
      if (!slug || slug.split("/")[0]?.toLowerCase() !== orgLower) continue;
      const count = Number(entry?.contributions?.totalCount ?? 0) || 0;
      addToMap(repoCommits, slug, count);
    }

    const prRepos = contrib?.pullRequestContributionsByRepository ?? [];
    for (const entry of prRepos ?? []) {
      const slug = entry?.repository?.nameWithOwner ?? "";
      if (!slug || slug.split("/")[0]?.toLowerCase() !== orgLower) continue;
      const count = Number(entry?.contributions?.totalCount ?? 0) || 0;
      addToMap(repoPROpens, slug, count);
    }

    const reviewRepos = contrib?.pullRequestReviewContributionsByRepository ?? [];
    for (const entry of reviewRepos ?? []) {
      const slug = entry?.repository?.nameWithOwner ?? "";
      if (!slug || slug.split("/")[0]?.toLowerCase() !== orgLower) continue;
      const count = Number(entry?.contributions?.totalCount ?? 0) || 0;
      addToMap(repoReviews, slug, count);
    }
  }

  const topReviewers = mapToTopUsers(reviewerStats);
  const topCommitters = mapToTopUsers(committerStats);
  const topPROpeners = mapToTopUsers(prOpenerStats);

  totals.commitRepos = repoCommits.size;
  totals.reviewRepos = repoReviews.size;

  return {
    since,
    totals,
    topUsers: {
      reviewer: topReviewers,
      committer: topCommitters,
      prOpener: topPROpeners,
    },
    topRepos: {
      reviews: mapToTopRepos(repoReviews),
      commits: mapToTopRepos(repoCommits),
      prsOpened: mapToTopRepos(repoPROpens),
    },
  } satisfies OrgStats;
}
