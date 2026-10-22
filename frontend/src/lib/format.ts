export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

export function formatDurationShort(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function formatMiles(miles: number): string {
  return `${miles.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`
}

export function formatLb(lb: number): string {
  return `${lb.toLocaleString('en-US')} lb`
}

// eta_local carries its own UTC offset; read the clock from the string so the viewer's
// timezone never shifts it.
export function formatLocalTime({
  eta_local: etaLocal,
  tz,
}: {
  eta_local: string
  tz: string
}): string {
  const match = /T(\d{2}):(\d{2})/.exec(etaLocal)
  if (!match) return etaLocal
  const hour = Number(match[1])
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${match[2]} ${suffix} ${tz}`
}

export function formatLocalDay(etaLocal: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(etaLocal)
  if (!match) return etaLocal
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatRate(value: number | null, unit: string): string {
  return value === null
    ? '-'
    : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}

export function formatAvgRisk(value: number | null): string {
  return value === null ? '-' : value.toFixed(2)
}

export const pad2 = (n: number): string => String(n).padStart(2, '0')

export const shortPlaceName = (label: string): string => label.split(',')[0].trim()
