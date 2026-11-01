/**
 * In-memory log of what the game did: MRX tool calls and transfers with their
 * durations, and errors. Shown in the Logs tab; React subscribes via
 * `useSyncExternalStore(activityLog.subscribe, activityLog.entries)`.
 */
export interface LogEntry {
  id: number
  /** Epoch ms when the entry was written (end of the operation). */
  time: number
  level: 'info' | 'error'
  message: string
  durationMs?: number
}

const MAX_ENTRIES = 300

let entries: readonly LogEntry[] = []
let nextId = 1
const listeners = new Set<() => void>()

function add(level: LogEntry['level'], message: string, durationMs?: number) {
  const entry = { id: nextId++, time: Date.now(), level, message, durationMs }
  entries = [...entries, entry].slice(-MAX_ENTRIES)
  listeners.forEach((l) => l())
}

export const activityLog = {
  info: (message: string, durationMs?: number) => add('info', message, durationMs),
  error: (message: string, durationMs?: number) => add('error', message, durationMs),
  entries: () => entries,
  clear() {
    entries = []
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Runs `fn`, logging `label` with its duration, or the error it threw. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    activityLog.info(label, performance.now() - start)
    return result
  } catch (e) {
    activityLog.error(`${label}: ${errorMessage(e)}`, performance.now() - start)
    throw e
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))
