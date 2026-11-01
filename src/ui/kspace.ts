import type { KSpaceRows } from '../services/simulation'

/** Largest |kx| or |ky| in the rows, ignoring NaN separators. */
export function kExtent(...arrays: (KSpaceRows | undefined)[]): number {
  let max = 0
  for (const rows of arrays) {
    if (!rows) continue
    for (let i = 0; i < rows.length; i += 4) {
      const m = Math.max(Math.abs(rows[i]), Math.abs(rows[i + 1]))
      if (m > max) max = m // NaN compares false
    }
  }
  return max
}
