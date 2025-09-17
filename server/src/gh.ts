import { execa } from "execa";
import type { PREnriched, PRLight, Repo } from "./types";

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

async function runGraphQL(query: string): Promise<any> {
  const { stdout } = await execa(ghBin, ["api", "graphql", "-f", `query=${query}`]);
  // gh returns a top-level JSON with "data" field
  const parsed = JSON.parse(stdout);
  return parsed.data ?? parsed;
}

export async function ghPRsAcross(
  org: string,
  repos: string[],
  _withEnrich = true,                       // kept for signature compatibility
  states: ("open" | "merged")[] = ["open"]
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

  return all;
}
