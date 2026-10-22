import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  clampToWindow,
  floorToMinute,
  from24Hour,
  parseDeparture,
  startOfDay,
  windowBounds,
  withTime,
  type Meridiem,
  type TimeParts,
} from '../lib/clock'
import { inHours, toDepartureString } from '../lib/trip'
import CalendarGrid from './CalendarGrid'
import ClockFace, { type ClockMode } from './ClockFace'
import './DateTimePicker.css'
import { pad2 } from '../lib/format'

export interface DateTimePickerProps {
  value: string
  onChange: (value: string) => void
  now: Date
  windowDays: number
}

const MERIDIEMS: Meridiem[] = ['AM', 'PM']
const QUICK_PICKS = [
  { label: 'Now', hours: 0 },
  { label: 'In 1 hour', hours: 1 },
  { label: 'In 6 hours', hours: 6 },
]
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

interface TimeFieldProps {
  label: string
  value: number
  min: number
  max: number
  padded?: boolean
  active: boolean
  onCommit: (value: number) => void
  onFocus: () => void
}

function TimeField({ label, value, min, max, padded, active, onCommit, onFocus }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
    setDraft(digits)
    const typed = Number(digits)
    if (digits && typed >= min && typed <= max) onCommit(typed)
  }

  return (
    <input
      className="picker__field num"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      data-active={active || undefined}
      value={draft ?? (padded ? pad2(value) : String(value))}
      onChange={handleChange}
      onFocus={(event) => {
        event.target.select()
        onFocus()
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

export default function DateTimePicker({ value, onChange, now, windowDays }: DateTimePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const openedWith = useRef(value)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ClockMode>('hour')
  const [draft, setDraft] = useState(() => parseDeparture(value) ?? floorToMinute(now))
  const [lastValue, setLastValue] = useState(value)

  if (value !== lastValue) {
    setLastValue(value)
    if (value !== toDepartureString(draft)) setDraft(parseDeparture(value) ?? draft)
  }

  const { earliest, latest } = windowBounds({ now, windowDays })
  const { status } = clampToWindow(draft, { now, windowDays })
  const parts = from24Hour(draft)

  function choose(next: Date) {
    const date = floorToMinute(next)
    setDraft(date)
    if (clampToWindow(date, { now, windowDays }).status === 'ok') onChange(toDepartureString(date))
  }

  function setParts(change: Partial<TimeParts>) {
    choose(withTime(draft, { ...parts, ...change }))
  }

  function selectDay(day: Date) {
    choose(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        draft.getHours(),
        draft.getMinutes(),
      ),
    )
  }

  function cancel() {
    onChange(openedWith.current)
    setOpen(false)
    setDraft(parseDeparture(openedWith.current) ?? draft)
    triggerRef.current?.focus()
  }

  function close(restoreFocus: boolean) {
    setOpen(false)
    setDraft(parseDeparture(value) ?? draft)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function toggle() {
    if (open) return close(false)
    openedWith.current = value
    setMode('hour')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const target = dialog?.querySelector<HTMLElement>('.calendar__day[tabindex="0"]')
    ;(target ?? dialog)?.focus()
    dialog?.scrollIntoView({ block: 'nearest' })
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setDraft((current) => parseDeparture(value) ?? current)
      }
    }
    // Capture phase: React may re-render and detach the clicked dial label before a bubbling
    // listener runs, which would make an inside click look like an outside one.
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, value])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      cancel()
    }
  }

  function handleMeridiemKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const next = parts.meridiem === 'AM' ? 'PM' : 'AM'
    setParts({ meridiem: next })
    event.currentTarget.parentElement
      ?.querySelector<HTMLElement>(`[data-meridiem="${next}"]`)
      ?.focus()
  }

  const message =
    status === 'too-early'
      ? `Pick a time after ${TIME_FORMAT.format(earliest)}.`
      : status === 'too-late'
        ? `Forecasts are available up to ${windowDays} days ahead.`
        : ''

  return (
    <div className="picker" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-dialog` : undefined}
        onClick={toggle}
      >
        <span className="picker__trigger-text">
          <span className="label" id={`${id}-label`}>
            Departure (origin local time)
          </span>
          <span className="picker__trigger-value">
            {DAY_FORMAT.format(draft)} -{' '}
            <span className="num">
              {parts.hour}:{pad2(parts.minute)} {parts.meridiem}
            </span>
          </span>
        </span>
        <svg className="picker__trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && (
        <div
          ref={dialogRef}
          id={`${id}-dialog`}
          className="picker__popover glass"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
        >
          <div className="picker__body">
            <CalendarGrid
              selected={draft}
              today={now}
              min={startOfDay(earliest)}
              max={startOfDay(latest)}
              onSelect={selectDay}
            />

            <div className="picker__time">
              <div className="picker__readout" role="group" aria-label="Time">
                <TimeField
                  label="Hour"
                  value={parts.hour}
                  min={1}
                  max={12}
                  active={mode === 'hour'}
                  onCommit={(hour) => setParts({ hour })}
                  onFocus={() => setMode('hour')}
                />
                <span className="picker__colon num" aria-hidden="true">
                  :
                </span>
                <TimeField
                  label="Minute"
                  value={parts.minute}
                  min={0}
                  max={59}
                  padded
                  active={mode === 'minute'}
                  onCommit={(minute) => setParts({ minute })}
                  onFocus={() => setMode('minute')}
                />
              </div>
              <div className="picker__meridiem" role="radiogroup" aria-label="AM or PM">
                {MERIDIEMS.map((meridiem) => (
                  <button
                    key={meridiem}
                    type="button"
                    role="radio"
                    aria-checked={parts.meridiem === meridiem}
                    tabIndex={parts.meridiem === meridiem ? 0 : -1}
                    data-meridiem={meridiem}
                    onClick={() => setParts({ meridiem })}
                    onKeyDown={handleMeridiemKey}
                  >
                    {meridiem}
                  </button>
                ))}
              </div>
            </div>

            <ClockFace
              mode={mode}
              hour={parts.hour}
              minute={parts.minute}
              onHourChange={(hour) => setParts({ hour })}
              onMinuteChange={(minute) => setParts({ minute })}
              onHourSettled={() => setMode('minute')}
            />

            <div className="picker__chips">
              {QUICK_PICKS.map(({ label, hours }) => (
                <button
                  key={label}
                  type="button"
                  className="picker__chip"
                  onClick={() =>
                    choose(clampToWindow(inHours(now, hours), { now, windowDays }).value)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="picker__footer">
            <p className="picker__status" role="status">
              {message}
            </p>
            <button
              type="button"
              className="btn-primary btn-block"
              disabled={status !== 'ok'}
              onClick={() => close(true)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
