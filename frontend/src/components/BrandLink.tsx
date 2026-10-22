import { Link } from 'react-router-dom'
import './BrandLink.css'

export default function BrandLink() {
  return (
    <Link to="/" className="brand-link" aria-label="Headwind home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="var(--logo-bg)" />
        <path
          d="M7 12 H22 a3 3 0 1 0 -3 -3"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path d="M7 18 H27" stroke="var(--text)" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M7 24 H19 a3 3 0 1 1 -3 3"
          fill="none"
          stroke="var(--time)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="brand-link__word display">Headwind</span>
    </Link>
  )
}
