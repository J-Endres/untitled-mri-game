import { useMemo, useReducer, useState } from 'react'
import { challenges } from './domain/challenge'
import {
  createStarterSequence,
  estimateSar,
  sequenceDurationUs,
  type ContainerId,
  type Sequence,
} from './domain/sequence'
import { mockLeaderboardService } from './services/leaderboard'
import { mockSimulationService } from './services/mockSimulation'
import { mrx } from './services/mrx/config'
import { createMrxSimulationService } from './services/mrx/mrxSimulation'
import { sequenceReducer } from './state/sequenceReducer'
import { useSimulation } from './state/useSimulation'
import styles from './App.module.css'
import { MetricsBar } from './ui/MetricsBar'
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
      window.alert(e instanceof Error ? e.message : String(e))
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
          <button onClick={() => setSheet({ kind: 'challenge' })}>ⓘ {challenge.title}</button>
          <div>
            {mrx.mode === 'oauth' &&
              (loggedIn ? (
                <button onClick={logout}>Log out</button>
              ) : (
                <button onClick={login} disabled={loggingIn}>
                  Log in
                </button>
              ))}
            <button onClick={() => setSheet({ kind: 'leaderboard' })} aria-label="Leaderboard">
              🏆
            </button>
          </div>
        </header>

        <section className={styles.top}>
          <ReconView state={sim} outdated={outdated} />
          <MetricsBar constraints={challenge.constraints} metrics={metrics} />
        </section>

        <main className={styles.editor}>
          <SequenceEditor />
        </main>

        <footer className={styles.footer}>
          <button
            disabled={sim.status !== 'done' || outdated}
            onClick={() => setSheet({ kind: 'guess' })}
          >
            Guess
          </button>
          {loggedIn ? (
            <button
              className="primary"
              disabled={sim.status === 'running'}
              onClick={() => run(sequence)}
            >
              {sim.status === 'running' ? sim.step : '▶ Scan'}
            </button>
          ) : (
            <button className="primary" disabled={loggingIn} onClick={login}>
              {loggingIn ? 'Opening MRX login…' : 'Log in with MRX to scan'}
            </button>
          )}
        </footer>

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
