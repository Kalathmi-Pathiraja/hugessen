import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class BenchmarkingErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Compensation Benchmarking module crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="p-6 bg-red-50 border border-red-200 rounded">
            <p className="font-semibold text-red-800 mb-1">Compensation Benchmarking hit an unexpected error</p>
            <p className="text-sm text-red-700">
              {this.state.error.message ?? 'Something went wrong rendering this module.'}
            </p>
            <p className="text-xs text-red-700/70 mt-2">
              The STIP and LTIP tabs are unaffected. Switch tabs above, or reload to try again.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 text-sm bg-white border border-red-200 rounded text-red-700 hover:bg-red-100 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
