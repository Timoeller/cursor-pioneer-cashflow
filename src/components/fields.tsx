import { useState } from 'react'

interface NumberFieldProps {
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  step?: number
  allowEmpty?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
}

/** Number input that keeps a local draft so partially typed values (e.g. "", "-") don't get clobbered. */
export function NumberField({ value, onChange, min, max, step, allowEmpty, placeholder, className, ariaLabel }: NumberFieldProps) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [seen, setSeen] = useState(value)

  // sync the draft when the value changes from outside (import, scenario switch)
  if (seen !== value) {
    setSeen(value)
    const parsed = draft.trim() === '' ? (allowEmpty ? null : 0) : Number(draft)
    if (parsed !== value) setDraft(value == null ? '' : String(value))
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      className={`num ${className ?? ''}`}
      value={draft}
      min={min}
      max={max}
      step={step ?? 'any'}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const s = e.target.value
        setDraft(s)
        if (s.trim() === '') {
          onChange(allowEmpty ? null : 0)
          return
        }
        const n = Number(s)
        if (Number.isFinite(n)) onChange(n)
      }}
    />
  )
}

interface TextFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}

export function TextField({ value, onChange, placeholder, className, ariaLabel }: TextFieldProps) {
  return (
    <input
      type="text"
      className={className}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      ×
    </button>
  )
}