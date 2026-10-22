import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export class ApiError extends Error {}

export const API_BASE = '/api/v1'

const UNEXPECTED = 'The server sent an unexpected response. Try again.'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(describeError(body) ?? `Request failed (${response.status}).`)
  }
  try {
    return await response.json()
  } catch {
    throw new ApiError(UNEXPECTED)
  }
}

const FIELD_LABELS: Record<string, string> = {
  origin: 'Origin',
  destination: 'Destination',
  departure_at: 'Departure',
  load_lbs: 'Load',
  interval_miles: 'Sampling interval',
}

export function describeError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.detail === 'string') return record.detail
  const first = Object.entries(record)[0]
  if (!first) return null
  const message = String(Array.isArray(first[1]) ? first[1][0] : first[1])
  const label = FIELD_LABELS[first[0]]
  return label ? `${label}: ${message}` : message
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function useGeocode(query: string, enabled = true) {
  const debounced = useDebounced(query.trim(), 250)
  return useQuery({
    queryKey: ['geocode', debounced],
    queryFn: () =>
      request<{ suggestions: string[] }>(
        `${API_BASE}/geocode?q=${encodeURIComponent(debounced)}`,
      ).then((body) => body.suggestions),
    enabled: enabled && debounced.length >= 2,
    staleTime: 10 * 60 * 1000,
  })
}
