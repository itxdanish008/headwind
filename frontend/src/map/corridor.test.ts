import { describe, expect, it } from 'vitest'
import type { Corridor } from '../api/corridor'
import type { LevelName, Route } from '../types'
import { cellsToGeoJSON, heatColorExpression, truckPosition, withAlpha } from './corridor'

const HOURS = 49

const corridor: Corridor = {
  hours: Array.from({ length: HOURS }, (_, h) => `h${h}`),
  cells: [
    [40, -100],
    [40, -99.75],
  ],
  step: 0.25,
  levels: Array.from({ length: 2 * HOURS }, (_, i) => (i < HOURS ? i % 5 : 5)),
}

describe('cellsToGeoJSON', () => {
  const collection = cellsToGeoJSON(corridor)

  it('builds one closed square per cell around its centre', () => {
    expect(collection.features).toHaveLength(2)
    expect(collection.features[0].geometry.coordinates[0]).toEqual([
      [-100.125, 39.875],
      [-99.875, 39.875],
      [-99.875, 40.125],
      [-100.125, 40.125],
      [-100.125, 39.875],
    ])
  })

  it('maps each hour of each cell to its own property', () => {
    const [a, b] = collection.features.map((f) => f.properties)
    expect(Object.keys(a)).toHaveLength(HOURS)
    expect(a.h0).toBe(0)
    expect(a.h7).toBe(2)
    expect(a.h48).toBe(3)
    expect(b.h0).toBe(5)
    expect(b.h48).toBe(5)
  })

  it('tiles neighbouring cells on a shared edge', () => {
    const [left, right] = collection.features.map((f) => f.geometry.coordinates[0])
    expect(left[1]).toEqual(right[0])
    expect(left[2]).toEqual(right[3])
  })
})

describe('withAlpha', () => {
  it('expands short hex', () => expect(withAlpha('#f80', 0.5)).toBe('rgba(255, 136, 0, 0.5)'))
  it('parses long hex', () => expect(withAlpha('#0e1420', 0.06)).toBe('rgba(14, 20, 32, 0.06)'))
})

describe('heatColorExpression', () => {
  const colors: Record<LevelName, string> = {
    LOW: '#010101',
    MODERATE: '#020202',
    HIGH: '#030303',
    SEVERE: '#040404',
    NO_TRAVEL: '#050505',
    UNKNOWN: '#060606',
  }

  it('matches on the floored hour and tints all six outputs', () => {
    expect(heatColorExpression({ hour: 6.9, colors })).toEqual([
      'match',
      ['get', 'h6'],
      0,
      'rgba(1, 1, 1, 0.06)',
      1,
      'rgba(2, 2, 2, 0.3)',
      2,
      'rgba(3, 3, 3, 0.4)',
      3,
      'rgba(4, 4, 4, 0.5)',
      4,
      'rgba(5, 5, 5, 0.55)',
      'rgba(6, 6, 6, 0.22)',
    ])
  })

  it('clamps the hour to 0..48', () => {
    expect(heatColorExpression({ hour: -3, colors })[1]).toEqual(['get', 'h0'])
    expect(heatColorExpression({ hour: 99, colors })[1]).toEqual(['get', 'h48'])
  })
})

describe('truckPosition', () => {
  const stop = (eta_utc: string, lon: number, lat: number) => ({ eta_utc, lon, lat })
  const route = {
    checkpoints: [
      stop('2026-10-22T13:00Z', -96, 32),
      stop('2026-10-22T15:00Z', -98, 34),
      stop('2026-10-22T16:00Z', -99, 35),
    ],
  } as Route
  const at = (iso: string) => Date.parse(iso)

  it('waits at the origin before departure', () =>
    expect(truckPosition({ route, atMs: at('2026-10-22T01:00Z') })).toEqual([-96, 32]))
  it('rests at the destination after arrival', () =>
    expect(truckPosition({ route, atMs: at('2026-10-23T01:00Z') })).toEqual([-99, 35]))
  it('interpolates between bracketing checkpoints', () =>
    expect(truckPosition({ route, atMs: at('2026-10-22T14:00Z') })).toEqual([-97, 33]))
  it('sits exactly on a checkpoint at its ETA', () =>
    expect(truckPosition({ route, atMs: at('2026-10-22T15:00Z') })).toEqual([-98, 34]))
})
