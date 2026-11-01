/**
 * Minimal MCP client for the Streamable HTTP transport, just enough to call
 * tools: initialize once, then `tools/call`. Responses may come as plain JSON
 * or as a server-sent event stream; both are handled.
 */
const PROTOCOL_VERSION = '2025-06-18'

export interface ToolContent {
  type: string
  text?: string
  uri?: string
  name?: string
}

export interface ToolResult {
  content: ToolContent[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export class McpClient {
  private sessionId?: string
  private initialized?: Promise<void>
  private nextId = 1
  private readonly url: string
  private readonly headers: Record<string, string>

  constructor(url: string, headers: Record<string, string>) {
    this.url = url
    this.headers = headers
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    await (this.initialized ??= this.initialize())
    const result = (await this.request('tools/call', { name, arguments: args })) as ToolResult
    if (result.isError) {
      const message = result.content.map((c) => c.text).join('\n')
      throw new Error(`${name} failed: ${message}`)
    }
    return result
  }

  private async initialize() {
    try {
      await this.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'untitled-mri-game', version: '0.0.0' },
      })
      await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    } catch (e) {
      this.initialized = undefined // allow a retry on the next call
      throw e
    }
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++
    const response = await this.post({ jsonrpc: '2.0', id, method, params })
    const message = await readResponse(response, id)
    if (message.error) throw new Error(`MCP ${method}: ${message.error.message}`)
    return message.result
  }

  private async post(body: unknown): Promise<Response> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': PROTOCOL_VERSION,
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
        ...this.headers,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${await response.text()}`)
    this.sessionId = response.headers.get('Mcp-Session-Id') ?? this.sessionId
    return response
  }
}

interface JsonRpcMessage {
  id?: number
  result?: unknown
  error?: { message: string }
}

async function readResponse(response: Response, id: number): Promise<JsonRpcMessage> {
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    return (await response.json()) as JsonRpcMessage
  }
  // SSE: events are separated by blank lines; we want the one answering `id`.
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) throw new Error('MCP stream ended without a response')
    buffer += value
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')
      if (!data) continue
      const message = JSON.parse(data) as JsonRpcMessage
      if (message.id === id) {
        void reader.cancel()
        return message
      }
    }
  }
}
