/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MRX_URL?: string
  /** TEMPORARY test key, see src/services/mrx/config.ts. */
  readonly VITE_MRX_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
