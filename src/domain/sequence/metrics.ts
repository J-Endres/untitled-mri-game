/**
 * Metrics that can be computed directly from the sequence, without simulation.
 * The SAR value is a rough heuristic for game balancing, not a safety number.
 */
import type { SeqEvent, SeqNode, Sequence } from './types'

const GAMMA_HZ_PER_T = 42.577e6

export function eventDurationUs(event: SeqEvent): number {
  return event.kind === 'adc' ? event.samples * event.dwellUs : event.durationUs
}

/** A block lasts as long as its longest event. */
export const blockDurationUs = (events: SeqEvent[]): number =>
  Math.max(0, ...events.map(eventDurationUs))

export function nodeDurationUs(node: SeqNode): number {
  return node.type === 'block'
    ? blockDurationUs(node.events)
    : node.count * node.body.reduce((sum, n) => sum + nodeDurationUs(n), 0)
}

export const sequenceDurationUs = (seq: Sequence): number =>
  seq.nodes.reduce((sum, n) => sum + nodeDurationUs(n), 0)

/** Number of ADC events executed, i.e. k-space lines acquired. */
export function adcCount(nodes: SeqNode[]): number {
  return nodes.reduce(
    (sum, n) =>
      sum +
      (n.type === 'block'
        ? n.events.filter((e) => e.kind === 'adc').length
        : n.count * adcCount(n.body)),
    0,
  )
}

/** RF energy in T²·s (B1² integrated over time), assuming hard pulses. */
function rfEnergy(nodes: SeqNode[]): number {
  let energy = 0
  for (const node of nodes) {
    if (node.type === 'loop') {
      energy += node.count * rfEnergy(node.body)
      continue
    }
    for (const e of node.events) {
      if (e.kind !== 'rf') continue
      const tau = e.durationUs * 1e-6
      const b1 = e.flipAngleDeg / 360 / (GAMMA_HZ_PER_T * tau)
      // A sinc pulse needs roughly 3x the peak amplitude for the same flip angle.
      const shapeFactor = e.shape === 'sinc' ? 3 : 1
      energy += (b1 * shapeFactor) ** 2 * tau
    }
  }
  return energy
}

/** Scaling from mean B1² (T²) to a W/kg-like number in a plausible range. */
const SAR_SCALE = 5e11

/** Heuristic whole-body SAR in "W/kg" (game units). */
export function estimateSar(seq: Sequence): number {
  const duration = sequenceDurationUs(seq) * 1e-6
  return duration > 0 ? (SAR_SCALE * rfEnergy(seq.nodes)) / duration : 0
}

/** Dwell time of every ADC sample in sequence order (loops unrolled), in µs. */
export function adcSampleDwellsUs(nodes: SeqNode[]): number[] {
  const out: number[] = []
  const walk = (list: SeqNode[]) => {
    for (const n of list) {
      if (n.type === 'loop') {
        for (let i = 0; i < n.count; i++) walk(n.body)
      } else {
        for (const e of n.events)
          if (e.kind === 'adc') out.push(...Array<number>(e.samples).fill(e.dwellUs))
      }
    }
  }
  walk(nodes)
  return out
}
