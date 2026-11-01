import { useCallback, useRef, useState } from 'react'
import type { Sequence } from '../domain/sequence'
import type { SimulationResult, SimulationService } from '../services/simulation'

export type SimulationState =
  | { status: 'idle' }
  | { status: 'running'; previous?: SimulationResult }
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
        previous: s.status === 'done' ? s.result : undefined,
      }))
      try {
        const result = await service.simulate(sequence, challengeId)
        if (id === runId.current) setState({ status: 'done', result, sequence })
      } catch (e) {
        if (id === runId.current) setState({ status: 'error', message: String(e) })
      }
    },
    [service, challengeId],
  )

  return { state, run }
}
