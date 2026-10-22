import { describe, expect, it } from 'vitest'
import { LEVEL_LABEL, LEVEL_VAR, LEVELS, assignRouteColors, levelColor } from './risk'

describe('risk helpers', () => {
  it('has a label and a token for every level', () => {
    for (const level of LEVELS) {
      expect(LEVEL_LABEL[level]).toBeTruthy()
      expect(LEVEL_VAR[level]).toMatch(/^--risk-/)
    }
  })

  it('maps levels to css variables, never to raw colours', () => {
    expect(levelColor('NO_TRAVEL')).toBe('var(--risk-notravel)')
    expect(levelColor('LOW')).toBe('var(--risk-low)')
  })

  it('gives the recommended route the accent whatever its letter', () => {
    expect(assignRouteColors(['A', 'B', 'C'], 'B')).toEqual({
      A: '--route-a',
      B: '--accent',
      C: '--route-b',
    })
    expect(assignRouteColors(['A', 'B', 'C'], 'C')).toEqual({
      A: '--route-a',
      B: '--route-b',
      C: '--accent',
    })
  })
})
