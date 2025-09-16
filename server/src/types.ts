
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
}
