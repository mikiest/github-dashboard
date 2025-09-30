import axios from 'axios'
import type { Repo, PREnriched, ReviewerStat, OrgTeam, ViewerInfo, OrgMember, OrgStats, ActivityResponse, ActivityRequest } from './types'

export async function fetchRepos(org: string): Promise<Repo[]> {
  const { data } = await axios.get<{ repos: Repo[] }>(`/api/orgs/${encodeURIComponent(org)}/repos`)
  return data.repos
}

export async function fetchPRs(org: string, repos: string[], states: ('open'|'merged')[] = ['open'], window: '24h' | '7d' | '30d'): Promise<PREnriched[]> {
  const { data } = await axios.post<{ prs: PREnriched[] }>(`/api/prs`, { org, repos, states, window })
  return data.prs
}

export async function fetchTopReviewers(
  org: string,
  window: '24h' | '7d' | '30d',
  users?: string[]
): Promise<{ since: string; reviewers: ReviewerStat[] }> {
  const payload: {
    org: string
    window: '24h' | '7d' | '30d'
    users?: string[]
  } = { org, window }

  if (users?.length) {
    payload.users = users
  }

  const { data } = await axios.post(`/api/reviewers/top`, payload)
  return data
}

export async function fetchTeams(org: string): Promise<OrgTeam[]> {
  const { data } = await axios.get<{ teams: OrgTeam[] }>(`/api/orgs/${encodeURIComponent(org)}/teams`)
  return data.teams
}

export async function fetchViewer(): Promise<ViewerInfo> {
  const { data } = await axios.get<{ viewer: ViewerInfo }>(`/api/viewer`)
  return data.viewer
}

export async function fetchOrgMembers(org: string): Promise<OrgMember[]> {
  const { data } = await axios.get<{ members: OrgMember[] }>(`/api/orgs/${encodeURIComponent(org)}/members`)
  return data.members
}

export async function fetchOrgStats(org: string, window: '24h'|'7d'|'30d'): Promise<OrgStats> {
  const { data } = await axios.post<{ stats: OrgStats }>(`/api/orgs/${encodeURIComponent(org)}/stats`, { window })
  return data.stats
}

export async function fetchActivity(org: string, params: ActivityRequest): Promise<ActivityResponse> {
  const payload: Record<string, unknown> = {}
  if (params.types?.length) payload.types = params.types
  const repo = params.repo?.trim()
  if (repo) payload.repo = repo
  const username = params.username?.trim()
  if (username) payload.username = username
  const fullname = params.fullname?.trim()
  if (fullname) payload.fullname = fullname
  if (params.cursor) payload.cursor = params.cursor
  if (params.pageSize) payload.pageSize = params.pageSize

  const { data } = await axios.post<ActivityResponse>(`/api/orgs/${encodeURIComponent(org)}/activity`, payload)
  return data
}
