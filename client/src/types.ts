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
