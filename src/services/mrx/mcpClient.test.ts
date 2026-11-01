import { describe, expect, it } from 'vitest'
import { McpClient } from './mcpClient'

/** Answers every request as an SSE stream, delivered in the given chunk sizes. */
function sseServer(lineEnd: string, chunkSize: number) {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { id?: number; method: string }
    if (request.id === undefined) return new Response(null, { status: 202 })
    const result =
      request.method === 'tools/call' ? { content: [{ type: 'text', text: 'ok' }] } : {}
    const event = `event: message${lineEnd}data: ${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}${lineEnd}${lineEnd}`
    const bytes = new TextEncoder().encode(event)
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize)
          controller.enqueue(bytes.slice(i, i + chunkSize))
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }) as typeof fetch
}

describe('McpClient', () => {
  for (const [name, lineEnd] of [
    ['LF', '\n'],
    ['CRLF', '\r\n'],
  ])
    it(`reads SSE responses with ${name} line endings, split into small chunks`, async () => {
      const client = new McpClient('https://mcp.example', sseServer(lineEnd, 3))
      const result = await client.callTool('echo', {})
      expect(result.content[0].text).toBe('ok')
    })
})
