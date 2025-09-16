import { execa } from "execa";
import pLimit from "p-limit";
import type { PREnriched, PRLight, Repo } from "./types.js";

const limit = pLimit(6); // avoid hammering the API

function toJson<T>(stdout: string): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (e) {
    throw new Error(`Failed to parse gh JSON: ${(e as Error).message}`);
  }
}

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
  const repos = toJson<any[]>(stdout);
  return repos.map(r => ({
    name: r.name,
    fullName: `${org}/${r.name}`,
    description: r.description ?? null,
    isPrivate: !!r.isPrivate,
    updatedAt: r.updatedAt ?? null,
    pushedAt: r.pushedAt ?? null,
  }));
}

type PRListItem = {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  baseRefName: string;
  headRefName: string;
  author: { login: string };
  reviewRequests?: { nodes?: { requestedReviewer?: { login?: string } }[] };
  reviews?: { nodes?: { state?: string, author?: { login?: string } }[] };
};

export async function ghPRs(org: string, repo: string): Promise<PRLight[]> {
  const repoSlug = `${org}/${repo}`;
  const { stdout } = await execa("gh", [
    "pr",
    "list",
    "-R",
    repoSlug,
    "--state",
    "open",
    "--limit",
    "100",
    "--json",
    "number,title,url,isDraft,createdAt,updatedAt,baseRefName,headRefName,author,reviewRequests,reviews",
  ]);
  const items = toJson<PRListItem[]>(stdout);
  return items.map(pr => {
    const approvals = pr.reviews?.nodes?.filter(n => n.state === "APPROVED").length ?? 0;
    const requestedReviewers = (pr.reviewRequests?.nodes ?? [])
      .map(n => n?.requestedReviewer?.login)
      .filter(Boolean) as string[];

    return {
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
    };
  });
}

type PRView = {
  additions?: number;
  deletions?: number;
  changedFiles?: number;
};

export async function ghPREnrich(pr: PRLight): Promise<PREnriched> {
  const { stdout } = await execa("gh", [
    "pr",
    "view",
    String(pr.number),
    "-R",
    pr.repo,
    "--json",
    "additions,deletions,changedFiles",
  ]);
  const detail = toJson<PRView>(stdout);
  return { ...pr, ...detail };
}

export async function ghPRsAcross(org: string, repos: string[], withEnrich = true): Promise<PREnriched[]> {
  const lists = await Promise.all(repos.map(repo => ghPRs(org, repo)));
  const flat = lists.flat();
  if (!withEnrich) return flat;
  const enriched = await Promise.all(flat.map(pr => limit(() => ghPREnrich(pr))));
  return enriched;
}
