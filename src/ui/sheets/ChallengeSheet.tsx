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
      <p className={styles.credits}>
        UI art and icons:{' '}
        <a href="https://crusenho.itch.io/complete-ui-book-styles-pack">
          Complete UI Essential Pack
        </a>{' '}
        and <a href="https://crusenho.itch.io">Icons Essential</a> by Crusenho, licensed{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> (recoloured, cropped).
        Fonts: VT323 and Silkscreen (SIL OFL).
      </p>
    </BottomSheet>
  )
}
