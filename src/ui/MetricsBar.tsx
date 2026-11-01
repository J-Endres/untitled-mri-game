import {
  evaluateConstraints,
  metricLabels,
  type Constraint,
  type Metrics,
} from '../domain/challenge'
import styles from './MetricsBar.module.css'

interface Props {
  constraints: Constraint[]
  /** Metrics are partial: duration and SAR are known live, SNR only after a scan. */
  metrics: Partial<Metrics>
  /** Stacked chips filling the available height instead of a row. */
  column?: boolean
}

/** Shows each constrained metric with its limit, coloured by pass/fail. */
export function MetricsBar({ constraints, metrics, column }: Props) {
  const known = { durationS: NaN, sar: NaN, snr: NaN, ...metrics }
  const { results } = evaluateConstraints(constraints, known)
  return (
    <div className={`${styles.bar} ${column ? styles.column : ''}`}>
      {results.map((r) => {
        const value = known[r.metric]
        const { label, unit } = metricLabels[r.metric]
        const state = Number.isNaN(value) ? styles.unknown : r.satisfied ? styles.ok : styles.bad
        return (
          <div key={r.metric} className={`${styles.chip} ${state}`}>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>
              {Number.isNaN(value) ? '–' : value.toFixed(2)} {unit}
            </span>
            <span className={styles.limit}>
              {r.bound === 'max' ? '≤' : '≥'} {r.limit}
            </span>
          </div>
        )
      })}
    </div>
  )
}
