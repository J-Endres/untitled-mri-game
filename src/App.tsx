import { useMemo, useReducer, useState, useSyncExternalStore } from 'react'
import { challenges } from './domain/challenge'
import {
  createStarterSequence,
  estimateSar,
  sequenceDurationUs,
  type ContainerId,
  type Sequence,
} from './domain/sequence'
import { activityLog, errorMessage } from './services/activityLog'
import { mockLeaderboardService } from './services/leaderboard'
import { mockSimulationService } from './services/mockSimulation'
import { mrx } from './services/mrx/config'
import { createMrxSimulationService } from './services/mrx/mrxSimulation'
import { sequenceReducer } from './state/sequenceReducer'
import { useSimulation } from './state/useSimulation'
import styles from './App.module.css'
import { MetricsBar } from './ui/MetricsBar'
import { Icon } from './ui/icons'
import { KSpaceView } from './ui/KSpaceView'
import { LogView } from './ui/LogView'
import { ReconView } from './ui/ReconView'
import { EditorContext, type EditorContextValue } from './ui/sequence/EditorContext'
import { SequenceEditor } from './ui/sequence/SequenceEditor'
import { AddSheet } from './ui/sheets/AddSheet'
import { ChallengeSheet } from './ui/sheets/ChallengeSheet'
import { EventSheet } from './ui/sheets/EventSheet'
import { GuessSheet } from './ui/sheets/GuessSheet'
import { LeaderboardSheet } from './ui/sheets/LeaderboardSheet'
import { LoopSheet } from './ui/sheets/LoopSheet'

const simulationService =
  mrx.mode === 'mock' ? mockSimulationService : createMrxSimulationService(mrx.url, mrx.fetch)
const leaderboardService = mockLeaderboardService

/** Keeps the player's sequence across the redirect to the MRX login. */
const SAVED_SEQUENCE = 'saved-sequence'

function initialSequence(): Sequence {
  const saved = sessionStorage.getItem(SAVED_SEQUENCE)
  sessionStorage.removeItem(SAVED_SEQUENCE)
  return saved ? (JSON.parse(saved) as Sequence) : createStarterSequence()
}

const TABS = [
  { id: 'reco', label: 'Reco' },
  { id: 'stats', label: 'Stats' },
  { id: 'kspace', label: 'K-space' },
  { id: 'logs', label: 'Logs' },
] as const
type Tab = (typeof TABS)[number]['id']

type Sheet =
  | { kind: 'event'; id: string }
  | { kind: 'loop'; id: string }
  | { kind: 'add'; container: ContainerId }
  | { kind: 'challenge' | 'leaderboard' | 'guess' }

export default function App() {
  const challenge = challenges[0]
  const [sequence, dispatch] = useReducer(sequenceReducer, undefined, initialSequence)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const { state: sim, run } = useSimulation(simulationService, challenge.id)
  const close = () => setSheet(null)
  const [tab, setTab] = useState<Tab>('reco')

  // Mark the Logs tab while it holds errors the player has not looked at.
  const log = useSyncExternalStore(activityLog.subscribe, activityLog.entries)
  const [logSeenId, setLogSeenId] = useState(0)
  const lastLogId = log.at(-1)?.id ?? 0
  const unseenError = tab !== 'logs' && log.some((e) => e.level === 'error' && e.id > logSeenId)
  const openTab = (next: Tab) => {
    if (tab === 'logs' || next === 'logs') setLogSeenId(lastLogId)
    setTab(next)
  }

  // Re-evaluated on every render; a rejected login shows up as a scan error.
  const loggedIn = mrx.mode !== 'oauth' || mrx.auth.isLoggedIn()
  const [loggingIn, setLoggingIn] = useState(false)
  const login = async () => {
    if (mrx.mode !== 'oauth') return
    setLoggingIn(true)
    sessionStorage.setItem(SAVED_SEQUENCE, JSON.stringify(sequence))
    try {
      await mrx.auth.login() // navigates away
    } catch (e) {
      sessionStorage.removeItem(SAVED_SEQUENCE)
      setLoggingIn(false)
      activityLog.error(`Login: ${errorMessage(e)}`)
      window.alert(errorMessage(e))
    }
  }
  const logout = () => {
    if (mrx.mode === 'oauth') mrx.auth.logout()
    setSheet(null) // any state change re-renders with the new login state
  }

  // Duration and SAR follow directly from the sequence, so show them live.
  const liveMetrics = useMemo(
    () => ({ durationS: sequenceDurationUs(sequence) * 1e-6, sar: estimateSar(sequence) }),
    [sequence],
  )
  const outdated = sim.status === 'done' && sim.sequence !== sequence
  const metrics = sim.status === 'done' && !outdated ? sim.result.metrics : { ...liveMetrics }

  const editor: EditorContextValue = {
    sequence,
    dispatch,
    editEvent: (id: string) => setSheet({ kind: 'event', id }),
    editLoop: (id: string) => setSheet({ kind: 'loop', id }),
    addTo: (container: ContainerId) => setSheet({ kind: 'add', container }),
  }

  return (
    <EditorContext value={editor}>
      <div className={styles.app}>
        <header className={styles.header}>
          <button className="plain" onClick={() => setSheet({ kind: 'challenge' })}>
            <Icon name="info" /> {challenge.title}
          </button>
          <div className={styles.headerActions}>
            {mrx.mode === 'oauth' &&
              (loggedIn ? (
                <button className="plain" onClick={logout} aria-label="Log out">
                  <Icon name="exit" />
                </button>
              ) : (
                <button className="plain" onClick={login} disabled={loggingIn} aria-label="Log in">
                  <Icon name="enter" />
                </button>
              ))}
            <button
              className="plain"
              onClick={() => setSheet({ kind: 'leaderboard' })}
              aria-label="Leaderboard"
            >
              <Icon name="trophy" />
            </button>
          </div>
        </header>

        <nav className={styles.tabs} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? styles.activeTab : undefined}
              onClick={() => openTab(t.id)}
            >
              {t.label}
              {t.id === 'logs' && unseenError && (
                <i className={styles.alert} aria-label="new errors" />
              )}
            </button>
          ))}
        </nav>

        <section className={styles.top} role="tabpanel">
          <div className={styles.box}>
            {tab === 'reco' && <ReconView state={sim} outdated={outdated} />}
            {tab === 'stats' && (
              <MetricsBar constraints={challenge.constraints} metrics={metrics} column />
            )}
            {tab === 'kspace' && (
              <KSpaceView
                trajectory={
                  sim.status === 'done'
                    ? sim.result.trajectory
                    : sim.status === 'running'
                      ? sim.previous?.trajectory
                      : undefined
                }
                outdated={outdated}
              />
            )}
            {tab === 'logs' && <LogView />}
          </div>

          <button
            className={styles.guess}
            disabled={sim.status !== 'done' || outdated}
            onClick={() => setSheet({ kind: 'guess' })}
            aria-label="Guess"
            title="Guess what is in the scanner"
          >
            <Icon name="search" />
          </button>
          {loggedIn ? (
            <button
              className={`primary ${styles.scan}`}
              disabled={sim.status === 'running'}
              onClick={() => run(sequence)}
              aria-label={sim.status === 'running' ? sim.step : 'Scan'}
              title="Scan"
            >
              <Icon name="play" />
            </button>
          ) : (
            <button
              className={`primary ${styles.scan}`}
              disabled={loggingIn}
              onClick={login}
              aria-label="Log in with MRX to scan"
              title="Log in with MRX to scan"
            >
              <Icon name="enter" />
            </button>
          )}
        </section>

        <main className={styles.editor}>
          <h2 className="section-bar">Sequence</h2>
          <SequenceEditor />
        </main>

        {sheet?.kind === 'event' && <EventSheet eventId={sheet.id} onClose={close} />}
        {sheet?.kind === 'loop' && <LoopSheet loopId={sheet.id} onClose={close} />}
        {sheet?.kind === 'add' && (
          <AddSheet
            onAdd={(kind) => dispatch({ type: 'add', kind, container: sheet.container })}
            onClose={close}
          />
        )}
        {sheet?.kind === 'challenge' && <ChallengeSheet challenge={challenge} onClose={close} />}
        {sheet?.kind === 'leaderboard' && (
          <LeaderboardSheet
            service={leaderboardService}
            challengeId={challenge.id}
            onClose={close}
          />
        )}
        {sheet?.kind === 'guess' && sim.status === 'done' && (
          <GuessSheet
            challenge={challenge}
            metrics={sim.result.metrics}
            service={leaderboardService}
            onClose={close}
          />
        )}
      </div>
    </EditorContext>
  )
}
