import { useEffect, useState } from 'react'
import type { TripRequest } from '../types'
import './SamplingScreen.css'
import { shortPlaceName } from '../lib/format'

export interface SamplingScreenProps {
  trip: TripRequest
  done: boolean
}

const TICK_MS = 120
const OPTIMISTIC_CAP = 92
const STEP_STARTS = [0, 8, 20, 34, 52, 72]

const LANES = [
  {
    letter: 'A',
    name: 'Route A',
    color: 'var(--route-a)',
    seconds: 6,
    offset: 0,
    dots: 20,
  },
  {
    letter: 'B',
    name: 'Route B',
    color: 'var(--route-b)',
    seconds: 6.6,
    offset: 2,
    dots: 20,
  },
  {
    letter: 'C',
    name: 'Route C',
    color: 'var(--accent)',
    seconds: 7.2,
    offset: 3,
    dots: 20,
  },
]

function stepTitles(interval: number) {
  return [
    'Finding your places',
    'Requesting three truck routes',
    `Placing checkpoints every ${interval} mi`,
    'Estimating arrival time at each checkpoint',
    'Fetching forecast weather',
    'Rating risk and ranking routes',
  ]
}

export default function SamplingScreen({ trip, done }: SamplingScreenProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) =>
        done ? Math.min(100, p + (100 - p) * 0.6 + 2) : p + (OPTIMISTIC_CAP - p) * 0.045,
      )
    }, TICK_MS)
    return () => clearInterval(id)
  }, [done])

  const finished = progress >= 100
  const pct = Math.floor(progress)
  const titles = stepTitles(trip.interval_miles)
  const activeIndex = finished
    ? titles.length
    : STEP_STARTS.reduce((acc, start, i) => (progress >= start ? i : acc), 0)
  const checkpointsPerRoute = Math.round(800 / trip.interval_miles)

  return (
    <div className="sampling">
      <div className="sampling__radar" aria-hidden="true">
        <div className="sampling__ring sampling__ring--outer" />
        <div className="sampling__ring sampling__ring--mid" />
        <div className="sampling__ring sampling__ring--inner" />
        <div className="sampling__sweep" />
        <div className="sampling__pulse" />
      </div>

      <main className="sampling__main">
        <section className="sampling__steps">
          <div>
            <div className="label">Building your corridor</div>
            <h1 className="sampling__title display">Reading the sky along every mile.</h1>
            <p className="sampling__trip num">
              {shortPlaceName(trip.origin)} {'→'} {shortPlaceName(trip.destination)}
            </p>
          </div>

          <div role="status" aria-live="polite" className="sampling__status">
            <span className="sr-only">
              {finished
                ? 'Done. Loading your routes.'
                : `Step ${activeIndex + 1} of ${titles.length}: ${titles[activeIndex]}`}
            </span>
            <div className="sampling__pct" aria-hidden="true">
              <span className="sampling__pct-value num">{pct}%</span>
              <span className="sampling__pct-note num">{finished ? 'complete' : 'estimated'}</span>
            </div>
            <div className="sampling__bar" aria-hidden="true">
              <div
                className="sampling__bar-fill"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
            <ol className="sampling__list" aria-hidden="true">
              {titles.map((title, i) => {
                const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'waiting'
                return (
                  <li key={title} className={`sampling__step sampling__step--${state}`}>
                    <StepIcon state={state} />
                    <span className="sampling__step-title">{title}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          <p className="sampling__note">
            First lookups can take a few seconds; repeat trips are cached.
          </p>
        </section>

        <section className="sampling__lanes glass" aria-hidden="true">
          <div className="sampling__lanes-head">
            <h2 className="sampling__lanes-title">Three candidate corridors</h2>
            <span className="label">Sampling progress</span>
          </div>
          {LANES.map((lane) => {
            const total = checkpointsPerRoute - lane.offset
            const sampled = Math.min(total, Math.floor((progress / 100) * total))
            return (
              <div key={lane.letter} className="sampling__lane">
                <div className="sampling__lane-head">
                  <span className="sampling__badge" style={{ background: lane.color }}>
                    {lane.letter}
                  </span>
                  <span className="sampling__lane-name">{lane.name}</span>
                  <span className="sampling__lane-count num">
                    {sampled}/{total} sampled
                  </span>
                </div>
                <div
                  className="sampling__road"
                  style={{ '--cycle': `${lane.seconds}s` } as React.CSSProperties}
                >
                  <div className="sampling__asphalt" />
                  <div className="sampling__centerline" />
                  <div className="sampling__dots">
                    {Array.from({ length: lane.dots }, (_, i) => (
                      <span
                        key={i}
                        className="sampling__dot"
                        style={
                          {
                            '--c': 'var(--accent)',
                            '--delay': `${(i / (lane.dots - 1)) * lane.seconds}s`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <div className="sampling__truck-track">
                    <svg className="sampling__truck" width="44" height="22" viewBox="0 0 44 22">
                      <rect x="0" y="2" width="27" height="14" rx="2" fill="var(--text-2)" />
                      <path d="M29 6 H35 L41 12 V17 H29 Z" fill="var(--time)" />
                      <circle cx="6" cy="18" r="3" fill="var(--bg)" stroke="var(--metal)" />
                      <circle cx="33" cy="18" r="3" fill="var(--bg)" stroke="var(--metal)" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}

function StepIcon({ state }: { state: 'done' | 'active' | 'waiting' }) {
  if (state === 'done') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="10" fill="var(--r0)" fillOpacity=".18" />
        <path
          d="M6.5 11.5 L9.5 14.5 L15.5 8"
          fill="none"
          stroke="var(--r0)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (state === 'active') {
    return (
      <svg
        className="sampling__spinner"
        width="22"
        height="22"
        viewBox="0 0 22 22"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="8.5"
          fill="none"
          stroke="rgb(var(--accent-rgb) / .2)"
          strokeWidth="2.5"
        />
        <path
          d="M11 2.5 A8.5 8.5 0 0 1 19.5 11"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="8.5"
        fill="none"
        stroke="rgb(var(--line-rgb) / .25)"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
    </svg>
  )
}
