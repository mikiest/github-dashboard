import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOrgStats } from '../api'
import type { OrgStatRepo, OrgStatUser } from '../types'
import { short } from '../lib_time'

type Props = {
  org: string
  windowSel: '24h' | '7d' | '30d'
  onChangeSelected: (window: '24h' | '7d' | '30d') => void
}

const formatter = new Intl.NumberFormat('en-US')

const WINDOW_OPTIONS: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d']

function formatCount(value: number | null | undefined) {
  return formatter.format(value ?? 0)
}

type HighlightCardProps<T> = {
  label: string
  entry: T | null
  render: (entry: T) => ReactNode
  loading?: boolean
}

function HighlightCard<T>({ label, entry, render, loading }: HighlightCardProps<T>) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <span className="text-xs uppercase tracking-wide text-zinc-400">{label}</span>
      {loading ? (
        <span className="text-sm text-zinc-500">Loading…</span>
      ) : entry ? (
        render(entry)
      ) : (
        <span className="text-sm text-zinc-500">No data in this window.</span>
      )}
    </div>
  )
}

function UserHighlight({ label, entry, loading }: { label: string; entry: OrgStatUser | null; loading: boolean }) {
  return (
    <HighlightCard
      label={label}
      entry={entry}
      loading={loading}
      render={(user) => (
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`${user.login} avatar`} className="w-14 h-14 rounded-full border border-zinc-700" />
          ) : (
            <div className="w-14 h-14 rounded-full border border-zinc-800 bg-zinc-900" />
          )}
          <div className="flex-1 min-w-0">
            <a
              href={`https://github.com/${encodeURIComponent(user.login)}`}
              target="_blank"
              rel="noreferrer"
              className="block text-lg font-semibold text-zinc-100 truncate hover:text-brand-300"
            >
              {user.name ?? user.login}
            </a>
            <div className="text-sm text-zinc-400 truncate">@{user.login}</div>
          </div>
          <span className="text-3xl font-bold text-zinc-100">{formatCount(user.count)}</span>
        </div>
      )}
    />
  )
}

function RepoHighlight({ label, entry, loading }: { label: string; entry: OrgStatRepo | null; loading: boolean }) {
  return (
    <HighlightCard
      label={label}
      entry={entry}
      loading={loading}
      render={(repo) => (
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <a
              href={`https://github.com/${repo.nameWithOwner}`}
              target="_blank"
              rel="noreferrer"
              className="block text-lg font-semibold text-zinc-100 truncate hover:text-brand-300"
            >
              {repo.nameWithOwner}
            </a>
          </div>
          <span className="text-3xl font-bold text-zinc-100">{formatCount(repo.count)}</span>
        </div>
      )}
    />
  )
}

export default function OrgStatsView({ org, windowSel, onChangeSelected }: Props) {
  const { data, isFetching, refetch, isError, error } = useQuery({
    queryKey: ['org-stats', org, windowSel],
    queryFn: () => fetchOrgStats(org, windowSel),
    enabled: !!org,
    refetchOnWindowFocus: true,
  })

  const since = data?.since ?? null
  const totals = data?.totals
  const topUsers = data?.topUsers
  const topRepos = data?.topRepos

  const hasOrg = !!org
  const loading = isFetching && !data

  const overallCards = useMemo(() => {
    if (!totals) return null
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">PRs currently open</span>
          <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.openPRs)}</span>
          <span className="text-xs text-zinc-500">Across the entire organization</span>
        </div>
        <div className="card p-5 flex flex-col gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-zinc-400">PRs this window</span>
            <div className="mt-1 flex items-baseline gap-4">
              <div>
                <div className="text-sm text-zinc-400">Opened</div>
                <div className="text-3xl font-semibold text-emerald-300">{formatCount(totals.prsOpened)}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Merged</div>
                <div className="text-3xl font-semibold text-sky-300">{formatCount(totals.prsMerged)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Commits this window</span>
          <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.commits)}</span>
          <span className="text-xs text-zinc-500">Committed by org members</span>
        </div>
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Reviews this window</span>
          <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.reviews)}</span>
          <span className="text-xs text-zinc-500">Completed by org members</span>
        </div>
      </div>
    )
  }, [totals])

  if (!hasOrg) {
    return <div className="card p-6 text-sm text-zinc-400">Choose an organization to explore its activity.</div>
  }

  if (isError) {
    return (
      <div className="card p-6 text-sm text-red-300">
        Unable to load organization stats: {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => onChangeSelected(w)}
              aria-pressed={windowSel === w}
              className={`px-3 py-1 text-xs transition ${windowSel === w ? 'bg-brand-500/20' : 'hover:bg-zinc-800'}`}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {since && <span>Since {short(since)}</span>}
          <button
            onClick={() => refetch()}
            className="px-3 py-1 rounded-full border border-zinc-700 hover:bg-zinc-800 inline-flex items-center gap-2 text-sm"
          >
            Refresh
            {isFetching && <span className="inline-block w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />}
          </button>
        </div>
      </div>

      {overallCards ?? (
        <div className="card p-6 text-sm text-zinc-400">Gathering organization stats…</div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Top users</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <UserHighlight label="Top reviewer" entry={topUsers?.reviewer ?? null} loading={loading} />
          <UserHighlight label="Top committer" entry={topUsers?.committer ?? null} loading={loading} />
          <UserHighlight label="Top PR opener" entry={topUsers?.prOpener ?? null} loading={loading} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Top repositories</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <RepoHighlight label="Most reviews" entry={topRepos?.reviews ?? null} loading={loading} />
          <RepoHighlight label="Most commits" entry={topRepos?.commits ?? null} loading={loading} />
          <RepoHighlight label="Most contributions" entry={topRepos?.contributions ?? null} loading={loading} />
        </div>
      </section>
    </div>
  )
}
