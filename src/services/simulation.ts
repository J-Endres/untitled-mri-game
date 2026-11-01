/**
 * Boundary to the MRX simulation pipeline.
 *
 * Implementations: `mrx/mrxSimulation.ts` (real, MRX tools) and
 * `mockSimulation.ts` (offline). See docs/ARCHITECTURE.md.
 */
import type { Metrics } from '../domain/challenge'
import type { Sequence } from '../domain/sequence'

/** Magnitude image, row-major, values normalised to [0, 1]. */
export interface ReconImage {
  width: number
  height: number
  pixels: Float32Array
}

/** Rows of (kx, ky, kz, t) in 1/m and s, as returned by trajex. */
export type KSpaceRows = Float32Array | Float64Array

export interface Trajectory {
  /** One row per ADC sample. */
  adc: KSpaceRows
  /** One row per sequence event; NaN rows separate repetitions and state changes. */
  full?: KSpaceRows
}

export interface SimulationResult {
  image: ReconImage
  metrics: Metrics
  /** Missing for the offline mock. */
  trajectory?: Trajectory
}

export interface SimulationService {
  /** `onProgress` receives short status texts for the UI ("Scanning…"). */
  simulate(
    sequence: Sequence,
    challengeId: string,
    onProgress?: (status: string) => void,
  ): Promise<SimulationResult>
}
