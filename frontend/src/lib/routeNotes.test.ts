import { describe, expect, it } from 'vitest'
import type { Route, RouteSummary } from '../types'
import { routeNote, severePlusMiles } from './routeNotes'

const summary = (miles: Partial<RouteSummary['miles_by_level']>): RouteSummary => ({
  miles_by_level: { LOW: 0, MODERATE: 0, HIGH: 0, SEVERE: 0, NO_TRAVEL: 0, ...miles },
  avg_risk: 0,
  unknown_miles: 0,
})

const route = (miles: Partial<RouteSummary['miles_by_level']>) =>
  ({ summary: summary(miles) }) as Route

describe('routeNote', () => {
  it('reports no travel first', () => {
    expect(routeNote(route({ NO_TRAVEL: 42, SEVERE: 10, HIGH: 5 }))).toBe(
      '42 mi of No Travel conditions',
    )
  })
  it('reports severe when no no-travel', () => {
    expect(routeNote(route({ SEVERE: 25, HIGH: 5 }))).toBe('25 mi of Severe weather')
  })
  it('reports high', () => {
    expect(routeNote(route({ HIGH: 25, MODERATE: 50 }))).toBe('25 mi of High risk')
  })
  it('reports moderate', () => {
    expect(routeNote(route({ MODERATE: 25, LOW: 100 }))).toBe('25 mi of Moderate weather')
  })
  it('reports clear when only low miles', () => {
    expect(routeNote(route({ LOW: 300 }))).toBe('Clear along the whole route')
  })
  it('treats 0 mi as absent', () => {
    expect(routeNote(route({ NO_TRAVEL: 0, SEVERE: 0, HIGH: 0, MODERATE: 0 }))).toBe(
      'Clear along the whole route',
    )
  })
})

describe('severePlusMiles', () => {
  it('sums severe and no travel', () => {
    expect(severePlusMiles(summary({ SEVERE: 10, NO_TRAVEL: 5, HIGH: 99 }))).toBe(15)
  })
})
