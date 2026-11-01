import { createContext, useContext, type Dispatch } from 'react'
import type { ContainerId, Sequence } from '../../domain/sequence'
import type { SequenceAction } from '../../state/sequenceReducer'

export interface EditorContextValue {
  sequence: Sequence
  dispatch: Dispatch<SequenceAction>
  editEvent: (eventId: string) => void
  editLoop: (loopId: string) => void
  addTo: (container: ContainerId) => void
}

/** Sequence + edit callbacks, provided by App so the recursive lists and sheets need no prop drilling. */
export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext)
  if (!value) throw new Error('useEditor must be used inside <EditorContext>')
  return value
}
