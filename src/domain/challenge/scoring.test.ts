import { describe, expect, it } from 'vitest'
import { evaluateConstraints, score } from './scoring'
import type { Constraint } from './types'

const constraints: Constraint[] = [
  { metric: 'sar', bound: 'max', limit: 2 },
  { metric: 'snr', bound: 'min', limit: 10 },
]

describe('scoring', () => {
  it('evaluates min and max bounds', () => {
    const { results, allSatisfied } = evaluateConstraints(constraints, {
      sar: 3,
      snr: 12,
      durationS: 1,
    })
    expect(results.map((r) => r.satisfied)).toEqual([false, true])
    expect(allSatisfied).toBe(false)
  })

  it('rewards shorter scans and gives zero for wrong answers', () => {
    const fast = { sar: 1, snr: 20, durationS: 1 }
    const slow = { ...fast, durationS: 4 }
    expect(score(constraints, fast, true)).toBeGreaterThan(score(constraints, slow, true))
    expect(score(constraints, fast, false)).toBe(0)
  })
})
