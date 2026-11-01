import type { ContainerId } from '../../domain/sequence'

/** Every node list is also a droppable, so items can be dropped into empty loops. */
const ROOT = 'list:root'

export const droppableId = (id: ContainerId): string => (id === null ? ROOT : `list:${id}`)

/** Maps a droppable id back to a container id, `undefined` if it is not a list. */
export function containerIdFromDroppable(id: string): ContainerId | undefined {
  if (id === ROOT) return null
  return id.startsWith('list:') ? id.slice(5) : undefined
}
