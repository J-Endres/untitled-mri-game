import type { Block } from '../../domain/sequence'
import { eventDetail, eventTitle, kindInfo } from '../eventInfo'
import { useEditor } from './EditorContext'
import styles from './Sequence.module.css'
import { useSortableNode } from './useSortableNode'

/** A block: a single event card, or a bracketed group of simultaneous events. */
export function BlockCard({ block }: { block: Block }) {
  const { editEvent } = useEditor()
  const { setNodeRef, style, handleProps } = useSortableNode(block.id)
  const linked = block.events.length > 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.block} ${linked ? styles.linked : ''}`}
    >
      <button className={styles.handle} {...handleProps} aria-label="Drag to reorder">
        ⠿
      </button>
      <div className={styles.events}>
        {linked && <span className={styles.together}>simultaneous</span>}
        {block.events.map((e) => (
          <button
            key={e.id}
            className={styles.event}
            style={{ borderLeftColor: kindInfo[e.kind].color }}
            onClick={() => editEvent(e.id)}
          >
            <span className={styles.icon} style={{ color: kindInfo[e.kind].color }}>
              {kindInfo[e.kind].icon}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{eventTitle(e)}</span>
              <span className={styles.detail}>{eventDetail(e)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
