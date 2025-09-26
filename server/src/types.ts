
export interface Repo {
  name: string;
  fullName: string;
  description?: string | null;
  isPrivate: boolean;
  updatedAt?: string | null;
  pushedAt?: string | null;
}

export interface PRLight {
  id: string; // repo#number
  number: number;
  repo: string; // ORG/REPO
  title: string;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  baseRefName: string;
  headRefName: string;
  requestedReviewers: string[];
  approvals: number;
}

export interface PREnriched extends PRLight {
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  lastReviewedAt?: string | null;
  state?: 'open' | 'merged';
  mergedAt?: string | null;
  closedAt?: string | null;
}

export interface ReviewerStat {
  user: string;
  displayName?: string | null;
  total: number;
  approvals: number;
  changesRequested: number;
  comments: number;
  lastReviewAt?: string | null;
  repos: string[]; // distinct repos they reviewed in (nameWithOwner or full slug)
  commitTotal: number;
  commitRepos: string[];
}
export interface TeamMember { login: string; name?: string | null }
export interface OrgTeam { slug: string; name: string; members: TeamMember[] }
