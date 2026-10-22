import { describe, expect, it } from 'vitest'
import { loadRuleNote, rainLevel, snowLevel, windLevel } from './thresholds'

describe('windLevel', () => {
  it.each([
    [0, 'LOW'],
    [24.99, 'LOW'],
    [25, 'MODERATE'],
    [34.99, 'MODERATE'],
    [35, 'HIGH'],
    [44.99, 'HIGH'],
    [45, 'SEVERE'],
    [54.99, 'SEVERE'],
    [55, 'NO_TRAVEL'],
    [80, 'NO_TRAVEL'],
  ])('%s mph -> %s', (mph, level) => {
    expect(windLevel(mph)).toBe(level)
  })
})

describe('rainLevel', () => {
  it.each([
    [0, 'LOW'],
    [0.0999, 'LOW'],
    [0.1, 'MODERATE'],
    [0.2499, 'MODERATE'],
    [0.25, 'HIGH'],
    [0.4999, 'HIGH'],
    [0.5, 'SEVERE'],
    [1.0, 'SEVERE'],
    [1.0001, 'NO_TRAVEL'],
  ])('%s in/hr -> %s', (rate, level) => {
    expect(rainLevel(rate)).toBe(level)
  })
})

describe('snowLevel', () => {
  it.each([
    [0, 'LOW'],
    [0.49, 'LOW'],
    [0.5, 'MODERATE'],
    [0.99, 'MODERATE'],
    [1.0, 'HIGH'],
    [1.99, 'HIGH'],
    [2.0, 'SEVERE'],
    [3.0, 'SEVERE'],
    [3.01, 'NO_TRAVEL'],
  ])('%s in/hr -> %s', (rate, level) => {
    expect(snowLevel(rate)).toBe(level)
  })
})

describe('loadRuleNote', () => {
  it.each([
    [50, 30_000, null],
    [50, 30_001, 'At 45-54 mph, loads over 30,000 lb are No Travel.'],
    [45, 30_001, 'At 45-54 mph, loads over 30,000 lb are No Travel.'],
    [55, 50_000, null],
    [40, 40_000, null],
    [40, 40_001, 'At 35-44 mph, loads over 40,000 lb are upgraded to Severe.'],
    [35, 40_001, 'At 35-44 mph, loads over 40,000 lb are upgraded to Severe.'],
    [34.99, 50_000, null],
    [44.99, 30_001, null],
    [20, 80_000, null],
  ])('wind %s, load %s', (wind, load, note) => {
    expect(loadRuleNote(wind, load)).toBe(note)
  })
})
