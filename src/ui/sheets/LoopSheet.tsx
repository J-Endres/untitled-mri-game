import { findNode } from '../../domain/sequence'
import { kindInfo } from '../eventInfo'
import { useEditor } from '../sequence/EditorContext'
import { Icon } from '../icons'
import { BottomSheet } from './BottomSheet'
import { SliderField } from './fields'
import styles from './sheets.module.css'

export function LoopSheet({ loopId, onClose }: { loopId: string; onClose: () => void }) {
  const { sequence, dispatch } = useEditor()
  const loop = findNode(sequence.nodes, loopId)?.node
  if (loop?.type !== 'loop') return null

  const close = (action: Parameters<typeof dispatch>[0]) => {
    dispatch(action)
    onClose()
  }

  return (
    <BottomSheet title={`${kindInfo.loop.icon} Loop`} onClose={onClose}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          className={styles.text}
          value={loop.label}
          onChange={(e) =>
            dispatch({ type: 'updateLoop', id: loopId, patch: { label: e.target.value } })
          }
        />
      </label>
      <SliderField
        label="Repetitions"
        min={1}
        max={256}
        value={loop.count}
        onChange={(count) => dispatch({ type: 'updateLoop', id: loopId, patch: { count } })}
      />
      <div className={styles.actions}>
        <button onClick={() => close({ type: 'unwrap', id: loopId })}>Unwrap</button>
        <button className="danger" onClick={() => close({ type: 'removeNode', id: loopId })}>
          <Icon name="trashbin" /> Delete with content
        </button>
      </div>
    </BottomSheet>
  )
}
