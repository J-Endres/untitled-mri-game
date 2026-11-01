/**
 * Pulseq shape compression (derivative + run-length encoding), as in
 * pypulseq's `compress_shape`. Falls back to the raw samples when compression
 * does not make the shape shorter; readers detect that by the sample count.
 */
const QUANT = 1e-7

export function compressShape(samples: number[]): number[] {
  const scaled = samples.map((v) => v / QUANT)
  const datq: number[] = []
  let sum = 0
  for (const v of scaled) {
    const d = Math.round(v - sum)
    datq.push(d)
    sum += d
  }
  const values: number[] = []
  for (let i = 0; i < datq.length;) {
    let j = i
    while (j + 1 < datq.length && datq[j + 1] === datq[i]) j++
    const run = j - i + 1
    const v = datq[i] * QUANT
    values.push(v)
    if (run >= 2) values.push(v, run - 2)
    i = j + 1
  }
  return values.length < samples.length ? values.map((v) => (Math.abs(v) < 1e-10 ? 0 : v)) : samples
}

export function decompressShape(data: number[], numSamples: number): number[] {
  if (data.length === numSamples) return data
  const deriv: number[] = []
  for (let i = 0; i < data.length; i++) {
    deriv.push(data[i])
    if (i + 1 < data.length && data[i + 1] === data[i]) {
      deriv.push(data[i])
      for (let k = 0; k < data[i + 2]; k++) deriv.push(data[i])
      i += 2
    }
  }
  let sum = 0
  return deriv.map((d) => (sum += d))
}

/** Normalised RF magnitude (max 1) for a block or Hamming-windowed sinc pulse. */
export function rfShape(shape: 'block' | 'sinc', numSamples: number): number[] {
  if (shape === 'block') return Array<number>(numSamples).fill(1)
  const timeBandwidth = 4
  return Array.from({ length: numSamples }, (_, i) => {
    const t = (i + 0.5) / numSamples - 0.5 // -0.5 .. 0.5
    const x = Math.PI * timeBandwidth * t
    const sinc = x === 0 ? 1 : Math.sin(x) / x
    const window = 0.54 + 0.46 * Math.cos(2 * Math.PI * t)
    return sinc * window
  })
}
