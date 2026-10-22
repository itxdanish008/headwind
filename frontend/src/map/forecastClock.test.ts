import { afterEach, describe, expect, it, vi } from 'vitest'
import { forecastClock } from './forecastClock'

afterEach(() => forecastClock.set(0))

describe('forecastClock', () => {
  it('notifies subscribers only when the hour changes', () => {
    const listener = vi.fn()
    const unsubscribe = forecastClock.subscribe(listener)
    forecastClock.set(5.5)
    forecastClock.set(5.5)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(5.5)
    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    forecastClock.subscribe(listener)()
    forecastClock.set(3)
    expect(listener).not.toHaveBeenCalled()
  })

  it('returns the current hour', () => {
    forecastClock.set(12)
    expect(forecastClock.get()).toBe(12)
  })
})
