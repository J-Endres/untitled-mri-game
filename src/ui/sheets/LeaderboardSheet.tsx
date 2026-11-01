import { useEffect, useState } from 'react'
import type { LeaderboardEntry, LeaderboardService } from '../../services/leaderboard'
import { BottomSheet } from './BottomSheet'
import styles from './sheets.module.css'

interface Props {
  service: LeaderboardService
  challengeId: string
  onClose: () => void
}

export function LeaderboardSheet({ service, challengeId, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>()
  useEffect(() => {
    service.top(challengeId).then(setEntries)
  }, [service, challengeId])

  return (
    <BottomSheet title="🏆 Leaderboard" onClose={onClose}>
      {!entries ? (
        <p>Loading…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Score</th>
              <th>Time</th>
              <th>SAR</th>
              <th>SNR</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.player}>
                <td>{i + 1}</td>
                <td>{e.player}</td>
                <td>{e.score}</td>
                <td>{e.durationS.toFixed(2)} s</td>
                <td>{e.sar.toFixed(1)}</td>
                <td>{e.snr.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </BottomSheet>
  )
}
