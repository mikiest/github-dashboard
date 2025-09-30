import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchActivity } from '../api'
import type { ActivityItem, ActivityType, ActivityResponse } from '../types'
import { fromNow, short } from '../lib_time'

const TYPE_LABEL: Record<ActivityType, string> = {
  pr_opened: 'PR Opened',
  pr_closed: 'PR Closed',
  pr_merged: 'PR Merged',
  review: 'Review',
}

const TYPE_BADGE_CLASS: Record<ActivityType, string> = {
  pr_opened: 'bg-blue-500/10 text-blue-200 border border-blue-500/30',
  pr_closed: 'bg-amber-500/10 text-amber-200 border border-amber-500/30',
  pr_merged: 'bg-purple-500/10 text-purple-200 border border-purple-500/30',
  review: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
}

const TYPE_OPTIONS: ActivityType[] = ['pr_opened', 'pr_closed', 'pr_merged', 'review']

const PAGE_SIZE = 20

type ActivityViewProps = {
  org?: string | null
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handle)
  }, [value, delay])

  return debounced
}

function ActivitySummary({ item }: { item: ActivityItem }) {
  if (item.type === 'review') {
    const { state, prNumber, prTitle, prUrl, author } = item.data
    const stateLabel = state.toLowerCase().replace(/_/g, ' ')
    return (
      <div className="space-y-1 text-sm text-zinc-200">
        <p>
          Reviewed{' '}
          <a
            href={prUrl ?? '#'}
            target={prUrl ? '_blank' : undefined}
            rel={prUrl ? 'noreferrer' : undefined}
            className={prUrl ? 'text-emerald-300 hover:text-emerald-200' : 'text-zinc-200'}
          >
            PR #{prNumber}
          </a>{' '}
          {prTitle ? `“${prTitle}”` : ''} with a
          {' '}
          <span className="font-semibold uppercase tracking-wide text-xs text-emerald-200">
            {stateLabel}
          </span>{' '}
          review.
        </p>
        {author?.login ? (
          <p className="text-xs text-zinc-400">
            Requested by{' '}
            <span className="font-semibold text-zinc-300">{author.login}</span>
            {author.name && author.name !== author.login ? ` (${author.name})` : ''}
          </p>
        ) : null}
      </div>
    )
  }

  if (item.type === 'pr_opened') {
    const { prNumber, prTitle, prUrl } = item.data
    return (
      <div className="space-y-1 text-sm text-zinc-200">
        <p>
          Opened{' '}
          <a
            href={prUrl ?? '#'}
            target={prUrl ? '_blank' : undefined}
            rel={prUrl ? 'noreferrer' : undefined}
            className={prUrl ? 'text-blue-300 hover:text-blue-200' : 'text-zinc-200'}
          >
            PR #{prNumber}
          </a>{' '}
          {prTitle ? `“${prTitle}”` : ''}.
        </p>
      </div>
    )
  }

  if (item.type === 'pr_closed') {
    const { prNumber, prTitle, prUrl, author, closedBy } = item.data
    return (
      <div className="space-y-1 text-sm text-zinc-200">
        <p>
          Closed{' '}
          <a
            href={prUrl ?? '#'}
            target={prUrl ? '_blank' : undefined}
            rel={prUrl ? 'noreferrer' : undefined}
            className={prUrl ? 'text-amber-300 hover:text-amber-200' : 'text-zinc-200'}
          >
            PR #{prNumber}
          </a>{' '}
          {prTitle ? `“${prTitle}”` : ''}.
        </p>
        {author?.login ? (
          <p className="text-xs text-zinc-400">
            Originally opened by{' '}
            <span className="font-semibold text-zinc-300">{author.login}</span>
            {author.name && author.name !== author.login ? ` (${author.name})` : ''}
          </p>
        ) : null}
        {closedBy?.login && closedBy.login !== author?.login ? (
          <p className="text-xs text-zinc-400">
            Closed by{' '}
            <span className="font-semibold text-zinc-300">{closedBy.login}</span>
            {closedBy.name && closedBy.name !== closedBy.login ? ` (${closedBy.name})` : ''}
          </p>
        ) : null}
      </div>
    )
  }

  const { prNumber, prTitle, prUrl, author, mergedBy, commitCount } = item.data
  return (
    <div className="space-y-1 text-sm text-zinc-200">
      <p>
        Merged{' '}
        <a
          href={prUrl ?? '#'}
          target={prUrl ? '_blank' : undefined}
          rel={prUrl ? 'noreferrer' : undefined}
          className={prUrl ? 'text-purple-300 hover:text-purple-200' : 'text-zinc-200'}
        >
          PR #{prNumber}
        </a>{' '}
        {prTitle ? `“${prTitle}”` : ''}
        {typeof commitCount === 'number' ? (
          <>
            {' '}after{' '}
            <span className="font-semibold">{commitCount}</span>{' '}
            commit{commitCount === 1 ? '' : 's'}
          </>
        ) : null}
        .
      </p>
      {author?.login ? (
        <p className="text-xs text-zinc-400">
          Authored by{' '}
          <span className="font-semibold text-zinc-300">{author.login}</span>
          {author.name && author.name !== author.login ? ` (${author.name})` : ''}
        </p>
      ) : null}
      {mergedBy?.login && mergedBy.login !== item.actor.login ? (
        <p className="text-xs text-zinc-400">
          Merge completed by{' '}
          <span className="font-semibold text-zinc-300">{mergedBy.login}</span>
          {mergedBy.name && mergedBy.name !== mergedBy.login ? ` (${mergedBy.name})` : ''}
        </p>
      ) : null}
    </div>
  )
}

export default function ActivityView({ org }: ActivityViewProps) {
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([])
  const [repoInput, setRepoInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [fullnameInput, setFullnameInput] = useState('')

  const debouncedRepo = useDebouncedValue(repoInput, 300)
  const debouncedUsername = useDebouncedValue(usernameInput, 300)
  const debouncedFullname = useDebouncedValue(fullnameInput, 300)

  const filters = useMemo(() => ({
    types: selectedTypes.length ? selectedTypes : undefined,
    repo: debouncedRepo.trim() ? debouncedRepo.trim() : undefined,
    username: debouncedUsername.trim() ? debouncedUsername.trim() : undefined,
    fullname: debouncedFullname.trim() ? debouncedFullname.trim() : undefined,
  }), [selectedTypes, debouncedRepo, debouncedUsername, debouncedFullname])

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ActivityResponse, Error>({
    queryKey: ['activity', org, filters],
    enabled: !!org,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    queryFn: ({ pageParam }) =>
      fetchActivity(org!, {
        ...filters,
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
        pageSize: PAGE_SIZE,
      }),
  })

  useEffect(() => {
    if (!data?.pages?.length) return
    const last = data.pages[data.pages.length - 1]
    if (last && last.items.length === 0 && last.nextCursor && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [data, fetchNextPage, isFetchingNextPage])

  const observerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasNextPage) return
    const target = observerRef.current
    if (!target) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        fetchNextPage()
      }
    }, { rootMargin: '200px' })

    observer.observe(target)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage])

  const items: ActivityItem[] = data?.pages?.flatMap((page) => page.items) ?? []

  const toggleType = (type: ActivityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  if (!org) {
    return <div className="card p-6 text-sm text-zinc-400">Choose an organization to view recent activity.</div>
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Recent activity</h2>
          <p className="text-sm text-zinc-400">Monitor pull request openings, closures, merges, and reviews across the organization.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase text-zinc-500 tracking-wide mb-1">Activity types</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((type) => {
                const active = selectedTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1 rounded-full border transition ${
                      active
                        ? TYPE_BADGE_CLASS[type]
                        : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {TYPE_LABEL[type]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs uppercase text-zinc-500 tracking-wide mb-1">Repository</label>
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="e.g. org/repo"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs uppercase text-zinc-500 tracking-wide mb-1">Username</label>
            <input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="login"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs uppercase text-zinc-500 tracking-wide mb-1">Full name</label>
            <input
              value={fullnameInput}
              onChange={(e) => setFullnameInput(e.target.value)}
              placeholder="Name"
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {isError ? (
        <div className="card p-6 text-sm text-red-300">
          <p>Unable to load activity.</p>
          <p className="text-xs text-red-400/80 mt-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={`${item.type}-${item.id}-${item.occurredAt}`}
            className="card p-4 flex gap-4 items-start"
          >
            {item.actor.avatarUrl ? (
              <img
                src={item.actor.avatarUrl}
                alt={`${item.actor.login} avatar`}
                className="w-12 h-12 rounded-full border border-zinc-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm uppercase text-zinc-300">
                {item.actor.login.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-100">{item.actor.login}</span>
                  {item.actor.name && item.actor.name !== item.actor.login ? (
                    <span className="text-xs text-zinc-400">{item.actor.name}</span>
                  ) : null}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGE_CLASS[item.type]}`}>
                  {TYPE_LABEL[item.type]}
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  {fromNow(item.occurredAt)} · {short(item.occurredAt)}
                </span>
              </div>
              <ActivitySummary item={item} />
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-full font-mono text-[11px]">
                  {item.repo}
                </span>
              </div>
            </div>
          </article>
        ))}

        {isLoading ? (
          <div className="card p-6 text-sm text-zinc-400">Loading activity…</div>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <div className="card p-6 text-sm text-zinc-400">No activity matched the selected filters.</div>
        ) : null}

        {hasNextPage ? (
          <div ref={observerRef} className="h-1" />
        ) : null}

        {isFetchingNextPage ? (
          <div className="card p-4 text-xs text-zinc-400">Loading more activity…</div>
        ) : null}
      </div>
    </div>
  )
}
