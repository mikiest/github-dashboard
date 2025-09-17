import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopReviewers } from '../api'
import type { ReviewerStat } from '../types'
import { fromNow, short, ageClass } from '../lib_time'

type Props = {
  org: string
  favorites: string[] // repo names only
}

export default function ReviewersView({ org, favorites }: Props) {
  const [windowSel, setWindowSel] = useState<'24h'|'7d'|'30d'>('24h')

  // selection is constrained to favorites; auto-sync when favorites change
  const [selected, setSelected] = useState<string[]>([...favorites])
  useEffect(() => {
    setSelected(prev => {
      const next = prev.filter(n => favorites.includes(n))
      return next.length ? next : [...favorites]
    })
  }, [favorites])

  const toggleRepo = (name: string) => {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const { data, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['top-reviewers', org, windowSel, ...selected.sort()],
    queryFn: () => fetchTopReviewers(org, selected, windowSel),
    enabled: !!org && selected.length > 0,
    refetchOnWindowFocus: true
  })

  const reviewers = (data?.reviewers ?? []) as ReviewerStat[]
  // sort defensively (server already sorts)
  const sorted = useMemo(
    () => [...reviewers].sort((a,b) => b.total - a.total || (b.lastReviewAt ?? '').localeCompare(a.lastReviewAt ?? '')),
    [reviewers]
  )
  const since = data?.since

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '')

  return (
    <div className="space-y-4">
      {/* Top controls: repo filter + window + refresh */}
      <div className="flex flex-col gap-3">
        {/* Repo filter chips (from favorites) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Repos:</span>
          {favorites.map(name => {
            const on = selected.includes(name)
            return (
              <button key={name}
                onClick={() => toggleRepo(name)}
                className={`text-xs px-2 py-1 rounded-full border ${on ? 'border-brand-400 bg-brand-500/20' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                {org}/{name}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
            {(['24h','7d','30d'] as const).map(w => (
              <button key={w}
                onClick={() => setWindowSel(w)}
                className={`px-3 py-1 text-xs ${windowSel===w ? 'bg-brand-500/20' : ''}`}>
                {w}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()}
            className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800 inline-flex items-center gap-2">
            Refresh
            {isFetching && <span className="inline-block w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />}
          </button>
        </div>
      </div>

      {/* Table (no repos column) */}
      <div className="card p-4 overflow-x-auto">
        {isError ? (
          <div className="text-red-300">Error: {(error as Error).message}</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-zinc-400">No reviews in this window.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr className="text-left">
                <th className="py-2">Reviewer</th>
                <th className="py-2">Total</th>
                <th className="py-2">Approved</th>
                <th className="py-2">Changes</th>
                <th className="py-2">Comments</th>
                <th className="py-2">Last review</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.user} className="border-t border-zinc-800">
                  <td className="py-2 font-medium">
                    <span className="mr-1">{medal(i)}</span>
                    <a
                      href={`https://github.com/${encodeURIComponent(r.user)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-2"
                      title={`Open ${r.user} on GitHub`}
                    >
                      {r.user}
                    </a>
                  </td>
                  <td className="py-2">{r.total}</td>
                  <td className="py-2">{r.approvals}</td>
                  <td className="py-2">{r.changesRequested}</td>
                  <td className="py-2">{r.comments}</td>
                  <td className="py-2">
                    {r.lastReviewAt ? (
                      <span className={ageClass(r.lastReviewAt)} title={short(r.lastReviewAt)}>
                        {fromNow(r.lastReviewAt)}
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
