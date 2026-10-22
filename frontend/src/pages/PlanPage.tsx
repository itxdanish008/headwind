import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { INCOMPLETE_LINK } from '../lib/notice'
import { useCorridor } from '../api/corridor'
import { planPath, usePlan, useTripFromUrl } from '../api/plan'
import { shortPlaceName } from '../lib/format'
import { readStorage, writeStorage } from '../lib/storage'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import CheckpointPanel from '../components/CheckpointPanel'
import CheckpointPicker from '../components/CheckpointPicker'
import ForecastSlider from '../components/ForecastSlider'
import DecisionLadder from '../components/DecisionLadder'
import MobileSheet, { RoutePanel } from '../components/MobileSheet'
import PlanError from '../components/PlanError'
import Recommendation from '../components/Recommendation'
import RiskLegend from '../components/RiskLegend'
import RouteList, { RouteListSkeleton } from '../components/RouteList'
import RouteMap from '../components/RouteMap'
import SamplingScreen from '../components/SamplingScreen'
import TripBar from '../components/TripBar'
import { useMediaQuery } from '../lib/useMediaQuery'
import type { Plan, SelectedCheckpoint, TripRequest } from '../types'
import './PlanPage.css'

const SAMPLING_DELAY_MS = 350
const SAMPLING_DONE_MS = 700
const SLIDER_CLEARANCE_PX = 150
const MOBILE_SHEET_COLLAPSED_PX = 184
const MOBILE_SHEET_HALF_VH = 0.55
const MOBILE_MAP_BOTTOM_PADDING = MOBILE_SHEET_COLLAPSED_PX + 32

export default function PlanPage() {
  const trip = useTripFromUrl()
  if (!trip) return <Navigate to="/" replace state={{ notice: INCOMPLETE_LINK }} />
  return <PlanView key={tripKey(trip)} trip={trip} />
}

const tripKey = (trip: TripRequest) => planPath({ ...trip, interval_miles: 25 })

type SamplingPhase = 'hidden' | 'visible'

const routeStorageKey = (trip: TripRequest) => `headwind:route:${tripKey(trip)}`

interface MapToggleProps {
  label: string
  shown: boolean
  onToggle: () => void
  second?: boolean
  children: React.ReactNode
}

function MapToggle({ label, shown, onToggle, second, children }: MapToggleProps) {
  return (
    <button
      type="button"
      className={`plan-page__cp-toggle glass${second ? ' plan-page__cp-toggle--second' : ''}`}
      aria-pressed={shown}
      aria-label={label}
      onClick={onToggle}
    >
      {children}
    </button>
  )
}

function CheckpointsToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <MapToggle label="Checkpoints" shown={shown} onToggle={onToggle}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M3 14 8 7l4 5 5-8" />
        <circle cx="3" cy="14" r="1.6" />
        <circle cx="8" cy="7" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="17" cy="4" r="1.6" />
      </svg>
    </MapToggle>
  )
}

function HeatmapToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <MapToggle label="Heatmap" shown={shown} onToggle={onToggle} second>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" />
      </svg>
    </MapToggle>
  )
}

function PlanView({ trip }: { trip: TripRequest }) {
  const planQuery = usePlan(trip)
  useDocumentTitle(
    `${shortPlaceName(trip.origin)} to ${shortPlaceName(trip.destination)} - Headwind`,
  )
  const storageKey = routeStorageKey(trip)
  const [phase, setPhase] = useState<SamplingPhase>('hidden')
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(() =>
    readStorage(sessionStorage, storageKey),
  )
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<SelectedCheckpoint | null>(null)
  const [showCheckpoints, setShowCheckpoints] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const isSheet = useMediaQuery('(max-width: 767px) and (min-height: 500px)')
  const isLandscape = useMediaQuery('(max-height: 499px) and (max-width: 1099px)')

  const [lastPlan, setLastPlan] = useState<Plan | null>(null)
  if (planQuery.data && planQuery.data !== lastPlan) {
    setLastPlan(planQuery.data)
    setSelectedCheckpoint(null)
  }
  const plan = planQuery.data ?? lastPlan
  const loading = planQuery.isLoading && !plan
  const pending = planQuery.isFetching
  const loadingRef = useRef(loading)
  const corridorQuery = useCorridor(plan, trip.load_lbs)

  useEffect(() => {
    loadingRef.current = loading
    if (!loading) return
    const timer = window.setTimeout(() => {
      if (loadingRef.current) setPhase('visible')
    }, SAMPLING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (phase !== 'visible' || loading) return
    const timer = window.setTimeout(() => setPhase('hidden'), SAMPLING_DONE_MS)
    return () => window.clearTimeout(timer)
  }, [phase, loading])

  if (planQuery.isError) {
    return (
      <main className="plan-page plan-page--centered">
        <PlanError message={planQuery.error.message} onRetry={() => planQuery.refetch()} />
        <Link to="/" className="plan-page__change">
          Change trip
        </Link>
      </main>
    )
  }

  if (phase === 'visible') return <SamplingScreen trip={trip} done={!loading} />

  const activeRouteId = plan
    ? (plan.routes.find((r) => r.id === selectedRouteId)?.id ?? plan.recommended_route_id)
    : null

  const activeRoute = plan?.routes.find((route) => route.id === activeRouteId) ?? null
  const corridor = corridorQuery.data ?? null
  const forecastSlider =
    plan && activeRoute ? (
      <ForecastSlider
        corridor={corridor}
        status={corridorQuery.isError ? 'error' : corridor ? 'ready' : 'loading'}
        route={activeRoute}
        departureUtc={plan.departure_utc}
        timeZone={plan.origin.timezone}
        onRetry={() => void corridorQuery.refetch()}
      />
    ) : null

  function selectRoute(id: string) {
    chooseRoute(id)
    if (selectedCheckpoint?.routeId !== id) setSelectedCheckpoint(null)
  }

  function chooseRoute(id: string) {
    setSelectedRouteId(id)
    writeStorage(sessionStorage, storageKey, id)
  }

  function selectCheckpoint(selection: SelectedCheckpoint | null) {
    setSelectedCheckpoint(selection)
    if (selection) chooseRoute(selection.routeId)
  }

  const heading = (
    <h1 className="sr-only">
      Weather-aware routes from {shortPlaceName(trip.origin)} to {shortPlaceName(trip.destination)}
    </h1>
  )
  const toggleCheckpoints = () => setShowCheckpoints((shown) => !shown)
  const toggleHeatmap = () => setShowHeatmap((shown) => !shown)

  if (isSheet) {
    return (
      <main
        className="plan-page plan-page--compact plan-page--mobile"
        style={{ '--sheet-collapsed': `${MOBILE_SHEET_COLLAPSED_PX}px` } as React.CSSProperties}
      >
        {heading}
        <RouteMap
          plan={plan}
          pending={pending}
          selectedRouteId={activeRouteId}
          hoveredRouteId={null}
          selectedCheckpoint={selectedCheckpoint}
          showCheckpoints={showCheckpoints}
          corridor={corridor}
          showHeatmap={showHeatmap}
          bottomPadding={MOBILE_MAP_BOTTOM_PADDING}
          selectionBottomInset={Math.round(window.innerHeight * MOBILE_SHEET_HALF_VH) + 16}
          onSelectRoute={selectRoute}
          onSelectCheckpoint={selectCheckpoint}
        />
        <TripBar
          trip={trip}
          routeCount={plan?.routes.length ?? null}
          showCheckpoints={showCheckpoints}
          onToggleCheckpoints={toggleCheckpoints}
          showHeatmap={showHeatmap}
          onToggleHeatmap={toggleHeatmap}
        />
        <CheckpointsToggle shown={showCheckpoints} onToggle={toggleCheckpoints} />
        <HeatmapToggle shown={showHeatmap} onToggle={toggleHeatmap} />
        {plan && activeRouteId && (
          <MobileSheet
            plan={plan}
            trip={trip}
            selectedRouteId={activeRouteId}
            collapsedPx={MOBILE_SHEET_COLLAPSED_PX}
            halfVh={MOBILE_SHEET_HALF_VH}
            selectedCheckpoint={selectedCheckpoint}
            forecast={forecastSlider}
            onSelectRoute={selectRoute}
            onSelectCheckpoint={selectCheckpoint}
          />
        )}
      </main>
    )
  }

  if (isLandscape) {
    return (
      <div className="plan-page plan-page--compact plan-page--landscape">
        <TripBar
          trip={trip}
          routeCount={plan?.routes.length ?? null}
          showCheckpoints={showCheckpoints}
          onToggleCheckpoints={toggleCheckpoints}
          showHeatmap={showHeatmap}
          onToggleHeatmap={toggleHeatmap}
        />
        <div className="plan-page__split">
          <main className="plan-page__map">
            {heading}
            <RouteMap
              plan={plan}
              bottomPadding={SLIDER_CLEARANCE_PX}
              pending={pending}
              selectedRouteId={activeRouteId}
              hoveredRouteId={null}
              selectedCheckpoint={selectedCheckpoint}
              showCheckpoints={showCheckpoints}
              corridor={corridor}
              showHeatmap={showHeatmap}
              onSelectRoute={selectRoute}
              onSelectCheckpoint={selectCheckpoint}
            />
            <CheckpointsToggle shown={showCheckpoints} onToggle={toggleCheckpoints} />
            <HeatmapToggle shown={showHeatmap} onToggle={toggleHeatmap} />
            <div className="plan-page__slider">{forecastSlider}</div>
          </main>
          {plan && activeRouteId && (
            <RoutePanel
              plan={plan}
              trip={trip}
              selectedRouteId={activeRouteId}
              selectedCheckpoint={selectedCheckpoint}
              onSelectRoute={selectRoute}
              onSelectCheckpoint={selectCheckpoint}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <TripBar
        trip={trip}
        routeCount={plan?.routes.length ?? null}
        showCheckpoints={showCheckpoints}
        onToggleCheckpoints={toggleCheckpoints}
        showHeatmap={showHeatmap}
        onToggleHeatmap={toggleHeatmap}
      />
      <div className="plan-page__body">
        <section className="plan-page__routes" aria-label="Routes">
          {plan && activeRouteId ? (
            <>
              <Recommendation plan={plan} />
              <RouteList
                plan={plan}
                selectedId={activeRouteId}
                onSelect={selectRoute}
                onHover={setHoveredRouteId}
              />
            </>
          ) : (
            <RouteListSkeleton />
          )}
        </section>

        <main className="plan-page__map">
          {heading}
          <RouteMap
            plan={plan}
            bottomPadding={SLIDER_CLEARANCE_PX}
            pending={pending}
            selectedRouteId={activeRouteId}
            hoveredRouteId={hoveredRouteId}
            selectedCheckpoint={selectedCheckpoint}
            showCheckpoints={showCheckpoints}
            corridor={corridor}
            showHeatmap={showHeatmap}
            onSelectRoute={selectRoute}
            onSelectCheckpoint={selectCheckpoint}
          />
          <RiskLegend />
          <div className="plan-page__slider">{forecastSlider}</div>
        </main>

        {plan && activeRouteId && (
          <aside className="plan-page__side" aria-label="Decision and checkpoint">
            <CheckpointPicker
              plan={plan}
              routeId={activeRouteId}
              selection={selectedCheckpoint}
              onSelectCheckpoint={selectCheckpoint}
            />
            <DecisionLadder plan={plan} trip={trip} selectedRouteId={activeRouteId} />
            {selectedCheckpoint ? (
              <CheckpointPanel
                plan={plan}
                selection={selectedCheckpoint}
                loadLbs={trip.load_lbs}
                onClose={() => setSelectedCheckpoint(null)}
              />
            ) : (
              <p className="plan-page__placeholder glass">
                Select a checkpoint on the map to see its forecast, arrival time and risk.
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
