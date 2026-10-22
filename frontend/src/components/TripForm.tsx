import { useId, useState, type FormEvent } from 'react'
import { usePlace } from '../api/place'
import type { TripRequest } from '../types'
import { formatLb } from '../lib/format'
import {
  DEPARTURE_WINDOW_DAYS,
  HEAVY_LB,
  LOAD_STEP_LB,
  MAX_CARGO_LB,
  MIN_CARGO_LB,
  OVERWEIGHT_LB,
  inHours,
  loadRuleText,
  nextWholeHour,
  toDepartureString,
  tomorrowAtSix,
  trailerFillColor,
  wallClockNow,
} from '../lib/trip'
import { radioKeyHandler } from '../lib/radioGroup'
import DateTimePicker from './DateTimePicker'
import PlaceInput from './PlaceInput'
import './TripForm.css'

export interface TripFormProps {
  pending: boolean
  onSubmit: (trip: TripRequest) => void
}

const INTERVALS = [10, 25, 50] as const
const QUICK_DEPARTURES = [
  { label: 'Leave now', at: (now: Date) => now },
  { label: 'In 6 hours', at: (now: Date) => inHours(now, 6) },
  { label: 'Tomorrow 06:00', at: tomorrowAtSix },
]

const originIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <circle cx="9" cy="9" r="5.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
    <circle cx="9" cy="9" r="2" fill="var(--accent)" />
  </svg>
)

const destinationIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path
      d="M9 16 C 9 16 3.5 10.6 3.5 7 a5.5 5.5 0 0 1 11 0 C 14.5 10.6 9 16 9 16 Z"
      fill="none"
      stroke="var(--time)"
      strokeWidth="2"
    />
    <circle cx="9" cy="7" r="2" fill="var(--time)" />
  </svg>
)

export default function TripForm({ pending, onSubmit }: TripFormProps) {
  const errorId = useId()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [originTouched, setOriginTouched] = useState(false)
  const [destinationTouched, setDestinationTouched] = useState(false)
  const [chosenDeparture, setDeparture] = useState<string | null>(null)
  const [load, setLoad] = useState(42000)
  const [interval, setInterval] = useState<TripRequest['interval_miles']>(25)

  const timeZone = usePlace(origin).data?.timezone
  const now = timeZone ? wallClockNow(timeZone) : new Date()
  const departure = chosenDeparture ?? toDepartureString(nextWholeHour(now))

  const missing = !origin.trim() || !destination.trim()
  const errors = [
    originTouched && !origin.trim() && 'Enter an origin.',
    destinationTouched && !destination.trim() && 'Enter a destination.',
  ].filter(Boolean)
  const loadShare = (load / MAX_CARGO_LB) * 100

  function swap() {
    setOrigin(destination)
    setDestination(origin)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (missing || pending) return
    const earliest = toDepartureString(now)
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      departure_at: departure < earliest ? earliest : departure,
      load_lbs: load,
      interval_miles: interval,
    })
  }

  return (
    <form className="trip-form glass" aria-label="Plan a trip" onSubmit={handleSubmit}>
      <div className="trip-form__places">
        <PlaceInput
          label="Origin"
          value={origin}
          onChange={setOrigin}
          onBlur={() => setOriginTouched(true)}
          icon={originIcon}
          invalid={originTouched && !origin.trim()}
          errorId={errorId}
        />
        <PlaceInput
          label="Destination"
          value={destination}
          onChange={setDestination}
          onBlur={() => setDestinationTouched(true)}
          icon={destinationIcon}
          invalid={destinationTouched && !destination.trim()}
          errorId={errorId}
        />
        <button
          type="button"
          className="trip-form__swap"
          aria-label="Swap origin and destination"
          onClick={swap}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M6 3 V15 M6 15 L3 12 M6 15 L9 12 M12 15 V3 M12 3 L9 6 M12 3 L15 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {errors.length > 0 && (
        <p id={errorId} role="alert" className="trip-form__error">
          {errors.join(' ')}
        </p>
      )}

      <div className="trip-form__group">
        <DateTimePicker
          value={departure}
          onChange={setDeparture}
          now={now}
          windowDays={DEPARTURE_WINDOW_DAYS}
        />
        <div className="trip-form__chips">
          {QUICK_DEPARTURES.map((quick) => (
            <button
              key={quick.label}
              type="button"
              className="trip-form__chip"
              onClick={() => setDeparture(toDepartureString(quick.at(now)))}
            >
              {quick.label}
            </button>
          ))}
        </div>
      </div>

      <div className="trip-form__load">
        <div className="trip-form__load-head">
          <label htmlFor="trip-load" className="label">
            Load weight
          </label>
          <output htmlFor="trip-load" className="trip-form__load-value num">
            {formatLb(load)}
          </output>
        </div>
        <p className="trip-form__hint">
          Cargo only. The 33,000 lb tractor-trailer is added for routing.
        </p>
        <div className="trip-form__trailer" aria-hidden="true">
          <div
            className="trip-form__trailer-fill"
            style={{ width: `${loadShare}%`, background: trailerFillColor(load) }}
          />
          <span
            className="trip-form__trailer-tick"
            style={{ left: `${(HEAVY_LB / MAX_CARGO_LB) * 100}%` }}
          />
          <span
            className="trip-form__trailer-tick"
            style={{ left: `${(OVERWEIGHT_LB / MAX_CARGO_LB) * 100}%` }}
          />
        </div>
        <input
          id="trip-load"
          type="range"
          className="trip-form__range"
          min={MIN_CARGO_LB}
          max={MAX_CARGO_LB}
          step={LOAD_STEP_LB}
          value={load}
          onChange={(event) => setLoad(Number(event.target.value))}
        />
        <div className="trip-form__scale num" aria-hidden="true">
          <span>1k</span>
          <span>30k</span>
          <span>40k</span>
          <span>47k</span>
        </div>
        <p
          className="trip-form__rule"
          style={{ borderColor: trailerFillColor(load) }}
          aria-live="polite"
        >
          {loadRuleText(load)}
        </p>
      </div>

      <div className="trip-form__interval">
        <span id="trip-interval" className="label">
          Sample weather every
        </span>
        <div
          role="radiogroup"
          aria-labelledby="trip-interval"
          className="trip-form__segments"
          onKeyDown={radioKeyHandler({
            values: INTERVALS,
            current: interval,
            onSelect: setInterval,
          })}
        >
          {INTERVALS.map((miles) => (
            <button
              key={miles}
              type="button"
              role="radio"
              aria-checked={interval === miles}
              tabIndex={interval === miles ? 0 : -1}
              className="trip-form__segment num"
              onClick={() => setInterval(miles)}
            >
              {miles} mi
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-primary btn-block" disabled={pending || missing}>
        {pending ? (
          <>
            <span className="trip-form__spinner" aria-hidden="true" />
            Sampling weather...
          </>
        ) : (
          'Find the safest route'
        )}
      </button>
    </form>
  )
}
