import { describe, expect, it } from 'vitest'
import {
  formatAvgRisk,
  formatDuration,
  formatDurationShort,
  formatLb,
  formatLocalDay,
  formatLocalTime,
  formatMiles,
  formatRate,
  pad2,
  shortPlaceName,
} from './format'

describe('format', () => {
  it('formats durations as hours and zero-padded minutes', () => {
    expect(formatDuration(44543)).toBe('12 h 22 min')
    expect(formatDuration(3660)).toBe('1 h 01 min')
    expect(formatDuration(59)).toBe('0 h 01 min')
  })

  it('formats a compact duration for tight tables', () => {
    expect(formatDurationShort(44543)).toBe('12h 22m')
    expect(formatDurationShort(3660)).toBe('1h 01m')
  })

  it('formats miles and pounds with grouping', () => {
    expect(formatMiles(797.8)).toBe('797.8 mi')
    expect(formatMiles(1204)).toBe('1,204 mi')
    expect(formatLb(42000)).toBe('42,000 lb')
  })

  it('reads the local clock from the ISO string, not the viewer timezone', () => {
    expect(formatLocalTime({ eta_local: '2026-10-22T08:00-05:00', tz: 'CDT' })).toBe('8:00 AM CDT')
    expect(formatLocalTime({ eta_local: '2026-10-22T19:23-06:00', tz: 'MDT' })).toBe('7:23 PM MDT')
    expect(formatLocalTime({ eta_local: '2026-10-22T00:05-06:00', tz: 'MDT' })).toBe('12:05 AM MDT')
    expect(formatLocalTime({ eta_local: '2026-10-22T12:00-06:00', tz: 'MDT' })).toBe('12:00 PM MDT')
  })

  it('formats the local day', () => {
    expect(formatLocalDay('2026-10-22T08:00-05:00')).toBe('Thu, Oct 22')
  })

  it('shows a dash for missing values', () => {
    expect(formatRate(null, 'mph')).toBe('-')
    expect(formatRate(27.6, 'mph')).toBe('27.6 mph')
    expect(formatAvgRisk(null)).toBe('-')
    expect(formatAvgRisk(0.034)).toBe('0.03')
  })
})

describe('shortPlaceName', () => {
  it('keeps the part before the first comma', () => {
    expect(shortPlaceName('Salt Lake City, UT, USA')).toBe('Salt Lake City')
    expect(shortPlaceName('Denver')).toBe('Denver')
  })
})

describe('pad2', () => {
  it('pads to two digits', () => {
    expect(pad2(4)).toBe('04')
    expect(pad2(12)).toBe('12')
  })
})
