import type { Route, RouteSummary } from '../types'

export const severePlusMiles = (summary: RouteSummary): number =>
  summary.miles_by_level.SEVERE + summary.miles_by_level.NO_TRAVEL

const NOTES = [
  ['NO_TRAVEL', 'of No Travel conditions'],
  ['SEVERE', 'of Severe weather'],
  ['HIGH', 'of High risk'],
  ['MODERATE', 'of Moderate weather'],
] as const

export function routeNote(route: Route): string {
  const miles = route.summary.miles_by_level
  const worst = NOTES.find(([level]) => miles[level] > 0)
  if (!worst) return 'Clear along the whole route'
  return `${Math.round(miles[worst[0]])} mi ${worst[1]}`
}
