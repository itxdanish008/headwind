import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import { CORRIDOR_HOURS, type Corridor } from '../api/corridor'
import type { LevelName, Route } from '../types'

export const CORRIDOR_SOURCE_ID = 'corridor'
export const CORRIDOR_LAYER_ID = 'corridor-fill'
export const TRUCK_SOURCE_ID = 'truck'
export const TRUCK_RING_LAYER_ID = 'truck-ring'
export const TRUCK_LAYER_ID = 'truck'

const MAX_HOUR = CORRIDOR_HOURS - 1
const MS_PER_HOUR = 3_600_000
// Rounding keeps the shared edge of neighbouring cells bit-identical so they tile without seams.
const COORD_DECIMALS = 6

// Low must be nearly invisible so only real risk glows.
const LEVEL_ALPHA: Record<LevelName, number> = {
  LOW: 0.06,
  MODERATE: 0.3,
  HIGH: 0.4,
  SEVERE: 0.5,
  NO_TRAVEL: 0.55,
  UNKNOWN: 0.22,
}

const LEVEL_ORDER: LevelName[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

export type CellProperties = Record<`h${number}`, number>

const round = (value: number) => Number(value.toFixed(COORD_DECIMALS))

function cellPolygon({ lat, lon, step }: { lat: number; lon: number; step: number }): Polygon {
  const half = step / 2
  const [west, east] = [round(lon - half), round(lon + half)]
  const [south, north] = [round(lat - half), round(lat + half)]
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  }
}

export function cellsToGeoJSON(corridor: Corridor): FeatureCollection<Polygon, CellProperties> {
  const { cells, step, levels } = corridor
  const features = cells.map(([lat, lon], cellIndex): Feature<Polygon, CellProperties> => {
    const properties = {} as CellProperties
    for (let hour = 0; hour < CORRIDOR_HOURS; hour++) {
      properties[`h${hour}`] = levels[cellIndex * CORRIDOR_HOURS + hour]
    }
    return { type: 'Feature', properties, geometry: cellPolygon({ lat, lon, step }) }
  })
  return { type: 'FeatureCollection', features }
}

export function withAlpha(hex: string, alpha: number): string {
  const digits = hex.replace('#', '')
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const clampHour = (hour: number) => Math.min(MAX_HOUR, Math.max(0, Math.floor(hour)))

export function heatColorExpression({
  hour,
  colors,
}: {
  hour: number
  colors: Record<LevelName, string>
}): ExpressionSpecification {
  const tint = (level: LevelName) => withAlpha(colors[level], LEVEL_ALPHA[level])
  return [
    'match',
    ['get', `h${clampHour(hour)}`],
    ...LEVEL_ORDER.flatMap((level, value) => [value, tint(level)]),
    tint('UNKNOWN'),
  ] as unknown as ExpressionSpecification
}

type Position = [number, number]

export function truckPosition({ route, atMs }: { route: Route; atMs: number }): Position {
  const { checkpoints } = route
  const first = checkpoints[0]
  const last = checkpoints[checkpoints.length - 1]
  const at = (checkpoint: { lon: number; lat: number }): Position => [
    checkpoint.lon,
    checkpoint.lat,
  ]
  if (Date.parse(first.eta_utc) >= atMs) return at(first)
  if (Date.parse(last.eta_utc) <= atMs) return at(last)

  const nextIndex = checkpoints.findIndex((c) => Date.parse(c.eta_utc) > atMs)
  const from = checkpoints[nextIndex - 1]
  const to = checkpoints[nextIndex]
  const fromMs = Date.parse(from.eta_utc)
  const t = (atMs - fromMs) / (Date.parse(to.eta_utc) - fromMs)
  return [from.lon + (to.lon - from.lon) * t, from.lat + (to.lat - from.lat) * t]
}

export const forecastHourToMs = ({ firstHourMs, hour }: { firstHourMs: number; hour: number }) =>
  firstHourMs + hour * MS_PER_HOUR
