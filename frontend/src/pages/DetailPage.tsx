import { Link, Navigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { detailPath, planPath, routeIdFromSlug, usePlan, useTripFromUrl } from '../api/plan'
import BrandLink from '../components/BrandLink'
import { INCOMPLETE_LINK } from '../lib/notice'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import CheckpointTable from '../components/CheckpointTable'
import HowItWon from '../components/HowItWon'
import PlanError from '../components/PlanError'
import RiskRibbonChart from '../components/RiskRibbonChart'
import RulesMatrix from '../components/RulesMatrix'
import ThemeToggle from '../components/ThemeToggle'
import { shortPlaceName } from '../lib/format'
import {
  formatAvgRisk,
  formatDuration,
  formatLocalDay,
  formatLocalTime,
  formatMiles,
} from '../lib/format'
import { severePlusMiles } from '../lib/routeNotes'
import type { Plan, Route, TripRequest } from '../types'
import './DetailPage.css'

const SECTION: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } },
}

const STAGGER: Variants = { shown: { transition: { staggerChildren: 0.07 } } }

function Footer() {
  return (
    <footer className="detail-footer">
      Weather data by{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo.com
      </a>{' '}
      (CC BY 4.0). Routing and geocoding by HERE.
    </footer>
  )
}

function Kpis({ route }: { route: Route }) {
  const last = route.checkpoints[route.checkpoints.length - 1]
  const { summary } = route
  const tiles = [
    { label: 'Drive time', value: formatDuration(route.duration_s) },
    { label: 'Distance', value: formatMiles(route.distance_mi) },
    {
      label: 'Arrival',
      value: last ? formatLocalTime(last) : '-',
      sub: last ? formatLocalDay(last.eta_local) : undefined,
    },
    { label: 'Severe+ miles', value: formatMiles(severePlusMiles(summary)) },
    { label: 'High miles', value: formatMiles(summary.miles_by_level.HIGH) },
    { label: 'Average risk', value: formatAvgRisk(summary.avg_risk), sub: 'out of 4' },
  ]
  return (
    <dl className="detail-kpis">
      {tiles.map((tile, i) => (
        <div key={tile.label} className={i === 0 ? 'detail-kpi detail-kpi-lead' : 'detail-kpi'}>
          <dt>{tile.label}</dt>
          <dd className="num">{tile.value}</dd>
          {tile.sub && <dd className="detail-kpi-sub">{tile.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}

function Header({ plan, route, trip }: { plan: Plan; route: Route; trip: TripRequest }) {
  return (
    <header className="detail-header">
      <BrandLink />
      <div className="detail-title-row">
        <Link to={planPath(trip)} className="detail-back" aria-label="Back to route overview">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M16 10 H4 M9 5 L4 10 L9 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="detail-title-block">
          <div className="detail-title-line">
            <h1 className="display detail-title">Route {route.id}</h1>
            {route.id === plan.recommended_route_id && (
              <span className="detail-chip">RECOMMENDED</span>
            )}
            {route.forced && <span className="detail-chip">GENERATED</span>}
          </div>
          <span className="detail-trip">
            {shortPlaceName(plan.origin.label)} {'->'} {shortPlaceName(plan.destination.label)}
          </span>
        </div>
        <ThemeToggle />
      </div>
      <nav className="detail-tabs" aria-label="Routes">
        {plan.routes.map((other) => (
          <Link
            key={other.id}
            to={detailPath(other.id, trip)}
            className="detail-tab"
            aria-current={other.id === route.id ? 'page' : undefined}
          >
            Route {other.id}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function DetailSkeleton() {
  return (
    <main className="detail-page" role="status" aria-busy="true">
      <span className="sr-only">Loading route details</span>
      <div className="detail-skeleton detail-skeleton-header" />
      <div className="detail-kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="detail-skeleton detail-skeleton-kpi" />
        ))}
      </div>
      <div className="detail-skeleton detail-skeleton-card" />
      <div className="detail-skeleton detail-skeleton-card" />
    </main>
  )
}

export default function DetailPage() {
  const letter = routeIdFromSlug(useParams().route)
  const trip = useTripFromUrl()
  const planQuery = usePlan(trip)
  const reduceMotion = useReducedMotion()
  useDocumentTitle(
    trip
      ? `Route ${letter ?? ''} - ${shortPlaceName(trip.origin)} to ${shortPlaceName(trip.destination)} - Headwind`
      : 'Headwind',
  )

  if (!trip) return <Navigate to="/" replace state={{ notice: INCOMPLETE_LINK }} />
  if (planQuery.isError) {
    return (
      <main className="detail-page">
        <PlanError message={planQuery.error.message} onRetry={() => void planQuery.refetch()} />
        <Link to="/" className="detail-home-link">
          Plan a different trip
        </Link>
      </main>
    )
  }
  const plan = planQuery.data
  if (!plan) return <DetailSkeleton />

  const route = plan.routes.find((r) => r.id === letter)
  if (!route) return <Navigate to={planPath(trip)} replace />

  const sections = [
    <Kpis key="kpis" route={route} />,
    <RiskRibbonChart key="ribbon" route={route} />,
    <HowItWon key="how" plan={plan} routeId={route.id} />,
    <RulesMatrix key="rules" loadLbs={trip.load_lbs} />,
    <CheckpointTable key="checkpoints" checkpoints={route.checkpoints} />,
  ]

  return (
    <motion.main
      className="detail-page"
      variants={STAGGER}
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
    >
      <motion.div variants={SECTION}>
        <Header plan={plan} route={route} trip={trip} />
      </motion.div>
      {sections.map((section) => (
        <motion.div
          key={section.key}
          variants={SECTION}
          className={section.key === 'kpis' ? undefined : 'glass detail-card'}
        >
          {section}
        </motion.div>
      ))}
      <Footer />
    </motion.main>
  )
}
