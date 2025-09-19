import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopReviewers } from '../api'
import type { ReviewerStat } from '../types'

type Props = {
  org: string
  favorites: string[]
  windowSel: '24h'|'7d'|'30d'
  selectedUsers: string[]
  onChangeSelected: (users: string[]) => void
}

export default function ReviewersSidebar({ org, favorites, windowSel, selectedUsers, onChangeSelected }: Props) {
  const { data, isFetching } = useQuery({
    queryKey: ['top-reviewers', org, windowSel, ...[...favorites].sort()],
    queryFn: () => fetchTopReviewers(org, favorites, windowSel),
    enabled: !!org && favorites.length > 0,
    refetchOnWindowFocus: true,
  })

  const allUsers = useMemo(() => {
    const uniq = new Map<string, string | null>()
    for (const r of (data?.reviewers ?? []) as ReviewerStat[]) {
      uniq.set(r.user, r.displayName ?? null)
    }
    return Array.from(uniq.entries())
  }, [data])

  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!ql) return allUsers
    return allUsers.filter(([login, name]) =>
      login.toLowerCase().includes(ql) || (name ?? '').toLowerCase().includes(ql)
    )
  }, [allUsers, ql])

  const toggle = (login: string) => {
    onChangeSelected(
      selectedUsers.includes(login)
        ? selectedUsers.filter(x => x !== login)
        : [...selectedUsers, login]
    )
  }

  const clear = () => onChangeSelected([])
  const selectAll = () => onChangeSelected(filtered.map(([login]) => login))

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs uppercase tracking-wider text-zinc-400">Filter reviewers</label>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search users…"
          className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button onClick={selectAll} className="px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800">Select all</button>
        <button onClick={clear} className="px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800">Clear</button>
        {isFetching && <span className="ml-auto text-zinc-400">Loading…</span>}
      </div>

      <div className="max-h-80 overflow-auto pr-2">
        {filtered.map(([login, name]) => {
          const on = selectedUsers.includes(login)
          return (
            <label key={login} className="flex items-center justify-between py-2 border-b border-zinc-800">
              <div className="min-w-0">
                <div className="truncate font-medium">{login}</div>
                {name && <div className="text-xs text-zinc-400 truncate">{name}</div>}
              </div>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(login)}
                className="accent-brand-500"
              />
            </label>
          )
        })}
        {filtered.length === 0 && <div className="text-sm text-zinc-400 py-4">No users.</div>}
      </div>
    </div>
  )
}
