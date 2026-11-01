import { describe, expect, it } from 'vitest'
import { parseNpy, writeComplex64Npy } from './npy'

describe('npy', () => {
  it('round-trips a complex64 array', () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6])
    const parsed = parseNpy(writeComplex64Npy(data, [3, 1]))
    expect(parsed.dtype).toBe('<c8')
    expect(parsed.shape).toEqual([3, 1])
    expect([...parsed.data]).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('aligns the header to 64 bytes', () => {
    const buffer = writeComplex64Npy(new Float32Array(2), [1])
    expect((buffer.byteLength - 8) % 64).toBe(0)
  })
})
