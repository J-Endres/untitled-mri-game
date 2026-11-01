import { useEffect, useRef } from 'react'
import type { ReconImage } from '../services/simulation'
import type { SimulationState } from '../state/useSimulation'
import styles from './ReconView.module.css'

function draw(canvas: HTMLCanvasElement, image: ReconImage) {
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!
  const data = ctx.createImageData(image.width, image.height)
  image.pixels.forEach((v, i) => {
    const g = Math.round(v * 255)
    data.data.set([g, g, g, 255], i * 4)
  })
  ctx.putImageData(data, 0, 0)
}

interface Props {
  state: SimulationState
  /** The sequence was edited after the shown image was simulated. */
  outdated: boolean
}

/** The reconstructed image at the top of the screen. */
export function ReconView({ state, outdated }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const image =
    state.status === 'done'
      ? state.result.image
      : state.status === 'running'
        ? state.previous?.image
        : undefined

  useEffect(() => {
    if (canvas.current && image) draw(canvas.current, image)
  }, [image])

  return (
    <div className={styles.view}>
      {image ? (
        <canvas ref={canvas} className={outdated ? styles.dim : undefined} />
      ) : (
        <p className={styles.hint}>
          {state.status === 'error' ? state.message : 'Press Scan to see what is in the scanner'}
        </p>
      )}
      {state.status === 'running' && <div className={styles.badge}>Scanning…</div>}
      {state.status === 'done' && outdated && <div className={styles.badge}>Outdated</div>}
    </div>
  )
}
