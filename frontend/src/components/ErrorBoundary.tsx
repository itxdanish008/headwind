import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface State {
  failed: boolean
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="error-boundary" role="alert">
        <h1 className="display">Something went wrong.</h1>
        <p>The page hit an unexpected problem. Reloading usually fixes it.</p>
        <div className="error-boundary__actions">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/">Back to the start</a>
        </div>
      </main>
    )
  }
}
