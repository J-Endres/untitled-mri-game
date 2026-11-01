/**
 * MOCK: simulation that renders a procedural "phantom" at a resolution derived from
 * the sequence and adds noise according to a made-up SNR model. Duration and
 * SAR are computed from the sequence like the real service will do.
 */
import {
  adcCount,
  estimateSar,
  sequenceDurationUs,
  type AdcEvent,
  type RfEvent,
  type SeqNode,
  type Sequence,
} from '../domain/sequence'
import type { ReconImage, SimulationService } from './simulation'

function collect<T>(nodes: SeqNode[], kind: string): T[] {
  return nodes.flatMap((n) =>
    n.type === 'block'
      ? (n.events.filter((e) => e.kind === kind) as T[])
      : collect<T>(n.body, kind),
  )
}

/** Brain-ish ellipse with "ventricles" - only meant to look vaguely anatomical. */
function phantom(x: number, y: number): number {
  const r = (cx: number, cy: number, a: number, b: number) =>
    ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2
  if (r(0, 0, 0.72, 0.9) > 1) return 0
  if (r(0, 0, 0.66, 0.84) > 1) return 1 // skull/fat
  if (r(-0.12, -0.1, 0.08, 0.28) < 1 || r(0.12, -0.1, 0.08, 0.28) < 1) return 0.25 // ventricles
  return 0.6 + 0.15 * Math.sin(9 * x) * Math.cos(7 * y) // folded "grey matter"
}

function render(nx: number, ny: number, noise: number): ReconImage {
  const size = 128
  const pixels = new Float32Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // Sample the phantom on the coarse (nx, ny) grid -> visible blockiness.
      const x = (Math.floor((i / size) * nx) + 0.5) / nx
      const y = (Math.floor((j / size) * ny) + 0.5) / ny
      const v = phantom(2 * x - 1, 2 * y - 1) + noise * (Math.random() - 0.5)
      pixels[j * size + i] = Math.min(1, Math.max(0, v))
    }
  }
  return { width: size, height: size, pixels }
}

export const mockSimulationService: SimulationService = {
  async simulate(sequence: Sequence) {
    await new Promise((resolve) => setTimeout(resolve, 900)) // pretend to be a server

    const lines = adcCount(sequence.nodes)
    const adcs = collect<AdcEvent>(sequence.nodes, 'adc')
    const rfs = collect<RfEvent>(sequence.nodes, 'rf')
    const samples = adcs[0]?.samples ?? 0
    const meanFlip = rfs.length ? rfs.reduce((s, rf) => s + rf.flipAngleDeg, 0) / rfs.length : 0

    const snr =
      lines && samples
        ? Math.sqrt(lines * samples) * Math.abs(Math.sin((meanFlip * Math.PI) / 180)) * 0.6
        : 0
    const image = render(Math.max(1, samples), Math.max(1, lines), snr > 0 ? 3 / snr : 1)

    return {
      image,
      metrics: {
        durationS: sequenceDurationUs(sequence) * 1e-6,
        sar: estimateSar(sequence),
        snr,
      },
    }
  },
}
