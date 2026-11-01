/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MRX_URL?: string
  /** Local testing only, see src/services/mrx/config.ts. */
  readonly VITE_MRX_API_KEY?: string
  /** 'true' for the offline mock simulation. */
  readonly VITE_MRX_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
