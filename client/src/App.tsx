import { useEffect, useMemo, useState } from 'react'
import RepoPicker from './components/RepoPicker'
import PRList from './components/PRList'
import ReviewersView from './components/ReviewersView'
import ReviewersSidebar from './components/ReviewersSidebar'
import OrgSelectorModal from './components/OrgSelectorModal'
import OrgStatsView from './components/OrgStatsView'
import { loadSettings, saveSettings } from './store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTeams, fetchViewer, fetchOrgMembers } from './api'


const DEFAULT_REFRESH_INTERVAL_MS = 15000
const REFRESH_INTERVAL_MS = (() => {
  const raw = import.meta.env.VITE_REFRESH_INTERVAL_MS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_INTERVAL_MS
})()


export default function App() {
  const [org, setOrg] = useState(loadSettings().org)
  const [username, setUsername] = useState(loadSettings().username)
  const [favorites, setFavorites] = useState<string[]>(loadSettings().favorites)
  const [tab, setTab] = useState<'org'|'prs'|'reviewers'>('org')
  const [reviewWindow, setReviewWindow] = useState<'24h'|'7d'|'30d'>('24h')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [orgModalOpen, setOrgModalOpen] = useState(false)

  const queryClient = useQueryClient()

  const {
    data: viewer,
    isLoading: viewerLoading,
    isError: viewerError,
    error: viewerErrorObj,
  } = useQuery({
    queryKey: ['viewer'],
    queryFn: fetchViewer,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const orgOptions = viewer?.organizations ?? []
  const selectedOrg = orgOptions.find(o => o.login === org) ?? null
  const viewerErrorMessage = viewerError
    ? viewerErrorObj instanceof Error
      ? viewerErrorObj.message
      : String(viewerErrorObj ?? 'Unknown error')
    : ''

  useEffect(() => {
    if (viewer?.login && viewer.login !== username) {
      setUsername(viewer.login)
    }
  }, [viewer?.login, username])

  useEffect(() => {
    if (!viewer) return
    const available = new Set((viewer.organizations ?? []).map(o => o.login))
    if (org && !available.has(org)) {
      setOrg('')
      return
    }
    if (!org && available.size === 1) {
      const only = orgOptions[0]?.login
      if (only) setOrg(only)
    }
  }, [viewer, orgOptions, org])

  useEffect(() => {
    setSelectedUsers([])
    setSelectedTeams([])
  }, [org])

  const requiresOrgSelection = !!viewer && !org && orgOptions.length > 1

  useEffect(() => {
    if (requiresOrgSelection) {
      setOrgModalOpen(true)
    }
  }, [requiresOrgSelection])

  useEffect(() => {
    if (!requiresOrgSelection && org && orgModalOpen) {
      setOrgModalOpen(false)
    }
  }, [requiresOrgSelection, org, orgModalOpen])

  useEffect(() => {
    if (!org) return
    queryClient.prefetchQuery({ queryKey: ['org-teams', org], queryFn: () => fetchTeams(org) })
    queryClient.prefetchQuery({ queryKey: ['org-members', org], queryFn: () => fetchOrgMembers(org) })
  }, [org, queryClient])

  const { data: teamsData } = useQuery({
    queryKey: ['org-teams', org],
    queryFn: () => fetchTeams(org),
    enabled: !!org,
    refetchOnWindowFocus: false,
  })
  const teams = teamsData ?? []

  useEffect(() => {
    saveSettings({ org, username, favorites })
  }, [org, username, favorites])

  const toggleFav = (name: string) => {
    setFavorites(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const canShowPRs = !!org && favorites.length > 0;
  const hasReviewerSelection = selectedUsers.length > 0 || selectedTeams.length > 0

  const selectedUsersEffective = useMemo(() => {
    if (!selectedTeams.length) return selectedUsers
    const teamMembers = new Set<string>()
    for (const t of teams) {
      if (selectedTeams.includes(t.slug)) {
        for (const m of t.members) teamMembers.add(m.login)
      }
    }
    const set = new Set([...selectedUsers, ...Array.from(teamMembers)])
    return Array.from(set)
  }, [selectedUsers, selectedTeams, teams])

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div class="flex items-center gap-4">
          <img src="./logo.svg" alt="GitHub Dashboard" class="w-14 h-14 rounded-full border border-zinc-700"/>
          <div class="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">GitHub Dashboard</h1>
            <p className="text-zinc-400 text-sm">Monitor organization health, pull requests, and reviews in one place.</p>
          </div>
        </div>
        <div className="flex flex-col md:items-end gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm md:justify-end">
            {viewerLoading ? (
              <span className="text-zinc-400">Loading GitHub context…</span>
            ) : viewerError ? (
              <div className="text-red-300 text-sm max-w-xs">
                <p>Unable to load GitHub context. Make sure you've run <code className="font-mono text-xs bg-red-500/20 px-1 py-0.5 rounded">gh auth login</code>.</p>
                {viewerErrorMessage && <p className="text-xs text-red-400/80 mt-1 break-words">{viewerErrorMessage}</p>}
              </div>
            ) : viewer ? (
              <>
                <div className="flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-zinc-200">
                  {viewer.avatarUrl && (
                    <img src={viewer.avatarUrl} alt={`${viewer.login} avatar`} className="w-6 h-6 rounded-full" />
                  )}
                  <span>Hi {viewer.login}!</span>
                </div>
                {selectedOrg ? (
                  <button
                    onClick={() => setOrgModalOpen(true)}
                    className="flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1 text-zinc-200 hover:bg-zinc-800 transition"
                    title="Change organization"
                  >
                    {selectedOrg.avatarUrl && (
                      <img src={selectedOrg.avatarUrl} alt={`${selectedOrg.login} logo`} className="w-6 h-6 rounded-full" />
                    )}
                    <span>{selectedOrg.name ?? selectedOrg.login}</span>
                  </button>
                ) : orgOptions.length === 0 ? (
                  <span className="text-xs text-zinc-500">No organizations detected.</span>
                ) : (
                  <button
                    onClick={() => setOrgModalOpen(true)}
                    className="text-xs px-3 py-1 rounded-full border border-amber-400/60 text-amber-200 hover:bg-amber-500/10 transition"
                  >
                    Choose organization
                  </button>
                )}
              </>
            ) : null}
          </div>
          <div className="inline-flex rounded-full border border-zinc-700 overflow-hidden self-start md:self-auto">
            <button onClick={() => setTab('org')} className={`px-3 py-1 text-sm ${tab==='org' ? 'bg-brand-500/20' : ''}`}>Org</button>
            <button onClick={() => setTab('prs')} className={`px-3 py-1 text-sm ${tab==='prs' ? 'bg-brand-500/20' : ''}`}>PRs</button>
            <button onClick={() => setTab('reviewers')} className={`px-3 py-1 text-sm ${tab==='reviewers' ? 'bg-brand-500/20' : ''}`}>Reviews</button>
          </div>
        </div>
      </header>
      {tab === 'org' ? (
        <OrgStatsView org={org} windowSel={reviewWindow} onChangeSelected={setReviewWindow} />
      ) : (
        <section className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 card p-4">
            {tab === 'reviewers' ? (
              <ReviewersSidebar
                org={org}
                selectedUsers={selectedUsersEffective}
                onChangeUsers={setSelectedUsers}
                onChangeTeams={setSelectedTeams}
                selectedTeams={selectedTeams}
              />
            ) : (
              <RepoPicker org={org} favorites={favorites} onToggleFavorite={toggleFav} />
            )}
          </div>

          <div className="md:col-span-2 card p-4">
            {tab === 'prs' ? (
              canShowPRs ? (
                <PRList
                  org={org}
                  repos={favorites}
                  username={username}
                  refreshMs={REFRESH_INTERVAL_MS}
                  windowSel={reviewWindow}
                  onChangeSelected={setReviewWindow}
                />
              ) : (
                <div className="text-sm text-zinc-400">
                  {org ? 'Select at least one favorite repository to see PRs.' : 'Choose an organization to get started.'}
                </div>
              )
            ) : (
              org ? (
                <ReviewersView
                  org={org}
                  selectedUsers={selectedUsersEffective}
                  hasSelection={hasReviewerSelection}
                  windowSel={reviewWindow}
                  onChangeSelected={setReviewWindow}
                />
              ) : (
                <div className="text-sm text-zinc-400">Choose an organization to see reviewers.</div>
              )
            )}
          </div>
        </section>
      )}
      <OrgSelectorModal
        open={orgModalOpen}
        options={orgOptions}
        onSelect={(login) => setOrg(login)}
        onClose={() => { if (!requiresOrgSelection) setOrgModalOpen(false) }}
        required={requiresOrgSelection}
      />
    </div>
  )
}
