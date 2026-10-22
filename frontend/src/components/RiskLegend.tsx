import { LEVEL_LABEL, LEVELS, levelColor } from '../lib/risk'
import './RiskLegend.css'

const ROUTE_KEYS = [
  { label: 'Recommended', colors: ['var(--accent)'] },
  { label: 'Alternatives', colors: ['var(--route-a)', 'var(--route-b)'] },
]

export default function RiskLegend() {
  return (
    <div className="legend glass" role="group" aria-label="Map legend">
      <div className="legend-block">
        <span className="label">Weather risk</span>
        <ul className="legend-list">
          {LEVELS.map((level) => (
            <li key={level} className="legend-item">
              <span
                className={`legend-swatch${level === 'NO_TRAVEL' ? ' notravel-hatch' : ''}`}
                style={{ background: level === 'NO_TRAVEL' ? undefined : levelColor(level) }}
              />
              {LEVEL_LABEL[level]}
            </li>
          ))}
        </ul>
      </div>
      <div className="legend-block legend-routes">
        <span className="label">Routes</span>
        <ul className="legend-list">
          {ROUTE_KEYS.map(({ label, colors }) => (
            <li key={label} className="legend-item">
              {colors.map((color) => (
                <span key={color} className="legend-line" style={{ background: color }} />
              ))}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
