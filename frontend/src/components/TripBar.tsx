import { Link, useNavigate } from 'react-router-dom'
import { planPath } from '../api/plan'
import BrandLink from './BrandLink'
import { radioKeyHandler } from '../lib/radioGroup'
import { formatLb, shortPlaceName } from '../lib/format'
import type { TripRequest } from '../types'
import ThemeToggle from './ThemeToggle'
import './TripBar.css'

const INTERVALS = [10, 25, 50] as const

interface TripBarProps {
  trip: TripRequest
  routeCount: number | null
  showCheckpoints: boolean
  onToggleCheckpoints: () => void
  showHeatmap: boolean
  onToggleHeatmap: () => void
}

export default function TripBar({
  trip,
  routeCount,
  showCheckpoints,
  onToggleCheckpoints,
  showHeatmap,
  onToggleHeatmap,
}: TripBarProps) {
  const navigate = useNavigate()

  function changeInterval(interval: TripRequest['interval_miles']) {
    if (interval === trip.interval_miles) return
    navigate(planPath({ ...trip, interval_miles: interval }), { replace: true })
  }

  return (
    <header className="trip-bar glass">
      <Link to="/" className="trip-bar__back">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M10 3 5 8l5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        New trip
      </Link>
      <BrandLink />

      <ul className="trip-bar__chips" aria-label="Trip summary">
        <li className="trip-bar__chip" title={`${trip.origin} to ${trip.destination}`}>
          {shortPlaceName(trip.origin)} <span aria-label="to">&rarr;</span>{' '}
          {shortPlaceName(trip.destination)}
        </li>
        <li className="trip-bar__chip num">{trip.departure_at.replace('T', ' ')}</li>
        <li className="trip-bar__chip num">{formatLb(trip.load_lbs)}</li>
        {routeCount !== null && (
          <li className="trip-bar__chip num">
            {routeCount} {routeCount === 1 ? 'route' : 'routes'}
          </li>
        )}
      </ul>

      <div className="trip-bar__controls">
        <div className="trip-bar__group">
          <span className="label" id="trip-bar-interval">
            Every
          </span>
          <div
            className="trip-bar__segments"
            role="radiogroup"
            aria-labelledby="trip-bar-interval"
            onKeyDown={radioKeyHandler({
              values: INTERVALS,
              current: trip.interval_miles,
              onSelect: changeInterval,
            })}
          >
            {INTERVALS.map((interval) => (
              <button
                key={interval}
                type="button"
                role="radio"
                aria-checked={interval === trip.interval_miles}
                tabIndex={interval === trip.interval_miles ? 0 : -1}
                className="trip-bar__segment num"
                onClick={() => changeInterval(interval)}
              >
                {interval} mi
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="trip-bar__toggle"
          aria-pressed={showHeatmap}
          onClick={onToggleHeatmap}
        >
          Heatmap
        </button>
        <button
          type="button"
          className="trip-bar__toggle"
          aria-pressed={showCheckpoints}
          onClick={onToggleCheckpoints}
        >
          Checkpoints
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
