import { useQuery } from '@tanstack/react-query'
import type { Place } from '../types'
import { API_BASE, request, useDebounced } from './client'

const MIN_CHARS = 3
const SETTLE_MS = 800

// The origin's timezone decides what "now" means for a departure, wherever the browser is.
export function usePlace(text: string) {
  const settled = useDebounced(text.trim(), SETTLE_MS)
  return useQuery({
    queryKey: ['place', settled],
    queryFn: () => request<Place>(`${API_BASE}/place?q=${encodeURIComponent(settled)}`),
    enabled: settled.length >= MIN_CHARS,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}
