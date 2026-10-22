// Pure geometry and date helpers for the departure picker. Dates are local browser time; days
// are always built with the local Date constructor, never by adding 24 hours, so DST is safe.

export type Meridiem = 'AM' | 'PM'

export interface TimeParts {
  hour: number // 1..12
  minute: number // 0..59
  meridiem: Meridiem
}

export type WindowStatus = 'ok' | 'too-early' | 'too-late'

export interface Point {
  x: number
  y: number
}

const DEGREES_PER_HOUR = 30
const DEGREES_PER_MINUTE = 6

export function pointAngle(dx: number, dy: number): number {
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (degrees + 360) % 360
}

export function angleToHour(angle: number): number {
  return Math.round(angle / DEGREES_PER_HOUR) % 12 || 12
}

export function angleToMinute(angle: number): number {
  return Math.round(angle / DEGREES_PER_MINUTE) % 60
}

export function hourToAngle(hour: number): number {
  return (hour % 12) * DEGREES_PER_HOUR
}

export function minuteToAngle(minute: number): number {
  return minute * DEGREES_PER_MINUTE
}

export function polarToCartesian(cx: number, cy: number, radius: number, angle: number): Point {
  const radians = (angle * Math.PI) / 180
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) }
}

export function stepCycle(value: number, delta: number, min: number, count: number): number {
  return ((((value - min + delta) % count) + count) % count) + min
}

export function to24Hour({ hour, meridiem }: TimeParts): number {
  return (hour % 12) + (meridiem === 'PM' ? 12 : 0)
}

export function from24Hour(date: Date): TimeParts {
  const hours = date.getHours()
  return {
    hour: hours % 12 || 12,
    minute: date.getMinutes(),
    meridiem: hours >= 12 ? 'PM' : 'AM',
  }
}

export function withTime(date: Date, parts: TimeParts): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    to24Hour(parts),
    parts.minute,
  )
}

export function floorToMinute(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  )
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function parseDeparture(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface WindowOptions {
  now: Date
  windowDays: number
}

export function windowBounds({ now, windowDays }: WindowOptions): { earliest: Date; latest: Date } {
  const earliest = floorToMinute(now)
  const latest = new Date(
    earliest.getFullYear(),
    earliest.getMonth(),
    earliest.getDate() + windowDays,
    earliest.getHours(),
    earliest.getMinutes(),
  )
  return { earliest, latest }
}

export function clampToWindow(
  date: Date,
  options: WindowOptions,
): { value: Date; status: WindowStatus } {
  const { earliest, latest } = windowBounds(options)
  if (date < earliest) return { value: earliest, status: 'too-early' }
  if (date > latest) return { value: latest, status: 'too-late' }
  return { value: date, status: 'ok' }
}

export function monthGrid(year: number, month: number): Date[][] {
  const offset = new Date(year, month, 1).getDay()
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => new Date(year, month, 1 - offset + week * 7 + day)),
  )
}
