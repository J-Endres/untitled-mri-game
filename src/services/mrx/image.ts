/**
 * Turns MRX results into something the game can show and score.
 */
import type { ReconImage } from '../simulation'
import type { NpyArray } from './npy'

/**
 * Magnitude image from a complex (nx, ny) reconstruction, normalised to [0, 1].
 * MRX puts x on axis 0 and y on axis 1 with y pointing up, so rows are flipped
 * to get a screen image (row 0 = top).
 */
export function magnitudeImage(reco: NpyArray): ReconImage {
  const [nx, ny = 1] = reco.shape
  const complex = reco.dtype === '<c8' || reco.dtype === '<c16'
  const pixels = new Float32Array(nx * ny)
  let max = 0
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      const k = x * ny + y
      const v = complex
        ? Math.hypot(reco.data[2 * k], reco.data[2 * k + 1])
        : Math.abs(reco.data[k])
      pixels[(ny - 1 - y) * nx + x] = v
      max = Math.max(max, v)
    }
  }
  if (max > 0) pixels.forEach((v, i) => (pixels[i] = v / max))
  return { width: nx, height: ny, pixels }
}

/**
 * SNR of a magnitude image: mean of the object over the noise standard
 * deviation. Object and background are separated with Otsu's threshold; in
 * the background the magnitude of complex Gaussian noise is Rayleigh
 * distributed, so sigma = mean / sqrt(pi / 2). Reconstruction artefacts in the
 * background count as noise, which is intended for the game.
 */
export function estimateSnr(image: ReconImage): number {
  const values = [...image.pixels]
  const threshold = otsu(values)
  const object = values.filter((v) => v > threshold)
  const background = values.filter((v) => v <= threshold)
  if (!object.length || !background.length) return 0
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const sigma = mean(background) / Math.sqrt(Math.PI / 2)
  return sigma > 0 ? mean(object) / sigma : Infinity
}

/** Otsu's method on values in [0, 1]. */
export function otsu(values: number[], bins = 64): number {
  const hist = new Array<number>(bins).fill(0)
  for (const v of values) hist[Math.min(bins - 1, Math.floor(v * bins))]++
  const total = values.length
  const sumAll = hist.reduce((s, h, i) => s + h * i, 0)
  let best = 0
  let bestVar = -1
  let w0 = 0
  let sum0 = 0
  for (let t = 0; t < bins; t++) {
    w0 += hist[t]
    sum0 += hist[t] * t
    const w1 = total - w0
    if (!w0 || !w1) continue
    const between = w0 * w1 * (sum0 / w0 - (sumAll - sum0) / w1) ** 2
    if (between > bestVar) {
      bestVar = between
      best = t
    }
  }
  return (best + 1) / bins
}

/** Complex Gaussian noise with standard deviation `sigma` per component (Box-Muller). */
export function addComplexNoise(data: Float32Array, sigma: number, random = Math.random) {
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i += 2) {
    const r = sigma * Math.sqrt(-2 * Math.log(1 - random()))
    const phi = 2 * Math.PI * random()
    out[i] = data[i] + r * Math.cos(phi)
    out[i + 1] = data[i + 1] + r * Math.sin(phi)
  }
  return out
}
