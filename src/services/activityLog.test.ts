import { beforeEach, describe, expect, it } from 'vitest'
import { activityLog, timed } from './activityLog'

describe('activityLog', () => {
  beforeEach(() => activityLog.clear())

  it('records successful operations with their duration', async () => {
    expect(await timed('tool rapisim', async () => 42)).toBe(42)
    const [entry] = activityLog.entries()
    expect(entry).toMatchObject({ level: 'info', message: 'tool rapisim' })
    expect(entry.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('records failures as errors and rethrows', async () => {
    await expect(
      timed('tool reco', async () => {
        throw new Error('bad matrix')
      }),
    ).rejects.toThrow('bad matrix')
    expect(activityLog.entries()[0]).toMatchObject({
      level: 'error',
      message: 'tool reco: bad matrix',
    })
  })

  it('notifies subscribers and returns a new array on change', () => {
    const before = activityLog.entries()
    let calls = 0
    const unsubscribe = activityLog.subscribe(() => calls++)
    activityLog.info('hello')
    unsubscribe()
    activityLog.info('ignored')
    expect(calls).toBe(1)
    expect(activityLog.entries()).not.toBe(before)
  })
})
