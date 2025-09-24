import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopCommitters } from '../api'
import type { CommitterStat } from '../types'
import { ageClass, fromNow, short } from '../lib_time'

type Props = {
  org: string
  favorites: string[]
  windowSel: '24h'|'7d'|'30d'
  onChangeWindow: (window: '24h'|'7d'|'30d') => void
}

export default function CommittersView({ org, favorites, windowSel, onChangeWindow }: Props) {
  const { data, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['top-committers', org, windowSel, ...[...favorites].sort()],
    queryFn: () => fetchTopCommitters(org, favorites, windowSel),
    enabled: !!org && favorites.length > 0,
    refetchOnWindowFocus: true,
  })

  const committers = (data?.committers ?? []) as CommitterStat[]
  const sorted = useMemo(
    () => [...committers].sort((a,b) => b.commits - a.commits || (b.lastCommitAt ?? '').localeCompare(a.lastCommitAt ?? '')),
    [committers]
  )

  const since = data?.since

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
          {(['24h','7d','30d'] as const).map(w => (
            <button
              key={w}
              onClick={() => onChangeWindow(w)}
              aria-pressed={windowSel === w}
              className={`px-3 py-1 text-xs transition ${
                windowSel === w ? 'bg-brand-500/20' : 'hover:bg-zinc-800'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800 inline-flex items-center gap-2"
        >
          Refresh
          {isFetching && (
            <span className="inline-block w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {isError ? (
          <div className="text-red-300">Error: {(error as Error).message}</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-zinc-400">No commits in this window.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr className="text-left">
                <th className="py-2">Committer</th>
                <th className="py-2">Commits</th>
                <th className="py-2">➕</th>
                <th className="py-2">➖</th>
                <th className="py-2">Repos</th>
                <th className="py-2">Last commit</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.user + i} className="border-t border-zinc-800">
                  <td className="py-2 font-medium">
                    <span aria-hidden className="mr-1 text-[16px] leading-none align-middle">{medal(i)}</span>
                    <a
                      href={`https://github.com/${encodeURIComponent(c.user)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 hover:opacity-90"
                      title={`Open ${c.user} on GitHub`}
                    >
                      {c.user}
                    </a>
                    {c.displayName && (
                      <div className="text-xs text-zinc-400">{c.displayName}</div>
                    )}
                  </td>
                  <td className="py-2">{c.commits}</td>
                  <td className="py-2">{c.additions}</td>
                  <td className="py-2">{c.deletions}</td>
                  <td className="py-2">{c.repos.length}</td>
                  <td className="py-2">
                    {c.lastCommitAt ? (
                      <span className={ageClass(c.lastCommitAt)} title={short(c.lastCommitAt)}>
                        {fromNow(c.lastCommitAt)}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {since && <div className="mt-3 text-xs text-zinc-500">Since {short(since)}</div>}
      </div>
    </div>
  )
}
