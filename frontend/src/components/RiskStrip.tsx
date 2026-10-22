import type { Checkpoint, LevelName } from '../types'
import { LEVEL_LABEL, LEVELS, levelColor } from '../lib/risk'
import { formatMiles } from '../lib/format'
import './RiskStrip.css'

interface RiskStripProps {
  checkpoints: Checkpoint[]
  height?: number
}

function describe(checkpoints: Checkpoint[]): string {
  const miles = new Map<LevelName, number>()
  for (const c of checkpoints) miles.set(c.level, (miles.get(c.level) ?? 0) + c.covered_miles)
  const parts = LEVELS.filter((level) => miles.has(level)).map(
    (level) => `${LEVEL_LABEL[level]} ${formatMiles(miles.get(level) ?? 0)}`,
  )
  return `Risk along the route: ${parts.join(', ')}`
}

export default function RiskStrip({ checkpoints, height = 8 }: RiskStripProps) {
  return (
    <div className="risk-strip" role="img" aria-label={describe(checkpoints)} style={{ height }}>
      {checkpoints.map((c, i) => (
        <span
          key={i}
          className={c.level === 'NO_TRAVEL' ? 'notravel-hatch' : undefined}
          style={{
            flexGrow: c.covered_miles,
            background: c.level === 'NO_TRAVEL' ? undefined : levelColor(c.level),
          }}
        />
      ))}
    </div>
  )
}
