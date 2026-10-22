import type { Checkpoint, LevelName } from '../types'

const BAR_HEIGHT_PCT: Record<LevelName, number> = {
  UNKNOWN: 12,
  LOW: 22,
  MODERATE: 42,
  HIGH: 62,
  SEVERE: 82,
  NO_TRAVEL: 100,
}

export const barHeightPct = (level: LevelName): number => BAR_HEIGHT_PCT[level]

export interface LoadRule {
  text: string
  overLb: number | null
}

export const LOAD_RULES: LoadRule[] = [
  { text: '55 mph or more: No Travel for any load', overLb: null },
  { text: '45-54 mph with a load over 30,000 lb: No Travel', overLb: 30_000 },
  { text: '35-44 mph with a load over 40,000 lb: Severe', overLb: 40_000 },
]

export const isRuleActive = (rule: LoadRule, loadLbs: number): boolean =>
  rule.overLb === null || loadLbs > rule.overLb

export type CheckpointFilter = 'moderate' | 'all'

export function filterCheckpoints(
  checkpoints: Checkpoint[],
  filter: CheckpointFilter,
): Checkpoint[] {
  if (filter === 'all') return checkpoints
  return checkpoints.filter((c) => c.level !== 'LOW')
}

const TINT: Partial<Record<LevelName, string>> = {
  MODERATE: 'var(--r1-t)',
  HIGH: 'var(--r2-t)',
  SEVERE: 'var(--r3-t)',
  NO_TRAVEL: 'var(--r4-t)',
}

export const metricTint = (level: LevelName | null): string | undefined =>
  level ? TINT[level] : undefined

export function nearestCheckpoint(checkpoints: Checkpoint[], mile: number): Checkpoint {
  return checkpoints.reduce((best, c) =>
    Math.abs(c.mile - mile) < Math.abs(best.mile - mile) ? c : best,
  )
}
