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

export interface SimulationResult {
  image: ReconImage
  metrics: Metrics
}

export interface SimulationService {
  /** `onProgress` receives short status texts for the UI ("Scanning…"). */
  simulate(
    sequence: Sequence,
    challengeId: string,
    onProgress?: (status: string) => void,
  ): Promise<SimulationResult>
}
