import type { Plan } from '../types'
import { buildLadder, type LadderKey } from '../lib/ladder'
import { formatAvgRisk, formatDuration, formatMiles } from '../lib/format'
import './HowItWon.css'

const FORMAT: Record<LadderKey, (value: number) => string> = {
  no_travel: formatMiles,
  severe: formatMiles,
  high: formatMiles,
  avg_risk: formatAvgRisk,
  duration: formatDuration,
}

interface HowItWonProps {
  plan: Plan
  routeId: string
}

export default function HowItWon({ plan, routeId }: HowItWonProps) {
  const { rows, decisiveKey } = buildLadder(plan)
  const won = routeId === plan.recommended_route_id

  return (
    <section className="how" aria-labelledby="how-title">
      <h2 id="how-title" className="detail-card-title">
        {won ? `How Route ${routeId} won` : `How Route ${routeId} compares`}
      </h2>
      <div className="how-scroll" tabIndex={0} role="region" aria-label="Route comparison table">
        <table className="how-table">
          <thead>
            <tr>
              <th scope="col" className="label">
                Criterion
              </th>
              {plan.routes.map((route) => (
                <th
                  key={route.id}
                  scope="col"
                  className={`label${route.id === routeId ? ' how-current how-current-head' : ''}`}
                >
                  Route {route.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.key}>
                <th scope="row" className="how-criterion">
                  {row.label}
                  {row.key === decisiveKey && <span className="how-decided">DECIDED</span>}
                </th>
                {plan.routes.map((route) => {
                  const classes = ['num']
                  if (row.bestIds.includes(route.id)) classes.push('how-best')
                  if (route.id === routeId) {
                    classes.push('how-current')
                    if (rowIndex === rows.length - 1) classes.push('how-current-foot')
                  }
                  return (
                    <td key={route.id} className={classes.join(' ')}>
                      {FORMAT[row.key](row.values[route.id])}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="how-note">
        Ranking order: No Travel, Severe, High, average risk, then travel time.
      </p>
    </section>
  )
}
