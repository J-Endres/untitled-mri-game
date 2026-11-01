import styles from './sheets.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

/** Slider with a numeric readout - thumb-friendly on phones. */
export function SliderField({ label, value, min, max, step = 1, unit, onChange }: SliderProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <output>
          {value} {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}

/** A row of mutually exclusive buttons for small sets of choices. */
export function SegmentedField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={o === value}
            className={o === value ? styles.selected : undefined}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
