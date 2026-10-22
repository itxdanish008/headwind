import { describe, expect, it } from 'vitest'
import {
  addDays,
  angleToHour,
  angleToMinute,
  clampToWindow,
  floorToMinute,
  from24Hour,
  hourToAngle,
  isSameDay,
  minuteToAngle,
  monthGrid,
  parseDeparture,
  pointAngle,
  polarToCartesian,
  stepCycle,
  to24Hour,
  windowBounds,
  withTime,
} from './clock'

describe('pointAngle', () => {
  it('measures clockwise from 12 o clock in all four quadrants', () => {
    expect(pointAngle(0, -10)).toBe(0)
    expect(pointAngle(10, 0)).toBe(90)
    expect(pointAngle(0, 10)).toBe(180)
    expect(pointAngle(-10, 0)).toBe(270)
    expect(pointAngle(10, -10)).toBeCloseTo(45)
    expect(pointAngle(10, 10)).toBeCloseTo(135)
    expect(pointAngle(-10, 10)).toBeCloseTo(225)
    expect(pointAngle(-10, -10)).toBeCloseTo(315)
  })

  it('stays inside 0..360', () => {
    expect(pointAngle(-0.001, -10)).toBeLessThan(360)
    expect(pointAngle(-0.001, -10)).toBeGreaterThan(359)
  })
})

describe('angle to value', () => {
  it('maps hours at the quadrant points', () => {
    expect(angleToHour(0)).toBe(12)
    expect(angleToHour(90)).toBe(3)
    expect(angleToHour(180)).toBe(6)
    expect(angleToHour(270)).toBe(9)
  })

  it('snaps to the nearest hour', () => {
    expect(angleToHour(14)).toBe(12)
    expect(angleToHour(16)).toBe(1)
    expect(angleToHour(120)).toBe(4)
  })

  it('maps minutes at the quadrant points', () => {
    expect(angleToMinute(0)).toBe(0)
    expect(angleToMinute(90)).toBe(15)
    expect(angleToMinute(180)).toBe(30)
    expect(angleToMinute(270)).toBe(45)
  })

  it('snaps to any minute, not only multiples of five', () => {
    expect(angleToMinute(42)).toBe(7)
    expect(angleToMinute(44.9)).toBe(7)
    expect(angleToMinute(46)).toBe(8)
  })

  it('wraps just before 12 o clock to hour 12 and minute 0', () => {
    expect(angleToHour(359.9)).toBe(12)
    expect(angleToMinute(359.9)).toBe(0)
  })
})

describe('value to angle', () => {
  it('round trips every hour and minute', () => {
    for (let hour = 1; hour <= 12; hour++) expect(angleToHour(hourToAngle(hour))).toBe(hour)
    for (let minute = 0; minute < 60; minute++) {
      expect(angleToMinute(minuteToAngle(minute))).toBe(minute)
    }
  })

  it('puts 12 at the top', () => {
    expect(hourToAngle(12)).toBe(0)
    expect(hourToAngle(3)).toBe(90)
    expect(minuteToAngle(30)).toBe(180)
  })
})

describe('polarToCartesian', () => {
  it('places angles around the centre with y growing downward', () => {
    const top = polarToCartesian(100, 100, 50, 0)
    expect(top.x).toBeCloseTo(100)
    expect(top.y).toBeCloseTo(50)
    const right = polarToCartesian(100, 100, 50, 90)
    expect(right.x).toBeCloseTo(150)
    expect(right.y).toBeCloseTo(100)
    const bottom = polarToCartesian(100, 100, 50, 180)
    expect(bottom.y).toBeCloseTo(150)
    const left = polarToCartesian(100, 100, 50, 270)
    expect(left.x).toBeCloseTo(50)
  })
})

describe('stepCycle', () => {
  it('wraps hours between 12 and 1', () => {
    expect(stepCycle(12, 1, 1, 12)).toBe(1)
    expect(stepCycle(1, -1, 1, 12)).toBe(12)
    expect(stepCycle(11, 3, 1, 12)).toBe(2)
  })

  it('wraps minutes', () => {
    expect(stepCycle(59, 1, 0, 60)).toBe(0)
    expect(stepCycle(2, -5, 0, 60)).toBe(57)
    expect(stepCycle(50, 15, 0, 60)).toBe(5)
  })
})

describe('12 hour conversion', () => {
  it('handles midnight and noon', () => {
    expect(to24Hour({ hour: 12, minute: 0, meridiem: 'AM' })).toBe(0)
    expect(to24Hour({ hour: 12, minute: 0, meridiem: 'PM' })).toBe(12)
    expect(to24Hour({ hour: 1, minute: 0, meridiem: 'AM' })).toBe(1)
    expect(to24Hour({ hour: 11, minute: 59, meridiem: 'PM' })).toBe(23)
  })

  it('reads a date back into parts', () => {
    expect(from24Hour(new Date(2026, 9, 21, 0, 5))).toEqual({
      hour: 12,
      minute: 5,
      meridiem: 'AM',
    })
    expect(from24Hour(new Date(2026, 9, 21, 12, 0))).toEqual({
      hour: 12,
      minute: 0,
      meridiem: 'PM',
    })
    expect(from24Hour(new Date(2026, 9, 21, 16, 7))).toEqual({
      hour: 4,
      minute: 7,
      meridiem: 'PM',
    })
  })

  it('round trips all 1440 minutes of a day', () => {
    for (let minutes = 0; minutes < 1440; minutes++) {
      const date = new Date(2026, 0, 15, Math.floor(minutes / 60), minutes % 60)
      const rebuilt = withTime(date, from24Hour(date))
      expect(rebuilt.getTime()).toBe(date.getTime())
    }
  })
})

describe('parseDeparture', () => {
  it('parses the local departure format', () => {
    const date = parseDeparture('2026-10-23T08:05')
    expect(date).toEqual(new Date(2026, 9, 23, 8, 5))
  })

  it('rejects malformed input', () => {
    expect(parseDeparture('')).toBeNull()
    expect(parseDeparture('2026-10-23')).toBeNull()
    expect(parseDeparture('2026-10-23T08:05:00Z')).toBeNull()
  })
})

describe('clampToWindow', () => {
  const now = new Date(2026, 9, 21, 23, 3, 41)
  const earliest = new Date(2026, 9, 21, 23, 3)
  const latest = new Date(2026, 10, 4, 23, 3)

  it('accepts exactly now and exactly the end of the window', () => {
    expect(clampToWindow(earliest, { now, windowDays: 14 })).toEqual({
      value: earliest,
      status: 'ok',
    })
    expect(clampToWindow(latest, { now, windowDays: 14 })).toEqual({ value: latest, status: 'ok' })
  })

  it('rejects one minute outside either end', () => {
    const before = new Date(2026, 9, 21, 23, 2)
    const after = new Date(2026, 10, 4, 23, 4)
    expect(clampToWindow(before, { now, windowDays: 14 })).toEqual({
      value: earliest,
      status: 'too-early',
    })
    expect(clampToWindow(after, { now, windowDays: 14 })).toEqual({
      value: latest,
      status: 'too-late',
    })
  })

  it('keeps wall-clock time across the DST change inside the window', () => {
    const bounds = windowBounds({ now, windowDays: 14 })
    expect(bounds.latest.getHours()).toBe(23)
    expect(bounds.latest.getMinutes()).toBe(3)
  })
})

describe('day helpers', () => {
  it('compares calendar days regardless of time', () => {
    expect(isSameDay(new Date(2026, 9, 21, 0, 0), new Date(2026, 9, 21, 23, 59))).toBe(true)
    expect(isSameDay(new Date(2026, 9, 21, 23, 59), new Date(2026, 9, 22, 0, 0))).toBe(false)
    expect(isSameDay(new Date(2026, 9, 21), new Date(2025, 9, 21))).toBe(false)
  })

  it('adds days by calendar, including across DST and month ends', () => {
    expect(addDays(new Date(2026, 9, 31), 1)).toEqual(new Date(2026, 10, 1))
    expect(addDays(new Date(2026, 10, 1), -1)).toEqual(new Date(2026, 9, 31))
    expect(addDays(new Date(2026, 10, 1, 15), 0).getHours()).toBe(0)
  })

  it('floors to the minute', () => {
    expect(floorToMinute(new Date(2026, 9, 21, 8, 5, 59, 999))).toEqual(new Date(2026, 9, 21, 8, 5))
  })
})

describe('monthGrid', () => {
  it('is six Sunday-first weeks of seven days', () => {
    const grid = monthGrid(2026, 9)
    expect(grid).toHaveLength(6)
    for (const week of grid) {
      expect(week).toHaveLength(7)
      expect(week[0].getDay()).toBe(0)
    }
  })

  it('places the 1st under its weekday for months starting on every weekday', () => {
    const startDays = new Set<number>()
    for (let month = 0; month < 12; month++) {
      const first = new Date(2026, month, 1)
      startDays.add(first.getDay())
      const grid = monthGrid(2026, month)
      expect(isSameDay(grid[0][first.getDay()], first)).toBe(true)
    }
    expect(startDays.size).toBe(7)
  })

  it('steps one calendar day at a time with no repeats or gaps across DST', () => {
    for (const month of [2, 9, 10]) {
      const days = monthGrid(2026, month).flat()
      days.forEach((day, i) => {
        if (i > 0) expect(isSameDay(day, addDays(days[i - 1], 1))).toBe(true)
        expect(day.getHours()).toBe(0)
      })
    }
  })

  it('includes February 29 only in a leap year', () => {
    const inMonth = (year: number) =>
      monthGrid(year, 1)
        .flat()
        .filter((day) => day.getMonth() === 1)
    expect(inMonth(2028)).toHaveLength(29)
    expect(inMonth(2026)).toHaveLength(28)
  })
})
