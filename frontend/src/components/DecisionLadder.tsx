import { Link } from 'react-router-dom'
import { detailPath } from '../api/plan'
import { formatDurationShort, formatMiles } from '../lib/format'
import { buildLadder, type LadderKey } from '../lib/ladder'
import { assignRouteColors, cssVar } from '../lib/risk'
import type { Plan, TripRequest } from '../types'
import './DecisionLadder.css'

interface DecisionLadderProps {
  plan: Plan
  trip: TripRequest
  selectedRouteId: string
}

const FORMAT: Record<LadderKey, (value: number) => string> = {
  no_travel: formatMiles,
  severe: formatMiles,
  high: formatMiles,
  avg_risk: (value) => value.toFixed(2),
  duration: formatDurationShort,
}

export default function DecisionLadder({ plan, trip, selectedRouteId }: DecisionLadderProps) {
  const { rows, decisiveKey, tieBreakKey } = buildLadder(plan)
  const routeIds = plan.routes.map((route) => route.id)
  const colors = assignRouteColors(routeIds, plan.recommended_route_id)

  return (
    <section className="ladder glass" aria-labelledby="ladder-title">
      <header className="ladder__head">
        <span className="label">DECISION</span>
        <h2 id="ladder-title" className="display ladder__title">
          Why Route {plan.recommended_route_id}
        </h2>
        <p className="ladder__reason">{plan.reason}</p>
      </header>

      <table className="ladder__table">
        <thead>
          <tr>
            <th scope="col" className="label ladder__corner">
              Criterion
            </th>
            {routeIds.map((id) => (
              <th key={id} scope="col" className="ladder__route">
                <span
                  className="ladder__badge"
                  style={{ '--route-color': cssVar(colors[id]) } as React.CSSProperties}
                >
                  {id}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                row.key === decisiveKey || row.key === tieBreakKey ? 'is-decisive' : undefined
              }
            >
              <th scope="row" className="ladder__criterion">
                {row.label}
                {row.key === decisiveKey && <span className="label ladder__decided">DECIDED</span>}
                {row.key === tieBreakKey && (
                  <span className="label ladder__decided">TIE-BREAK</span>
                )}
              </th>
              {routeIds.map((id) => (
                <td
                  key={id}
                  className={`num ladder__value${row.bestIds.includes(id) ? ' is-best' : ''}`}
                >
                  {FORMAT[row.key](row.values[id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="ladder__footnote">
        {decisiveKey
          ? 'Ranked in this order: No Travel, Severe, High, average risk, then travel time.'
          : 'All routes tie on risk and travel time.'}
      </p>

      <Link className="ladder__link" to={detailPath(selectedRouteId, trip)}>
        Route {selectedRouteId} details
      </Link>
    </section>
  )
}
