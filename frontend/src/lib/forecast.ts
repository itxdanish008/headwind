import { CORRIDOR_HOURS, UNKNOWN_CELL_LEVEL, type Corridor } from '../api/corridor'

const HOUR_MS = 3_600_000
const LAST_HOUR = CORRIDOR_HOURS - 1

export const BEYOND_WINDOW_NOTE =
  'Your departure is beyond the 48-hour forecast window, so the heatmap starts from now.'

function stampMs({ hours, hour }: { hours: string[]; hour: number }): number {
  const clamped = Math.min(Math.max(hour, 0), LAST_HOUR)
  const whole = Math.floor(clamped)
  return Date.parse(hours[whole]) + Math.floor((clamped - whole) * 60) * 60_000
}

interface LabelOptions {
  hours: string[]
  hour: number
  timeZone: string
}

// Intl knows the origin's daylight saving changes, which one fixed UTC offset cannot.
function formatStamp({ hours, hour, timeZone }: LabelOptions, detailed: boolean): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: detailed ? '2-digit' : undefined,
    hour12: true,
    timeZoneName: detailed ? 'short' : undefined,
  }).formatToParts(stampMs({ hours, hour }))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const time = detailed ? `${part('hour')}:${part('minute')}` : part('hour')
  const base = `${part('weekday')} ${time} ${part('dayPeriod')}`
  return detailed ? `${base} ${part('timeZoneName')}` : base
}

export const hourLabel = (options: LabelOptions) => formatStamp(options, true)

export const tickLabel = (options: LabelOptions) => formatStamp(options, false)

export function hoursFromNow(hour: number): string {
  const rounded = Math.round(hour)
  return rounded === 0 ? 'Now' : `+${rounded}h`
}

export interface TripWindow {
  startHour: number
  endHour: number
}

export function tripWindow({
  departureUtc,
  arrivalUtc,
  firstHourUtc,
}: {
  departureUtc: string
  arrivalUtc: string
  firstHourUtc: string
}): TripWindow | null {
  const first = Date.parse(firstHourUtc)
  const start = (Date.parse(departureUtc) - first) / HOUR_MS
  const end = (Date.parse(arrivalUtc) - first) / HOUR_MS
  if (end < 0 || start > LAST_HOUR) return null
  return {
    startHour: Math.min(Math.max(start, 0), LAST_HOUR),
    endHour: Math.min(Math.max(end, 0), LAST_HOUR),
  }
}

export function initialHour({ departureUtc, hours }: { departureUtc: string; hours: string[] }): {
  hour: number
  note: string | null
} {
  const hour = Math.floor((Date.parse(departureUtc) - Date.parse(hours[0])) / HOUR_MS)
  if (hour >= 0 && hour <= LAST_HOUR) return { hour, note: null }
  return { hour: 0, note: BEYOND_WINDOW_NOTE }
}

export function worstLevelByHour(corridor: Corridor): number[] {
  const cellCount = corridor.cells.length
  return Array.from({ length: CORRIDOR_HOURS }, (_, h) => {
    let worst = -1
    for (let c = 0; c < cellCount; c++) {
      const level = corridor.levels[c * CORRIDOR_HOURS + h]
      if (level !== UNKNOWN_CELL_LEVEL && level > worst) worst = level
    }
    return worst === -1 ? UNKNOWN_CELL_LEVEL : worst
  })
}
