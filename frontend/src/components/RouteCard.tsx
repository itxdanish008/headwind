import { motion } from 'motion/react'
import type { Route } from '../types'
import { formatAvgRisk, formatDuration, formatMiles } from '../lib/format'
import { cssVar } from '../lib/risk'
import { routeNote, severePlusMiles } from '../lib/routeNotes'
import RiskStrip from './RiskStrip'
import './RouteCard.css'

interface RouteCardProps {
  route: Route
  colorVar: string
  recommended: boolean
  selected: boolean
  animate: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

export default function RouteCard({
  route,
  colorVar,
  recommended,
  selected,
  animate,
  onSelect,
  onHover,
}: RouteCardProps) {
  const { summary } = route
  const noTravel = summary.miles_by_level.NO_TRAVEL > 0
  const severe = severePlusMiles(summary)
  const high = summary.miles_by_level.HIGH
  const color = cssVar(colorVar)
  const Highlight = animate && selected ? motion.span : 'span'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      className={`route-card ${selected ? 'is-selected' : 'glass'}`}
      style={{ '--route-color': color } as React.CSSProperties}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      {selected && (
        <Highlight
          className="route-card-highlight"
          {...(animate ? { layoutId: 'route-selection' } : {})}
        />
      )}
      <span className="route-card-head">
        <span className="route-card-badge">{route.id}</span>
        <span className="route-card-name">
          <strong>Route {route.id}</strong>
          <span className="num">{formatMiles(route.distance_mi)}</span>
        </span>
        <span className="route-card-tags">
          {recommended && <span className="chip chip-accent">RECOMMENDED</span>}
          {noTravel && <span className="chip chip-notravel notravel-hatch">NO-TRAVEL ZONE</span>}
          {route.forced && (
            <span
              className="chip chip-muted"
              title="Forced through a detour point; the routing service offered fewer routes"
            >
              GENERATED
            </span>
          )}
        </span>
      </span>
      <RiskStrip checkpoints={route.checkpoints} />
      <span className="route-card-stats">
        <Stat label="Drive time" value={formatDuration(route.duration_s)} />
        <Stat
          label="Severe+ mi"
          value={String(Math.round(severe))}
          warn={severe > 0 ? '--r3-t' : undefined}
        />
        <Stat
          label="High mi"
          value={String(Math.round(high))}
          warn={high > 0 ? '--r2-t' : undefined}
        />
        <Stat label="Avg risk" value={formatAvgRisk(summary.avg_risk)} />
      </span>
      <span className="route-card-reason">{routeNote(route)}</span>
      {summary.unknown_miles > 0 && (
        <span className="route-card-unrated">
          <span className="num">{Math.round(summary.unknown_miles)}</span> mi not rated (beyond
          forecast)
        </span>
      )}
    </button>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: string }) {
  return (
    <span className="route-card-stat">
      <span className="route-card-stat-label">{label}</span>
      <span
        className="num route-card-stat-value"
        style={warn ? { color: cssVar(warn) } : undefined}
      >
        {value}
      </span>
    </span>
  )
}
