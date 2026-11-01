import { describe, expect, it } from 'vitest'
import { createBlock, createEvent, createLoop, createStarterSequence } from './factory'
import { adcCount, adcSampleDwellsUs, estimateSar, sequenceDurationUs } from './metrics'
import type { AdcEvent, GradientEvent } from './types'

describe('sequence metrics', () => {
  it('uses the longest event as block duration and multiplies loops', () => {
    const adc = { ...createEvent('adc'), samples: 100, dwellUs: 10 } as AdcEvent // 1000 us
    const gx = { ...createEvent('gradient'), durationUs: 1500 } as GradientEvent
    const seq = { nodes: [createLoop(3, [createBlock(adc, gx)])] }
    expect(sequenceDurationUs(seq)).toBe(4500)
    expect(adcCount(seq.nodes)).toBe(3)
    expect(adcSampleDwellsUs(seq.nodes)).toEqual(Array(300).fill(10))
  })

  it('gives the starter sequence a plausible SAR', () => {
    const sar = estimateSar(createStarterSequence())
    expect(sar).toBeGreaterThan(0)
    expect(sar).toBeLessThan(4)
  })

  it('scales SAR with the square of the flip angle', () => {
    const seq = (fa: number) => ({
      nodes: [createBlock({ ...createEvent('rf'), flipAngleDeg: fa } as never)],
    })
    expect(estimateSar(seq(90)) / estimateSar(seq(45))).toBeCloseTo(4)
  })
})
