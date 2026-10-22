import { describe, expect, it } from 'vitest'
import {
  loadRuleText,
  nextWholeHour,
  toDepartureString,
  tomorrowAtSix,
  wallClockNow,
  trailerFillColor,
} from './trip'

describe('loadRuleText', () => {
  it('uses the standard rule up to and including 30,000 lb', () => {
    expect(loadRuleText(30000)).toMatch(/^Standard thresholds/)
  })

  it('switches to the heavy rule just above 30,000 lb', () => {
    expect(loadRuleText(31000)).toBe('Over 30,000 lb: 45-54 mph wind becomes No Travel.')
    expect(loadRuleText(40000)).toBe('Over 30,000 lb: 45-54 mph wind becomes No Travel.')
  })

  it('adds the Severe upgrade above 40,000 lb', () => {
    expect(loadRuleText(41000)).toMatch(/35-44 mph is upgraded to Severe/)
  })
})

describe('trailerFillColor', () => {
  it('changes colour only after each boundary', () => {
    expect(trailerFillColor(30000)).toBe('var(--risk-low)')
    expect(trailerFillColor(31000)).toBe('var(--risk-high)')
    expect(trailerFillColor(40000)).toBe('var(--risk-high)')
    expect(trailerFillColor(41000)).toBe('var(--risk-severe)')
  })
})

describe('departure strings', () => {
  it('formats local time with no offset', () => {
    expect(toDepartureString(new Date(2026, 9, 5, 7, 4))).toBe('2026-10-05T07:04')
  })

  it('rounds up to the next whole hour', () => {
    expect(toDepartureString(nextWholeHour(new Date(2026, 9, 5, 13, 0)))).toBe('2026-10-05T14:00')
    expect(toDepartureString(nextWholeHour(new Date(2026, 9, 5, 23, 59)))).toBe('2026-10-06T00:00')
  })

  it('finds tomorrow at 06:00', () => {
    expect(toDepartureString(tomorrowAtSix(new Date(2026, 9, 5, 20, 15)))).toBe('2026-10-06T06:00')
  })
})

describe('wallClockNow', () => {
  const instant = new Date('2026-10-22T13:00:00Z')

  it('reads the clock in the origin timezone, not the viewer timezone', () => {
    expect(toDepartureString(wallClockNow('America/Chicago', instant))).toBe('2026-10-22T08:00')
    expect(toDepartureString(wallClockNow('America/Denver', instant))).toBe('2026-10-22T07:00')
    expect(toDepartureString(wallClockNow('Asia/Karachi', instant))).toBe('2026-10-22T18:00')
  })

  it('rolls the date over for zones on the other side of midnight', () => {
    expect(toDepartureString(wallClockNow('Pacific/Auckland', instant))).toBe('2026-10-23T02:00')
  })
})
