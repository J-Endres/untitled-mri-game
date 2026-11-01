import { describe, expect, it } from 'vitest'
import { authorizedFetch } from './authFetch'
import { LoginRequiredError, MrxOAuth, pkceChallenge, wellKnownUrl } from './oauth'

const GW = 'https://gw.example'
const RESOURCE = `${GW}/mcp`
const APP = 'https://user.github.io/game/'

class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
}

/** Fake MRX authorization server; records requests. */
function fakeServer() {
  const requests: { url: string; body: string }[] = []
  let issued = 0
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const server = {
    requests,
    rejectRefresh: false,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? String(init.body) : ''
      requests.push({ url, body })
      if (url === `${GW}/.well-known/oauth-protected-resource/mcp`)
        return json({ resource: RESOURCE, authorization_servers: [`${GW}/`] })
      if (url === `${GW}/.well-known/oauth-authorization-server`)
        return json({
          issuer: `${GW}/`,
          authorization_endpoint: `${GW}/authorize`,
          token_endpoint: `${GW}/token`,
          registration_endpoint: `${GW}/register`,
        })
      if (url === `${GW}/register`) return json({ client_id: 'client-1' }, 201)
      if (url === `${GW}/token`) {
        const params = new URLSearchParams(body)
        if (params.get('grant_type') === 'refresh_token' && server.rejectRefresh)
          return json({ error: 'invalid_grant' }, 400)
        issued++
        return json({
          access_token: `access-${issued}`,
          refresh_token: `refresh-${issued}`,
          expires_in: 3600,
        })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch,
  }
  return server
}

function setup() {
  const server = fakeServer()
  let time = 1_000_000
  let navigatedTo = ''
  const storage = new MemoryStorage()
  const options = {
    resourceUrl: RESOURCE,
    redirectUri: APP,
    storage,
    session: new MemoryStorage(),
    fetch: server.fetch,
    navigate: (url: string) => (navigatedTo = url),
    now: () => time,
  }
  const auth = new MrxOAuth(options)
  return {
    server,
    auth,
    options,
    storage,
    navigated: () => new URL(navigatedTo),
    advance: (ms: number) => (time += ms),
  }
}

async function loggedIn() {
  const s = setup()
  await s.auth.login()
  const state = s.navigated().searchParams.get('state')!
  expect(await s.auth.handleRedirect(`${APP}?code=the-code&state=${state}&iss=${GW}/`)).toBe(true)
  return s
}

describe('wellKnownUrl', () => {
  it('inserts the well-known segment before the path', () => {
    expect(wellKnownUrl(`${GW}/mcp`, 'oauth-protected-resource')).toBe(
      `${GW}/.well-known/oauth-protected-resource/mcp`,
    )
    expect(wellKnownUrl(`${GW}/`, 'oauth-authorization-server')).toBe(
      `${GW}/.well-known/oauth-authorization-server`,
    )
  })
})

describe('pkceChallenge', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

describe('MrxOAuth', () => {
  it('registers a client and redirects to the authorization endpoint with PKCE', async () => {
    const { auth, navigated, server } = setup()
    expect(auth.isLoggedIn()).toBe(false)
    await auth.login()
    const url = navigated()
    expect(url.origin + url.pathname).toBe(`${GW}/authorize`)
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: APP,
      code_challenge_method: 'S256',
      resource: RESOURCE,
    })
    const registration = JSON.parse(server.requests.find((r) => r.url.endsWith('/register'))!.body)
    expect(registration).toMatchObject({ redirect_uris: [APP], token_endpoint_auth_method: 'none' })
  })

  it('exchanges the code with the PKCE verifier', async () => {
    const { auth, server } = await loggedIn()
    expect(auth.isLoggedIn()).toBe(true)
    expect(await auth.accessToken()).toBe('access-1')
    const token = new URLSearchParams(server.requests.find((r) => r.url.endsWith('/token'))!.body)
    expect(token.get('grant_type')).toBe('authorization_code')
    expect(token.get('code')).toBe('the-code')
    expect(token.get('code_verifier')).toMatch(/^[\w-]{43}$/)
  })

  it('reuses the registered client for the next login', async () => {
    const { options, server } = await loggedIn()
    await new MrxOAuth(options).login()
    expect(server.requests.filter((r) => r.url.endsWith('/register'))).toHaveLength(1)
  })

  it('ignores page loads that are not a login redirect', async () => {
    const { auth } = setup()
    expect(await auth.handleRedirect(APP)).toBe(false)
  })

  it('rejects a redirect with an unknown state', async () => {
    const { auth } = setup()
    await auth.login()
    await expect(auth.handleRedirect(`${APP}?code=x&state=forged`)).rejects.toThrow(/state/)
    expect(auth.isLoggedIn()).toBe(false)
  })

  it('reports a denied login', async () => {
    const { auth, navigated } = setup()
    await auth.login()
    const state = navigated().searchParams.get('state')
    await expect(auth.handleRedirect(`${APP}?error=access_denied&state=${state}`)).rejects.toThrow(
      /access_denied/,
    )
  })

  it('refreshes the access token before it expires', async () => {
    const { auth, advance } = await loggedIn()
    advance(3600_000 - 30_000)
    expect(await auth.accessToken()).toBe('access-2')
  })

  it('asks for a new login when the refresh is rejected', async () => {
    const { auth, advance, server } = await loggedIn()
    server.rejectRefresh = true
    advance(3600_000)
    await expect(auth.accessToken()).rejects.toBeInstanceOf(LoginRequiredError)
    expect(auth.isLoggedIn()).toBe(false)
  })
})

describe('authorizedFetch', () => {
  it('sends the bearer token and retries once with a fresh one after a 401', async () => {
    const { auth } = await loggedIn()
    const seen: string[] = []
    const api = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization')!
      seen.push(authorization)
      return new Response(null, { status: authorization === 'Bearer access-1' ? 401 : 200 })
    }) as typeof fetch
    const response = await authorizedFetch(auth, api)(`${GW}/files/abc`)
    expect(response.status).toBe(200)
    expect(seen).toEqual(['Bearer access-1', 'Bearer access-2'])
  })

  it('throws LoginRequiredError when the server keeps rejecting the token', async () => {
    const api = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch
    const tokens = { accessToken: async () => 'key' }
    await expect(authorizedFetch(tokens, api)('x')).rejects.toBeInstanceOf(LoginRequiredError)
  })
})
