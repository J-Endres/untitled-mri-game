import { findEvent, findNode, type SeqEvent } from '../../domain/sequence'
import { kindInfo } from '../eventInfo'
import { useEditor } from '../sequence/EditorContext'
import { Icon } from '../icons'
import { BottomSheet } from './BottomSheet'
import { SegmentedField, SliderField } from './fields'
import styles from './sheets.module.css'

const AXES = ['x', 'y', 'z'] as const

/** Parameter fields for one event kind. */
function EventFields({ event, set }: { event: SeqEvent; set: (p: Partial<SeqEvent>) => void }) {
  const duration = (max: number) => (
    <SliderField
      label="Duration"
      unit="µs"
      min={100}
      max={max}
      step={10}
      value={'durationUs' in event ? event.durationUs : 0}
      onChange={(durationUs) => set({ durationUs })}
    />
  )
  switch (event.kind) {
    case 'rf':
      return (
        <>
          <SliderField
            label="Flip angle"
            unit="°"
            min={1}
            max={180}
            value={event.flipAngleDeg}
            onChange={(flipAngleDeg) => set({ flipAngleDeg })}
          />
          <SliderField
            label="Phase"
            unit="°"
            min={0}
            max={359}
            value={event.phaseDeg}
            onChange={(phaseDeg) => set({ phaseDeg })}
          />
          <SegmentedField
            label="Shape"
            options={['block', 'sinc'] as const}
            value={event.shape}
            onChange={(shape) => set({ shape })}
          />
          {duration(5000)}
        </>
      )
    case 'adc':
      return (
        <>
          <SegmentedField
            label="Samples"
            options={[16, 32, 64, 128, 256] as const}
            value={event.samples}
            onChange={(samples) => set({ samples })}
          />
          <SliderField
            label="Dwell time"
            unit="µs"
            min={2}
            max={100}
            value={event.dwellUs}
            onChange={(dwellUs) => set({ dwellUs })}
          />
        </>
      )
    case 'gradient':
      return (
        <>
          <SegmentedField
            label="Axis"
            options={AXES}
            value={event.axis}
            onChange={(axis) => set({ axis })}
          />
          <SegmentedField
            label="Shape"
            options={['trapezoid', 'triangle'] as const}
            value={event.shape}
            onChange={(shape) => set({ shape })}
          />
          <SliderField
            label="Area"
            unit="1/m"
            min={-5000}
            max={5000}
            step={10}
            value={event.area}
            onChange={(area) => set({ area })}
          />
          <SliderField
            label="Area step per loop iteration"
            unit="1/m"
            min={-100}
            max={100}
            value={event.areaStep}
            onChange={(areaStep) => set({ areaStep })}
          />
          {duration(10000)}
        </>
      )
    case 'spoiler':
      return (
        <>
          <SegmentedField
            label="Axis"
            options={AXES}
            value={event.axis}
            onChange={(axis) => set({ axis })}
          />
          <SliderField
            label="Area"
            unit="1/m"
            min={0}
            max={10000}
            step={100}
            value={event.area}
            onChange={(area) => set({ area })}
          />
          {duration(5000)}
        </>
      )
    case 'delay':
      return duration(50000)
  }
}

export function EventSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { sequence, dispatch } = useEditor()
  const found = findEvent(sequence.nodes, eventId)
  if (!found) return null
  const { event, blockId } = found
  const block = findNode(sequence.nodes, blockId)!.node
  const linked = block.type === 'block' && block.events.length > 1
  const info = kindInfo[event.kind]

  return (
    <BottomSheet
      title={<span style={{ color: info.color }}>{`${info.icon} ${info.label}`}</span>}
      onClose={onClose}
    >
      <EventFields
        event={event}
        set={(patch) => dispatch({ type: 'updateEvent', id: eventId, patch })}
      />
      <div className={styles.actions}>
        {linked && <button onClick={() => dispatch({ type: 'unlink', eventId })}>Unlink</button>}
        <button
          onClick={() => {
            dispatch({ type: 'wrap', id: blockId })
            onClose()
          }}
        >
          Wrap in loop
        </button>
        <button
          className="danger"
          onClick={() => {
            dispatch({ type: 'removeEvent', id: eventId })
            onClose()
          }}
        >
          <Icon name="trashbin" /> Delete
        </button>
      </div>
    </BottomSheet>
  )
}
