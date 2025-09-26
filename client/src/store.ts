export type Settings = {
  org: string
  username: string
  favorites: string[] // repo names (not full slug); org is separate
}

const KEY = 'prdash::settings'

const defaults: Settings = {
  org: '',
  username: '',
  favorites: [],
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const { refreshMs: _refreshMs, ...data } = JSON.parse(raw)
    return { ...defaults, ...data }
  } catch {
    return defaults
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

const PINS_KEY = 'prdash::pins'

export function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    return raw ? Array.from(new Set(JSON.parse(raw))) : []
  } catch {
    return []
  }
}

export function savePins(pins: string[]) {
  localStorage.setItem(PINS_KEY, JSON.stringify(Array.from(new Set(pins))))
}
