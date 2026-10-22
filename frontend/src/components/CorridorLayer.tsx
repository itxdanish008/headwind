import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import type { Corridor } from '../api/corridor'
import {
  CORRIDOR_LAYER_ID,
  CORRIDOR_SOURCE_ID,
  cellsToGeoJSON,
  clampHour,
  heatColorExpression,
} from '../map/corridor'
import { forecastClock } from '../map/forecastClock'
import type { LevelName } from '../types'

export interface CorridorLayerProps {
  corridor: Corridor | null
  visible: boolean
  colors: Record<LevelName, string>
  belowLayerId?: string
}

const FADE_MS = 350

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function CorridorLayer({
  corridor,
  visible,
  colors,
  belowLayerId,
}: CorridorLayerProps) {
  const { current: mapRef } = useMap()
  const hasCorridor = corridor !== null
  const geojson = useMemo(() => (corridor ? cellsToGeoJSON(corridor) : null), [corridor])
  const [mountHour] = useState(() => clampHour(forecastClock.get()))

  // Stable on purpose: a changed paint prop would make react-map-gl re-apply it over the live hour.
  const paint = useMemo(
    () => ({
      'fill-color': heatColorExpression({ hour: mountHour, colors }),
      'fill-antialias': false,
      'fill-color-transition': { duration: prefersReducedMotion() ? 0 : FADE_MS, delay: 0 },
    }),
    [colors, mountHour],
  )

  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map || !hasCorridor) return
    // A new layer is created with the mount-hour paint, so that is what it currently shows.
    let applied = mountHour
    let placed = false

    // Added without beforeId: the route layers may not exist yet when the corridor arrives first.
    const placeBelowRoutes = () => {
      const present = Boolean(map.getLayer(CORRIDOR_LAYER_ID))
      if (!present) placed = false
      if (placed || !present || !belowLayerId || !map.getLayer(belowLayerId)) return
      map.moveLayer(CORRIDOR_LAYER_ID, belowLayerId)
      placed = true
    }

    const apply = () => {
      placeBelowRoutes()
      const hour = clampHour(forecastClock.get())
      if (hour === applied || !map.getLayer(CORRIDOR_LAYER_ID)) return
      map.setPaintProperty(CORRIDOR_LAYER_ID, 'fill-color', heatColorExpression({ hour, colors }))
      applied = hour
    }

    apply()
    map.on('styledata', apply)
    map.on('idle', apply)
    const unsubscribe = forecastClock.subscribe(apply)
    return () => {
      unsubscribe()
      map.off('styledata', apply)
      map.off('idle', apply)
    }
  }, [mapRef, hasCorridor, colors, mountHour, belowLayerId])

  if (!geojson) return null
  return (
    <Source id={CORRIDOR_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={CORRIDOR_LAYER_ID}
        type="fill"
        layout={{ visibility: visible ? 'visible' : 'none' }}
        paint={paint}
      />
    </Source>
  )
}
