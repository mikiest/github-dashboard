import { execa } from "execa";
import type { PREnriched, Repo, ReviewerStat } from "./types.js";

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
    commitContributionsByRepository(maxRepositories: 100) {
      contributions(first:100) {
        nodes {
          commitCount
          repository {
            name
            nameWithOwner
          }
        }
      }
    }
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
      commitTotal: Number(
        userNode?.contributionsCollection?.totalCommitContributions ?? 0
      ),
      commitRepos: new Set<string>(),
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

    type CommitContributionNode = {
      commitCount?: number | null;
      repository?: { name?: string | null; nameWithOwner?: string | null } | null;
    };

    const commitBuckets = (
      userNode?.contributionsCollection?.commitContributionsByRepository ?? []
    ) as { contributions?: { nodes?: CommitContributionNode[] | null } | null }[];

    let commitTotalFromNodes = 0;

    for (const bucket of commitBuckets) {
      const nodes = bucket?.contributions?.nodes ?? [];
      for (const node of nodes ?? []) {
        const count = Number(node?.commitCount ?? 0);
        if (!Number.isNaN(count) && count > 0) {
          commitTotalFromNodes += count;
        }
        const repoSlug =
          node?.repository?.nameWithOwner ?? node?.repository?.name ?? null;
        if (repoSlug) {
          entry.commitRepos.add(repoSlug);
        }
      }
    }

    if (commitTotalFromNodes > 0) {
      entry.commitTotal = commitTotalFromNodes;
    } else if (!Number.isFinite(entry.commitTotal)) {
      entry.commitTotal = 0;
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
      commitTotal: entry.commitTotal,
      commitRepos: Array.from(entry.commitRepos).sort(),
    }))
    .sort((a, b) => b.total - a.total || (b.lastReviewAt ?? "").localeCompare(a.lastReviewAt ?? ""));

  return { since, reviewers };
}

export async function ghOrgTeams(org: string): Promise<import("./types.js").OrgTeam[]> {
  const TEAMS_PER_PAGE = Number(process.env.TEAMS_PER_PAGE ?? 50);
  const MEMBERS_PER_PAGE = Number(process.env.TEAM_MEMBERS_PER_PAGE ?? 100);

  const out: import("./types.js").OrgTeam[] = [];
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
            nodes { login ... on User { name } }
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
      const members: { login: string; name?: string|null }[] = [];
      let memberCursor: string | null = null;
      do {
        const md = await runGraphQL(MEMBERS_Q, { org, slug: t.slug, memberCursor });
        const nodes = md?.organization?.team?.members?.nodes ?? [];
        for (const m of nodes) members.push({ login: m.login, name: m.name ?? null });
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
