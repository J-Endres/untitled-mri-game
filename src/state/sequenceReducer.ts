import {
  createBlock,
  createEvent,
  createLoop,
  insertNode,
  linkWithNext,
  moveNode,
  removeEvent,
  removeNode,
  unlinkEvent,
  unwrapLoop,
  updateEvent,
  updateLoop,
  wrapInLoop,
  type ContainerId,
  type EventKind,
  type Loop,
  type SeqEvent,
  type Sequence,
} from '../domain/sequence'

/** All edits the UI can make to the sequence. Thin layer over domain operations. */
export type SequenceAction =
  | { type: 'add'; kind: EventKind | 'loop'; container: ContainerId }
  | { type: 'move'; id: string; container: ContainerId; index: number }
  | { type: 'updateEvent'; id: string; patch: Partial<SeqEvent> }
  | { type: 'updateLoop'; id: string; patch: Partial<Pick<Loop, 'label' | 'count'>> }
  | { type: 'removeEvent'; id: string }
  | { type: 'removeNode'; id: string }
  | { type: 'linkWithNext'; blockId: string }
  | { type: 'unlink'; eventId: string }
  | { type: 'wrap'; id: string }
  | { type: 'unwrap'; id: string }
  | { type: 'reset'; sequence: Sequence }

export function sequenceReducer(seq: Sequence, action: SequenceAction): Sequence {
  switch (action.type) {
    case 'add':
      return insertNode(
        seq,
        action.kind === 'loop' ? createLoop() : createBlock(createEvent(action.kind)),
        action.container,
      )
    case 'move':
      return moveNode(seq, action.id, action.container, action.index)
    case 'updateEvent':
      return updateEvent(seq, action.id, action.patch)
    case 'updateLoop':
      return updateLoop(seq, action.id, action.patch)
    case 'removeEvent':
      return removeEvent(seq, action.id)
    case 'removeNode':
      return removeNode(seq, action.id)
    case 'linkWithNext':
      return linkWithNext(seq, action.blockId)
    case 'unlink':
      return unlinkEvent(seq, action.eventId)
    case 'wrap':
      return wrapInLoop(seq, action.id)
    case 'unwrap':
      return unwrapLoop(seq, action.id)
    case 'reset':
      return action.sequence
  }
}
