import { useLocation, useNavigate } from 'react-router-dom'
import { planPath } from '../api/plan'
import BrandLink from '../components/BrandLink'
import HighwayScene from '../components/HighwayScene'
import ThemeToggle from '../components/ThemeToggle'
import TripForm from '../components/TripForm'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  useDocumentTitle('Headwind - Weather-aware truck routing')
  return (
    <div className="home">
      <HighwayScene />
      <header className="home-bar">
        <BrandLink />
        <ThemeToggle />
      </header>
      <main className="home-main">
        <section className="home-hero">
          {notice && (
            <p role="status" className="home-notice">
              {notice}
            </p>
          )}
          <h1 className="home-title display">
            Drive the road the weather will let you <em>finish.</em>
          </h1>
          <p className="home-sub">
            Headwind samples the forecast at each checkpoint for the hour your truck will actually
            be there, then ranks three routes by weather risk and drive time.
          </p>
        </section>
        <div className="home-form">
          <TripForm pending={false} onSubmit={(trip) => navigate(planPath(trip))} />
        </div>
      </main>
      <footer className="home-foot">
        Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0). Routing
        and geocoding by HERE.
      </footer>
    </div>
  )
}
