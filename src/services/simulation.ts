/**
 * Boundary to the MRX simulation pipeline.
 *
 * Real pipeline (see docs/ARCHITECTURE.md): Pulseq export -> upload_file ->
 * trajex_extract_trajectory + rapisim_simulate on the hidden phantom ->
 * reco_reconstruct (nufft). It runs behind a small backend, because the
 * MCP credentials and the phantom choice must not live in the browser.
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
  simulate(sequence: Sequence, challengeId: string): Promise<SimulationResult>
}
