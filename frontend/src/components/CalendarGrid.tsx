import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { addDays, isSameDay, monthGrid, startOfDay } from '../lib/clock'
import './CalendarGrid.css'

interface CalendarGridProps {
  selected: Date
  today: Date
  min: Date
  max: Date
  onSelect: (day: Date) => void
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export default function CalendarGrid({ selected, today, min, max, onSelect }: CalendarGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  const [focused, setFocused] = useState(() => clampDay(selected))
  const [lastSelected, setLastSelected] = useState(selected)

  function clampDay(day: Date): Date {
    const clamped = startOfDay(day)
    return clamped < min ? min : clamped > max ? max : clamped
  }

  if (!isSameDay(lastSelected, selected)) {
    setLastSelected(selected)
    setFocused(clampDay(selected))
  }

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [focused])

  const year = focused.getFullYear()
  const month = focused.getMonth()
  const weeks = monthGrid(year, month)

  function shiftMonth(delta: number) {
    const target = new Date(year, month + delta, 1)
    const day = Math.min(focused.getDate(), daysInMonth(target.getFullYear(), target.getMonth()))
    setFocused(clampDay(new Date(target.getFullYear(), target.getMonth(), day)))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -focused.getDay()),
      End: () => addDays(focused, 6 - focused.getDay()),
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      moveFocus.current = true
      shiftMonth(event.key === 'PageUp' ? -1 : 1)
    } else if (event.key in moves) {
      event.preventDefault()
      moveFocus.current = true
      setFocused(clampDay(moves[event.key]()))
    }
  }

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button
          type="button"
          className="calendar__nav"
          aria-label="Previous month"
          disabled={year * 12 + month <= min.getFullYear() * 12 + min.getMonth()}
          onClick={() => shiftMonth(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div className="calendar__title" aria-live="polite">
          {MONTH_FORMAT.format(focused)}
        </div>
        <button
          type="button"
          className="calendar__nav"
          aria-label="Next month"
          disabled={year * 12 + month >= max.getFullYear() * 12 + max.getMonth()}
          onClick={() => shiftMonth(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label={MONTH_FORMAT.format(focused)}
        onKeyDown={handleKeyDown}
      >
        <div className="calendar__row" role="row">
          {WEEKDAYS.map((name) => (
            <div
              key={name}
              className="calendar__weekday label"
              role="columnheader"
              aria-label={name}
            >
              {name.slice(0, 2)}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].getTime()} className="calendar__row" role="row">
            {week.map((day) => {
              if (day.getMonth() !== month) {
                return <div key={day.getTime()} className="calendar__cell" role="gridcell" />
              }
              const isSelected = isSameDay(day, selected)
              return (
                <div
                  key={day.getTime()}
                  className="calendar__cell"
                  role="gridcell"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    className="calendar__day num"
                    tabIndex={isSameDay(day, focused) ? 0 : -1}
                    disabled={day < min || day > max}
                    aria-label={DAY_FORMAT.format(day)}
                    aria-current={isSameDay(day, today) ? 'date' : undefined}
                    data-selected={isSelected || undefined}
                    data-today={isSameDay(day, today) || undefined}
                    onClick={() => onSelect(day)}
                    onFocus={() => setFocused(day)}
                  >
                    {day.getDate()}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
