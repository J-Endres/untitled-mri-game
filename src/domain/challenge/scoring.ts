import type { Constraint, Metric, Metrics } from './types'

export const metricLabels: Record<Metric, { label: string; unit: string }> = {
  durationS: { label: 'Duration', unit: 's' },
  sar: { label: 'SAR', unit: 'W/kg' },
  snr: { label: 'SNR', unit: '' },
}

export const isSatisfied = (c: Constraint, value: number): boolean =>
  c.bound === 'max' ? value <= c.limit : value >= c.limit

export function evaluateConstraints(constraints: Constraint[], metrics: Metrics) {
  const results = constraints.map((c) => ({ ...c, satisfied: isSatisfied(c, metrics[c.metric]) }))
  return { results, allSatisfied: results.every((r) => r.satisfied) }
}

/**
 * MOCK scoring: a correct answer with all constraints satisfied scores higher
 * the shorter the scan. The real formula is an open game-design question.
 */
export function score(constraints: Constraint[], metrics: Metrics, answerCorrect: boolean): number {
  if (!answerCorrect || !evaluateConstraints(constraints, metrics).allSatisfied) return 0
  return Math.round(1000 / (1 + metrics.durationS))
}
