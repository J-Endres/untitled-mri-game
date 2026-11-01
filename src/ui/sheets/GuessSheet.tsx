import { useState } from 'react'
import type { Challenge, Metrics } from '../../domain/challenge'
import type { AnswerResult, LeaderboardService } from '../../services/leaderboard'
import { BottomSheet } from './BottomSheet'
import styles from './sheets.module.css'

interface Props {
  challenge: Challenge
  /** Metrics of the last scan; answering needs a scanned image. */
  metrics: Metrics
  service: LeaderboardService
  onClose: () => void
}

/** "What is in the scanner?" multiple choice. */
export function GuessSheet({ challenge, metrics, service, onClose }: Props) {
  const [result, setResult] = useState<AnswerResult>()

  return (
    <BottomSheet title="What is in the scanner?" onClose={onClose}>
      {result ? (
        <div className={styles.result}>
          <p className={styles.big}>{result.correct ? '✅ Correct!' : '❌ Not quite'}</p>
          <p>Score: {result.score}</p>
          {result.correct && result.score === 0 && <p>…but not all requirements were met.</p>}
        </div>
      ) : (
        <div className={styles.palette}>
          {challenge.answerOptions.map((answer) => (
            <button
              key={answer}
              onClick={() => service.submit(challenge.id, answer, metrics).then(setResult)}
            >
              {answer}
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
