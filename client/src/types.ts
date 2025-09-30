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

export type ActivityType = 'pr_opened' | 'pr_closed' | 'pr_merged' | 'review'

export type ActivityUser = {
  login: string
  name?: string | null
  avatarUrl?: string | null
}

export type ActivityPROpenedData = {
  type: 'pr_opened'
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
}

export type ActivityPRClosedData = {
  type: 'pr_closed'
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
  closedBy?: ActivityUser | null
}

export type ActivityReviewData = {
  type: 'review'
  state: string
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
}

export type ActivityPRMergedData = {
  type: 'pr_merged'
  prNumber: number
  prTitle?: string | null
  prUrl?: string | null
  author?: ActivityUser | null
  mergedBy?: ActivityUser | null
  commitCount?: number | null
}

export type ActivityItem =
  | { id: string; type: 'review'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityReviewData }
  | { id: string; type: 'pr_opened'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityPROpenedData }
  | { id: string; type: 'pr_closed'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityPRClosedData }
  | { id: string; type: 'pr_merged'; occurredAt: string; repo: string; actor: ActivityUser; data: ActivityPRMergedData }

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
