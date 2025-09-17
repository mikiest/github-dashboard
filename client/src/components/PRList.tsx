import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPRs } from '../api'
import type { PREnriched } from '../types'
import { loadPins, savePins } from '../store'
import PRCard from './PRCard'
import dayjs from 'dayjs'

type Props = { org: string; repos: string[]; username: string; refreshMs: number }

export default function PRList({ org, repos, username, refreshMs }: Props) {
  const [status, setStatus] = useState<'open'|'merged'>('open') // NEW
  const { data, refetch, isFetching, isError, error } = useQuery({
    queryKey: ['prs', org, username, status, ...repos.sort()],
    queryFn: () => fetchPRs(org, repos, [status]),
    enabled: org.length > 0 && repos.length > 0,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: true,
  })

  // Keep previous list visible
  const [displayed, setDisplayed] = useState<PREnriched[]>([])
  const [pins, setPins] = useState<string[]>(loadPins()) // NEW

  const togglePin = (id: string) => {                    // NEW
    setPins(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]
      savePins(next)
      return next
    })
  }
  useEffect(() => { if (data) setDisplayed(data) }, [data])

  // New PR detection (skip first render)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const firstLoadRef = useRef(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ids = new Set((displayed ?? []).map(p => p.id))
    if (firstLoadRef.current) {
      // initialize without animation
      prevIdsRef.current = ids
      firstLoadRef.current = false
      setNewIds(new Set())
      return
    }
    const prev = prevIdsRef.current
    const newly = new Set<string>()
    ids.forEach(id => { if (!prev.has(id)) newly.add(id) })
    setNewIds(newly)
    prevIdsRef.current = ids
  }, [displayed])

  // Free-text + filters
  const [filter, setFilter] = useState('')
  const [onlyStale, setOnlyStale] = useState(false)
  const [onlyMine, setOnlyMine] = useState(false)
  const filterLower = filter.trim().toLowerCase()

  // Sorting: last updated desc
  const sorted = useMemo(() => {
    const arr = [...(displayed ?? [])]
    arr.sort((a, b) => {
      const getTime = (p: PREnriched) =>
        status === 'merged'
          ? (Date.parse(p.mergedAt ?? '') || Date.parse(p.updatedAt ?? '') || 0)
          : (Date.parse(p.updatedAt ?? '') || 0)
      return getTime(b) - getTime(a)
    })
    return arr
  }, [displayed, status])

  // stale = no update or review in >7 days (only meaningful for open)
  function isStale(p: PREnriched) {
    if (status === 'merged') return false
    const lastTouch = dayjs(
      (p.lastReviewedAt && dayjs(p.lastReviewedAt) > dayjs(p.updatedAt)) ? p.lastReviewedAt : p.updatedAt
    )
    return dayjs().diff(lastTouch, 'day') > 7
  }

  

  const filtered = useMemo(() => {
    let arr = sorted
    if (filterLower) {
      arr = arr.filter(p =>
        p.title.toLowerCase().includes(filterLower) ||
        p.author.toLowerCase().includes(filterLower) ||
        p.repo.toLowerCase().includes(filterLower)
      )
    }
    if (onlyMine) arr = arr.filter(p => p.author.toLowerCase() === username.toLowerCase())
    if (onlyStale && status === 'open') arr = arr.filter(isStale)
    return arr
  }, [sorted, filterLower, onlyMine, onlyStale, status, username])

  const ordered = useMemo(() => {                        // NEW
    const set = new Set(pins)
    const pinned = filtered.filter(p => set.has(p.id))
    const rest = filtered.filter(p => !set.has(p.id))
    return [...pinned, ...rest]
  }, [filtered, pins])

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 20
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize))
  useEffect(() => { setPage(1) }, [filterLower, onlyMine, onlyStale, repos.join(','), org, status, pins.join('|')]) // reset when pins/filter change
  const paged = useMemo(() => ordered.slice((page - 1) * pageSize, page * pageSize), [ordered, page])

  // Buckets for "requested reviews" (only relevant for open)
  const reviewRequested = status === 'open'
    ? paged.filter(p => p.requestedReviewers?.some(r => r?.toLowerCase() === username.toLowerCase()))
    : []
  const others = status === 'open' ? paged.filter(p => !reviewRequested.includes(p)) : paged

  if (isError) return <div className="text-red-300">Error: {(error as Error).message}</div>
  if (repos.length === 0) return <div className="text-sm text-zinc-400">No favorites selected.</div>

  return (
    <div className="space-y-6">
      {/* header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm uppercase tracking-wider text-zinc-400">Pull Requests</h3>
        <div className="flex items-center gap-2">
          {/* status toggle */}
          <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
            <button
              onClick={() => setStatus('open')}
              className={`px-3 py-1 text-xs ${status==='open' ? 'bg-brand-500/20 border-r border-zinc-700' : ''}`}
            >Open</button>
            <button
              onClick={() => setStatus('merged')}
              className={`px-3 py-1 text-xs ${status==='merged' ? 'bg-brand-500/20' : ''}`}
            >Merged</button>
          </div>

          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by author, repo, or title…"
            className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => setOnlyMine(v => !v)}
            className={`text-xs px-2 py-1 rounded-full border ${onlyMine ? 'border-brand-400 bg-brand-500/20' : 'border-zinc-700 hover:bg-zinc-800'}`}
            title="Show only PRs authored by me"
          >
            Mine
          </button>
          <button
            onClick={() => setOnlyStale(v => !v)}
            disabled={status === 'merged'}
            className={`text-xs px-2 py-1 rounded-full border ${onlyStale && status==='open' ? 'border-amber-400 bg-amber-500/20' : 'border-zinc-700 hover:bg-zinc-800'} disabled:opacity-40`}
            title="PRs not updated or reviewed in >7 days"
          >
            Stale
          </button>
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
      </div>

      {/* Requested Reviews bucket only for Open */}
      {status === 'open' && reviewRequested.length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-amber-200/90">Requested Reviews ({reviewRequested.length})</h4>
          <div className="grid gap-3">
            {reviewRequested.map(pr => (
              <div key={pr.id}>
                <PRCard pr={pr} username={username} isNew={newIds.has(pr.id)} pinned={pins.includes(pr.id)} onTogglePin={togglePin} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-2 font-semibold text-zinc-200">
          {status === 'merged' ? 'Recently Merged' : 'All Open PRs'} ({filtered.length})
        </h4>
        <div className="grid gap-3">
          {others.map(pr => (
            <div key={pr.id}>
              <PRCard pr={pr} username={username} isNew={newIds.has(pr.id)} pinned={pins.includes(pr.id)} onTogglePin={togglePin} />
            </div>
          ))}
        </div>

        {/* pagination */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-2 py-1 text-xs rounded border border-zinc-700 disabled:opacity-40"
          >
            Prev
          </button>
          {Array.from({ length: pageCount }).map((_, i) => {
            const n = i + 1
            const active = n === page
            return (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-2 py-1 text-xs rounded border ${active ? 'border-brand-400 bg-brand-500/20' : 'border-zinc-700 hover:bg-zinc-800'}`}
              >
                {n}
              </button>
            )
          })}
          <button
            disabled={page >= pageCount}
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            className="px-2 py-1 text-xs rounded border border-zinc-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  )
}
