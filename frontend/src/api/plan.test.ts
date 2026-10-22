import { describe, expect, it } from 'vitest'
import type { TripRequest } from '../types'
import { detailPath, parseTrip, placeFromSlug, planPath, routeIdFromSlug, slugify } from './plan'

const trip: TripRequest = {
  origin: 'Dallas, TX, United States',
  destination: 'Denver, CO, United States',
  departure_at: '2026-10-22T08:00',
  load_lbs: 42000,
  interval_miles: 25,
}

describe('place slugs', () => {
  it('keeps the place and region only', () => {
    expect(slugify('Dallas, TX, United States')).toBe('dallas-tx')
    expect(slugify('Fort Worth, TX')).toBe('fort-worth-tx')
    expect(slugify('Montréal, QC, Canada')).toBe('montreal-qc')
  })

  it('turns a slug back into readable geocoder text', () => {
    expect(placeFromSlug('dallas-tx')).toBe('Dallas, TX')
    expect(placeFromSlug('fort-worth-tx')).toBe('Fort Worth, TX')
    expect(placeFromSlug('chicago')).toBe('Chicago')
  })
})

describe('trip urls', () => {
  it('builds clean path-based urls', () => {
    expect(planPath(trip)).toBe(
      '/routes/dallas-tx/denver-co?depart=2026-10-22T08%3A00&load=42000&sample=25',
    )
    expect(detailPath('B', trip)).toBe(
      '/routes/dallas-tx/denver-co/route-b?depart=2026-10-22T08%3A00&load=42000&sample=25',
    )
  })

  it('round-trips a trip through its url', () => {
    const url = new URL(planPath(trip), 'http://x')
    expect(parseTrip('dallas-tx', 'denver-co', url.searchParams)).toEqual({
      ...trip,
      origin: 'Dallas, TX',
      destination: 'Denver, CO',
    })
  })

  it('rejects incomplete or invalid urls', () => {
    const base = new URLSearchParams('depart=2026-10-22T08:00&load=42000&sample=25')
    expect(parseTrip(undefined, 'denver-co', base)).toBeNull()
    expect(parseTrip('dallas-tx', 'denver-co', new URLSearchParams())).toBeNull()
    expect(
      parseTrip('dallas-tx', 'denver-co', new URLSearchParams('depart=x&load=42000&sample=30')),
    ).toBeNull()
    expect(
      parseTrip('dallas-tx', 'denver-co', new URLSearchParams('depart=x&load=0&sample=25')),
    ).toBeNull()
  })

  it('reads a route id from its slug', () => {
    expect(routeIdFromSlug('route-b')).toBe('B')
    expect(routeIdFromSlug('b')).toBeNull()
    expect(routeIdFromSlug(undefined)).toBeNull()
  })
})
