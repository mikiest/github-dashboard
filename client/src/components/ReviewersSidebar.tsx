import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTopReviewers, fetchTeams, fetchTopCommitters } from '../api'
import type { ReviewerStat, OrgTeam, CommitterStat } from '../types'

type Props = {
  org: string
  favorites: string[]                   // used to scope reviewers query
  windowSel: '24h'|'7d'|'30d'
  selectedUsers: string[]               // controlled from parent
  selectedTeams: string[]               // team slugs
  onChangeUsers: (users: string[]) => void
  onChangeTeams: (teams: string[]) => void
  mode?: 'reviewers' | 'committers'
}

export default function ReviewersSidebar({
  org, favorites, windowSel,
  selectedUsers, selectedTeams,
  onChangeUsers, onChangeTeams,
  mode = 'reviewers'
}: Props) {
  type Person = { user: string; displayName: string | null }

  // reviewers/committers (to list users)
  const { data: people = [] } = useQuery<Person[]>({
    queryKey: [
      mode === 'reviewers' ? 'top-reviewers' : 'top-committers',
      org,
      windowSel,
      ...[...favorites].sort(),
    ],
    queryFn: async () => {
      if (mode === 'reviewers') {
        const res = await fetchTopReviewers(org, favorites, windowSel)
        const reviewers: ReviewerStat[] = res?.reviewers ?? []
        return reviewers.map(r => ({ user: r.user, displayName: r.displayName ?? null }))
      }
      const res = await fetchTopCommitters(org, favorites, windowSel)
      const committers: CommitterStat[] = res?.committers ?? []
      return committers.map(c => ({ user: c.user, displayName: c.displayName ?? null }))
    },
    enabled: !!org && favorites.length > 0,
    refetchOnWindowFocus: true,
  })

  const allUsers = useMemo(() => {
    const uniq = new Map<string, string | null>()
    for (const p of people) {
      if (!uniq.has(p.user)) {
        uniq.set(p.user, p.displayName)
      } else if (p.displayName && !uniq.get(p.user)) {
        uniq.set(p.user, p.displayName)
      }
    }
    return Array.from(uniq.entries())
      .map(([login, displayName]) => ({ login, displayName }))
      .sort((a,b) => {
        const an = a.displayName ?? a.login
        const bn = b.displayName ?? b.login
        return an.localeCompare(bn)
      })
  }, [people])

  // teams list
  const { data: teamsData, isFetching: teamsLoading } = useQuery({
    queryKey: ['org-teams', org],
    queryFn: () => fetchTeams(org),
    enabled: !!org,
    refetchOnWindowFocus: false,
  });
  const teams: OrgTeam[] = teamsData ?? []

  // tabs + search
  const [tab, setTab] = useState<'users'|'teams'>('users')
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()

  const filteredUsers = useMemo(() => {
    if (!ql) return allUsers
    return allUsers.filter(u => {
      const name = u.displayName?.toLowerCase() ?? ''
      return name.includes(ql) || u.login.toLowerCase().includes(ql)
    })
  }, [allUsers, ql])

  const filteredTeams = useMemo(() => {
    if (!ql) return teams
    return teams.filter(t =>
      t.name.toLowerCase().includes(ql) ||
      t.slug.toLowerCase().includes(ql)
    )
  }, [teams, ql])

  // helpers
  const toggleUser = (login: string) =>
    onChangeUsers(selectedUsers.includes(login) ? selectedUsers.filter(x => x !== login) : [...selectedUsers, login])

  const toggleTeam = (slug: string) =>
    onChangeTeams(selectedTeams.includes(slug) ? selectedTeams.filter(x => x !== slug) : [...selectedTeams, slug])

  const clear = () => (tab === 'users' ? onChangeUsers([]) : onChangeTeams([]))

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
        <button onClick={() => setTab('users')} className={`px-3 py-1 text-xs ${tab==='users' ? 'bg-brand-500/20' : ''}`}>Users</button>
        <button onClick={() => setTab('teams')} className={`px-3 py-1 text-xs ${tab==='teams' ? 'bg-brand-500/20' : ''}`}>Teams</button>
      </div>

      <div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={tab==='users' ? "Search users…" : "Search teams…"}
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button onClick={clear} className="px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800">Clear</button>
        {tab==='teams' && teamsLoading && <span className="text-zinc-400">Loading teams…</span>}
      </div>

      <div className="max-h-80 overflow-auto pr-2">
        {tab === 'users' ? (
          filteredUsers.map(({ login, displayName }) => {
            const on = selectedUsers.includes(login)
            return (
              <label key={login} className="flex items-center justify-between py-2 border-b border-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-medium">{displayName ?? login}</div>
                  {displayName && displayName !== login && (
                    <div className="text-xs text-zinc-400 truncate">@{login}</div>
                  )}
                </div>
                <input type="checkbox" checked={on} onChange={() => toggleUser(login)} className="accent-brand-500" />
              </label>
            )
          })
        ) : (
          filteredTeams.map((t) => {
            const on = selectedTeams.includes(t.slug)
            return (
              <label key={t.slug} className="flex items-center justify-between py-2 border-b border-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="text-xs text-zinc-400 truncate">@{t.slug} • {t.members.length} members</div>
                </div>
                <input type="checkbox" checked={on} onChange={() => toggleTeam(t.slug)} className="accent-brand-500" />
              </label>
            )
          })
        )}
        {tab==='users' && filteredUsers.length===0 && <div className="py-4 text-sm text-zinc-400">No users.</div>}
        {tab==='teams' && filteredTeams.length===0 && <div className="py-4 text-sm text-zinc-400">No teams.</div>}
      </div>
    </div>
  )
}
