import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopReviewers } from '../api'
import type { ReviewerStat } from '../types'
import { fromNow, short, ageClass } from '../lib_time'
import { ReviewBar } from './ReviewBar'

type Props = {
  org: string
  selectedUsers: string[]
  hasSelection: boolean
  windowSel: '24h'|'7d'|'30d'
  onChangeSelected: (window: '24h'|'7d'|'30d') => void
}

export default function ReviewersView({ org, windowSel, selectedUsers, hasSelection, onChangeSelected }: Props) {
  const sortedUsers = useMemo(() => [...selectedUsers].sort((a, b) => a.localeCompare(b)), [selectedUsers])

  const { data, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['top-reviewers', org, windowSel, 'users', ...sortedUsers],
    queryFn: () => fetchTopReviewers(org, windowSel, sortedUsers),
    enabled: !!org,
    refetchOnWindowFocus: true,
  })

  const reviewers = (data?.reviewers ?? []) as ReviewerStat[]
  const filteredByUsers = useMemo(() => {
    if (!selectedUsers?.length) return reviewers
    const set = new Set(selectedUsers.map(s => s.toLowerCase()))
    return reviewers.filter(r => set.has(r.user.toLowerCase()))
  }, [reviewers, selectedUsers])

  const sorted = useMemo(
    () => [...filteredByUsers].sort((a,b) => b.total - a.total || (b.lastReviewAt ?? '').localeCompare(a.lastReviewAt ?? '')),
    [filteredByUsers]
  )

  const since = data?.since
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '')

  return (
    <div className="space-y-4">
      {/* Top controls: window + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
          {(['24h','7d','30d'] as const).map(w => (
            <button
              key={w}
              onClick={() => onChangeSelected(w)}
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
          <div className="text-sm text-zinc-400">
            {hasSelection ? 'No reviews in this window.' : 'Select at least one user or team to see reviewer stats.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr className="text-left">
                <th className="py-2">Reviewer</th>
                <th className="py-2">Total</th>
                <th className="py-2">Review mix</th>
                <th className="py-2">%</th>
                <th className="py-2">Last review</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const approvalPercent = r.total ? Math.round((r.approvals / r.total) * 100) : null
                return (
                  <tr key={r.user} className="border-t border-zinc-800">
                  <td className="py-2 font-medium">
                    <span aria-hidden className="mr-1 text-[16px] leading-none align-middle">{medal(i)}</span>
                    <a
                      href={`https://github.com/${encodeURIComponent(r.user)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 hover:opacity-90"
                      title={`Open ${r.user} on GitHub`}
                    >
                      {r.user}
                    </a>
                    {r.displayName && (
                      <div className="text-xs text-zinc-400">{r.displayName}</div>
                    )}
                  </td>
                  <td className="py-2 text-base font-semibold">{r.total}</td>
                  <td className="py-2 pr-6">
                    <ReviewBar approvals={r.approvals} changesRequested={r.changesRequested} commented={r.commented} />
                  </td>
                  <td className="py-2 text-base font-semibold">{approvalPercent === null ? '—' : approvalPercent}</td>
                  <td className="py-2">
                    {r.lastReviewAt ? (
                      <span className={ageClass(r.lastReviewAt)} title={short(r.lastReviewAt)}>
                        {fromNow(r.lastReviewAt)}
                      </span>
                    ) : '—'}
                  </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {since && <div className="mt-3 text-xs text-zinc-500">Since {short(since)}</div>}
      </div>
    </div>
  )
}
