import { LoginRequiredError } from './oauth'

export interface TokenSource {
  accessToken(): Promise<string>
  /** Called when the server rejected the token; the next `accessToken()` should be fresh. */
  invalidate?(): void
}

/**
 * `fetch` that sends `Authorization: Bearer <token>`. On a 401 the token is
 * invalidated and the request retried once, which covers revoked or
 * expired-early tokens; a second 401 means the user has to log in again.
 */
export function authorizedFetch(tokens: TokenSource, base: typeof fetch = fetch): typeof fetch {
  const attempt = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${await tokens.accessToken()}`)
    return base(input, { ...init, headers })
  }
  return async (input, init) => {
    let response = await attempt(input, init)
    if (response.status === 401 && tokens.invalidate) {
      tokens.invalidate()
      response = await attempt(input, init)
    }
    if (response.status === 401)
      throw new LoginRequiredError('MRX rejected the login. Please log in again.')
    return response
  }
}
