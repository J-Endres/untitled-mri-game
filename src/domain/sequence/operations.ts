/**
 * Pure, immutable operations on the sequence tree. Every function returns a new
 * sequence and leaves its input untouched; invalid operations return the input
 * unchanged (same reference), so callers can cheaply detect a no-op.
 */
import { createBlock, createLoop } from './factory'
import type { ContainerId, Loop, SeqEvent, SeqNode, Sequence } from './types'
import { canPlayTogether } from './validation'

/** Applies `fn` to the node list of the container `containerId`. */
function mapContainer(
  nodes: SeqNode[],
  containerId: ContainerId,
  fn: (nodes: SeqNode[]) => SeqNode[],
): SeqNode[] {
  if (containerId === null) return fn(nodes)
  let changed = false
  const result = nodes.map((node) => {
    if (node.type !== 'loop') return node
    const body = node.id === containerId ? fn(node.body) : mapContainer(node.body, containerId, fn)
    if (body === node.body) return node
    changed = true
    return { ...node, body }
  })
  return changed ? result : nodes
}

const withNodes = (seq: Sequence, nodes: SeqNode[]): Sequence =>
  nodes === seq.nodes ? seq : { ...seq, nodes }

/** Finds a node and the container it lives in. */
export function findNode(
  nodes: SeqNode[],
  id: string,
  containerId: ContainerId = null,
): { node: SeqNode; containerId: ContainerId; index: number } | undefined {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) return { node, containerId, index }
    if (node.type === 'loop') {
      const found = findNode(node.body, id, node.id)
      if (found) return found
    }
  }
  return undefined
}

/** Finds an event and the block that contains it. */
export function findEvent(
  nodes: SeqNode[],
  eventId: string,
): { event: SeqEvent; blockId: string } | undefined {
  for (const node of nodes) {
    if (node.type === 'block') {
      const event = node.events.find((e) => e.id === eventId)
      if (event) return { event, blockId: node.id }
    } else {
      const found = findEvent(node.body, eventId)
      if (found) return found
    }
  }
  return undefined
}

export function insertNode(
  seq: Sequence,
  node: SeqNode,
  containerId: ContainerId,
  index?: number,
): Sequence {
  return withNodes(
    seq,
    mapContainer(seq.nodes, containerId, (nodes) => {
      const at = index ?? nodes.length
      return [...nodes.slice(0, at), node, ...nodes.slice(at)]
    }),
  )
}

export function removeNode(seq: Sequence, id: string): Sequence {
  const found = findNode(seq.nodes, id)
  if (!found) return seq
  return withNodes(
    seq,
    mapContainer(seq.nodes, found.containerId, (nodes) => nodes.filter((n) => n.id !== id)),
  )
}

/**
 * Moves a node to `index` in container `targetId`. The index refers to the
 * target list *after* the node has been removed from its old position.
 * Moving a loop into itself or one of its descendants is rejected.
 */
export function moveNode(
  seq: Sequence,
  id: string,
  targetId: ContainerId,
  index: number,
): Sequence {
  const found = findNode(seq.nodes, id)
  if (!found) return seq
  if (targetId !== null && found.node.type === 'loop') {
    if (targetId === id || findNode(found.node.body, targetId)) return seq
  }
  return insertNode(removeNode(seq, id), found.node, targetId, index)
}

export function updateEvent(seq: Sequence, eventId: string, patch: Partial<SeqEvent>): Sequence {
  const found = findEvent(seq.nodes, eventId)
  if (!found) return seq
  const blockLocation = findNode(seq.nodes, found.blockId)!
  return withNodes(
    seq,
    mapContainer(seq.nodes, blockLocation.containerId, (nodes) =>
      nodes.map((node) =>
        node.type === 'block' && node.id === found.blockId
          ? {
              ...node,
              events: node.events.map((e) =>
                e.id === eventId ? ({ ...e, ...patch, id: e.id, kind: e.kind } as SeqEvent) : e,
              ),
            }
          : node,
      ),
    ),
  )
}

export function updateLoop(
  seq: Sequence,
  loopId: string,
  patch: Partial<Pick<Loop, 'label' | 'count'>>,
): Sequence {
  const found = findNode(seq.nodes, loopId)
  if (!found || found.node.type !== 'loop') return seq
  return withNodes(
    seq,
    mapContainer(seq.nodes, found.containerId, (nodes) =>
      nodes.map((n) => (n.id === loopId ? { ...n, ...patch } : n)),
    ),
  )
}

/** Whether block `blockId` can be linked with the block right after it. */
export function canLinkWithNext(seq: Sequence, blockId: string): boolean {
  const found = findNode(seq.nodes, blockId)
  if (!found || found.node.type !== 'block') return false
  const siblings =
    found.containerId === null
      ? seq.nodes
      : (findNode(seq.nodes, found.containerId)!.node as Loop).body
  const next = siblings[found.index + 1]
  return next?.type === 'block' && canPlayTogether(found.node.events, next.events)
}

/** Merges a block with the next sibling block so their events play simultaneously. */
export function linkWithNext(seq: Sequence, blockId: string): Sequence {
  if (!canLinkWithNext(seq, blockId)) return seq
  const { containerId, index } = findNode(seq.nodes, blockId)!
  return withNodes(
    seq,
    mapContainer(seq.nodes, containerId, (nodes) => {
      const a = nodes[index]
      const b = nodes[index + 1]
      if (a.type !== 'block' || b.type !== 'block') return nodes
      const merged = { ...a, events: [...a.events, ...b.events] }
      return [...nodes.slice(0, index), merged, ...nodes.slice(index + 2)]
    }),
  )
}

/** Takes an event out of a linked block and puts it into its own block right after. */
export function unlinkEvent(seq: Sequence, eventId: string): Sequence {
  const found = findEvent(seq.nodes, eventId)
  if (!found) return seq
  const { node, containerId, index } = findNode(seq.nodes, found.blockId)!
  if (node.type !== 'block' || node.events.length < 2) return seq
  const rest = { ...node, events: node.events.filter((e) => e.id !== eventId) }
  return withNodes(
    seq,
    mapContainer(seq.nodes, containerId, (nodes) => [
      ...nodes.slice(0, index),
      rest,
      createBlock(found.event),
      ...nodes.slice(index + 1),
    ]),
  )
}

/** Removes an event; its block disappears when it becomes empty. */
export function removeEvent(seq: Sequence, eventId: string): Sequence {
  const found = findEvent(seq.nodes, eventId)
  if (!found) return seq
  const { node, containerId } = findNode(seq.nodes, found.blockId)!
  if (node.type !== 'block') return seq
  if (node.events.length === 1) return removeNode(seq, node.id)
  return withNodes(
    seq,
    mapContainer(seq.nodes, containerId, (nodes) =>
      nodes.map((n) =>
        n.id === node.id ? { ...node, events: node.events.filter((e) => e.id !== eventId) } : n,
      ),
    ),
  )
}

/** Wraps a node in a new loop at the same position. */
export function wrapInLoop(seq: Sequence, nodeId: string, count = 8): Sequence {
  const found = findNode(seq.nodes, nodeId)
  if (!found) return seq
  return withNodes(
    seq,
    mapContainer(seq.nodes, found.containerId, (nodes) =>
      nodes.map((n) => (n.id === nodeId ? createLoop(count, [n]) : n)),
    ),
  )
}

/** Replaces a loop with its body (runs the body once). */
export function unwrapLoop(seq: Sequence, loopId: string): Sequence {
  const found = findNode(seq.nodes, loopId)
  if (!found || found.node.type !== 'loop') return seq
  const body = found.node.body
  return withNodes(
    seq,
    mapContainer(seq.nodes, found.containerId, (nodes) =>
      nodes.flatMap((n) => (n.id === loopId ? body : [n])),
    ),
  )
}
