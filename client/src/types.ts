export type Repo = {
  name: string
  fullName: string
  description?: string | null
  isPrivate: boolean
  updatedAt?: string | null
  pushedAt?: string | null
}

export type PREnriched = {
  id: string
  number: number
  repo: string
  title: string
  url: string
  author: string
  createdAt: string
  updatedAt: string
  isDraft: boolean
  baseRefName: string
  headRefName: string
  requestedReviewers: string[]
  approvals: number
  additions?: number
  deletions?: number
  changedFiles?: number
  lastReviewedAt?: string | null
  state?: 'open' | 'merged'
  mergedAt?: string | null
  closedAt?: string | null
}

export type ReviewerStat = {
  user: string
  displayName?: string | null
  total: number
  approvals: number
  changesRequested: number
  comments: number
  commented: number
  lastReviewAt?: string | null
  repos: string[]
}

export type TeamMember = { login: string; name?: string | null; avatarUrl?: string | null }
export type OrgTeam = { slug: string; name: string; members: TeamMember[] }
export type OrgMember = { login: string; name?: string | null; avatarUrl?: string | null }
export type ViewerOrg = { login: string; name?: string | null; avatarUrl?: string | null }
export type ViewerInfo = { login: string; name?: string | null; avatarUrl?: string | null; organizations: ViewerOrg[] }

export type OrgStatUser = {
  login: string
  name?: string | null
  avatarUrl?: string | null
  count: number
}

export type OrgStatRepo = {
  nameWithOwner: string
  count: number
}

export type OrgStats = {
  since: string
  totals: {
    openPRs: number
    stalePRs: number
    prsOpened: number
    prsMerged: number
    prsClosed: number
    commits: number
    commitRepos: number
    reviews: number
    reviewRepos: number
  }
  topUsers: {
    reviewer: OrgStatUser[]
    committer: OrgStatUser[]
    prOpener: OrgStatUser[]
  }
  topRepos: {
    reviews: OrgStatRepo[]
    commits: OrgStatRepo[]
    prsOpened: OrgStatRepo[]
  }
}

export type ActivityType = 'commit' | 'review' | 'merge'

export type ActivityUser = {
  login: string
  name?: string | null
  avatarUrl?: string | null
}

export type ActivityCommitData = {
  type: 'commit'
  branch?: string | null
  commitCount: number
  message?: string | null
  sha?: string | null
  url?: string | null
}

export type ActivityReviewData = {
  type: 'review'
  state: string
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
}

export type ActivityMergeData = {
  type: 'merge'
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
  mergedBy?: ActivityUser | null
}

export type ActivityItem =
  | { id: string; type: 'commit'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityCommitData }
  | { id: string; type: 'review'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityReviewData }
  | { id: string; type: 'merge'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityMergeData }

export type ActivityResponse = {
  items: ActivityItem[]
  nextCursor?: string | null
}

export type ActivityRequest = {
  types?: ActivityType[]
  repo?: string
  username?: string
  fullname?: string
  cursor?: string | null
  pageSize?: number
}
