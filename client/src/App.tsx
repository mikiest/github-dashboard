import { useEffect, useMemo, useState } from 'react'
import RepoPicker from './components/RepoPicker'
import PRList from './components/PRList'
import { loadSettings, saveSettings } from './store'

export default function App() {
  const [org, setOrg] = useState(loadSettings().org)
  const [username, setUsername] = useState(loadSettings().username)
  const [favorites, setFavorites] = useState<string[]>(loadSettings().favorites)
  const [refreshMs, setRefreshMs] = useState(loadSettings().refreshMs)

  useEffect(() => {
    saveSettings({ org, username, favorites, refreshMs })
  }, [org, username, favorites, refreshMs])

  const toggleFav = (name: string) => {
    setFavorites(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  const canShowPRs = org && favorites.length > 0

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">GitHub PR Dashboard</h1>
          <p className="text-zinc-400 text-sm">Pick repos, set your username, and watch your PRs roll in.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://cli.github.com/" target="_blank" rel="noreferrer" className="text-xs opacity-70 hover:opacity-100 underline">Requires GitHub CLI (gh)</a>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 card p-4 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400">Organization</label>
            <input
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="your-org-slug"
              value={org}
              onChange={(e) => setOrg(e.target.value.trim())}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-zinc-400">GitHub Username (for review highlighting)</label>
            <input
              className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="your-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-400">Refresh (ms)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                min={5000}
                step={1000}
                value={refreshMs}
                onChange={(e) => setRefreshMs(Number(e.target.value || 15000))}
              />
            </div>
          </div>

          <RepoPicker org={org} favorites={favorites} onToggleFavorite={toggleFav} />
        </div>

        <div className="md:col-span-2 card p-4">
          {canShowPRs ? (
            <PRList org={org} repos={favorites} username={username} refreshMs={refreshMs} />
          ) : (
            <div className="text-sm text-zinc-400">Select at least one favorite repository to see PRs.</div>
          )}
        </div>
      </section>
    </div>
  )
}
