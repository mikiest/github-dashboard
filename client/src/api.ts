import axios from 'axios'
import type { Repo, PREnriched, ReviewerStat } from './types'

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
  repos: string[],
  window: '24h' | '7d' | '30d'
): Promise<{ since: string; reviewers: ReviewerStat[] }> {
  const { data } = await axios.post(`/api/reviewers/top`, { org, repos, window })
  return data
}
