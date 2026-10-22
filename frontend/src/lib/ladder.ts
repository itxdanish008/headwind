import type { Plan } from '../types'

export type LadderKey = 'no_travel' | 'severe' | 'high' | 'avg_risk' | 'duration'

export interface LadderRow {
  key: LadderKey
  label: string
  values: Record<string, number>
  bestIds: string[]
}

export interface Ladder {
  rows: LadderRow[]
  decisiveKey: LadderKey | null
  tieBreakKey: LadderKey | null
}

const LABELS: Record<LadderKey, string> = {
  no_travel: 'No Travel miles',
  severe: 'Severe miles',
  high: 'High miles',
  avg_risk: 'Average risk',
  duration: 'Travel time',
}

// Rounded exactly like the backend sort key, so a tie here is a tie there.
const roundMiles = (value: number) => Math.round(value * 10) / 10
const roundRisk = (value: number) => Math.round(value * 100) / 100

export function buildLadder(plan: Plan): Ladder {
  const read: Record<LadderKey, (route: Plan['routes'][number]) => number> = {
    no_travel: (route) => roundMiles(route.summary.miles_by_level.NO_TRAVEL),
    severe: (route) => roundMiles(route.summary.miles_by_level.SEVERE),
    high: (route) => roundMiles(route.summary.miles_by_level.HIGH),
    avg_risk: (route) => roundRisk(route.summary.avg_risk ?? 0),
    duration: (route) => route.duration_s,
  }

  const rows = (Object.keys(LABELS) as LadderKey[]).map((key): LadderRow => {
    const values = Object.fromEntries(plan.routes.map((route) => [route.id, read[key](route)]))
    const best = Math.min(...Object.values(values))
    const bestIds = plan.routes.filter((route) => values[route.id] === best).map((r) => r.id)
    return { key, label: LABELS[key], values, bestIds }
  })

  const winner = plan.recommended_route_id
  const rivalsDiffering = (row: LadderRow, rivals: string[]) =>
    rivals.some((id) => row.values[id] !== row.values[winner])

  const rivalIds = plan.routes.map((route) => route.id).filter((id) => id !== winner)
  const decisiveIndex = rows.findIndex((row) => rivalsDiffering(row, rivalIds))
  if (decisiveIndex === -1) return { rows, decisiveKey: null, tieBreakKey: null }

  const decisiveRow = rows[decisiveIndex]
  const tiedIds = rivalIds.filter((id) => decisiveRow.values[id] === decisiveRow.values[winner])
  const tieBreak = rows.slice(decisiveIndex + 1).find((row) => rivalsDiffering(row, tiedIds))
  return { rows, decisiveKey: decisiveRow.key, tieBreakKey: tieBreak?.key ?? null }
}
