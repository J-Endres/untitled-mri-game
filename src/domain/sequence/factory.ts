import type { Block, EventKind, Loop, SeqEvent, SeqNode, Sequence } from './types'

let counter = 0
/** Ids only need to be unique within a session. */
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${counter++}`

/** Creates an event of the given kind with sensible defaults. */
export function createEvent<K extends EventKind>(kind: K): Extract<SeqEvent, { kind: K }> {
  return defaults(kind) as Extract<SeqEvent, { kind: K }>
}

function defaults(kind: EventKind): SeqEvent {
  const id = newId(kind)
  switch (kind) {
    case 'rf':
      return { id, kind, flipAngleDeg: 90, phaseDeg: 0, durationUs: 1000, shape: 'block' }
    case 'adc':
      return { id, kind, samples: 64, dwellUs: 20 }
    case 'gradient':
      return {
        id,
        kind,
        axis: 'x',
        shape: 'trapezoid',
        area: 0,
        areaStep: 0,
        durationUs: 1000,
      }
    case 'spoiler':
      return { id, kind, axis: 'z', area: 1500, durationUs: 2000 }
    case 'delay':
      return { id, kind, durationUs: 5000 }
  }
}

export const createBlock = (...events: SeqEvent[]): Block => ({
  type: 'block',
  id: newId('block'),
  events,
})

export const createLoop = (count = 8, body: SeqNode[] = [], label = 'Loop'): Loop => ({
  type: 'loop',
  id: newId('loop'),
  label,
  count,
  body,
})

const with_ = <K extends EventKind>(kind: K, patch: Partial<Extract<SeqEvent, { kind: K }>>) =>
  ({ ...createEvent(kind), ...patch }) as SeqEvent

/**
 * A simple 2D gradient echo (FLASH) to start from, so the editor is never empty.
 * 64 x 64 matrix with a 200 mm field of view (k-space step 5 /m).
 */
export function createStarterSequence(): Sequence {
  const n = 64
  return {
    nodes: [
      createLoop(
        n,
        [
          createBlock(with_('rf', { flipAngleDeg: 15, durationUs: 500 })),
          createBlock(
            with_('gradient', { axis: 'x', area: -160, durationUs: 800 }),
            with_('gradient', { axis: 'y', area: 0, areaStep: 5, durationUs: 800 }),
          ),
          createBlock(
            with_('adc', { samples: n, dwellUs: 20 }),
            with_('gradient', { axis: 'x', area: 320, durationUs: 1280 }),
          ),
          createBlock(with_('spoiler', { axis: 'x' })),
          createBlock(with_('delay', { durationUs: 3000 })),
        ],
        'Phase encoding',
      ),
    ],
  }
}
