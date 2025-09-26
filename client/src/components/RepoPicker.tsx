import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchRepos } from '../api'
import type { Repo } from '../types'
import { fromNow } from '../lib_time'

type Props = { org: string; favorites: string[]; onToggleFavorite: (repoName: string) => void }

export default function RepoPicker({ org, favorites, onToggleFavorite }: Props) {
  const [q, setQ] = useState('')
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['repos', org],
    queryFn: () => fetchRepos(org),
    enabled: !!org,
  })

  const repos = (data ?? []) as Repo[]
  const ql = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!ql) return repos
    return repos.filter(r =>
      r.name.toLowerCase().includes(ql) ||
      r.fullName.toLowerCase().includes(ql) ||
      (r.description ?? '').toLowerCase().includes(ql)
    )
  }, [repos, ql])

  
  if (!org) return <div className="text-sm text-zinc-400">Choose an organization to load repos.</div>
  if (isLoading) return <div>Loading repos…</div>
  if (isError) return <div className="text-red-300">Error: {(error as Error).message}</div>


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider text-zinc-400">Repositories</h3>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter repos…"
            className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={() => refetch()} className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800">
            Refresh {isFetching ? '…' : ''}
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-auto pr-2">
        {filtered.map((r) => {
          const fav = favorites.includes(r.name)
          return (
            <div key={r.fullName} className="flex items-center justify-between py-2 border-b border-zinc-800">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.fullName}</div>
                <div className="text-xs text-zinc-400">
                  updated {fromNow(r.updatedAt)} • pushed {fromNow(r.pushedAt)}
                </div>
              </div>
              <button
                onClick={() => onToggleFavorite(r.name)}
                className={`ml-3 px-3 py-1 rounded-full text-xs border ${fav ? 'border-brand-400 bg-brand-500/20' : 'border-zinc-700 hover:bg-zinc-800'}`}
                title={fav ? 'Unfavorite' : 'Favorite'}
              >
                {fav ? '★' : '☆'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
