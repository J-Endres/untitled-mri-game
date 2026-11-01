/**
 * Simulation via the MRX tools, called directly from the browser:
 *
 *   writePulseq -> upload_file -> trajex (k-space) + rapisim (signal)
 *   -> add noise -> upload noisy signal -> reco_reconstruct (nufft)
 *
 * Noise is not part of the simulation, so it is added here. Its level is
 * relative to the phantom's equilibrium magnetisation, measured once per
 * phantom with a reference scan, so the SNR does not depend on the arbitrary
 * signal scale of the simulator.
 *
 * Runs in the browser for now; the phantom choice therefore is not secret.
 * Moves to a backend together with the switch to OAuth (see config.ts).
 */
import {
  adcCount,
  adcSampleDwellsUs,
  createBlock,
  createEvent,
  estimateSar,
  sequenceDurationUs,
  type Sequence,
} from '../../domain/sequence'
import { writePulseq } from '../../domain/pulseq'
import type { SimulationService } from '../simulation'
import { mrxConfig } from './config'
import { addComplexNoise, estimateSnr, magnitudeImage } from './image'
import { McpClient, type ToolResult } from './mcpClient'
import { parseNpy, writeComplex64Npy } from './npy'

/** Hidden phantom per challenge (bifti registry). */
const PHANTOMS: Record<string, { collection: string; file_name: string }> = {
  'first-light': { collection: 'endres-bifti_demo-001', file_name: 'subj42-3T.json' },
}

/** Reconstruction field of view in m - covers the head phantoms. */
const RECO_FOV_M = 0.2
const MAX_MATRIX = 256

/**
 * Noise per sample relative to the equilibrium magnetisation of the whole
 * phantom, at the reference dwell time. Longer dwell times (lower bandwidth)
 * mean less noise per sample. Tuned so the starter sequence lands near SNR 10.
 */
const NOISE_REL = 1e-4
const NOISE_REF_DWELL_US = 20

export function createMrxSimulationService(): SimulationService {
  const auth: Record<string, string> = mrxConfig.apiKey
    ? { Authorization: `Bearer ${mrxConfig.apiKey}` }
    : {}
  const client = new McpClient(mrxConfig.url, auth)
  const phantomCache = new Map<string, Promise<{ hash: string; m0: number }>>()

  const call = (name: string, args: Record<string, unknown>) => client.callTool(name, args)

  async function download(url: string) {
    const response = await fetch(url, { headers: auth })
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
    return parseNpy(await response.arrayBuffer())
  }

  async function uploadText(fileName: string, content: string): Promise<string> {
    const result = await call('upload_file', { file_name: fileName, content })
    return String(structured(result).result ?? JSON.parse(text(result)).result)
  }

  async function uploadBinary(fileName: string, body: ArrayBuffer): Promise<string> {
    const { url } = structured(await call('create_upload_url', { file_name: fileName })) as {
      url: string
    }
    const response = await fetch(url, { method: 'PUT', body })
    if (!response.ok) throw new Error(`Upload failed (${response.status})`)
    return (await response.text()).trim()
  }

  async function simulateSignal(sequenceHash: string, phantomHash: string) {
    const result = await call('rapisim_simulate', {
      sequence: sequenceHash,
      phantom: phantomHash,
      sampler: 'fft',
    })
    return download(link(result, (name) => name === 'signal.npy'))
  }

  /** Loads the phantom and measures its equilibrium magnetisation. */
  function phantom(challengeId: string) {
    let cached = phantomCache.get(challengeId)
    if (!cached) {
      cached = (async () => {
        const ref = PHANTOMS[challengeId]
        if (!ref) throw new Error(`No phantom for challenge ${challengeId}`)
        const result = await call('bifti_get_phantom', {
          collection: ref.collection,
          phantom: { file_name: ref.file_name },
          reslice: true,
        })
        const hash = hashOf(link(result, (name) => name.endsWith('.zip')))
        // 90° pulse, then one sample at the k-space centre: |signal| = total M0.
        const reference: Sequence = {
          nodes: [
            createBlock({ ...createEvent('rf'), flipAngleDeg: 90, durationUs: 100 }),
            createBlock({ ...createEvent('adc'), samples: 1, dwellUs: 10 }),
          ],
        }
        const signal = await simulateSignal(
          await uploadText('reference.seq', writePulseq(reference)),
          hash,
        )
        return { hash, m0: Math.hypot(signal.data[0], signal.data[1]) }
      })()
      cached.catch(() => phantomCache.delete(challengeId))
      phantomCache.set(challengeId, cached)
    }
    return cached
  }

  return {
    async simulate(sequence, challengeId, onProgress = () => {}) {
      if (adcCount(sequence.nodes) === 0)
        throw new Error('The sequence has no ADC - nothing to see.')
      const metrics = {
        durationS: sequenceDurationUs(sequence) * 1e-6,
        sar: estimateSar(sequence),
      }

      onProgress('Preparing scanner…')
      const [{ hash: phantomHash, m0 }, sequenceHash] = await Promise.all([
        phantom(challengeId),
        uploadText('game.seq', writePulseq(sequence)),
      ])

      onProgress('Scanning…')
      const [kspaceResult, signal] = await Promise.all([
        call('trajex_extract_trajectory', {
          sequence: sequenceHash,
          t1: 1,
          t2: 0.1,
          min_mag: 1e-4,
        }),
        simulateSignal(sequenceHash, phantomHash),
      ])
      const kspaceHash = String((structured(kspaceResult).kspace as { sha256: string }).sha256)
      const kspace = await download(link(kspaceResult, (name) => name.endsWith('-kspace.npy')))

      onProgress('Reconstructing…')
      const dwells = adcSampleDwellsUs(sequence.nodes)
      const noisy = new Float32Array(signal.data.length)
      for (let i = 0; i < dwells.length; i++) {
        const sigma = NOISE_REL * m0 * Math.sqrt(NOISE_REF_DWELL_US / dwells[i])
        noisy.set(
          addComplexNoise(Float32Array.from(signal.data.subarray(2 * i, 2 * i + 2)), sigma),
          2 * i,
        )
      }
      const noisyHash = await uploadBinary(
        'signal-noisy.npy',
        writeComplex64Npy(noisy, signal.shape),
      )

      const reco = await call('reco_reconstruct', {
        signal: noisyHash,
        kspace: kspaceHash,
        method: 'nufft',
        fov: [RECO_FOV_M, RECO_FOV_M, RECO_FOV_M],
        resolution: matrixFor(kspace.data),
      })
      const image = magnitudeImage(await download(link(reco, (name) => name.endsWith('.npy'))))
      return { image, metrics: { ...metrics, snr: estimateSnr(image) } }
    },
  }
}

/**
 * Smallest matrix whose Nyquist limit covers the sampled k-space (the reco
 * tool rejects anything else). kspace rows are (kx, ky, kz, t) in 1/m.
 */
export function matrixFor(kspace: Float32Array | Float64Array): [number, number, number] {
  const kmax = [0, 0, 0]
  for (let i = 0; i < kspace.length; i += 4) {
    for (let a = 0; a < 3; a++) kmax[a] = Math.max(kmax[a], Math.abs(kspace[i + a]))
  }
  const [x, y] = kmax.map((k) =>
    Math.min(MAX_MATRIX, Math.max(1, Math.ceil(2 * k * RECO_FOV_M - 1e-3))),
  )
  return [x, y, 1] // 2D only for now: kz is ignored
}

const text = (r: ToolResult) => r.content.map((c) => c.text ?? '').join('')
const structured = (r: ToolResult) => r.structuredContent ?? {}
const hashOf = (url: string) => url.split('/').pop()!

function link(result: ToolResult, match: (name: string) => boolean): string {
  const item = result.content.find(
    (c) => c.type === 'resource_link' && c.uri && match(c.name ?? ''),
  )
  if (!item?.uri) throw new Error('Unexpected MRX response: resource link missing')
  return item.uri
}
