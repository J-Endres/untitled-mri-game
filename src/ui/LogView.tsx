import { useSyncExternalStore } from 'react'
import { activityLog } from '../services/activityLog'
import styles from './LogView.module.css'

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false })
const duration = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`

/** MRX tool calls, transfers and errors, newest first. */
export function LogView() {
  const entries = useSyncExternalStore(activityLog.subscribe, activityLog.entries)
  return (
    <div className={styles.log}>
      <div className={styles.toolbar}>
        <span>{entries.length} entries</span>
        <button className="plain" onClick={activityLog.clear} disabled={!entries.length}>
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>Nothing yet - scan to see the MRX calls.</p>
      ) : (
        <ol className={styles.list}>
          {[...entries].reverse().map((e) => (
            <li key={e.id} className={e.level === 'error' ? styles.error : undefined}>
              <span className={styles.time}>{time(e.time)}</span>
              <span className={styles.message}>{e.message}</span>
              {e.durationMs !== undefined && (
                <span className={styles.duration}>{duration(e.durationMs)}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
