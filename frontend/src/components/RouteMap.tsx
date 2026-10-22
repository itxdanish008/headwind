import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layer,
  Map,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import {
  LAYER_IDS,
  SOURCE_IDS,
  buildCheckpointsGeoJSON,
  buildEndpointsGeoJSON,
  buildRoutesGeoJSON,
  buildSelectedCheckpointGeoJSON,
  casingLayer,
  checkpointsLayer,
  computeBounds,
  endpointsLayer,
  fitPadding,
  hitLayer,
  lineLayer,
  resolveMapColors,
  selectedCheckpointLayer,
  type MapColors,
  type RouteStyleState,
} from '../map/layers'
import type { Map as MaplibreMap } from 'maplibre-gl'
import type { Corridor } from '../api/corridor'
import { resolvedLevelColors } from '../lib/risk'
import { useTheme, type Theme } from '../theme/context'
import CorridorLayer from './CorridorLayer'
import TruckLayer from './TruckLayer'
import type { Plan, SelectedCheckpoint } from '../types'
import './RouteMap.css'

export interface RouteMapProps {
  plan: Plan | null
  corridor?: Corridor | null
  showHeatmap?: boolean
  pending: boolean
  selectedRouteId: string | null
  hoveredRouteId: string | null
  selectedCheckpoint: SelectedCheckpoint | null
  showCheckpoints?: boolean
  bottomPadding?: number
  selectionBottomInset?: number
  onSelectRoute: (id: string) => void
  onSelectCheckpoint: (selection: SelectedCheckpoint | null) => void
}

const BLANK_PIXEL = { width: 1, height: 1, data: new Uint8Array(4) }

// The OpenFreeMap style references icons its sprite lacks; a blank one stops the warning.
function blankImageResolver(map: MaplibreMap) {
  return async (id: string) => {
    if (!map.hasImage(id)) map.addImage(id, BLANK_PIXEL)
  }
}

const MAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
}
const INITIAL_VIEW = { longitude: -98, latitude: 39, zoom: 3.6 }
const TOP_CLEARANCE = 100
const INTERACTIVE_LAYER_IDS = [LAYER_IDS.checkpoints, LAYER_IDS.hit]

interface RouteLayersProps {
  plan: Plan
  colors: MapColors
  style: RouteStyleState
  selectedCheckpoint: SelectedCheckpoint | null
  showCheckpoints: boolean
}

const RouteLayers = memo(function RouteLayers({
  plan,
  colors,
  style,
  selectedCheckpoint,
  showCheckpoints,
}: RouteLayersProps) {
  const routes = useMemo(() => buildRoutesGeoJSON(plan), [plan])
  const checkpoints = useMemo(() => buildCheckpointsGeoJSON(plan), [plan])
  const endpoints = useMemo(() => buildEndpointsGeoJSON(plan), [plan])
  const selected = useMemo(
    () => buildSelectedCheckpointGeoJSON(plan, selectedCheckpoint),
    [plan, selectedCheckpoint],
  )

  return (
    <>
      <Source id={SOURCE_IDS.routes} type="geojson" data={routes}>
        <Layer {...casingLayer(colors, style)} />
        <Layer {...lineLayer(colors, style)} />
        <Layer {...hitLayer} />
      </Source>
      <Source id={SOURCE_IDS.checkpoints} type="geojson" data={checkpoints}>
        <Layer {...checkpointsLayer(colors, style, showCheckpoints)} />
      </Source>
      <Source id={SOURCE_IDS.selectedCheckpoint} type="geojson" data={selected}>
        <Layer {...selectedCheckpointLayer(colors, showCheckpoints)} />
      </Source>
      <Source id={SOURCE_IDS.endpoints} type="geojson" data={endpoints}>
        <Layer {...endpointsLayer(colors)} />
      </Source>
    </>
  )
})

function RouteMapView({
  plan,
  corridor = null,
  showHeatmap = true,
  pending,
  selectedRouteId,
  hoveredRouteId,
  selectedCheckpoint,
  showCheckpoints = true,
  bottomPadding,
  selectionBottomInset = 0,
  onSelectRoute,
  onSelectCheckpoint,
  theme,
}: RouteMapProps & { theme: Theme }) {
  const mapRef = useRef<MapRef | null>(null)
  const attachMap = useCallback((instance: MapRef | null) => {
    mapRef.current = instance
    if (instance)
      instance.getMap().setMissingStyleImageResolver(blankImageResolver(instance.getMap()))
  }, [])
  const [cursor, setCursor] = useState('')
  const [levelColors] = useState(resolvedLevelColors)

  const colors = useMemo(
    () =>
      resolveMapColors(
        plan?.routes.map((route) => route.id) ?? [],
        plan?.recommended_route_id ?? '',
        levelColors,
      ),
    [plan, levelColors],
  )

  const activeRoute = plan?.routes.find((route) => route.id === selectedRouteId) ?? null

  const style = useMemo<RouteStyleState>(
    () => ({ selectedRouteId, hoveredRouteId, dimmed: pending }),
    [selectedRouteId, hoveredRouteId, pending],
  )

  const fitPlan = useCallback(
    (target: Plan) => {
      const map = mapRef.current
      const bounds = computeBounds(target)
      if (!map || !bounds) return
      map.fitBounds(bounds, {
        padding: fitPadding(map.getContainer().clientWidth, bottomPadding),
        duration: 900,
      })
    },
    [bottomPadding],
  )

  useEffect(() => {
    if (plan) fitPlan(plan)
  }, [plan, fitPlan])

  useEffect(() => {
    const map = mapRef.current
    const checkpoint = selectedCheckpoint
      ? plan?.routes.find((r) => r.id === selectedCheckpoint.routeId)?.checkpoints[
          selectedCheckpoint.index
        ]
      : undefined
    if (!map || !checkpoint || selectionBottomInset === 0) return
    const { x, y } = map.project([checkpoint.lon, checkpoint.lat])
    const { clientWidth, clientHeight } = map.getContainer()
    const visibleBottom = clientHeight - selectionBottomInset
    const clear = x > 24 && x < clientWidth - 24 && y > TOP_CLEARANCE && y < visibleBottom - 24
    if (clear) return
    map.easeTo({
      center: [checkpoint.lon, checkpoint.lat],
      offset: [0, -selectionBottomInset / 2 + TOP_CLEARANCE / 2],
      duration: 500,
    })
  }, [selectedCheckpoint, plan, selectionBottomInset])

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature =
        event.features?.find((f) => f.properties.routeId === selectedRouteId) ?? event.features?.[0]
      if (!feature) {
        onSelectCheckpoint(null)
        return
      }
      const { routeId, index } = feature.properties as { routeId: string; index?: number }
      onSelectRoute(routeId)
      if (feature.layer.id === LAYER_IDS.checkpoints) {
        onSelectCheckpoint({ routeId, index: index as number })
      }
    },
    [selectedRouteId, onSelectRoute, onSelectCheckpoint],
  )

  const showPointer = useCallback(() => setCursor('pointer'), [])
  const clearPointer = useCallback(() => setCursor(''), [])

  return (
    <div className="route-map">
      {plan && (
        <Map
          ref={attachMap}
          initialViewState={INITIAL_VIEW}
          mapStyle={MAP_STYLES[theme]}
          cooperativeGestures={false}
          interactiveLayerIds={INTERACTIVE_LAYER_IDS}
          cursor={cursor}
          onClick={handleClick}
          onMouseEnter={showPointer}
          onMouseLeave={clearPointer}
          onLoad={() => {
            fitPlan(plan)
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />
          <RouteLayers
            plan={plan}
            colors={colors}
            style={style}
            selectedCheckpoint={selectedCheckpoint}
            showCheckpoints={showCheckpoints}
          />
          <CorridorLayer
            corridor={corridor}
            visible={showHeatmap}
            colors={levelColors}
            belowLayerId={LAYER_IDS.casing}
          />
          {corridor && activeRoute && (
            <TruckLayer route={activeRoute} firstHourMs={Date.parse(corridor.hours[0])} />
          )}
        </Map>
      )}
      {pending && (
        <div className="route-map__chip" role="status">
          <span className="route-map__spinner" />
          Sampling weather along 3 routes...
        </div>
      )}
      {!plan && !pending && (
        <div className="route-map__hint">Enter a trip to see routes and weather checkpoints</div>
      )}
    </div>
  )
}

export default function RouteMap(props: RouteMapProps) {
  const { theme } = useTheme()
  return <RouteMapView key={theme} theme={theme} {...props} />
}
