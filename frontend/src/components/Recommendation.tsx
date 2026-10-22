import type { Plan } from '../types'
import './Recommendation.css'

export default function Recommendation({ plan }: { plan: Plan }) {
  return (
    <section className="recommendation" role="status">
      <span className="label recommendation-label">RECOMMENDED</span>
      <h2 className="display recommendation-title">Route {plan.recommended_route_id}</h2>
      <p className="recommendation-reason">{plan.reason}</p>
      {plan.warnings.length > 0 && (
        <ul className="recommendation-warnings">
          {plan.warnings.map((warning) => (
            <li key={warning}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M8 1.5 15 14H1L8 1.5Z" fill="currentColor" />
                <path
                  d="M8 6v4M8 11.5v1"
                  stroke="var(--bg)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
