/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REFRESH_INTERVAL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
