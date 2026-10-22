import type { FeatureCollection, Geometry } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { LayerProps } from 'react-map-gl/maplibre'
import { assignRouteColors, resolveVar } from '../lib/risk'
import type { LevelName, Plan, SelectedCheckpoint } from '../types'

export const SOURCE_IDS = {
  routes: 'routes',
  checkpoints: 'checkpoints',
  selectedCheckpoint: 'selected-checkpoint',
  endpoints: 'endpoints',
} as const

export const LAYER_IDS = {
  casing: 'route-casing',
  line: 'route-line',
  hit: 'route-hit',
  checkpoints: 'checkpoints',
  selectedCheckpoint: 'selected-checkpoint-ring',
  endpoints: 'endpoints',
} as const

export type Bounds = [[number, number], [number, number]]

type Collection<P> = FeatureCollection<Geometry, P>

export function buildRoutesGeoJSON(plan: Plan): Collection<{ routeId: string }> {
  return {
    type: 'FeatureCollection',
    features: plan.routes.map((route) => ({
      type: 'Feature',
      properties: { routeId: route.id },
      geometry: route.geometry,
    })),
  }
}

export function buildCheckpointsGeoJSON(
  plan: Plan,
): Collection<{ routeId: string; index: number; level: LevelName; mile: number }> {
  return {
    type: 'FeatureCollection',
    features: plan.routes.flatMap((route) =>
      route.checkpoints.map((checkpoint, index) => ({
        type: 'Feature' as const,
        properties: { routeId: route.id, index, level: checkpoint.level, mile: checkpoint.mile },
        geometry: { type: 'Point' as const, coordinates: [checkpoint.lon, checkpoint.lat] },
      })),
    ),
  }
}

export function buildSelectedCheckpointGeoJSON(
  plan: Plan | null,
  selection: SelectedCheckpoint | null,
): Collection<Record<string, never>> {
  const checkpoint = selection
    ? plan?.routes.find((route) => route.id === selection.routeId)?.checkpoints[selection.index]
    : undefined
  return {
    type: 'FeatureCollection',
    features: checkpoint
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [checkpoint.lon, checkpoint.lat] },
          },
        ]
      : [],
  }
}

export function buildEndpointsGeoJSON(plan: Plan): Collection<{ kind: 'start' | 'end' }> {
  const point = (kind: 'start' | 'end', place: Plan['origin']) => ({
    type: 'Feature' as const,
    properties: { kind },
    geometry: { type: 'Point' as const, coordinates: [place.lon, place.lat] },
  })
  return {
    type: 'FeatureCollection',
    features: [point('start', plan.origin), point('end', plan.destination)],
  }
}

export function computeBounds(plan: Plan): Bounds | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const route of plan.routes) {
    for (const [lon, lat] of route.geometry.coordinates) {
      minLon = Math.min(minLon, lon)
      maxLon = Math.max(maxLon, lon)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    }
  }
  return minLon === Infinity
    ? null
    : [
        [minLon, minLat],
        [maxLon, maxLat],
      ]
}

const PANEL_WIDTH_BREAKPOINT = 900
const PANEL_OVERLAY_PADDING = 460

export function fitPadding(containerWidth: number, bottom = 80) {
  return {
    top: 80,
    bottom,
    right: 80,
    left: containerWidth > PANEL_WIDTH_BREAKPOINT ? PANEL_OVERLAY_PADDING : 80,
  }
}

export interface MapColors {
  bg: string
  accent: string
  notravelDeep: string
  routes: Record<string, string>
  levels: Record<LevelName, string>
}

export function resolveMapColors(
  routeIds: string[],
  recommendedId: string,
  levels: Record<LevelName, string>,
): MapColors {
  const routeVars = assignRouteColors(routeIds, recommendedId)
  return {
    bg: resolveVar('--bg'),
    accent: resolveVar('--accent'),
    notravelDeep: resolveVar('--risk-notravel-deep'),
    routes: Object.fromEntries(Object.entries(routeVars).map(([id, v]) => [id, resolveVar(v)])),
    levels,
  }
}

export interface RouteStyleState {
  selectedRouteId: string | null
  hoveredRouteId: string | null
  dimmed: boolean
}

const isRoute = (id: string | null): ExpressionSpecification => ['==', ['get', 'routeId'], id ?? '']

function routeCase(
  state: RouteStyleState,
  selected: number,
  hovered: number,
  other: number,
): ExpressionSpecification {
  const factor = state.dimmed ? 0.4 : 1
  return [
    'case',
    isRoute(state.selectedRouteId),
    selected * factor,
    isRoute(state.hoveredRouteId),
    hovered * factor,
    other * factor,
  ]
}

export function routeWidthExpression(state: RouteStyleState): ExpressionSpecification {
  return routeCase({ ...state, dimmed: false }, 6, 4.5, 3)
}

export function routeOpacityExpression(state: RouteStyleState): ExpressionSpecification {
  return routeCase(state, 1, 0.9, 0.45)
}

export function casingWidthExpression(state: RouteStyleState): ExpressionSpecification {
  return ['case', isRoute(state.selectedRouteId), 12, 0]
}

export function routeColorExpression(
  colors: Record<string, string>,
  fallback: string,
): ExpressionSpecification {
  const entries = Object.entries(colors)
  if (entries.length === 0) return ['literal', fallback]
  return [
    'match',
    ['get', 'routeId'],
    ...entries.flat(),
    fallback,
  ] as unknown as ExpressionSpecification
}

export function levelColorExpression(levels: Record<LevelName, string>): ExpressionSpecification {
  return [
    'match',
    ['get', 'level'],
    ...Object.entries(levels).flat(),
    levels.UNKNOWN,
  ] as unknown as ExpressionSpecification
}

const lineLayout = { 'line-cap': 'round', 'line-join': 'round' } as const

export function casingLayer(colors: MapColors, state: RouteStyleState): LayerProps {
  return {
    id: LAYER_IDS.casing,
    type: 'line',
    layout: lineLayout,
    paint: {
      'line-color': colors.bg,
      'line-width': casingWidthExpression(state),
      'line-opacity': state.dimmed ? 0.4 : 1,
    },
  }
}

export function lineLayer(colors: MapColors, state: RouteStyleState): LayerProps {
  return {
    id: LAYER_IDS.line,
    type: 'line',
    layout: lineLayout,
    paint: {
      'line-color': routeColorExpression(colors.routes, colors.accent),
      'line-width': routeWidthExpression(state),
      'line-opacity': routeOpacityExpression(state),
    },
  }
}

export const hitLayer: LayerProps = {
  id: LAYER_IDS.hit,
  type: 'line',
  layout: lineLayout,
  paint: { 'line-width': 18, 'line-opacity': 0 },
}

export function checkpointsLayer(
  colors: MapColors,
  state: RouteStyleState,
  visible = true,
): LayerProps {
  const factor = state.dimmed ? 0.4 : 1
  return {
    id: LAYER_IDS.checkpoints,
    type: 'circle',
    layout: {
      'circle-sort-key': ['case', isRoute(state.selectedRouteId), 1, 0],
      visibility: visible ? 'visible' : 'none',
    },
    paint: {
      'circle-color': levelColorExpression(colors.levels),
      'circle-radius': ['case', isRoute(state.selectedRouteId), 7, 4],
      'circle-opacity': ['case', isRoute(state.selectedRouteId), factor, 0.5 * factor],
      'circle-stroke-color': colors.notravelDeep,
      'circle-stroke-width': ['case', ['==', ['get', 'level'], 'NO_TRAVEL'], 3, 0],
      'circle-stroke-opacity': ['case', isRoute(state.selectedRouteId), factor, 0.5 * factor],
    },
  }
}

export function selectedCheckpointLayer(colors: MapColors, visible = true): LayerProps {
  return {
    id: LAYER_IDS.selectedCheckpoint,
    type: 'circle',
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'circle-radius': 11,
      'circle-color': colors.accent,
      'circle-opacity': 0,
      'circle-stroke-color': colors.accent,
      'circle-stroke-width': 2,
    },
  }
}

export function endpointsLayer(colors: MapColors): LayerProps {
  const isStart: ExpressionSpecification = ['==', ['get', 'kind'], 'start']
  return {
    id: LAYER_IDS.endpoints,
    type: 'circle',
    paint: {
      'circle-radius': 7,
      'circle-color': colors.accent,
      'circle-opacity': ['case', isStart, 0, 1],
      'circle-stroke-color': colors.accent,
      'circle-stroke-width': ['case', isStart, 3, 0],
    },
  }
}
