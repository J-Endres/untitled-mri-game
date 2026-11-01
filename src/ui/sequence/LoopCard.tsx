import { nodeDurationUs, type Loop } from '../../domain/sequence'
import { formatUs, kindInfo } from '../eventInfo'
import { useEditor } from './EditorContext'
import { NodeList } from './NodeList'
import styles from './Sequence.module.css'
import { useSortableNode } from './useSortableNode'

/** A loop header plus its (recursively rendered) body. */
export function LoopCard({ loop }: { loop: Loop }) {
  const { editLoop } = useEditor()
  const { setNodeRef, style, handleProps } = useSortableNode(loop.id)

  return (
    <div ref={setNodeRef} style={style} className={styles.loop}>
      <div className={styles.loopHeader}>
        <button className={styles.handle} {...handleProps} aria-label="Drag to reorder">
          ⠿
        </button>
        <button className={styles.loopTitle} onClick={() => editLoop(loop.id)}>
          <span style={{ color: kindInfo.loop.color }}>{kindInfo.loop.icon}</span>
          <strong>{loop.label}</strong>
          <span className={styles.count}>× {loop.count}</span>
          <span className={styles.detail}>{formatUs(nodeDurationUs(loop))}</span>
        </button>
      </div>
      <div className={styles.loopBody}>
        <NodeList nodes={loop.body} containerId={loop.id} />
      </div>
    </div>
  )
}
