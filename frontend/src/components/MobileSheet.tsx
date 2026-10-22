import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react'
import { detailPath } from '../api/plan'
import { formatAvgRisk, formatDuration, formatLocalTime, formatMiles } from '../lib/format'
import { LEVEL_LABEL, assignRouteColors, cssVar } from '../lib/risk'
import { severePlusMiles } from '../lib/routeNotes'
import type { Plan, Route, SelectedCheckpoint, TripRequest } from '../types'
import CheckpointPanel from './CheckpointPanel'
import CheckpointPicker from './CheckpointPicker'
import Recommendation from './Recommendation'
import RiskStrip from './RiskStrip'
import './MobileSheet.css'

const FULL_VH = 0.88
const TOP_BAR_CLEARANCE_PX = 148
const FLICK_PROJECTION_S = 0.08

type Snap = 'collapsed' | 'half' | 'full'
const SNAPS: Snap[] = ['collapsed', 'half', 'full']
const RISKY_LEVELS = ['MODERATE', 'HIGH', 'SEVERE', 'NO_TRAVEL']

interface MobileSheetProps {
  plan: Plan
  trip: TripRequest
  selectedRouteId: string
  collapsedPx: number
  halfVh: number
  selectedCheckpoint: SelectedCheckpoint | null
  forecast?: ReactNode
  onSelectRoute: (id: string) => void
  onSelectCheckpoint: (selection: SelectedCheckpoint | null) => void
}

const subscribeToResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
const getViewportHeight = () => window.innerHeight

export default function MobileSheet({
  plan,
  trip,
  selectedRouteId,
  collapsedPx,
  halfVh,
  selectedCheckpoint,
  forecast,
  onSelectRoute,
  onSelectCheckpoint,
}: MobileSheetProps) {
  const reduceMotion = useReducedMotion()
  const viewportHeight = useSyncExternalStore(subscribeToResize, getViewportHeight)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [safeBottom, setSafeBottom] = useState(0)
  const [snap, setSnap] = useState<Snap>('collapsed')
  const y = useMotionValue(0)
  const dragControls = useDragControls()

  // env(safe-area-inset-bottom) is only readable from CSS, via the sheet's own padding.
  useLayoutEffect(() => {
    if (sheetRef.current) {
      setSafeBottom(parseFloat(getComputedStyle(sheetRef.current).paddingBottom) || 0)
    }
  }, [viewportHeight])

  const sheetHeight = Math.min(
    Math.round(viewportHeight * FULL_VH),
    viewportHeight - TOP_BAR_CLEARANCE_PX,
  )
  const offsets: Record<Snap, number> = {
    collapsed: sheetHeight - collapsedPx - safeBottom,
    half: sheetHeight - Math.round(viewportHeight * halfVh),
    full: 0,
  }
  const targetY = offsets[snap]

  useEffect(() => {
    if (reduceMotion) y.set(targetY)
    else animate(y, targetY, { type: 'spring', stiffness: 400, damping: 40 })
  }, [targetY, reduceMotion, y])

  const [seenCheckpoint, setSeenCheckpoint] = useState(selectedCheckpoint)
  if (selectedCheckpoint !== seenCheckpoint) {
    setSeenCheckpoint(selectedCheckpoint)
    if (selectedCheckpoint && snap === 'collapsed') setSnap('half')
  }

  function settle(next: Snap) {
    setSnap(next)
    if (next === snap) y.set(offsets[next])
  }

  function handleDragEnd(_: unknown, info: { velocity: { y: number } }) {
    const projected = y.get() + info.velocity.y * FLICK_PROJECTION_S
    const nearest = SNAPS.reduce((best, candidate) =>
      Math.abs(offsets[candidate] - projected) < Math.abs(offsets[best] - projected)
        ? candidate
        : best,
    )
    settle(nearest)
  }

  const startDrag = (event: React.PointerEvent) => dragControls.start(event)

  function cycleSnap() {
    setSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length])
  }

  const route = plan.routes.find((r) => r.id === selectedRouteId) ?? plan.routes[0]
  const expanded = snap !== 'collapsed'

  return (
    <motion.div
      ref={sheetRef}
      className="mobile-sheet glass"
      data-snap={snap}
      style={{ y, height: sheetHeight }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: offsets.full, bottom: offsets.collapsed }}
      dragElastic={0.1}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <div className="mobile-sheet__head" onPointerDown={startDrag}>
        <button
          type="button"
          className="mobile-sheet__handle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse route details' : 'Expand route details'}
          onClick={cycleSnap}
        >
          <span className="mobile-sheet__grip" aria-hidden="true" />
        </button>
        <RouteHead plan={plan} route={route} onSelectRoute={onSelectRoute} />
      </div>

      <div className="mobile-sheet__body" onPointerDown={snap === 'full' ? undefined : startDrag}>
        <RouteBody
          plan={plan}
          trip={trip}
          route={route}
          showRecommendation={expanded}
          forecast={forecast}
          selectedCheckpoint={selectedCheckpoint}
          onSelectCheckpoint={onSelectCheckpoint}
        />
      </div>
    </motion.div>
  )
}

interface RoutePanelProps {
  plan: Plan
  trip: TripRequest
  selectedRouteId: string
  selectedCheckpoint: SelectedCheckpoint | null
  onSelectRoute: (id: string) => void
  onSelectCheckpoint: (selection: SelectedCheckpoint | null) => void
}

export function RoutePanel({
  plan,
  trip,
  selectedRouteId,
  selectedCheckpoint,
  onSelectRoute,
  onSelectCheckpoint,
}: RoutePanelProps) {
  const route = plan.routes.find((r) => r.id === selectedRouteId) ?? plan.routes[0]
  return (
    <aside className="route-panel" aria-label="Route details">
      <div className="mobile-sheet__head">
        <RouteHead plan={plan} route={route} onSelectRoute={onSelectRoute} />
      </div>
      <div className="mobile-sheet__body">
        <RouteBody
          plan={plan}
          trip={trip}
          route={route}
          showRecommendation
          selectedCheckpoint={selectedCheckpoint}
          onSelectCheckpoint={onSelectCheckpoint}
        />
      </div>
    </aside>
  )
}

function RouteHead({
  plan,
  route,
  onSelectRoute,
}: {
  plan: Plan
  route: Route
  onSelectRoute: (id: string) => void
}) {
  const colors = assignRouteColors(
    plan.routes.map((r) => r.id),
    plan.recommended_route_id,
  )
  const recommended = route.id === plan.recommended_route_id
  const noTravel = route.summary.miles_by_level.NO_TRAVEL > 0

  return (
    <>
      <div className="mobile-sheet__tabs" role="tablist" aria-label="Routes">
        {plan.routes.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === route.id}
            className="mobile-sheet__tab"
            style={{ '--route-color': cssVar(colors[r.id]) } as React.CSSProperties}
            onClick={() => onSelectRoute(r.id)}
          >
            Route {r.id}
            {r.id === plan.recommended_route_id && (
              <span className="mobile-sheet__dot" role="img" aria-label="Recommended" />
            )}
          </button>
        ))}
      </div>

      <div className="mobile-sheet__title">
        <strong>Route {route.id}</strong>
        <span className="num mobile-sheet__distance">{formatMiles(route.distance_mi)}</span>
        <span className="mobile-sheet__tags">
          {recommended && <span className="chip chip-accent">RECOMMENDED</span>}
          {noTravel && <span className="chip chip-notravel notravel-hatch">NO-TRAVEL ZONE</span>}
          {route.forced && <span className="chip chip-muted">GENERATED</span>}
        </span>
      </div>
      <RiskStrip checkpoints={route.checkpoints} />
    </>
  )
}

interface RouteBodyProps {
  plan: Plan
  trip: TripRequest
  route: Route
  showRecommendation: boolean
  forecast?: ReactNode
  selectedCheckpoint: SelectedCheckpoint | null
  onSelectCheckpoint: (selection: SelectedCheckpoint | null) => void
}

function RouteBody({
  plan,
  trip,
  route,
  showRecommendation,
  forecast,
  selectedCheckpoint,
  onSelectCheckpoint,
}: RouteBodyProps) {
  const severe = severePlusMiles(route.summary)
  const nextRisk = route.checkpoints.find((c) => c.mile > 0 && RISKY_LEVELS.includes(c.level))

  return (
    <>
      <CheckpointPicker
        plan={plan}
        routeId={route.id}
        selection={selectedCheckpoint}
        onSelectCheckpoint={onSelectCheckpoint}
      />

      {selectedCheckpoint && (
        <CheckpointPanel
          plan={plan}
          selection={selectedCheckpoint}
          loadLbs={trip.load_lbs}
          onClose={() => onSelectCheckpoint(null)}
        />
      )}

      <dl className="mobile-sheet__stats">
        <Stat label="Drive time" value={formatDuration(route.duration_s)} />
        <Stat
          label="Severe+ mi"
          value={String(Math.round(severe))}
          warn={severe > 0 ? '--risk-severe' : undefined}
        />
        <Stat label="Avg risk" value={formatAvgRisk(route.summary.avg_risk)} />
      </dl>

      {forecast}

      <p className={`mobile-sheet__alert${nextRisk ? '' : ' is-clear'}`} role="status">
        {nextRisk ? (
          <>
            Next risk: {LEVEL_LABEL[nextRisk.level]} at MP{' '}
            <span className="num">{Math.round(nextRisk.mile)}</span>, about{' '}
            <span className="num">{formatLocalTime(nextRisk)}</span>
          </>
        ) : (
          'Clear weather along the whole route'
        )}
      </p>

      {showRecommendation && !selectedCheckpoint && <Recommendation plan={plan} />}

      <Link to={detailPath(route.id, trip)} className="btn-primary btn-block">
        Route details
      </Link>
    </>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: string }) {
  return (
    <div className="mobile-sheet__stat">
      <dt className="label">{label}</dt>
      <dd className="num" style={warn ? { color: cssVar(warn) } : undefined}>
        {value}
      </dd>
    </div>
  )
}
