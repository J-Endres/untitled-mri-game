import { useMemo, useReducer, useState } from 'react'
import { challenges } from './domain/challenge'
import {
  createStarterSequence,
  estimateSar,
  sequenceDurationUs,
  type ContainerId,
} from './domain/sequence'
import { mockLeaderboardService } from './services/leaderboard'
import { mockSimulationService } from './services/mockSimulation'
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

// Swap these for the real implementations once the backend exists.
const simulationService = mockSimulationService
const leaderboardService = mockLeaderboardService

type Sheet =
  | { kind: 'event'; id: string }
  | { kind: 'loop'; id: string }
  | { kind: 'add'; container: ContainerId }
  | { kind: 'challenge' | 'leaderboard' | 'guess' }

export default function App() {
  const challenge = challenges[0]
  const [sequence, dispatch] = useReducer(sequenceReducer, undefined, createStarterSequence)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const { state: sim, run } = useSimulation(simulationService, challenge.id)
  const close = () => setSheet(null)

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
          <button onClick={() => setSheet({ kind: 'leaderboard' })} aria-label="Leaderboard">
            🏆
          </button>
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
          <button
            className="primary"
            disabled={sim.status === 'running'}
            onClick={() => run(sequence)}
          >
            {sim.status === 'running' ? 'Scanning…' : '▶ Scan'}
          </button>
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
