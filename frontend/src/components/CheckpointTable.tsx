import { useState } from 'react'
import type { Checkpoint, LevelName } from '../types'
import { filterCheckpoints, metricTint, type CheckpointFilter } from '../lib/detail'
import { formatLocalDay, formatLocalTime, formatRate } from '../lib/format'
import { LEVEL_LABEL, levelColor } from '../lib/risk'
import { rainLevel, snowLevel, windLevel } from '../lib/thresholds'
import './CheckpointTable.css'

const FILTERS: { value: CheckpointFilter; label: string }[] = [
  { value: 'moderate', label: 'Moderate and above' },
  { value: 'all', label: 'All' },
]

interface MetricCellProps {
  value: number | null
  unit: string
  classify: (value: number) => LevelName
  gust?: number | null
}

function MetricCell({ value, unit, classify, gust }: MetricCellProps) {
  return (
    <td className="num" style={{ color: metricTint(value === null ? null : classify(value)) }}>
      {formatRate(value, unit)}
      {gust != null && <span className="cp-gust">gusts {Math.round(gust)}</span>}
    </td>
  )
}

function Row({ checkpoint: c, showDay }: { checkpoint: Checkpoint; showDay: boolean }) {
  return (
    <tr>
      <th scope="row" className="num cp-mile">
        {c.mile}
      </th>
      <td className="num">
        {formatLocalTime(c)}
        {showDay && <span className="cp-gust">{formatLocalDay(c.eta_local)}</span>}
      </td>
      <MetricCell value={c.wind_mph} unit="mph" classify={windLevel} gust={c.gust_mph} />
      <MetricCell value={c.rain_in_hr} unit="in/hr" classify={rainLevel} />
      <MetricCell value={c.snow_in_hr} unit="in/hr" classify={snowLevel} />
      <td>
        <span
          className={c.level === 'NO_TRAVEL' ? 'cp-badge notravel-hatch' : 'cp-badge'}
          style={{ background: c.level === 'NO_TRAVEL' ? undefined : levelColor(c.level) }}
        >
          {LEVEL_LABEL[c.level]}
        </span>
      </td>
      <td className="cp-driver">{c.driver ?? '-'}</td>
    </tr>
  )
}

export default function CheckpointTable({ checkpoints }: { checkpoints: Checkpoint[] }) {
  const [filter, setFilter] = useState<CheckpointFilter>('moderate')
  const visible = new Set(filterCheckpoints(checkpoints, filter))

  return (
    <section className="cp" aria-labelledby="cp-title">
      <div className="cp-head">
        <h2 id="cp-title" className="detail-card-title">
          Checkpoints
        </h2>
        <div className="cp-filter" role="radiogroup" aria-label="Filter checkpoints">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filter === option.value}
              className="cp-filter-option"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {visible.size === 0 ? (
        <p className="cp-empty">No checkpoints at Moderate or above.</p>
      ) : (
        <div
          className="cp-scroll"
          tabIndex={0}
          role="region"
          aria-label="Checkpoint forecast table"
        >
          <table className="cp-table">
            <thead>
              <tr className="label">
                <th scope="col">MP</th>
                <th scope="col">Local ETA</th>
                <th scope="col">Wind</th>
                <th scope="col">Rain</th>
                <th scope="col">Snow</th>
                <th scope="col">Level</th>
                <th scope="col">Driver</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((c, i) =>
                visible.has(c) ? (
                  <Row
                    key={c.mile}
                    checkpoint={c}
                    showDay={
                      i === 0 ||
                      formatLocalDay(c.eta_local) !== formatLocalDay(checkpoints[i - 1].eta_local)
                    }
                  />
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
