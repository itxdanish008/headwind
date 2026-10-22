import { describe, expect, it } from 'vitest'
import type { Corridor } from '../api/corridor'
import {
  hourLabel,
  hoursFromNow,
  initialHour,
  tickLabel,
  tripWindow,
  worstLevelByHour,
} from './forecast'

const hours = Array.from({ length: 49 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 21, 18 + i))
  return d.toISOString().slice(0, 16) + 'Z'
})
const chicago = 'America/Chicago'
const denver = 'America/Denver'

describe('hourLabel', () => {
  it('uses the origin offset, not the viewer timezone', () => {
    expect(hourLabel({ hours, hour: 0, timeZone: chicago })).toBe('Wed 1:00 PM CDT')
    expect(hourLabel({ hours, hour: 0, timeZone: denver })).toBe('Wed 12:00 PM MDT')
  })
  it('rolls the weekday over a UTC midnight', () => {
    // hour 6 = 2026-10-22T00:00Z = Wed 7 PM CDT; hour 11 = 05:00Z = Thu 12 AM CDT
    expect(hourLabel({ hours, hour: 6, timeZone: chicago })).toBe('Wed 7:00 PM CDT')
    expect(hourLabel({ hours, hour: 11, timeZone: chicago })).toBe('Thu 12:00 AM CDT')
  })
  it('adds the fractional part as minutes', () => {
    expect(hourLabel({ hours, hour: 3.5, timeZone: chicago })).toBe('Wed 4:30 PM CDT')
  })
  it('clamps beyond the last hour', () => {
    expect(hourLabel({ hours, hour: 48.9, timeZone: chicago })).toBe(
      hourLabel({ hours, hour: 48, timeZone: chicago }),
    )
  })
})

describe('hoursFromNow', () => {
  it('rounds and names zero', () => {
    expect(hoursFromNow(0)).toBe('Now')
    expect(hoursFromNow(0.3)).toBe('Now')
    expect(hoursFromNow(12.6)).toBe('+13h')
  })
})

describe('tripWindow', () => {
  const firstHourUtc = hours[0]
  it('returns fractional hours inside the window', () => {
    expect(
      tripWindow({
        departureUtc: '2026-10-21T20:30Z',
        arrivalUtc: '2026-10-22T01:00Z',
        firstHourUtc,
      }),
    ).toEqual({ startHour: 2.5, endHour: 7 })
  })
  it('clips to 0..48', () => {
    expect(
      tripWindow({
        departureUtc: '2026-10-21T10:00Z',
        arrivalUtc: '2026-10-25T00:00Z',
        firstHourUtc,
      }),
    ).toEqual({ startHour: 0, endHour: 48 })
  })
  it('is null when the trip lies outside the window', () => {
    expect(
      tripWindow({
        departureUtc: '2026-10-20T00:00Z',
        arrivalUtc: '2026-10-21T10:00Z',
        firstHourUtc,
      }),
    ).toBeNull()
    expect(
      tripWindow({
        departureUtc: '2026-10-24T00:00Z',
        arrivalUtc: '2026-10-24T10:00Z',
        firstHourUtc,
      }),
    ).toBeNull()
  })
})

describe('initialHour', () => {
  it('floors the departure hour when inside the window', () => {
    expect(initialHour({ departureUtc: '2026-10-22T13:40Z', hours })).toEqual({
      hour: 19,
      note: null,
    })
  })
  it('falls back to 0 with a note outside the window', () => {
    const late = initialHour({ departureUtc: '2026-11-05T00:00Z', hours })
    expect(late.hour).toBe(0)
    expect(late.note).toMatch(/beyond the 48-hour/)
    expect(initialHour({ departureUtc: '2026-10-01T00:00Z', hours }).hour).toBe(0)
  })
})

describe('worstLevelByHour', () => {
  it('takes the max per hour and ignores unknown unless all are unknown', () => {
    const levels = new Array(2 * 49).fill(0)
    levels[0] = 2 // cell 0, hour 0
    levels[49] = 5 // cell 1, hour 0
    levels[1] = 5 // cell 0, hour 1
    levels[49 + 1] = 5 // cell 1, hour 1: all unknown
    levels[49 + 2] = 3 // cell 1, hour 2
    const corridor: Corridor = {
      hours,
      cells: [
        [0, 0],
        [1, 1],
      ],
      step: 1,
      levels,
    }
    const worst = worstLevelByHour(corridor)
    expect(worst).toHaveLength(49)
    expect(worst[0]).toBe(2)
    expect(worst[1]).toBe(5)
    expect(worst[2]).toBe(3)
    expect(worst[3]).toBe(0)
  })
})

describe('tickLabel', () => {
  it('names the weekday so the three ticks differ', () => {
    expect(tickLabel({ hours, hour: 0, timeZone: chicago })).toBe('Wed 1 PM')
    expect(tickLabel({ hours, hour: 24, timeZone: chicago })).toBe('Thu 1 PM')
  })
})

describe('daylight saving', () => {
  const dstHours = Array.from(
    { length: 49 },
    (_, i) => new Date(Date.UTC(2026, 10, 1, 4 + i)).toISOString().slice(0, 16) + 'Z',
  )

  it('switches abbreviation and offset when the clocks change', () => {
    expect(hourLabel({ hours: dstHours, hour: 2, timeZone: chicago })).toBe('Sun 1:00 AM CDT')
    expect(hourLabel({ hours: dstHours, hour: 3, timeZone: chicago })).toBe('Sun 1:00 AM CST')
    expect(hourLabel({ hours: dstHours, hour: 4, timeZone: chicago })).toBe('Sun 2:00 AM CST')
  })
})
