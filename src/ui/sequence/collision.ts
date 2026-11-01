import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core'
import { containerIdFromDroppable } from './droppable'

const area = (r: { width: number; height: number }) => r.width * r.height

/**
 * Nested lists confuse dnd-kit's default strategies: the pointer is inside a
 * loop card, its body list and a child card at the same time. Prefer the
 * innermost (smallest) node under the pointer, then the innermost list (to
 * drop into empty loops), then fall back to the closest centre.
 */
export const nestedCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args).filter((h) => h.id !== args.active.id)
  const smallest = (lists: boolean) =>
    hits
      .filter((h) => (containerIdFromDroppable(String(h.id)) !== undefined) === lists)
      .map((h) => ({ hit: h, size: area(args.droppableRects.get(h.id)!) }))
      .sort((a, b) => a.size - b.size)[0]?.hit

  const hit = smallest(false) ?? smallest(true)
  return hit ? [hit] : closestCenter(args)
}
