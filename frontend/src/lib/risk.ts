import type { LevelName } from '../types'

export const LEVELS: LevelName[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL', 'UNKNOWN']

export const LEVEL_LABEL: Record<LevelName, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  SEVERE: 'Severe',
  NO_TRAVEL: 'No Travel',
  UNKNOWN: 'Unknown',
}

export const LEVEL_VAR: Record<LevelName, string> = {
  LOW: '--risk-low',
  MODERATE: '--risk-moderate',
  HIGH: '--risk-high',
  SEVERE: '--risk-severe',
  NO_TRAVEL: '--risk-notravel',
  UNKNOWN: '--risk-unknown',
}

export const levelColor = (level: LevelName): string => `var(${LEVEL_VAR[level]})`

// MapLibre paint cannot resolve CSS variables, so the map reads the computed values.
export function resolvedLevelColors(): Record<LevelName, string> {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    LEVELS.map((level) => [level, style.getPropertyValue(LEVEL_VAR[level]).trim()]),
  ) as Record<LevelName, string>
}

export function assignRouteColors(
  routeIds: string[],
  recommendedId: string,
): Record<string, string> {
  const others = ['--route-a', '--route-b']
  const colors: Record<string, string> = {}
  for (const id of routeIds) {
    colors[id] = id === recommendedId ? '--accent' : (others.shift() ?? '--route-a')
  }
  return colors
}

export const cssVar = (name: string): string => `var(${name})`

export const resolveVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
