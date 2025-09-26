
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
}

export interface TeamMember {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface OrgTeam {
  slug: string;
  name: string;
  members: TeamMember[];
}

export interface OrgMember {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface ViewerOrg {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface ViewerInfo {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  organizations: ViewerOrg[];
}

export interface OrgStatUser {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  count: number;
}

export interface OrgStatRepo {
  nameWithOwner: string;
  count: number;
}

export interface OrgStatsSummary {
  openPRs: number;
  prsOpened: number;
  prsMerged: number;
  commits: number;
  reviews: number;
}

export interface OrgStats {
  since: string;
  totals: OrgStatsSummary;
  topUsers: {
    reviewer: OrgStatUser | null;
    committer: OrgStatUser | null;
    prOpener: OrgStatUser | null;
  };
  topRepos: {
    reviews: OrgStatRepo | null;
    commits: OrgStatRepo | null;
    contributions: OrgStatRepo | null;
  };
}
