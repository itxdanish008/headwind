import { describe, expect, it } from 'vitest'
import type { Checkpoint, Plan, Route } from '../types'
import {
  buildCheckpointsGeoJSON,
  buildEndpointsGeoJSON,
  buildRoutesGeoJSON,
  buildSelectedCheckpointGeoJSON,
  computeBounds,
  fitPadding,
  levelColorExpression,
  routeColorExpression,
  routeOpacityExpression,
  routeWidthExpression,
} from './layers'

const checkpoint = (mile: number, lon: number, lat: number, level: Checkpoint['level']) =>
  ({ mile, lon, lat, level }) as Checkpoint

const route = (id: string, coordinates: number[][], checkpoints: Checkpoint[]) =>
  ({ id, geometry: { type: 'LineString', coordinates }, checkpoints }) as Route

const plan = {
  origin: { label: 'A', lat: 40, lon: -100 },
  destination: { label: 'B', lat: 35, lon: -90 },
  recommended_route_id: 'r1',
  routes: [
    route(
      'r1',
      [
        [-100, 40],
        [-95, 38],
        [-90, 35],
      ],
      [checkpoint(0, -100, 40, 'LOW'), checkpoint(50, -95, 38, 'NO_TRAVEL')],
    ),
    route(
      'r2',
      [
        [-101, 41],
        [-90, 34],
      ],
      [checkpoint(0, -101, 41, 'HIGH')],
    ),
  ],
} as unknown as Plan

describe('geojson builders', () => {
  it('builds one route feature per route', () => {
    const routes = buildRoutesGeoJSON(plan)
    expect(routes.features.map((f) => f.properties)).toEqual([{ routeId: 'r1' }, { routeId: 'r2' }])
  })

  it('flattens checkpoints of all routes with their index', () => {
    const { features } = buildCheckpointsGeoJSON(plan)
    expect(features).toHaveLength(3)
    expect(features[1].properties).toEqual({
      routeId: 'r1',
      index: 1,
      level: 'NO_TRAVEL',
      mile: 50,
    })
    expect(features[2].properties.routeId).toBe('r2')
  })

  it('builds start and end points', () => {
    const { features } = buildEndpointsGeoJSON(plan)
    expect(features.map((f) => f.properties.kind)).toEqual(['start', 'end'])
  })

  it('selected checkpoint source is empty without a valid selection', () => {
    expect(buildSelectedCheckpointGeoJSON(plan, null).features).toHaveLength(0)
    expect(buildSelectedCheckpointGeoJSON(plan, { routeId: 'x', index: 0 }).features).toHaveLength(
      0,
    )
    const selected = buildSelectedCheckpointGeoJSON(plan, { routeId: 'r1', index: 1 })
    expect(selected.features[0].geometry).toEqual({ type: 'Point', coordinates: [-95, 38] })
  })
})

describe('bounds and padding', () => {
  it('spans the union of all route geometries', () => {
    expect(computeBounds(plan)).toEqual([
      [-101, 34],
      [-90, 41],
    ])
  })

  it('returns null without geometry', () => {
    expect(computeBounds({ ...plan, routes: [] })).toBeNull()
  })

  it('leaves room for the side panel on wide containers only', () => {
    expect(fitPadding(1200).left).toBe(460)
    expect(fitPadding(600).left).toBe(80)
  })
})

describe('paint expressions', () => {
  const state = { selectedRouteId: 'r1', hoveredRouteId: 'r2', dimmed: false }

  it('orders selected, hovered, other', () => {
    expect(routeWidthExpression(state)).toEqual([
      'case',
      ['==', ['get', 'routeId'], 'r1'],
      6,
      ['==', ['get', 'routeId'], 'r2'],
      4.5,
      3,
    ])
  })

  it('scales opacity while pending', () => {
    const expr = routeOpacityExpression({ ...state, dimmed: true }) as unknown[]
    expect(expr[2]).toBeCloseTo(0.4)
    expect(expr[5]).toBeCloseTo(0.18)
  })

  it('matches colours by route and level', () => {
    expect(routeColorExpression({ r1: 'a', r2: 'b' }, 'z')).toEqual([
      'match',
      ['get', 'routeId'],
      'r1',
      'a',
      'r2',
      'b',
      'z',
    ])
    const levels = { LOW: 'g', UNKNOWN: 'u' } as Parameters<typeof levelColorExpression>[0]
    expect(levelColorExpression(levels)).toEqual([
      'match',
      ['get', 'level'],
      'LOW',
      'g',
      'UNKNOWN',
      'u',
      'u',
    ])
  })
})
