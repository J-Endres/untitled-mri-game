import { useCallback, useRef, useState } from 'react'
import type { Sequence } from '../domain/sequence'
import { errorMessage, timed } from '../services/activityLog'
import type { SimulationResult, SimulationService } from '../services/simulation'

export type SimulationState =
  | { status: 'idle' }
  | { status: 'running'; step: string; previous?: SimulationResult }
  | { status: 'done'; result: SimulationResult; sequence: Sequence }
  | { status: 'error'; message: string }

/** Runs simulations and remembers which sequence the shown result belongs to. */
export function useSimulation(service: SimulationService, challengeId: string) {
  const [state, setState] = useState<SimulationState>({ status: 'idle' })
  const runId = useRef(0)

  const run = useCallback(
    async (sequence: Sequence) => {
      const id = ++runId.current
      setState((s) => ({
        status: 'running',
        step: 'Scanning…',
        previous: s.status === 'done' ? s.result : s.status === 'running' ? s.previous : undefined,
      }))
      const onProgress = (step: string) =>
        setState((s) => (id === runId.current && s.status === 'running' ? { ...s, step } : s))
      try {
        const result = await timed('scan', () =>
          service.simulate(sequence, challengeId, onProgress),
        )
        if (id === runId.current) setState({ status: 'done', result, sequence })
      } catch (e) {
        if (id === runId.current) {
          console.error(e)
          setState({ status: 'error', message: errorMessage(e) })
        }
      }
    },
    [service, challengeId],
  )

  return { state, run }
}
