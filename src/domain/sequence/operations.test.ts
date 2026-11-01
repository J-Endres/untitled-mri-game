import { describe, expect, it } from 'vitest'
import { createBlock, createEvent, createLoop } from './factory'
import {
  canLinkWithNext,
  findEvent,
  findNode,
  insertNode,
  linkWithNext,
  moveNode,
  removeEvent,
  unlinkEvent,
  unwrapLoop,
  updateEvent,
  wrapInLoop,
} from './operations'
import type { Block, Loop, Sequence } from './types'

const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id)

function fixture() {
  const rf = createBlock(createEvent('rf'))
  const adc = createBlock(createEvent('adc'))
  const gx = createBlock(createEvent('gradient'))
  const inner = createBlock(createEvent('delay'))
  const loop = createLoop(4, [inner])
  const seq: Sequence = { nodes: [rf, adc, gx, loop] }
  return { seq, rf, adc, gx, loop, inner }
}

describe('sequence operations', () => {
  it('inserts into a loop body', () => {
    const { seq, loop } = fixture()
    const block = createBlock(createEvent('rf'))
    const next = insertNode(seq, block, loop.id, 0)
    expect(findNode(next.nodes, block.id)?.containerId).toBe(loop.id)
    expect(seq.nodes[3]).toBe(loop) // input untouched
  })

  it('reorders within a container', () => {
    const { seq, rf, adc, gx, loop } = fixture()
    expect(ids(moveNode(seq, rf.id, null, 2).nodes)).toEqual([adc.id, gx.id, rf.id, loop.id])
  })

  it('moves between containers', () => {
    const { seq, rf, loop, inner } = fixture()
    const next = moveNode(seq, rf.id, loop.id, 1)
    expect(ids((findNode(next.nodes, loop.id)!.node as Loop).body)).toEqual([inner.id, rf.id])
  })

  it('refuses to move a loop into itself', () => {
    const { seq, loop } = fixture()
    expect(moveNode(seq, loop.id, loop.id, 0)).toBe(seq)
  })

  it('links ADC and gradient into one block and unlinks again', () => {
    const { seq, adc, gx } = fixture()
    expect(canLinkWithNext(seq, adc.id)).toBe(true)
    const linked = linkWithNext(seq, adc.id)
    const block = linked.nodes[1] as Block
    expect(block.events.map((e) => e.kind)).toEqual(['adc', 'gradient'])
    expect(linked.nodes).toHaveLength(3)

    const unlinked = unlinkEvent(linked, gx.events[0].id)
    expect(unlinked.nodes.map((n) => (n as Block).events?.[0].kind)).toEqual([
      'rf',
      'adc',
      'gradient',
      undefined,
    ])
  })

  it('refuses to link two events of the same slot', () => {
    const a = createBlock(createEvent('rf'))
    const b = createBlock(createEvent('rf'))
    const seq = { nodes: [a, b] }
    expect(canLinkWithNext(seq, a.id)).toBe(false)
    expect(linkWithNext(seq, a.id)).toBe(seq)
  })

  it('updates an event inside a loop', () => {
    const { seq, inner } = fixture()
    const eventId = inner.events[0].id
    const next = updateEvent(seq, eventId, { durationUs: 42 })
    expect(findEvent(next.nodes, eventId)?.event).toMatchObject({ durationUs: 42, kind: 'delay' })
  })

  it('removes empty blocks together with their last event', () => {
    const { seq, rf } = fixture()
    expect(findNode(removeEvent(seq, rf.events[0].id).nodes, rf.id)).toBeUndefined()
  })

  it('wraps in a loop and unwraps again', () => {
    const { seq, rf } = fixture()
    const wrapped = wrapInLoop(seq, rf.id, 3)
    const loop = wrapped.nodes[0] as Loop
    expect(loop).toMatchObject({ type: 'loop', count: 3 })
    expect(unwrapLoop(wrapped, loop.id).nodes[0]).toBe(rf)
  })
})
