import { motion, useReducedMotion } from 'motion/react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  angleToHour,
  angleToMinute,
  hourToAngle,
  minuteToAngle,
  pointAngle,
  polarToCartesian,
  stepCycle,
} from '../lib/clock'
import './ClockFace.css'
import { pad2 } from '../lib/format'

export type ClockMode = 'hour' | 'minute'

interface ClockFaceProps {
  mode: ClockMode
  hour: number
  minute: number
  onHourChange: (hour: number) => void
  onMinuteChange: (minute: number) => void
  onHourSettled: () => void
}

const SIZE = 220
const CENTER = SIZE / 2
const LABEL_RADIUS = 84
const KNOB_RADIUS = 18
const TICK_OUTER = 106
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_LABELS = Array.from({ length: 12 }, (_, i) => i * 5)
const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => i)

const minuteDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 60 - Math.abs(a - b))
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

export default function ClockFace({
  mode,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onHourSettled,
}: ClockFaceProps) {
  const reduceMotion = useReducedMotion()
  const dragging = useRef(false)
  const isHour = mode === 'hour'
  const value = isHour ? hour : minute
  const knob = polarToCartesian(
    CENTER,
    CENTER,
    LABEL_RADIUS,
    isHour ? hourToAngle(hour) : minuteToAngle(minute),
  )

  function pick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const angle = pointAngle(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    )
    if (isHour) onHourChange(angleToHour(angle))
    else onMinuteChange(angleToMinute(angle))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    pick(event)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current) pick(event)
  }

  function handlePointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (isHour) onHourSettled()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const small = event.shiftKey && !isHour ? 5 : 1
    const page = isHour ? 3 : 15
    const steps: Record<string, number> = {
      ArrowRight: small,
      ArrowUp: small,
      ArrowLeft: -small,
      ArrowDown: -small,
      PageUp: page,
      PageDown: -page,
    }
    const min = isHour ? 1 : 0
    const count = isHour ? 12 : 60
    let next: number
    if (event.key in steps) next = stepCycle(value, steps[event.key], min, count)
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = min + count - 1
    else if (event.key === 'Enter' && isHour) {
      event.preventDefault()
      onHourSettled()
      return
    } else return

    event.preventDefault()
    if (isHour) onHourChange(next)
    else onMinuteChange(next)
  }

  return (
    <div
      className="clock"
      role="slider"
      tabIndex={0}
      aria-label={isHour ? 'Select hour' : 'Select minute'}
      aria-valuemin={isHour ? 1 : 0}
      aria-valuemax={isHour ? 12 : 59}
      aria-valuenow={value}
      aria-valuetext={plural(value, isHour ? 'hour' : 'minute')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragging.current = false
      }}
      onKeyDown={handleKeyDown}
    >
      <svg className="clock__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="clock__dial" cx={CENTER} cy={CENTER} r={CENTER} />
        <motion.g
          key={mode}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          {!isHour &&
            MINUTE_TICKS.map((tick) => {
              const major = tick % 5 === 0
              const outer = polarToCartesian(CENTER, CENTER, TICK_OUTER, minuteToAngle(tick))
              const inner = polarToCartesian(
                CENTER,
                CENTER,
                TICK_OUTER - (major ? 8 : 4),
                minuteToAngle(tick),
              )
              return (
                <line
                  key={tick}
                  className={major ? 'clock__tick clock__tick--major' : 'clock__tick'}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                />
              )
            })}
          {(isHour ? HOURS : MINUTE_LABELS).map((label) => {
            if (!isHour && minuteDistance(label, minute) <= 2) return null
            const at = polarToCartesian(
              CENTER,
              CENTER,
              LABEL_RADIUS,
              isHour ? hourToAngle(label) : minuteToAngle(label),
            )
            return (
              <text key={label} className="clock__label num" x={at.x} y={at.y}>
                {isHour ? label : pad2(label)}
              </text>
            )
          })}
          <line className="clock__hand" x1={CENTER} y1={CENTER} x2={knob.x} y2={knob.y} />
          <circle className="clock__pivot" cx={CENTER} cy={CENTER} r={3} />
          <circle className="clock__knob" cx={knob.x} cy={knob.y} r={KNOB_RADIUS} />
          <text className="clock__knob-label num" x={knob.x} y={knob.y}>
            {isHour ? hour : pad2(minute)}
          </text>
        </motion.g>
      </svg>
    </div>
  )
}
