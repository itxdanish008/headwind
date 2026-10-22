import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { LevelName, Plan, SelectedCheckpoint } from '../types'
import { formatLocalDay, formatLocalTime, formatRate, formatMiles } from '../lib/format'
import { LEVEL_LABEL, levelColor } from '../lib/risk'
import { NO_TRAVEL_AT, loadRuleNote, rainLevel, snowLevel, windLevel } from '../lib/thresholds'
import './CheckpointPanel.css'

export interface CheckpointPanelProps {
  plan: Plan
  selection: SelectedCheckpoint
  loadLbs: number
  onClose: () => void
}

interface MeterProps {
  label: string
  value: number | null
  unit: string
  limit: number
  level: LevelName | null
  note?: string
}

function Meter({ label, value, unit, limit, level, note }: MeterProps) {
  const fill = value === null ? 0 : Math.min(value / limit, 1) * 100
  return (
    <div className="cp-meter">
      <div className="cp-meter-row">
        <span className="label">{label}</span>
        <span className="num cp-meter-value">{formatRate(value, unit)}</span>
      </div>
      <div className="cp-bar" aria-hidden="true">
        <div
          className="cp-bar-fill"
          style={{ width: `${fill}%`, background: level ? levelColor(level) : undefined }}
        />
      </div>
      {note && <div className="cp-meter-note num">{note}</div>}
    </div>
  )
}

export default function CheckpointPanel({
  plan,
  selection,
  loadLbs,
  onClose,
}: CheckpointPanelProps) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const route = plan.routes.find((r) => r.id === selection.routeId)
  const cp = route?.checkpoints[selection.index]
  if (!route || !cp) return <></>

  const utc = /T(\d{2}:\d{2})/.exec(cp.eta_utc)?.[1]
  const unknown = cp.level === 'UNKNOWN'
  const ruleNote = cp.wind_mph === null ? null : loadRuleNote(cp.wind_mph, loadLbs)

  return (
    <motion.aside
      className="cp-panel glass"
      aria-label="Checkpoint details"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="cp-header">
        <span className="label">Checkpoint</span>
        <span className="cp-chip num">Route {route.id}</span>
        <button
          type="button"
          className="cp-close"
          aria-label="Close checkpoint details"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M2 2 L12 12 M12 2 L2 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="cp-mile num">
        MP {Math.round(cp.mile).toLocaleString('en-US')} of{' '}
        {Math.round(route.distance_mi).toLocaleString('en-US')}
      </div>

      <div className="cp-eta">
        <div className="cp-eta-time num">{formatLocalTime(cp)}</div>
        <div className="cp-eta-day num">{formatLocalDay(cp.eta_local)}</div>
        {utc && <div className="cp-eta-utc num">{utc} UTC</div>}
      </div>

      <div className="cp-badge-row">
        <span
          className={`cp-badge${cp.level === 'NO_TRAVEL' ? ' notravel-hatch' : ''}`}
          style={{ background: cp.level === 'NO_TRAVEL' ? undefined : levelColor(cp.level) }}
        >
          {LEVEL_LABEL[cp.level]}
        </span>
        {cp.driver && <span className="cp-driver">driven by {cp.driver}</span>}
      </div>

      {unknown ? (
        <p className="cp-unknown">
          No forecast for this arrival time. It is beyond the forecast horizon and is not counted in
          the route's risk.
        </p>
      ) : (
        <div className="cp-meters">
          <Meter
            label="Wind"
            value={cp.wind_mph}
            unit="mph"
            limit={NO_TRAVEL_AT.wind}
            level={cp.wind_mph === null ? null : windLevel(cp.wind_mph)}
            note={
              cp.gust_mph === null
                ? undefined
                : `Gusts ${formatRate(cp.gust_mph, 'mph')} (information only)`
            }
          />
          <Meter
            label="Rain"
            value={cp.rain_in_hr}
            unit="in/hr"
            limit={NO_TRAVEL_AT.rain}
            level={cp.rain_in_hr === null ? null : rainLevel(cp.rain_in_hr)}
          />
          <Meter
            label="Snow"
            value={cp.snow_in_hr}
            unit="in/hr"
            limit={NO_TRAVEL_AT.snow}
            level={cp.snow_in_hr === null ? null : snowLevel(cp.snow_in_hr)}
          />
        </div>
      )}

      {!unknown && ruleNote && (
        <div className="cp-rule">
          <span className="label">Load rule</span>
          <p>{ruleNote}</p>
        </div>
      )}

      <div className="cp-covers num">Covers {formatMiles(cp.covered_miles)}</div>
    </motion.aside>
  )
}
