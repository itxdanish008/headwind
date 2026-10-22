import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTripFromUrl } from './api/plan'
import ErrorBoundary from './components/ErrorBoundary'
import PageLoading from './components/PageLoading'
import { INCOMPLETE_LINK } from './lib/notice'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'

const PlanPage = lazy(() => import('./map/setup').then(() => import('./pages/PlanPage')))
const DetailPage = lazy(() => import('./pages/DetailPage'))

function TripGate({ children }: { children: ReactNode }) {
  const trip = useTripFromUrl()
  if (!trip) return <Navigate to="/" replace state={{ notice: INCOMPLETE_LINK }} />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/routes/:from/:to"
            element={
              <TripGate>
                <PlanPage />
              </TripGate>
            }
          />
          <Route
            path="/routes/:from/:to/:route"
            element={
              <TripGate>
                <DetailPage />
              </TripGate>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
