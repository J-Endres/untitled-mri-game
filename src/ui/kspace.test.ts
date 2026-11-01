import { describe, expect, it } from 'vitest'
import { kExtent } from './kspace'

describe('kExtent', () => {
  it('finds the largest |kx| or |ky| and skips NaN separator rows', () => {
    const adc = new Float32Array([10, -20, 0, 0, 5, 5, 0, 1])
    const full = new Float32Array([NaN, NaN, NaN, NaN, -30, 1, 99, 2])
    expect(kExtent(adc, full)).toBe(30) // kz (99) is ignored
    expect(kExtent(undefined)).toBe(0)
  })
})
