import { memo, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CORRIDOR_HOURS, type Corridor } from '../api/corridor'
import { forecastClock, useForecastHour } from '../map/forecastClock'
import {
  hourLabel,
  hoursFromNow,
  initialHour,
  tickLabel,
  tripWindow,
  worstLevelByHour,
  type TripWindow,
} from '../lib/forecast'
import { LEVELS, levelColor } from '../lib/risk'
import type { Route } from '../types'
import './ForecastSlider.css'

interface ForecastSliderProps {
  corridor: Corridor | null
  status: 'loading' | 'error' | 'ready'
  route: Route
  departureUtc: string
  timeZone: string
  onRetry: () => void
}

const LAST_HOUR = CORRIDOR_HOURS - 1
const MS_PER_HOUR = 700
const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -6,
  PageUp: 6,
}

const clamp = (hour: number) => Math.min(Math.max(hour, 0), LAST_HOUR)

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function usePlayback({ start }: { start: number }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const stop = () => setPlaying(false)
    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let timer = 0
    if (reduced) {
      timer = window.setInterval(() => {
        const next = Math.floor(forecastClock.get()) + 1
        forecastClock.set(Math.min(next, LAST_HOUR))
        if (next >= LAST_HOUR) stop()
      }, MS_PER_HOUR)
    } else {
      let last = performance.now()
      const tick = (now: number) => {
        // A long frame (busy main thread) must not make the truck jump.
        const next = forecastClock.get() + Math.min(now - last, 100) / MS_PER_HOUR
        last = now
        forecastClock.set(Math.min(next, LAST_HOUR))
        if (next >= LAST_HOUR) stop()
        else frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [playing])

  const toggle = () => {
    if (!playing && forecastClock.get() >= LAST_HOUR) forecastClock.set(start)
    setPlaying(!playing)
  }

  return { playing, toggle, pause: () => setPlaying(false) }
}

function Readout({ corridor, timeZone }: { corridor: Corridor; timeZone: string }) {
  const hour = useForecastHour()
  return (
    <div className="fslider__readout num" aria-live="off">
      <span className="fslider__time">{hourLabel({ hours: corridor.hours, hour, timeZone })}</span>
      <span className="fslider__offset">{hoursFromNow(hour)}</span>
    </div>
  )
}

function HourRange({
  corridor,
  timeZone,
  onTouch,
}: {
  corridor: Corridor
  timeZone: string
  onTouch: () => void
}) {
  const hour = useForecastHour()

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    let next: number | undefined
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = LAST_HOUR
    else if (event.key in KEY_STEPS) next = clamp(forecastClock.get() + KEY_STEPS[event.key])
    if (next === undefined) return
    event.preventDefault()
    onTouch()
    forecastClock.set(next)
  }

  return (
    <input
      className="fslider__range"
      type="range"
      min={0}
      max={LAST_HOUR}
      step={0.05}
      value={hour}
      aria-label="Forecast hour"
      aria-valuetext={hourLabel({ hours: corridor.hours, hour, timeZone })}
      onChange={(event) => forecastClock.set(Number(event.currentTarget.value))}
      onKeyDown={onKeyDown}
      onPointerDown={onTouch}
    />
  )
}

const Strip = memo(function Strip({
  corridor,
  window,
}: {
  corridor: Corridor
  window: TripWindow | null
}) {
  const levels = useMemo(() => worstLevelByHour(corridor).slice(0, LAST_HOUR), [corridor])

  return (
    <>
      <div className="fslider__strip" aria-hidden="true">
        {levels.map((level, i) => (
          <span key={i} data-level={level} style={{ background: levelColor(LEVELS[level]) }} />
        ))}
      </div>
      {window && (
        <div
          className="fslider__trip"
          data-anchor={window.startHour > LAST_HOUR / 2 ? 'end' : 'start'}
          style={{
            left: `${(window.startHour / LAST_HOUR) * 100}%`,
            width: `${((window.endHour - window.startHour) / LAST_HOUR) * 100}%`,
          }}
        >
          <span className="label fslider__trip-label">Your trip</span>
        </div>
      )}
    </>
  )
})

function Ready({
  corridor,
  route,
  departureUtc,
  timeZone,
}: {
  corridor: Corridor
  route: Route
  departureUtc: string
  timeZone: string
}) {
  const initial = useMemo(
    () => initialHour({ departureUtc, hours: corridor.hours }),
    [corridor, departureUtc],
  )
  const window = useMemo(
    () =>
      tripWindow({
        departureUtc,
        arrivalUtc: route.checkpoints[route.checkpoints.length - 1].eta_utc,
        firstHourUtc: corridor.hours[0],
      }),
    [corridor, route, departureUtc],
  )
  const { playing, toggle, pause } = usePlayback({ start: window?.startHour ?? 0 })

  useEffect(() => {
    forecastClock.set(initial.hour)
  }, [initial])

  const ticks = useMemo(
    () =>
      [0, LAST_HOUR / 2, LAST_HOUR].map((hour) =>
        tickLabel({ hours: corridor.hours, hour, timeZone }),
      ),
    [corridor, timeZone],
  )

  return (
    <section className="fslider glass" aria-label="Forecast time">
      <button
        type="button"
        className="fslider__play"
        aria-label={playing ? 'Pause forecast' : 'Play forecast'}
        onClick={toggle}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <Readout corridor={corridor} timeZone={timeZone} />
      <div className="fslider__track">
        {initial.note && (
          <p className="fslider__note" role="status">
            {initial.note}
          </p>
        )}
        <div className="fslider__plot">
          <Strip corridor={corridor} window={window} />
          <HourRange corridor={corridor} timeZone={timeZone} onTouch={pause} />
        </div>
        <div className="fslider__ticks num" aria-hidden="true">
          {ticks.map((tick, i) => (
            <span key={i}>{tick}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function ForecastSlider({
  corridor,
  status,
  route,
  departureUtc,
  timeZone,
  onRetry,
}: ForecastSliderProps) {
  if (status === 'error') {
    return (
      <section className="fslider fslider--message glass" aria-label="Forecast time">
        <p className="fslider__message">Heatmap unavailable</p>
        <button type="button" className="fslider__retry" onClick={onRetry}>
          Try again
        </button>
      </section>
    )
  }
  if (status === 'loading' || !corridor) {
    return (
      <section
        className="fslider fslider--message fslider--loading glass"
        aria-label="Forecast time"
        aria-busy="true"
      >
        <p className="fslider__message">Loading the forecast heatmap</p>
      </section>
    )
  }
  return <Ready corridor={corridor} route={route} departureUtc={departureUtc} timeZone={timeZone} />
}
