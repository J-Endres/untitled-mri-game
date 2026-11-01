import type { ReactNode } from 'react'
import styles from './sheets.module.css'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

/** Mobile-style popup that slides in from the bottom. Tap the backdrop to close. */
export function BottomSheet({ title, onClose, children }: Props) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2>{title}</h2>
          <button className="plain" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
