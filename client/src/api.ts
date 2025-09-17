import axios from 'axios'
import type { Repo, PREnriched } from './types'

export async function fetchRepos(org: string): Promise<Repo[]> {
  const { data } = await axios.get<{ repos: Repo[] }>(`/api/orgs/${encodeURIComponent(org)}/repos`)
  return data.repos
}

export async function fetchPRs(org: string, repos: string[], states: ('open'|'merged')[] = ['open']): Promise<PREnriched[]> {
  const { data } = await axios.post<{ prs: PREnriched[] }>(`/api/prs`, { org, repos, states })
  return data.prs
}
