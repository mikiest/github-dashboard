import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPRs } from '../api'
import type { PREnriched } from '../types'

type Props = {
  org: string
  repos: string[]
  username: string
  refreshMs: number
}

export default function PRList({ org, repos, username, refreshMs }: Props) {
  const { data, refetch, isFetching, isError, error } = useQuery({
    queryKey: ['prs', org, repos.sort().join(','), username],
    queryFn: () => fetchPRs(org, repos),
    enabled: org.length > 0 && repos.length > 0,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: true,
  })

  // Track previous ids to detect "new" PRs
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ids = new Set((data ?? []).map(p => p.id))
    const prev = prevIdsRef.current
    const newly = new Set<string>()
    ids.forEach(id => { if (!prev.has(id)) newly.add(id) })
    setNewIds(newly)
    prevIdsRef.current = ids
  }, [data])

  const prs = useMemo(() => (data ?? []) as PREnriched[], [data])

  // Sorting: updated desc
  const sorted = useMemo(() => [...prs].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), [prs])

  if (isError) return <div className="text-red-300">Error: {(error as Error).message}</div>
  if (repos.length === 0) return <div className="text-sm text-zinc-400">No favorites selected.</div>

  const reviewRequested = sorted.filter(p => p.requestedReviewers?.some(r => r?.toLowerCase() === username.toLowerCase()))
  const others = sorted.filter(p => !reviewRequested.includes(p))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider text-zinc-400">Pull Requests</h3>
        <button onClick={() => refetch()} className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800">
          Refresh {isFetching ? '…' : ''}
        </button>
      </div>

      {reviewRequested.length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-amber-200/90">Requested Reviews ({reviewRequested.length})</h4>
          <div className="grid gap-3">
            {reviewRequested.map(pr => (
              <div key={pr.id}>
                <PRCard pr={pr} username={username} isNew={newIds.has(pr.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 font-semibold text-zinc-200">All Open PRs ({sorted.length})</h4>
        <div className="grid gap-3">
          {sorted.map(pr => (
            <div key={pr.id}>
              <PRCard pr={pr} username={username} isNew={newIds.has(pr.id)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

import PRCard from './PRCard'
