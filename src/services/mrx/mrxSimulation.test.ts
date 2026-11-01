import { describe, expect, it } from 'vitest'
import { matrixFor } from './mrxSimulation'

describe('matrixFor', () => {
  it('picks the smallest matrix covering the sampled k-space at 200 mm FOV', () => {
    // kx in -160..155 (64 steps of 5 /m), ky in -80..75
    const k = new Float32Array([-160, -80, 0, 0, 155, 75, 0, 1e-3])
    expect(matrixFor(k)).toEqual([64, 32, 1])
  })
})
