/**
 * Minimal reader/writer for NumPy .npy files (little-endian, C order), enough
 * for the arrays MRX exchanges: float32/float64 and complex64/complex128.
 * Complex data is returned interleaved (re, im, re, im, ...).
 */
export interface NpyArray {
  dtype: '<f4' | '<f8' | '<c8' | '<c16'
  shape: number[]
  data: Float32Array | Float64Array
}

const MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59] // \x93NUMPY

export function parseNpy(buffer: ArrayBuffer): NpyArray {
  const bytes = new Uint8Array(buffer)
  if (!MAGIC.every((b, i) => bytes[i] === b)) throw new Error('Not a .npy file')
  const view = new DataView(buffer)
  const major = bytes[6]
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true)
  const offset = (major === 1 ? 10 : 12) + headerLen
  const header = new TextDecoder().decode(bytes.subarray(offset - headerLen, offset))

  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1]
  const fortran = /'fortran_order':\s*True/.test(header)
  const shape = (/'shape':\s*\(([^)]*)\)/.exec(header)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
  if (fortran) throw new Error('Fortran-ordered .npy is not supported')

  const body = buffer.slice(offset)
  switch (descr) {
    case '<f4':
    case '<c8':
      return { dtype: descr, shape, data: new Float32Array(body) }
    case '<f8':
    case '<c16':
      return { dtype: descr, shape, data: new Float64Array(body) }
    default:
      throw new Error(`Unsupported .npy dtype ${descr}`)
  }
}

/** Writes a complex64 array; `data` is interleaved (re, im, ...). */
export function writeComplex64Npy(data: Float32Array, shape: number[]): ArrayBuffer {
  const shapeText = shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`
  let header = `{'descr': '<c8', 'fortran_order': False, 'shape': ${shapeText}, }`
  // Pad so that magic + version + length + header is a multiple of 64, ending in \n.
  const total = Math.ceil((10 + header.length + 1) / 64) * 64
  header = header.padEnd(total - 10 - 1, ' ') + '\n'

  const out = new Uint8Array(total + data.byteLength)
  out.set(MAGIC)
  out[6] = 1
  out[7] = 0
  new DataView(out.buffer).setUint16(8, header.length, true)
  out.set(new TextEncoder().encode(header), 10)
  out.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), total)
  return out.buffer
}
