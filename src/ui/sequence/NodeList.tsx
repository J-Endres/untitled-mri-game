import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Fragment } from 'react'
import { canLinkWithNext, type ContainerId, type SeqNode } from '../../domain/sequence'
import { BlockCard } from './BlockCard'
import { droppableId } from './droppable'
import { useEditor } from './EditorContext'
import { LoopCard } from './LoopCard'
import styles from './Sequence.module.css'

interface Props {
  nodes: SeqNode[]
  containerId: ContainerId
}

/** A sortable list of nodes with link toggles between adjacent blocks. */
export function NodeList({ nodes, containerId }: Props) {
  const { sequence, dispatch, addTo } = useEditor()
  const { setNodeRef } = useDroppable({ id: droppableId(containerId) })

  return (
    <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={styles.list}>
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            {node.type === 'block' ? <BlockCard block={node} /> : <LoopCard loop={node} />}
            {node.type === 'block' && nodes[i + 1]?.type === 'block' && (
              <button
                className={styles.link}
                disabled={!canLinkWithNext(sequence, node.id)}
                onClick={() => dispatch({ type: 'linkWithNext', blockId: node.id })}
                aria-label="Play together with next block"
                title="Play together with next block"
              >
                🔗
              </button>
            )}
          </Fragment>
        ))}
        <button className={styles.add} onClick={() => addTo(containerId)}>
          + Add {containerId === null ? 'block' : 'to loop'}
        </button>
      </div>
    </SortableContext>
  )
}
