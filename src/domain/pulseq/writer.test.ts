import { describe, expect, it } from 'vitest'
import { createBlock, createEvent, createLoop, type Sequence } from '../sequence'
import { compressShape, decompressShape, rfShape } from './shapes'
import { makeTrapezoid, writePulseq } from './writer'

/** Lines of one [SECTION] of a Pulseq file, without comments. */
function section(text: string, name: string): string[] {
  const lines = text.split('\n')
  const start = lines.indexOf(`[${name}]`)
  if (start < 0) return []
  const end = lines.findIndex((l, i) => i > start && l.trim() === '')
  return lines.slice(start + 1, end).filter((l) => !l.startsWith('#'))
}

describe('makeTrapezoid', () => {
  it.each([
    [320, 1280e-6, 'trapezoid'],
    [-160, 800e-6, 'trapezoid'],
    [1500, 2000e-6, 'trapezoid'],
    [100, 400e-6, 'triangle'],
  ] as const)('keeps area %d in %f s (%s)', (area, duration, shape) => {
    const t = makeTrapezoid(area, duration, shape)
    expect(t.amplitude * (t.flat + (t.rise + t.fall) / 2)).toBeCloseTo(area, 6)
    expect(t.rise + t.flat + t.fall).toBeCloseTo(duration, 9)
    expect(Math.round(t.rise / 10e-6) * 10e-6).toBeCloseTo(t.rise, 12) // on raster
  })
})

describe('shapes', () => {
  it('compresses and decompresses losslessly', () => {
    for (const samples of [rfShape('block', 500), rfShape('sinc', 300), [0, 0, 0, 1, 2, 3, 3]]) {
      const restored = decompressShape(compressShape(samples), samples.length)
      restored.forEach((v, i) => expect(v).toBeCloseTo(samples[i], 6))
    }
  })

  it('compresses a constant shape to four numbers', () => {
    expect(compressShape(rfShape('block', 500))).toEqual([1, 0, 0, 497])
  })
})

describe('writePulseq', () => {
  const rf = { ...createEvent('rf'), flipAngleDeg: 90, durationUs: 1000 }
  const adc = { ...createEvent('adc'), samples: 64, dwellUs: 20 }
  const gy = { ...createEvent('gradient'), axis: 'y' as const, area: 0, areaStep: 10 }

  it('unrolls loops and deduplicates identical events', () => {
    const seq: Sequence = { nodes: [createLoop(4, [createBlock(rf), createBlock(adc)])] }
    const text = writePulseq(seq)
    expect(section(text, 'BLOCKS')).toHaveLength(8)
    expect(section(text, 'RF')).toHaveLength(1)
    expect(section(text, 'ADC')).toEqual(['1 64 20000 0 0 0'])
  })

  it('computes the RF amplitude from the flip angle', () => {
    // 90° block pulse of 1 ms: amplitude = 0.25 / 1 ms = 250 Hz
    const [line] = section(writePulseq({ nodes: [createBlock(rf)] }), 'RF')
    expect(Number(line.split(' ')[1])).toBeCloseTo(250, 3)
  })

  it('steps gradient areas per loop iteration, centred', () => {
    const text = writePulseq({ nodes: [createLoop(3, [createBlock(gy)])] })
    const traps = section(text, 'TRAP').map((l) => l.split(' ').map(Number))
    // areas -10, 0, 10 -> amplitudes negative, zero, positive
    expect(traps.map((t) => Math.sign(t[1]))).toEqual([-1, 0, 1])
    expect(section(text, 'BLOCKS').map((l) => l.split(' ')[4])).toEqual(['1', '2', '3'])
  })

  it('makes linked events share a block lasting as long as the longest event', () => {
    const gx = { ...createEvent('gradient'), area: 320, durationUs: 1500 }
    const [block] = section(writePulseq({ nodes: [createBlock(adc, gx)] }), 'BLOCKS')
    expect(block).toBe('1 150 0 1 0 0 1 0') // 1.5 ms, gx = TRAP 1, ADC 1
  })

  it('writes the total duration', () => {
    const text = writePulseq({
      nodes: [createBlock({ ...createEvent('delay'), durationUs: 5000 })],
    })
    expect(section(text, 'DEFINITIONS')).toContain('TotalDuration 0.005')
  })
})
