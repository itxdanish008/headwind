import { describe, expect, it } from 'vitest'
import type { Checkpoint, LevelName } from '../types'
import {
  LOAD_RULES,
  barHeightPct,
  filterCheckpoints,
  isRuleActive,
  metricTint,
  nearestCheckpoint,
} from './detail'

const cp = (mile: number, level: LevelName = 'LOW'): Checkpoint => ({
  mile,
  lat: 0,
  lon: 0,
  eta_utc: '',
  eta_local: '',
  tz: 'MT',
  covered_miles: 25,
  wind_mph: null,
  gust_mph: null,
  rain_in_hr: null,
  snow_in_hr: null,
  level,
  driver: null,
})

describe('barHeightPct', () => {
  it('rises with severity and keeps UNKNOWN shortest', () => {
    const order: LevelName[] = ['UNKNOWN', 'LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']
    const heights = order.map(barHeightPct)
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
    expect(new Set(heights).size).toBe(order.length)
  })
})

describe('isRuleActive', () => {
  const active = (load: number) => LOAD_RULES.map((rule) => isRuleActive(rule, load))

  it('always applies the any-load rule', () => {
    expect(active(0)[0]).toBe(true)
  })

  it('treats the thresholds as strictly greater than', () => {
    expect(active(30_000)).toEqual([true, false, false])
    expect(active(30_001)).toEqual([true, true, false])
    expect(active(40_000)).toEqual([true, true, false])
    expect(active(40_001)).toEqual([true, true, true])
  })
})

describe('filterCheckpoints', () => {
  const all = [cp(0), cp(25, 'MODERATE'), cp(50, 'UNKNOWN'), cp(75, 'NO_TRAVEL')]

  it('hides only LOW at moderate and above', () => {
    expect(filterCheckpoints(all, 'moderate').map((c) => c.mile)).toEqual([25, 50, 75])
  })

  it('returns everything for all', () => {
    expect(filterCheckpoints(all, 'all')).toHaveLength(4)
  })
})

describe('metricTint', () => {
  it('leaves LOW and missing values untinted', () => {
    expect(metricTint('LOW')).toBeUndefined()
    expect(metricTint(null)).toBeUndefined()
    expect(metricTint('SEVERE')).toBe('var(--r3-t)')
  })
})

describe('nearestCheckpoint', () => {
  it('picks the checkpoint closest to the mile', () => {
    expect(nearestCheckpoint([cp(0), cp(25), cp(50)], 40).mile).toBe(50)
  })
})
