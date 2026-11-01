/**
 * Connection settings for the MRX MCP gateway, read from Vite env variables
 * (see `.env.example`).
 *
 * - Default (and every deployed build): players log in with MRX via OAuth.
 * - `VITE_MRX_API_KEY` set: local testing with a key, no login.
 * - `VITE_MRX_MOCK=true`: offline mock simulation, no MRX at all.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  VITE_MRX_API_KEY IS FOR LOCAL TESTING ONLY  ⚠️                   ║
 * ║                                                                      ║
 * ║  It is compiled into the JavaScript bundle; anyone who opens the     ║
 * ║  page can read and use it. Only put it in `.env.local`, never into   ║
 * ║  CI. The Pages workflow fails if a key ends up in the build.         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { authorizedFetch } from './authFetch'
import { MrxOAuth } from './oauth'

const url = import.meta.env.VITE_MRX_URL || 'https://mrx-org--mcp-gateway-func.modal.run/mcp'
const apiKey = import.meta.env.VITE_MRX_API_KEY as string | undefined

export type MrxConnection =
  | { mode: 'mock' }
  | { mode: 'key'; url: string; fetch: typeof fetch }
  | { mode: 'oauth'; url: string; fetch: typeof fetch; auth: MrxOAuth }

function connect(): MrxConnection {
  if (import.meta.env.VITE_MRX_MOCK === 'true') return { mode: 'mock' }
  if (apiKey) {
    console.warn('⚠️ MRX test API key is bundled into the app. Never deploy this build publicly.')
    return { mode: 'key', url, fetch: authorizedFetch({ accessToken: async () => apiKey }) }
  }
  const auth = new MrxOAuth({
    resourceUrl: url,
    // The app's own URL without query or hash, e.g. https://<user>.github.io/<repo>/
    redirectUri: new URL(import.meta.env.BASE_URL, window.location.href).href,
  })
  return { mode: 'oauth', url, fetch: authorizedFetch(auth), auth }
}

export const mrx = connect()
