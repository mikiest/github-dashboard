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
    prsOpened: number
    prsMerged: number
    commits: number
    reviews: number
  }
  topUsers: {
    reviewer: OrgStatUser | null
    committer: OrgStatUser | null
    prOpener: OrgStatUser | null
  }
  topRepos: {
    reviews: OrgStatRepo | null
    commits: OrgStatRepo | null
    contributions: OrgStatRepo | null
  }
}
