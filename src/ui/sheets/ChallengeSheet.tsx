import { metricLabels, type Challenge } from '../../domain/challenge'
import { BottomSheet } from './BottomSheet'
import styles from './sheets.module.css'

export function ChallengeSheet({
  challenge,
  onClose,
}: {
  challenge: Challenge
  onClose: () => void
}) {
  return (
    <BottomSheet title={challenge.title} onClose={onClose}>
      <p>{challenge.brief}</p>
      <h3>Requirements</h3>
      <ul className={styles.plain}>
        {challenge.constraints.map((c) => (
          <li key={c.metric}>
            {metricLabels[c.metric].label} {c.bound === 'max' ? '≤' : '≥'} {c.limit}{' '}
            {metricLabels[c.metric].unit}
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
