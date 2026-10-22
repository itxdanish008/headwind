import { pad2 } from './format'

export const MIN_CARGO_LB = 1000
export const MAX_CARGO_LB = 47000
export const LOAD_STEP_LB = 1000
export const HEAVY_LB = 30000
export const OVERWEIGHT_LB = 40000

// The backend reads this as the origin's local time, so it must carry no UTC offset.
export function toDepartureString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export const DEPARTURE_WINDOW_DAYS = 14

// A Date whose local fields read as the wall clock in `timeZone`, so the rest of the departure
// code (which works in local fields) sees the origin's time.
export function wallClockNow(timeZone: string, at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return new Date(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
}

export function nextWholeHour(now: Date): Date {
  const next = new Date(now)
  next.setHours(next.getHours() + 1, 0, 0, 0)
  return next
}

export function inHours(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 3_600_000)
}

export function tomorrowAtSix(now: Date): Date {
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(6, 0, 0, 0)
  return next
}

export function loadRuleText(lb: number): string {
  if (lb <= HEAVY_LB) {
    return 'Standard thresholds apply. Wind of 55 mph or more is still No Travel for any load.'
  }
  if (lb <= OVERWEIGHT_LB) return 'Over 30,000 lb: 45-54 mph wind becomes No Travel.'
  return 'Over 30,000 lb: 45-54 mph wind becomes No Travel, and 35-44 mph is upgraded to Severe.'
}

export function trailerFillColor(lb: number): string {
  if (lb <= HEAVY_LB) return 'var(--risk-low)'
  if (lb <= OVERWEIGHT_LB) return 'var(--risk-high)'
  return 'var(--risk-severe)'
}
