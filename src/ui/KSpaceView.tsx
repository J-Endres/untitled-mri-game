import { useEffect, useRef, useState } from 'react'
import type { Trajectory } from '../services/simulation'
import { kExtent } from './kspace'
import styles from './KSpaceView.module.css'

/** Canvas resolution; drawn pixelated to match the UI. */
const SIZE = 320

function draw(canvas: HTMLCanvasElement, trajectory: Trajectory, extent: number) {
  const css = getComputedStyle(canvas)
  const color = (name: string) => css.getPropertyValue(name).trim()
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)

  const scale = (SIZE / 2 - 12) / (extent || 1)
  const x = (kx: number) => SIZE / 2 + kx * scale
  const y = (ky: number) => SIZE / 2 - ky * scale

  // Axes
  ctx.fillStyle = color('--tan')
  ctx.fillRect(0, SIZE / 2, SIZE, 1)
  ctx.fillRect(SIZE / 2, 0, 1, SIZE)

  // Full trajectory: one polyline per segment between NaN rows.
  const full = trajectory.full
  if (full) {
    ctx.strokeStyle = color('--ink-soft')
    ctx.lineWidth = 1
    ctx.beginPath()
    let pen = false
    for (let i = 0; i < full.length; i += 4) {
      if (Number.isNaN(full[i]) || Number.isNaN(full[i + 1])) {
        pen = false
        continue
      }
      if (pen) ctx.lineTo(x(full[i]), y(full[i + 1]))
      else ctx.moveTo(x(full[i]), y(full[i + 1]))
      pen = true
    }
    ctx.stroke()
  }

  // ADC samples on top.
  ctx.fillStyle = color('--cover')
  const adc = trajectory.adc
  for (let i = 0; i < adc.length; i += 4) {
    ctx.fillRect(Math.round(x(adc[i])) - 1, Math.round(y(adc[i + 1])) - 1, 2, 2)
  }
}

interface Props {
  trajectory?: Trajectory
  outdated: boolean
}

/** k-space trajectory of the last scan (kx/ky plane), from trajex. */
export function KSpaceView({ trajectory, outdated }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // Spoilers reach far beyond the sampled region; let the player zoom to the ADC samples.
  const [fitAdc, setFitAdc] = useState(false)
  const extent = trajectory
    ? fitAdc
      ? kExtent(trajectory.adc)
      : kExtent(trajectory.adc, trajectory.full)
    : 0

  useEffect(() => {
    if (canvas.current && trajectory) draw(canvas.current, trajectory, extent)
  }, [trajectory, extent])

  if (!trajectory) return <p className={styles.hint}>Scan to see the k-space trajectory</p>
  return (
    <div className={styles.plot}>
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className={outdated ? styles.dim : undefined}
      />
      <span className={styles.legend}>
        <i className={styles.line} /> path <i className={styles.dot} /> ADC
      </span>
      <button className={`plain ${styles.axis}`} onClick={() => setFitAdc(!fitAdc)}>
        ±{Math.round(extent)} /m · {fitAdc ? 'ADC' : 'all'}
      </button>
    </div>
  )
}
