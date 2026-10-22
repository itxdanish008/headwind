import { Link } from 'react-router-dom'
import BrandLink from '../components/BrandLink'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import './NotFoundPage.css'

export default function NotFoundPage() {
  useDocumentTitle('Page not found - Headwind')
  return (
    <main className="not-found">
      <BrandLink />
      <h1 className="display not-found__title">This road does not exist.</h1>
      <p className="not-found__text">The page you asked for could not be found.</p>
      <Link to="/" className="btn-primary">
        Plan a trip
      </Link>
    </main>
  )
}
