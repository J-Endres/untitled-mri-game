/**
 * Sequence model.
 *
 * The model mirrors Pulseq closely: a sequence is a list of *blocks*, and every
 * event inside a block plays simultaneously. The UI shows a block with a single
 * event as one card and a block with several events as a "linked" group
 * (e.g. ADC + readout gradient). Loops are an editor convenience; they are
 * unrolled when the sequence is exported to Pulseq.
 *
 * Units: durations in microseconds, angles in degrees, gradient areas in 1/m
 * (Pulseq convention, i.e. k-space units).
 */

export type Axis = 'x' | 'y' | 'z'

export interface RfEvent {
  id: string
  kind: 'rf'
  flipAngleDeg: number
  phaseDeg: number
  durationUs: number
  shape: 'block' | 'sinc'
}

export interface AdcEvent {
  id: string
  kind: 'adc'
  samples: number
  dwellUs: number
}

export interface GradientEvent {
  id: string
  kind: 'gradient'
  axis: Axis
  shape: 'trapezoid' | 'triangle'
  /** Area in 1/m for the centre iteration of the enclosing loop. */
  area: number
  /**
   * Area change per iteration of the innermost enclosing loop, centred on
   * `area`: iteration i of n gets `area + areaStep * (i - (n - 1) / 2)`.
   * This is how phase encoding is expressed. 0 = constant.
   */
  areaStep: number
  durationUs: number
}

/** A gradient with a fixed, large area that dephases leftover transverse magnetisation. */
export interface SpoilerEvent {
  id: string
  kind: 'spoiler'
  axis: Axis
  area: number
  durationUs: number
}

export interface DelayEvent {
  id: string
  kind: 'delay'
  durationUs: number
}

export type SeqEvent = RfEvent | AdcEvent | GradientEvent | SpoilerEvent | DelayEvent
export type EventKind = SeqEvent['kind']

/** A Pulseq block: all events play at the same time. */
export interface Block {
  type: 'block'
  id: string
  events: SeqEvent[]
}

export interface Loop {
  type: 'loop'
  id: string
  label: string
  count: number
  body: SeqNode[]
}

export type SeqNode = Block | Loop

export interface Sequence {
  nodes: SeqNode[]
}

/** Id of a container: `null` is the sequence root, otherwise a loop id. */
export type ContainerId = string | null
