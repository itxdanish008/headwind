import './PlanError.css'

interface PlanErrorProps {
  message: string
  onRetry: () => void
}

export default function PlanError({ message, onRetry }: PlanErrorProps) {
  return (
    <div className="plan-error glass" role="alert">
      <h2 className="plan-error-title">Could not plan this trip</h2>
      <p className="plan-error-message">{message}</p>
      <button type="button" className="btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
