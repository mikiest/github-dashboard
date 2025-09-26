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
  commitTotal: number
  commitRepos: string[]
}

export type TeamMember = { login: string; name?: string | null }
export type OrgTeam = { slug: string; name: string; members: TeamMember[] }
