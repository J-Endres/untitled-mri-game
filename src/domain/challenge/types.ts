export type Metric = 'durationS' | 'sar' | 'snr'

export interface Constraint {
  metric: Metric
  /** `max`: value must be <= limit, `min`: value must be >= limit. */
  bound: 'max' | 'min'
  limit: number
}

export interface Challenge {
  id: string
  title: string
  brief: string
  constraints: Constraint[]
  /** Multiple-choice options for "what is in the scanner?". */
  answerOptions: string[]
}

/** Measured values of one scan, compared against the constraints. */
export type Metrics = Record<Metric, number>
