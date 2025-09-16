import { useQuery } from '@tanstack/react-query'
import { fetchRepos } from '../api'
import type { Repo } from '../types'
import { fromNow } from '../lib_time'

type Props = {
  org: string
  favorites: string[]
  onToggleFavorite: (repoName: string) => void
}

export default function RepoPicker({ org, favorites, onToggleFavorite }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['repos', org],
    queryFn: () => fetchRepos(org),
    enabled: !!org,
  })

  if (!org) return <div className="text-sm text-zinc-400">Enter an org to load repos.</div>
  if (isLoading) return <div>Loading repos…</div>
  if (isError) return <div className="text-red-300">Error: {(error as Error).message}</div>

  const repos = (data ?? []) as Repo[]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider text-zinc-400">Repositories</h3>
        <button
          onClick={() => refetch()}
          className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800"
        >
          Refresh {isFetching ? '…' : ''}
        </button>
      </div>
      <div className="max-h-80 overflow-auto pr-2">
        {repos.map((r) => {
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
