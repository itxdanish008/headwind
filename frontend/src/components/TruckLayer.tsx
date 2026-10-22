import type { Feature, Point } from 'geojson'
import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import {
  TRUCK_LAYER_ID,
  TRUCK_RING_LAYER_ID,
  TRUCK_SOURCE_ID,
  forecastHourToMs,
  truckPosition,
} from '../map/corridor'
import { forecastClock } from '../map/forecastClock'
import { resolveVar } from '../lib/risk'
import type { Route } from '../types'

export interface TruckLayerProps {
  route: Route | null
  firstHourMs: number
}

const truckFeature = ({
  route,
  firstHourMs,
}: {
  route: Route
  firstHourMs: number
}): Feature<Point> => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: truckPosition({
      route,
      atMs: forecastHourToMs({ firstHourMs, hour: forecastClock.get() }),
    }),
  },
})

export default function TruckLayer({ route, firstHourMs }: TruckLayerProps) {
  const { current: mapRef } = useMap()
  const [colors] = useState(() => ({ truck: resolveVar('--time'), stroke: resolveVar('--bg') }))
  const initial = useMemo(
    () => (route ? truckFeature({ route, firstHourMs }) : null),
    [route, firstHourMs],
  )

  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map || !route) return
    let frame = 0

    const render = () => {
      frame = 0
      const source = map.getSource<GeoJSONSource>(TRUCK_SOURCE_ID)
      source?.setData(truckFeature({ route, firstHourMs }))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render)
    }

    schedule()
    const unsubscribe = forecastClock.subscribe(schedule)
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [mapRef, route, firstHourMs])

  if (!initial) return null
  return (
    <Source id={TRUCK_SOURCE_ID} type="geojson" data={initial}>
      <Layer
        id={TRUCK_RING_LAYER_ID}
        type="circle"
        paint={{ 'circle-radius': 16, 'circle-color': colors.truck, 'circle-opacity': 0.18 }}
      />
      <Layer
        id={TRUCK_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': 8,
          'circle-color': colors.truck,
          'circle-stroke-width': 2,
          'circle-stroke-color': colors.stroke,
        }}
      />
    </Source>
  )
}
