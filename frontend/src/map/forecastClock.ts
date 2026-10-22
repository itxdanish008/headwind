import { useSyncExternalStore } from 'react'

// The forecast hour (0 to 48, fractional) lives outside React so dragging the slider never
// re-renders the map. Map layers subscribe and update paint properties directly.
let hour = 0
const listeners = new Set<(hour: number) => void>()

export const forecastClock = {
  get: () => hour,
  set(next: number) {
    if (next === hour) return
    hour = next
    listeners.forEach((listener) => listener(hour))
  },
  subscribe(listener: (hour: number) => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export const useForecastHour = () =>
  useSyncExternalStore(forecastClock.subscribe, forecastClock.get)
