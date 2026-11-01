import { eventDurationUs, type EventKind, type SeqEvent } from '../domain/sequence'

export const kindInfo: Record<EventKind | 'loop', { label: string; icon: string; color: string }> =
  {
    rf: { label: 'RF pulse', icon: '⟿', color: 'var(--c-rf)' },
    adc: { label: 'ADC', icon: '◉', color: 'var(--c-adc)' },
    gradient: { label: 'Gradient', icon: '⏢', color: 'var(--c-gradient)' },
    spoiler: { label: 'Spoiler', icon: '≋', color: 'var(--c-spoiler)' },
    delay: { label: 'Delay', icon: '⏱', color: 'var(--c-delay)' },
    loop: { label: 'Loop', icon: '↻', color: 'var(--c-loop)' },
  }

export const formatUs = (us: number): string =>
  us >= 1000 ? `${+(us / 1000).toFixed(2)} ms` : `${Math.round(us)} µs`

/** One-line summary shown on a card. */
export function eventTitle(e: SeqEvent): string {
  switch (e.kind) {
    case 'rf':
      return `RF ${e.flipAngleDeg}°`
    case 'adc':
      return `ADC ${e.samples} samples`
    case 'gradient':
      return `G${e.axis} ${e.area} /m${e.areaStep ? ` ± ${e.areaStep}/step` : ''}`
    case 'spoiler':
      return `Spoiler ${e.axis}`
    case 'delay':
      return 'Delay'
  }
}

export function eventDetail(e: SeqEvent): string {
  const duration = formatUs(eventDurationUs(e))
  switch (e.kind) {
    case 'rf':
      return `${e.shape} · ${duration}${e.phaseDeg ? ` · ${e.phaseDeg}° phase` : ''}`
    case 'adc':
      return `${e.dwellUs} µs dwell · ${duration}`
    case 'gradient':
      return `${e.shape} · ${duration}`
    case 'spoiler':
      return `${e.area} /m · ${duration}`
    case 'delay':
      return duration
  }
}
