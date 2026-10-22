import type { Route } from '../types'
import { barHeightPct, nearestCheckpoint } from '../lib/detail'
import { formatLocalTime } from '../lib/format'
import { LEVEL_LABEL, LEVELS, levelColor } from '../lib/risk'
import './RiskRibbonChart.css'

const TICK_COUNT = 4

function summarize(route: Route): string {
  const parts = LEVELS.flatMap((level) => {
    const count = route.checkpoints.filter((c) => c.level === level).length
    return count > 0 ? [`${count} ${LEVEL_LABEL[level]}`] : []
  })
  return `Risk at ${route.checkpoints.length} checkpoints over ${Math.round(route.distance_mi)} miles: ${parts.join(', ')}`
}

export default function RiskRibbonChart({ route }: { route: Route }) {
  const { checkpoints, distance_mi: distance } = route
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const mile = (distance * i) / TICK_COUNT
    const showTime = i % (TICK_COUNT / 2) === 0
    const c = showTime ? nearestCheckpoint(checkpoints, mile) : null
    return { mile: Math.round(mile), time: c && formatLocalTime(c) }
  })

  return (
    <section className="ribbon" aria-labelledby="ribbon-title">
      <div className="ribbon-head">
        <h2 id="ribbon-title" className="detail-card-title">
          Risk along the drive
        </h2>
        <span className="ribbon-hint num">bar height = risk level</span>
      </div>
      <div className="ribbon-plot" role="img" aria-label={summarize(route)}>
        {checkpoints.map((c) => (
          <span
            key={c.mile}
            className="ribbon-slot"
            style={{ flexGrow: c.covered_miles }}
            title={`MP ${c.mile}, ${formatLocalTime(c)}: ${LEVEL_LABEL[c.level]}`}
          >
            <span
              className={c.level === 'NO_TRAVEL' ? 'ribbon-bar notravel-hatch' : 'ribbon-bar'}
              style={{
                height: `${barHeightPct(c.level)}%`,
                background: c.level === 'NO_TRAVEL' ? undefined : levelColor(c.level),
              }}
            />
          </span>
        ))}
      </div>
      <ol className="ribbon-axis num">
        {ticks.map((tick) => (
          <li key={tick.mile} className="ribbon-tick">
            <span>MP {tick.mile}</span>
            {tick.time && <span className="ribbon-tick-time">{tick.time}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
