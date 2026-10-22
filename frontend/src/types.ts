export type LevelName = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'NO_TRAVEL' | 'UNKNOWN'
export type Driver = 'wind' | 'rain' | 'snow'

export interface TripRequest {
  origin: string
  destination: string
  departure_at: string
  load_lbs: number
  interval_miles: 10 | 25 | 50
}

export interface Checkpoint {
  mile: number
  lat: number
  lon: number
  eta_utc: string
  eta_local: string
  tz: string
  covered_miles: number
  wind_mph: number | null
  gust_mph: number | null
  rain_in_hr: number | null
  snow_in_hr: number | null
  level: LevelName
  driver: Driver | null
}

export interface RouteSummary {
  miles_by_level: Record<Exclude<LevelName, 'UNKNOWN'>, number>
  avg_risk: number | null
  unknown_miles: number
}

export interface Route {
  id: string
  geometry: GeoJSON.LineString
  distance_mi: number
  duration_s: number
  forced: boolean
  checkpoints: Checkpoint[]
  summary: RouteSummary
}

export interface Place {
  label: string
  lat: number
  lon: number
  timezone: string
}

export interface Plan {
  origin: Place
  destination: Place
  departure_utc: string
  routes: Route[]
  recommended_route_id: string
  reason: string
  warnings: string[]
}

export interface SelectedCheckpoint {
  routeId: string
  index: number
}
