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

export async function ghTopReviewers(
  org: string,
  repos: string[],
  window: "24h" | "7d" | "30d"
): Promise<{ since: string; reviewers: ReviewerStat[] }> {
  const since = buildSinceISO(window);
  const REPO_BATCH = Number(process.env.REPO_BATCH ?? 6); // keep search queries short
  const SEARCH_PAGE_LIMIT = Number(process.env.SEARCH_PAGE_LIMIT ?? 5); // up to 500 PRs/batch

  // Build batches of repos to avoid query-length limits
  const repoBatches = batch(repos, REPO_BATCH);

  type NodePR = {
    number: number;
    url: string;
    repository: { nameWithOwner: string };
    reviews: { nodes: Array<{ state: string; author?: { login?: string }; submittedAt?: string; updatedAt?: string }> };
  };

  const counts = new Map<string, {
    user: string; approvals: number; displayName: string; changesRequested: number; comments: number; commented: number; lastReviewAt: string|null; repos: Set<string>;
  }>();

  // GraphQL query with variables for search/pagination
  const QUERY = `
    query($q:String!, $cursor:String) {
      rateLimit { remaining resetAt cost }
      search(query:$q, type: ISSUE, first: 100, after:$cursor) {
        issueCount
        pageInfo { hasNextPage endCursor }
        nodes {
          ... on PullRequest {
            number
            url
            repository { nameWithOwner }
            reviews(first: 100) {
              pageInfo { hasNextPage endCursor }
              nodes {
                state
                author {
                  login
                  ... on User { name }
                }
                submittedAt
                updatedAt
                comments {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  `;

  for (const batchRepos of repoBatches) {
    // search string: org + date + repos
    const repoQuals = batchRepos.map(r => `repo:${org}/${r}`).join(" ");
    const qBase = `org:${org} is:pr updated:>=${since} ${repoQuals}`.trim();

    let cursor: string | null = null;
    for (let page = 0; page < SEARCH_PAGE_LIMIT; page++) {
      const data = await runGraphQL(QUERY, { q: qBase, cursor: cursor ?? "" });
      const search = data.search;
      const nodes = (search?.nodes ?? []) as NodePR[];

      for (const pr of nodes) {
        const repoSlug = pr.repository?.nameWithOwner ?? `${org}`;
        const revNodes = pr.reviews?.nodes ?? [];
        for (const r of revNodes) {
          const when = r.submittedAt ?? r.updatedAt ?? null;
          if (!when || when < since) continue; // outside window
          const user = r.author?.login ?? "unknown";
          const name = (r.author as any)?.name ?? null;

          if (!counts.has(user)) {
            counts.set(user, {
              user,
              approvals: 0,
              changesRequested: 0,
              commented: 0,
              comments: 0,
              lastReviewAt: null,
              repos: new Set<string>(),
              displayName: name,
            } as any);
          }
          const entry = counts.get(user)! as any;
          if (name && !entry.displayName) entry.displayName = name;

          if (r.state === "APPROVED") entry.approvals++;
          else if (r.state === "CHANGES_REQUESTED") entry.changesRequested++;
          else if (r.state === "COMMENTED") {
            entry.commented++;
          }
          entry.comments += ((r as any).comments?.totalCount ?? 0); 

          if (!entry.lastReviewAt || when > entry.lastReviewAt) entry.lastReviewAt = when;
          entry.repos.add(repoSlug);
        }
      }

      if (!search?.pageInfo?.hasNextPage) break;
      cursor = search.pageInfo.endCursor;
    }
  }

  const reviewers: ReviewerStat[] = Array.from(counts.values()).map(e => ({
    user: e.user,
    displayName: e.displayName ?? null,
    total: e.approvals + e.changesRequested + e.commented,
    approvals: e.approvals,
    changesRequested: e.changesRequested,
    comments: e.comments,
    commented: e.commented,
    lastReviewAt: e.lastReviewAt,
    repos: Array.from(e.repos).sort(),
  }))
  .sort((a,b) => b.total - a.total || (b.lastReviewAt??'').localeCompare(a.lastReviewAt??''));

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
