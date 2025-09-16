export type Settings = {
  org: string
  username: string
  favorites: string[] // repo names (not full slug); org is separate
  refreshMs: number
}

const KEY = 'prdash::settings'

const defaults: Settings = {
  org: '',
  username: '',
  favorites: [],
  refreshMs: 15000,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const data = JSON.parse(raw)
    return { ...defaults, ...data }
  } catch {
    return defaults
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
