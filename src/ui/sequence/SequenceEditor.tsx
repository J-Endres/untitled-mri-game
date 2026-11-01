import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { findNode } from '../../domain/sequence'
import { nestedCollision } from './collision'
import { useEditor } from './EditorContext'
import { containerIdFromDroppable } from './droppable'
import { NodeList } from './NodeList'

/**
 * The sequence as an editable, drag-and-drop list of blocks and loops.
 * Nodes can be dragged within a list and into/out of loops.
 */
export function SequenceEditor() {
  const { sequence, dispatch } = useEditor()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    // Dropped on an (empty) list rather than on a node: append to that list.
    const droppedOnList = containerIdFromDroppable(overId)
    if (droppedOnList !== undefined) {
      const loop =
        droppedOnList === null ? undefined : findNode(sequence.nodes, droppedOnList)?.node
      const list = loop?.type === 'loop' ? loop.body : sequence.nodes
      dispatch({ type: 'move', id: activeId, container: droppedOnList, index: list.length })
      return
    }

    const target = findNode(sequence.nodes, overId)
    if (target) {
      dispatch({ type: 'move', id: activeId, container: target.containerId, index: target.index })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={nestedCollision} onDragEnd={onDragEnd}>
      <NodeList nodes={sequence.nodes} containerId={null} />
    </DndContext>
  )
}
