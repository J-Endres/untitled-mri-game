import { describe, expect, it } from 'vitest'
import { addComplexNoise, estimateSnr, magnitudeImage } from './image'

describe('magnitudeImage', () => {
  it('normalises and flips y so that row 0 is the top', () => {
    // nx = 2, ny = 2; element [x][y] at x * ny + y, complex interleaved
    const data = new Float32Array([0, 0, 2, 0, 0, 0, 0, 1]) // [0][1] = 2, [1][1] = i
    const img = magnitudeImage({ dtype: '<c8', shape: [2, 2], data })
    expect([...img.pixels]).toEqual([1, 0.5, 0, 0]) // top row is y = 1
  })
})

describe('estimateSnr', () => {
  it('is higher for less noise', () => {
    const make = (sigma: number) => {
      const n = 32
      const clean = new Float32Array(2 * n * n)
      for (let i = 0; i < n * n; i++) if (i % n > 8 && i % n < 24) clean[2 * i] = 1
      let seed = 1
      const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
      return estimateSnr(
        magnitudeImage({
          dtype: '<c8',
          shape: [n, n],
          data: addComplexNoise(clean, sigma, random),
        }),
      )
    }
    expect(make(0.02)).toBeGreaterThan(make(0.1))
    expect(make(0.1)).toBeGreaterThan(3)
  })
})
