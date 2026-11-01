/**
 * Writes a sequence as a Pulseq 1.4 file (https://pulseq.github.io/).
 *
 * Loops are unrolled; gradient areas with an `areaStep` get the area of their
 * iteration of the innermost enclosing loop. Identical events are written once
 * and referenced by id. Hardware limits are not enforced here: the simulation
 * plays whatever it gets, and trajex + NUFFT reconstruct any trajectory,
 * including samples on gradient ramps.
 */
import type {
  AdcEvent,
  Axis,
  GradientEvent,
  RfEvent,
  SeqNode,
  Sequence,
  SpoilerEvent,
} from '../sequence'
import { compressShape, rfShape } from './shapes'

/** Raster times in seconds (Siemens-like defaults). */
export const RASTER = {
  block: 10e-6,
  gradient: 10e-6,
  rf: 1e-6,
  adc: 100e-9,
} as const

/** Slew rate used for gradient ramps, in Hz/m/s (~180 T/m/s). */
const SLEW_HZ_PER_M_PER_S = 180 * 42.577e6

const ceilTo = (value: number, raster: number) => Math.ceil(value / raster - 1e-9) * raster
const us = (seconds: number) => Math.round(seconds * 1e6)
const fmt = (v: number) => String(Number(v.toPrecision(9)))

interface Trap {
  amplitude: number // Hz/m
  rise: number // s
  flat: number // s
  fall: number // s
}

/**
 * A trapezoid (or triangle) with the given area in the given total duration.
 * Ramps are as short as the slew rate allows, on the gradient raster.
 */
export function makeTrapezoid(
  area: number,
  durationS: number,
  shape: GradientEvent['shape'],
): Trap {
  const duration = ceilTo(Math.max(durationS, 2 * RASTER.gradient), RASTER.gradient)
  if (shape === 'triangle' || area === 0) {
    const rise = ceilTo(duration / 2, RASTER.gradient)
    return { amplitude: area / rise, rise, flat: 0, fall: rise }
  }
  // Estimate the amplitude with minimal ramps, then size the ramps for it.
  let rise: number = RASTER.gradient
  for (let i = 0; i < 5; i++) {
    const amplitude = area / (duration - rise)
    rise = ceilTo(
      Math.max(RASTER.gradient, Math.abs(amplitude) / SLEW_HZ_PER_M_PER_S),
      RASTER.gradient,
    )
  }
  if (2 * rise >= duration) return makeTrapezoid(area, duration, 'triangle')
  const flat = duration - 2 * rise
  return { amplitude: area / (flat + rise), rise, flat, fall: rise }
}

/** Assigns ids to unique event definitions (Pulseq libraries). */
class Library<T> {
  private ids = new Map<string, number>()
  readonly entries: T[] = []
  id(entry: T): number {
    const key = JSON.stringify(entry)
    let id = this.ids.get(key)
    if (id === undefined) {
      this.entries.push(entry)
      id = this.entries.length
      this.ids.set(key, id)
    }
    return id
  }
}

interface RfDef {
  amplitude: number
  magId: number
  phaseId: number
  phase: number
}

interface AdcDef {
  num: number
  dwellNs: number
}

interface BlockRow {
  duration: number // in block raster units
  rf: number
  gx: number
  gy: number
  gz: number
  adc: number
}

export function writePulseq(seq: Sequence): string {
  const shapes = new Library<number[]>()
  const rfs = new Library<RfDef>()
  const traps = new Library<Trap>()
  const adcs = new Library<AdcDef>()
  const blocks: BlockRow[] = []

  function rfDef(e: RfEvent): RfDef {
    const num = Math.max(1, Math.round((e.durationUs * 1e-6) / RASTER.rf))
    const magnitude = rfShape(e.shape, num)
    const integral = magnitude.reduce((s, v) => s + v, 0) * RASTER.rf
    const flip = (e.flipAngleDeg * Math.PI) / 180
    return {
      amplitude: flip / (2 * Math.PI * integral),
      magId: shapes.id(magnitude),
      phaseId: shapes.id(Array<number>(num).fill(0)),
      phase: (e.phaseDeg * Math.PI) / 180,
    }
  }

  function gradArea(e: GradientEvent | SpoilerEvent, iteration: Iteration) {
    if (e.kind === 'spoiler' || !iteration) return e.area
    return e.area + e.areaStep * (iteration.index - (iteration.count - 1) / 2)
  }

  type Iteration = { index: number; count: number } | undefined

  function emit(nodes: SeqNode[], iteration: Iteration) {
    for (const node of nodes) {
      if (node.type === 'loop') {
        for (let index = 0; index < node.count; index++) {
          emit(node.body, { index, count: node.count })
        }
        continue
      }
      const row: BlockRow = { duration: 0, rf: 0, gx: 0, gy: 0, gz: 0, adc: 0 }
      let duration = 0
      for (const e of node.events) {
        switch (e.kind) {
          case 'rf':
            row.rf = rfs.id(rfDef(e))
            duration = Math.max(duration, e.durationUs * 1e-6)
            break
          case 'adc': {
            const def = adcDef(e)
            row.adc = adcs.id(def)
            duration = Math.max(duration, def.num * def.dwellNs * 1e-9)
            break
          }
          case 'gradient':
          case 'spoiler': {
            const trap = makeTrapezoid(
              gradArea(e, iteration),
              e.durationUs * 1e-6,
              e.kind === 'gradient' ? e.shape : 'trapezoid',
            )
            row[gradKey(e.axis)] = traps.id(trap)
            duration = Math.max(duration, trap.rise + trap.flat + trap.fall)
            break
          }
          case 'delay':
            duration = Math.max(duration, e.durationUs * 1e-6)
            break
        }
      }
      row.duration = Math.round(ceilTo(duration, RASTER.block) / RASTER.block)
      if (row.duration > 0) blocks.push(row)
    }
  }

  emit(seq.nodes, undefined)
  return format(blocks, shapes.entries, rfs.entries, traps.entries, adcs.entries)
}

const gradKey = (axis: Axis) => `g${axis}` as const

function adcDef(e: AdcEvent): AdcDef {
  return { num: e.samples, dwellNs: Math.max(100, Math.round((e.dwellUs * 1e3) / 100) * 100) }
}

function format(
  blocks: BlockRow[],
  shapes: number[][],
  rfs: RfDef[],
  traps: Trap[],
  adcs: AdcDef[],
): string {
  const total = blocks.reduce((s, b) => s + b.duration, 0) * RASTER.block
  const out: string[] = [
    '# Pulseq sequence file',
    '# Created by untitled-mri-game',
    '',
    '[VERSION]',
    'major 1',
    'minor 4',
    'revision 2',
    '',
    '[DEFINITIONS]',
    `AdcRasterTime ${fmt(RASTER.adc)}`,
    `BlockDurationRaster ${fmt(RASTER.block)}`,
    `GradientRasterTime ${fmt(RASTER.gradient)}`,
    `RadiofrequencyRasterTime ${fmt(RASTER.rf)}`,
    `TotalDuration ${fmt(total)}`,
    '',
    '# Format of blocks:',
    '# NUM DUR RF  GX  GY  GZ  ADC  EXT',
    '[BLOCKS]',
    ...blocks.map((b, i) => [i + 1, b.duration, b.rf, b.gx, b.gy, b.gz, b.adc, 0].join(' ')),
    '',
  ]
  if (rfs.length) {
    out.push(
      '# Format of RF events:',
      '# id amplitude mag_id phase_id time_shape_id delay freq phase',
      '# ..        Hz   ....     ....          ....    us   Hz   rad',
      '[RF]',
      ...rfs.map((r, i) =>
        [i + 1, fmt(r.amplitude), r.magId, r.phaseId, 0, 0, 0, fmt(r.phase)].join(' '),
      ),
      '',
    )
  }
  if (traps.length) {
    out.push(
      '# Format of trapezoid gradients:',
      '# id amplitude rise flat fall delay',
      '# ..      Hz/m   us   us   us    us',
      '[TRAP]',
      ...traps.map((t, i) =>
        [i + 1, fmt(t.amplitude), us(t.rise), us(t.flat), us(t.fall), 0].join(' '),
      ),
      '',
    )
  }
  if (adcs.length) {
    out.push(
      '# Format of ADC events:',
      '# id num dwell delay freq phase',
      '# ..  ..    ns    us   Hz   rad',
      '[ADC]',
      ...adcs.map((a, i) => [i + 1, a.num, a.dwellNs, 0, 0, 0].join(' ')),
      '',
    )
  }
  if (shapes.length) {
    out.push('# Sequence Shapes', '[SHAPES]', '')
    shapes.forEach((samples, i) => {
      out.push(
        `shape_id ${i + 1}`,
        `num_samples ${samples.length}`,
        ...compressShape(samples).map(fmt),
        '',
      )
    })
  }
  return out.join('\n')
}
