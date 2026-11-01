/**
 * Browser OAuth login for the MRX gateway, following the MCP authorization
 * spec: protected-resource metadata -> authorization-server metadata ->
 * dynamic client registration -> authorization code with PKCE (S256) ->
 * access + refresh token.
 *
 * The app is a public client (no secret). The client id is registered once
 * per redirect URI and kept in localStorage, as are the tokens; the PKCE
 * verifier and state only live in sessionStorage during the redirect.
 */

const SCOPE = 'read:user'
/** Refresh this long before the access token expires. */
const EXPIRY_MARGIN_MS = 60_000

export class LoginRequiredError extends Error {
  constructor(message = 'Please log in with MRX to scan.') {
    super(message)
    this.name = 'LoginRequiredError'
  }
}

interface ServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
}

interface Tokens {
  accessToken: string
  refreshToken?: string
  /** Epoch ms; `Infinity` if the server sent no `expires_in`. */
  expiresAt: number
}

interface Pending {
  state: string
  verifier: string
  clientId: string
  issuer: string
  tokenEndpoint: string
}

export interface OAuthOptions {
  /** The protected resource, i.e. the MCP endpoint. */
  resourceUrl: string
  /** Where the server sends the user back; must be this app's URL. */
  redirectUri: string
  storage?: Storage
  session?: Storage
  fetch?: typeof fetch
  navigate?: (url: string) => void
  now?: () => number
}

export class MrxOAuth {
  private readonly resourceUrl: string
  private readonly redirectUri: string
  private readonly storage: Storage
  private readonly session: Storage
  private readonly fetch: typeof fetch
  private readonly navigate: (url: string) => void
  private readonly now: () => number
  private refreshing?: Promise<string>

  constructor(options: OAuthOptions) {
    this.resourceUrl = options.resourceUrl
    this.redirectUri = options.redirectUri
    this.storage = options.storage ?? localStorage
    this.session = options.session ?? sessionStorage
    this.fetch = options.fetch ?? ((...args) => fetch(...args))
    this.navigate = options.navigate ?? ((url) => window.location.assign(url))
    this.now = options.now ?? Date.now
  }

  isLoggedIn(): boolean {
    return this.tokens !== undefined
  }

  /** Sends the browser to the MRX login page. */
  async login(): Promise<void> {
    const metadata = await this.discover()
    const clientId = await this.clientId(metadata)
    const verifier = randomString(32)
    const state = randomString(16)
    const pending: Pending = {
      state,
      verifier,
      clientId,
      issuer: metadata.issuer,
      tokenEndpoint: metadata.token_endpoint,
    }
    this.session.setItem(KEYS.pending, JSON.stringify(pending))

    const url = new URL(metadata.authorization_endpoint)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPE,
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: 'S256',
      resource: this.resourceUrl,
    }).toString()
    this.navigate(url.href)
  }

  /**
   * Finishes a login if `url` is the redirect back from the server. Returns
   * true if it was (the caller should then remove the query from the URL).
   */
  async handleRedirect(url: string): Promise<boolean> {
    const params = new URL(url).searchParams
    const state = params.get('state')
    if (!state || !(params.has('code') || params.has('error'))) return false

    const pending = this.session.getItem(KEYS.pending)
    this.session.removeItem(KEYS.pending)
    const expected = pending ? (JSON.parse(pending) as Pending) : undefined
    if (!expected || expected.state !== state) throw new Error('Login failed: unexpected state.')
    const error = params.get('error')
    if (error) throw new Error(`Login failed: ${params.get('error_description') ?? error}`)
    const iss = params.get('iss')
    if (iss && iss !== expected.issuer) throw new Error('Login failed: unexpected issuer.')

    await this.requestTokens(expected.tokenEndpoint, {
      grant_type: 'authorization_code',
      code: params.get('code')!,
      redirect_uri: this.redirectUri,
      client_id: expected.clientId,
      code_verifier: expected.verifier,
      resource: this.resourceUrl,
    })
    return true
  }

  /** A valid access token, refreshed if needed. */
  async accessToken(): Promise<string> {
    const tokens = this.tokens
    if (!tokens) throw new LoginRequiredError()
    if (tokens.expiresAt - EXPIRY_MARGIN_MS > this.now()) return tokens.accessToken
    return (this.refreshing ??= this.refresh().finally(() => (this.refreshing = undefined)))
  }

  /** Call when the server rejected the current access token. */
  invalidate() {
    const tokens = this.tokens
    if (!tokens) return
    if (tokens.refreshToken) this.tokens = { ...tokens, expiresAt: 0 }
    else this.logout()
  }

  logout() {
    this.storage.removeItem(KEYS.tokens)
  }

  private async refresh(): Promise<string> {
    const tokens = this.tokens
    if (!tokens?.refreshToken) {
      this.logout()
      throw new LoginRequiredError('Your MRX login expired. Please log in again.')
    }
    const metadata = await this.discover()
    try {
      return await this.requestTokens(metadata.token_endpoint, {
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: await this.clientId(metadata),
        resource: this.resourceUrl,
      })
    } catch (e) {
      if (!(e instanceof TokenError)) throw e // network trouble: keep the login
      this.logout()
      throw new LoginRequiredError('Your MRX login expired. Please log in again.')
    }
  }

  private async requestTokens(endpoint: string, body: Record<string, string>): Promise<string> {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok || typeof json.access_token !== 'string') {
      // An unknown client (e.g. registrations were reset) must register again.
      if (json.error === 'invalid_client') this.storage.removeItem(KEYS.client(this.redirectUri))
      throw new TokenError(String(json.error_description ?? json.error ?? response.status))
    }
    const expiresIn = Number(json.expires_in)
    this.tokens = {
      accessToken: json.access_token,
      refreshToken:
        typeof json.refresh_token === 'string' ? json.refresh_token : this.tokens?.refreshToken,
      expiresAt: expiresIn > 0 ? this.now() + expiresIn * 1000 : Infinity,
    }
    return json.access_token
  }

  private async clientId(metadata: ServerMetadata): Promise<string> {
    const key = KEYS.client(this.redirectUri)
    const stored = this.storage.getItem(key)
    if (stored) return stored
    if (!metadata.registration_endpoint) throw new Error('MRX does not allow client registration.')
    const client = await this.json<{ client_id: string }>(metadata.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Untitled MRI Game',
        redirect_uris: [this.redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: SCOPE,
      }),
    })
    this.storage.setItem(key, client.client_id)
    return client.client_id
  }

  private metadata?: Promise<ServerMetadata>

  private discover(): Promise<ServerMetadata> {
    this.metadata ??= (async () => {
      const resource = await this.json<{ authorization_servers?: string[] }>(
        wellKnownUrl(this.resourceUrl, 'oauth-protected-resource'),
      )
      const issuer = resource.authorization_servers?.[0]
      if (!issuer) throw new Error('MRX did not name an authorization server.')
      return this.json<ServerMetadata>(wellKnownUrl(issuer, 'oauth-authorization-server'))
    })()
    this.metadata.catch(() => (this.metadata = undefined))
    return this.metadata
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetch(url, init)
    if (!response.ok) throw new Error(`MRX login: ${url} answered ${response.status}`)
    return (await response.json()) as T
  }

  private get tokens(): Tokens | undefined {
    const raw = this.storage.getItem(KEYS.tokens)
    if (!raw) return undefined
    const tokens = JSON.parse(raw) as Tokens & { expiresAt: number | null }
    return { ...tokens, expiresAt: tokens.expiresAt ?? Infinity } // JSON has no Infinity
  }

  private set tokens(tokens: Tokens) {
    this.storage.setItem(KEYS.tokens, JSON.stringify(tokens))
  }
}

class TokenError extends Error {}

const KEYS = {
  tokens: 'mrx-oauth:tokens',
  pending: 'mrx-oauth:pending',
  client: (redirectUri: string) => `mrx-oauth:client:${redirectUri}`,
}

/** RFC 8414 / 9728: the well-known segment goes between host and path. */
export function wellKnownUrl(base: string, name: string): string {
  const url = new URL(base)
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  return `${url.origin}/.well-known/${name}${path}`
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function randomString(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
