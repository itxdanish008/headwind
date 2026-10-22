import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import type { Plan, TripRequest } from '../types'
import { MAX_CARGO_LB, MIN_CARGO_LB } from '../lib/trip'
import { API_BASE, ApiError, request } from './client'

const INTERVALS = [10, 25, 50] as const

export function slugify(label: string): string {
  return label
    .split(',')
    .slice(0, 2)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function placeFromSlug(slug: string): string {
  const words = slug.split('-').filter(Boolean)
  const last = words.at(-1)
  const hasRegion = words.length > 1 && last?.length === 2
  const name = (hasRegion ? words.slice(0, -1) : words)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return hasRegion ? `${name}, ${last.toUpperCase()}` : name
}

export const routeSlug = (routeId: string) => `route-${routeId.toLowerCase()}`

export function routeIdFromSlug(slug: string | undefined): string | null {
  const match = /^route-([a-z])$/.exec(slug ?? '')
  return match ? match[1].toUpperCase() : null
}

function tripQuery(trip: TripRequest): string {
  return new URLSearchParams({
    depart: trip.departure_at,
    load: String(trip.load_lbs),
    sample: String(trip.interval_miles),
  }).toString()
}

const tripBase = (trip: TripRequest) =>
  `/routes/${slugify(trip.origin)}/${slugify(trip.destination)}`

export const planPath = (trip: TripRequest) => `${tripBase(trip)}?${tripQuery(trip)}`

export const detailPath = (routeId: string, trip: TripRequest) =>
  `${tripBase(trip)}/${routeSlug(routeId)}?${tripQuery(trip)}`

const DEPARTURE_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function parseTrip(
  from: string | undefined,
  to: string | undefined,
  search: URLSearchParams,
): TripRequest | null {
  const departure = search.get('depart')
  const load = Number(search.get('load'))
  const sample = Number(search.get('sample'))
  const interval = INTERVALS.find((value) => value === sample)
  const validDeparture =
    departure !== null && DEPARTURE_FORMAT.test(departure) && !Number.isNaN(Date.parse(departure))
  const validLoad = Number.isInteger(load) && load >= MIN_CARGO_LB && load <= MAX_CARGO_LB
  if (!from || !to || !validDeparture || !validLoad || !interval) return null
  return {
    origin: placeFromSlug(from),
    destination: placeFromSlug(to),
    departure_at: departure,
    load_lbs: load,
    interval_miles: interval,
  }
}

export function useTripFromUrl(): TripRequest | null {
  const { from, to } = useParams()
  const [search] = useSearchParams()
  return parseTrip(from, to, search)
}

function assertPlan(body: Plan): Plan {
  const usable =
    Array.isArray(body?.routes) &&
    body.routes.length > 0 &&
    body.routes.every((route) => Array.isArray(route?.checkpoints) && route.geometry) &&
    body.routes.some((route) => route.id === body.recommended_route_id)
  if (!usable) throw new ApiError('The server sent an unexpected response. Try again.')
  return body
}

export function usePlan(trip: TripRequest | null) {
  return useQuery({
    queryKey: ['plan', trip],
    queryFn: async () =>
      assertPlan(
        await request<Plan>(`${API_BASE}/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trip),
        }),
      ),
    enabled: trip !== null,
    staleTime: 30 * 60 * 1000,
  })
}
