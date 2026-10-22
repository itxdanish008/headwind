import { describe, expect, it } from 'vitest'
import type { Plan, Route } from '../types'
import { buildLadder } from './ladder'

function route(id: string, opts: Partial<Record<string, number>> = {}): Route {
  return {
    id,
    geometry: { type: 'LineString', coordinates: [] },
    distance_mi: 500,
    duration_s: opts.duration ?? 36000,
    forced: false,
    checkpoints: [],
    summary: {
      miles_by_level: {
        LOW: 0,
        MODERATE: 0,
        HIGH: opts.high ?? 0,
        SEVERE: opts.severe ?? 0,
        NO_TRAVEL: opts.noTravel ?? 0,
      },
      avg_risk: opts.avg ?? 0,
      unknown_miles: 0,
    },
  }
}

const plan = (routes: Route[], recommended: string): Plan => ({
  origin: { label: 'A', lat: 0, lon: 0, timezone: 'UTC' },
  destination: { label: 'B', lat: 0, lon: 0, timezone: 'UTC' },
  departure_utc: '',
  routes,
  recommended_route_id: recommended,
  reason: '',
  warnings: [],
})

describe('buildLadder', () => {
  it('orders the criteria like the backend sort key', () => {
    const { rows } = buildLadder(plan([route('A'), route('B')], 'A'))
    expect(rows.map((row) => row.key)).toEqual([
      'no_travel',
      'severe',
      'high',
      'avg_risk',
      'duration',
    ])
  })

  it('marks the first row that separates the winner from any rival as decisive', () => {
    const routes = [route('A', { noTravel: 25 }), route('B'), route('C', { duration: 40000 })]
    const ladder = buildLadder(plan(routes, 'B'))
    expect(ladder.decisiveKey).toBe('no_travel')
    expect(ladder.rows[0].bestIds).toEqual(['B', 'C'])
  })

  it('falls through to travel time when risk is level', () => {
    const ladder = buildLadder(
      plan([route('A', { duration: 100 }), route('B', { duration: 200 })], 'A'),
    )
    expect(ladder.decisiveKey).toBe('duration')
    expect(ladder.rows[4].bestIds).toEqual(['A'])
  })

  it('rounds miles to a tenth and risk to two decimals before comparing', () => {
    const ladder = buildLadder(
      plan(
        [route('A', { severe: 10.04, avg: 1.004 }), route('B', { severe: 10, avg: 1.001 })],
        'A',
      ),
    )
    expect(ladder.rows[1].bestIds).toEqual(['A', 'B'])
    expect(ladder.rows[3].bestIds).toEqual(['A', 'B'])
  })

  it('has no decisive row when every route ties', () => {
    const ladder = buildLadder(plan([route('A'), route('B')], 'A'))
    expect(ladder.decisiveKey).toBeNull()
    expect(ladder.tieBreakKey).toBeNull()
  })

  it('names the later row that separates a rival tied on the decisive row', () => {
    const routes = [
      route('A', { avg: 0, duration: 44555 }),
      route('B', { avg: 0.03, duration: 45720 }),
      route('C', { avg: 0, duration: 44601 }),
    ]
    const ladder = buildLadder(plan(routes, 'A'))
    expect(ladder.decisiveKey).toBe('avg_risk')
    expect(ladder.tieBreakKey).toBe('duration')
  })

  it('has no tie-break when every rival is separated by the decisive row', () => {
    const routes = [route('A'), route('B', { severe: 12 }), route('C', { severe: 30 })]
    expect(buildLadder(plan(routes, 'A')).tieBreakKey).toBeNull()
  })
})
