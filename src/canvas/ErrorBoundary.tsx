import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches render errors so a bug shows a message instead of a blank page.
 * A class component: React only exposes error boundaries through the class
 * lifecycle (getDerivedStateFromError / componentDidCatch).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full items-center justify-center bg-bg p-6 text-ink">
        <div className="max-w-lg rounded border border-warn-line bg-warn-bg p-4 text-sm text-warn-ink shadow">
          <p className="mb-2 font-medium">Something went wrong.</p>
          <p className="mb-3">Your work is saved in this browser. Reloading usually fixes it.</p>
          <pre className="mb-3 max-h-40 overflow-auto rounded bg-black/10 p-2 text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <button
            type="button"
            className="rounded border border-warn-line px-3 py-1 hover:bg-black/10"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
