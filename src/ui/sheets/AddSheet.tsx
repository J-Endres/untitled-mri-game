import type { EventKind } from '../../domain/sequence'
import { kindInfo } from '../eventInfo'
import { BottomSheet } from './BottomSheet'
import styles from './sheets.module.css'

const KINDS: (EventKind | 'loop')[] = ['rf', 'adc', 'gradient', 'spoiler', 'delay', 'loop']

interface Props {
  onAdd: (kind: EventKind | 'loop') => void
  onClose: () => void
}

/** Palette of building blocks. */
export function AddSheet({ onAdd, onClose }: Props) {
  return (
    <BottomSheet title="Add building block" onClose={onClose}>
      <div className={styles.palette}>
        {KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => {
              onAdd(kind)
              onClose()
            }}
          >
            <span style={{ color: kindInfo[kind].color, fontSize: 24 }}>{kindInfo[kind].icon}</span>
            {kindInfo[kind].label}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
