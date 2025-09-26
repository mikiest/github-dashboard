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

const WINDOW_LABEL: Record<Props['windowSel'], string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

function formatCount(value: number | null | undefined) {
  return formatter.format(value ?? 0)
}

type HighlightCardProps<T> = {
  label: string
  entry: T | null
  render: (entry: T) => ReactNode
  loading?: boolean
  footer?: ReactNode
  emptyMessage?: string
}

function HighlightCard<T>({ label, entry, render, loading, footer, emptyMessage }: HighlightCardProps<T>) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <span className="text-xs uppercase tracking-wide text-zinc-400">{label}</span>
      {loading ? (
        <span className="text-sm text-zinc-500">Loading…</span>
      ) : entry ? (
        <>
          {render(entry)}
          {footer}
        </>
      ) : (
        <span className="text-sm text-zinc-500">{emptyMessage ?? 'No data in the selected window.'}</span>
      )}
    </div>
  )
}

function UserHighlight({
  label,
  entries,
  loading,
  windowLabel,
}: {
  label: string
  entries: OrgStatUser[] | undefined
  loading: boolean
  windowLabel: string
}) {
  const [primary, ...rest] = (entries ?? []).filter((entry) => entry.count > 0)
  const secondary = rest.slice(0, 2)

  return (
    <HighlightCard
      label={label}
      entry={primary ?? null}
      loading={loading}
      emptyMessage={`No user activity in the last ${windowLabel}.`}
      footer={
        secondary.length ? (
          <ol className="space-y-2 border-t border-zinc-800">
            {secondary.map((user) => (
              <li key={user.login} className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={`${user.login} avatar`}
                      className="w-8 h-8 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900" />
                  )}
                  <div className="min-w-0">
                    <a
                      href={`https://github.com/${encodeURIComponent(user.login)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm font-medium text-zinc-200 truncate hover:text-brand-300"
                    >
                      {user.name ?? user.login}
                    </a>
                    <div className="text-xs text-zinc-500 truncate">@{user.login}</div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-zinc-200">{formatCount(user.count)}</span>
              </li>
            ))}
          </ol>
        ) : null
      }
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

function RepoHighlight({
  label,
  entries,
  loading,
  windowLabel,
}: {
  label: string
  entries: OrgStatRepo[] | undefined
  loading: boolean
  windowLabel: string
}) {
  const [primary, ...rest] = (entries ?? []).filter((entry) => entry.count > 0)
  const secondary = rest.slice(0, 2)

  return (
    <HighlightCard
      label={label}
      entry={primary ?? null}
      loading={loading}
      emptyMessage={`No repository activity in the last ${windowLabel}.`}
      footer={
        secondary.length ? (
          <ol className="space-y-2 border-t border-zinc-800 text-sm text-zinc-400">
            {secondary.map((repo) => (
              <li key={repo.nameWithOwner} className="flex items-center justify-between gap-3">
                <a
                  href={`https://github.com/${repo.nameWithOwner}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-brand-300"
                >
                  {repo.nameWithOwner}
                </a>
                <span className="font-semibold text-zinc-200">{formatCount(repo.count)}</span>
              </li>
            ))}
          </ol>
        ) : null
      }
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
  const windowLabel = WINDOW_LABEL[windowSel]

  const overallCards = useMemo(() => {
    if (!totals) return null
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">PRs currently open</span>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.openPRs)}</span>
            <span className="text-sm text-zinc-500">Stale: {formatCount(totals.stalePRs)}</span>
          </div>
          <span className="text-xs text-zinc-500">Across the entire organization</span>
        </div>
        <div className="card p-5 flex flex-col gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-zinc-400">PRs last {windowLabel}</span>
            <div className="mt-1 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-sm text-zinc-400">Opened</div>
                <div className="text-3xl font-semibold text-emerald-300">{formatCount(totals.prsOpened)}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Merged</div>
                <div className="text-3xl font-semibold text-purple-300">{formatCount(totals.prsMerged)}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-400">Closed</div>
                <div className="text-3xl font-semibold text-rose-300">{formatCount(totals.prsClosed)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Commits last {windowLabel}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.commits)}</span>
            <span className="text-sm text-zinc-500">in {formatCount(totals.commitRepos)} repos</span>
          </div>
          <span className="text-xs text-zinc-500">Committed by org members</span>
        </div>
        <div className="card p-5 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">Reviews last {windowLabel}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-zinc-100">{formatCount(totals.reviews)}</span>
            <span className="text-sm text-zinc-500">in {formatCount(totals.reviewRepos)} repos</span>
          </div>
          <span className="text-xs text-zinc-500">Completed by org members</span>
        </div>
      </div>
    )
  }, [totals, windowLabel])

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
          <UserHighlight
            label="Top reviewer"
            entries={topUsers?.reviewer}
            loading={loading}
            windowLabel={windowLabel}
          />
          <UserHighlight
            label="Top committer"
            entries={topUsers?.committer}
            loading={loading}
            windowLabel={windowLabel}
          />
          <UserHighlight
            label="Top PR opener"
            entries={topUsers?.prOpener}
            loading={loading}
            windowLabel={windowLabel}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-100">Top repositories</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <RepoHighlight
            label="Top reviews"
            entries={topRepos?.reviews}
            loading={loading}
            windowLabel={windowLabel}
          />
          <RepoHighlight
            label="Top commits"
            entries={topRepos?.commits}
            loading={loading}
            windowLabel={windowLabel}
          />
          <RepoHighlight
            label="Top PRs opened"
            entries={topRepos?.prsOpened}
            loading={loading}
            windowLabel={windowLabel}
          />
        </div>
      </section>
    </div>
  )
}
