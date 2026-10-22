import type { LevelName } from '../types'

type MeterLevel = Exclude<LevelName, 'UNKNOWN'>

// Upper bounds of LOW..SEVERE for one metric. The bound itself belongs to the next level
// unless `inclusive` is set (rain and snow: No Travel is strictly greater than Severe's top).
interface Table {
  bounds: [number, number, number, number]
  inclusive: boolean
}

const LADDER: MeterLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

function classify(value: number, { bounds, inclusive }: Table): MeterLevel {
  const index = bounds.findIndex((bound, i) =>
    inclusive && i === 3 ? value <= bound : value < bound,
  )
  return LADDER[index === -1 ? 4 : index]
}

const WIND: Table = { bounds: [25, 35, 45, 55], inclusive: false }
const RAIN: Table = { bounds: [0.1, 0.25, 0.5, 1.0], inclusive: true }
const SNOW: Table = { bounds: [0.5, 1.0, 2.0, 3.0], inclusive: true }

export const NO_TRAVEL_AT = { wind: 55, rain: 1.0, snow: 3.0 }

export const windLevel = (mph: number): MeterLevel => classify(mph, WIND)
export const rainLevel = (inHr: number): MeterLevel => classify(inHr, RAIN)
export const snowLevel = (inHr: number): MeterLevel => classify(inHr, SNOW)

export function loadRuleNote(windMph: number, loadLbs: number): string | null {
  if (windMph >= 45 && windMph < 55 && loadLbs > 30_000) {
    return 'At 45-54 mph, loads over 30,000 lb are No Travel.'
  }
  if (windMph >= 35 && windMph < 45 && loadLbs > 40_000) {
    return 'At 35-44 mph, loads over 40,000 lb are upgraded to Severe.'
  }
  return null
}
