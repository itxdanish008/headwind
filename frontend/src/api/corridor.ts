import { useQuery } from '@tanstack/react-query'
import type { Plan } from '../types'
import { API_BASE, ApiError, request } from './client'

export const CORRIDOR_HOURS = 49
export const UNKNOWN_CELL_LEVEL = 5

export interface Corridor {
  hours: string[]
  cells: [number, number][]
  step: number
  levels: number[]
}

function assertCorridor(body: Corridor): Corridor {
  const usable =
    Array.isArray(body?.hours) &&
    body.hours.length === CORRIDOR_HOURS &&
    Array.isArray(body.cells) &&
    Array.isArray(body.levels) &&
    body.levels.length === body.cells.length * CORRIDOR_HOURS
  if (!usable) throw new ApiError('The server sent an unexpected heatmap response.')
  return body
}

// One request per trip and load: the geometry does not change with the sampling interval.
export function useCorridor(plan: Plan | null, loadLbs: number) {
  return useQuery({
    queryKey: ['corridor', plan?.origin.label, plan?.destination.label, loadLbs],
    queryFn: async () =>
      assertCorridor(
        await request<Corridor>(`${API_BASE}/corridor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routes: plan?.routes.map((route) => route.geometry.coordinates),
            load_lbs: loadLbs,
          }),
        }),
      ),
    enabled: plan !== null,
    staleTime: 30 * 60 * 1000,
  })
}
