import type { SeqEvent } from './types'

/**
 * Slot an event occupies in a block. Pulseq allows at most one event per slot
 * (one RF, one ADC, one gradient per axis, one delay).
 */
export function eventSlot(event: SeqEvent): string {
  switch (event.kind) {
    case 'gradient':
    case 'spoiler':
      return `g${event.axis}`
    default:
      return event.kind
  }
}

/** Returns the slots that are used more than once, empty if the block is valid. */
export function conflictingSlots(events: SeqEvent[]): string[] {
  const seen = new Set<string>()
  const conflicts = new Set<string>()
  for (const slot of events.map(eventSlot)) {
    if (seen.has(slot)) conflicts.add(slot)
    seen.add(slot)
  }
  return [...conflicts]
}

export const canPlayTogether = (a: SeqEvent[], b: SeqEvent[]): boolean =>
  conflictingSlots([...a, ...b]).length === 0
