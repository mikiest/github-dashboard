import axios from 'axios'
import type { Repo, PREnriched, ReviewerStat, OrgTeam } from './types'

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
