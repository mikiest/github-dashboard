
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
  stalePRs: number;
  prsOpened: number;
  prsMerged: number;
  prsClosed: number;
  commits: number;
  commitRepos: number;
  reviews: number;
  reviewRepos: number;
}

export interface OrgStats {
  since: string;
  totals: OrgStatsSummary;
  topUsers: {
    reviewer: OrgStatUser[];
    committer: OrgStatUser[];
    prOpener: OrgStatUser[];
  };
  topRepos: {
    reviews: OrgStatRepo[];
    commits: OrgStatRepo[];
    prsOpened: OrgStatRepo[];
  };
}

export type ActivityType = "commit" | "review" | "merge";

export interface ActivityUser {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface ActivityCommitData {
  type: "commit";
  branch?: string | null;
  commitCount: number;
  message?: string | null;
  sha?: string | null;
  url?: string | null;
}

export interface ActivityReviewData {
  type: "review";
  state: string;
  prNumber: number;
  prTitle?: string | null;
  prUrl?: string | null;
  author?: ActivityUser | null;
}

export interface ActivityMergeData {
  type: "merge";
  prNumber: number;
  prTitle?: string | null;
  prUrl?: string | null;
  author?: ActivityUser | null;
  mergedBy?: ActivityUser | null;
}

export type ActivityItem =
  | {
      id: string;
      type: "commit";
      occurredAt: string;
      repo: string;
      actor: ActivityUser;
      data: ActivityCommitData;
    }
  | {
      id: string;
      type: "review";
      occurredAt: string;
      repo: string;
      actor: ActivityUser;
      data: ActivityReviewData;
    }
  | {
      id: string;
      type: "merge";
      occurredAt: string;
      repo: string;
      actor: ActivityUser;
      data: ActivityMergeData;
    };

export interface ActivityResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}
