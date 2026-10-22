import type { LevelName } from '../types'
import { LOAD_RULES, isRuleActive } from '../lib/detail'
import { formatLb } from '../lib/format'
import { LEVEL_LABEL, levelColor } from '../lib/risk'
import './RulesMatrix.css'

const COLUMNS: Exclude<LevelName, 'UNKNOWN'>[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

const ROWS: { metric: string; ranges: string[] }[] = [
  { metric: 'Wind mph', ranges: ['<25', '25-34', '35-44', '45-54', '>=55'] },
  { metric: 'Rain in/hr', ranges: ['<0.10', '0.10-0.25', '0.25-0.50', '0.50-1.00', '>1.00'] },
  { metric: 'Snow in/hr', ranges: ['<0.5', '0.5-1.0', '1.0-2.0', '2.0-3.0', '>3.0'] },
]

export default function RulesMatrix({ loadLbs }: { loadLbs: number }) {
  return (
    <section className="rules" aria-labelledby="rules-title">
      <h2 id="rules-title" className="detail-card-title">
        Risk rules
      </h2>
      <div className="rules-scroll" tabIndex={0} role="region" aria-label="Risk threshold table">
        <table className="rules-table num">
          <thead>
            <tr>
              <td />
              {COLUMNS.map((level) => (
                <th
                  key={level}
                  scope="col"
                  className="rules-level"
                  style={{ background: levelColor(level) }}
                >
                  {LEVEL_LABEL[level]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.metric}>
                <th scope="row" className="rules-metric">
                  {row.metric}
                </th>
                {row.ranges.map((range) => (
                  <td key={range}>{range}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rules-load">
        Your load: <span className="num">{formatLb(loadLbs)}</span>
      </p>
      <ul className="rules-list">
        {LOAD_RULES.map((rule) => {
          const active = isRuleActive(rule, loadLbs)
          return (
            <li key={rule.text} className={active ? 'rules-card rules-card-active' : 'rules-card'}>
              <span>{rule.text}</span>
              {active && <span className="label rules-active">Active for your load</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
