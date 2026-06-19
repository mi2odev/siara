import React from 'react'

/**
 * Top-level error boundary. Without one, any uncaught render/commit error
 * unmounts the entire React tree under React 19 and the page goes blank.
 * This catches the error, keeps the app shell alive, and surfaces the actual
 * message + stack so failures are diagnosable instead of a white screen.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Keep the raw error in the console for stack traces / source maps.
    console.error('[AppErrorBoundary] uncaught error', error, info)
  }

  handleReset = () => {
    this.setState({ error: null, info: null })
  }

  render() {
    const { error, info } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        style={{
          padding: '24px',
          margin: '24px',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          background: '#fef2f2',
          color: '#7f1d1d',
          fontFamily: 'monospace',
          maxWidth: '900px',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Something crashed in the UI</h2>
        <p style={{ fontWeight: 'bold' }}>{String(error?.message || error)}</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', overflowX: 'auto' }}>
          {error?.stack}
        </pre>
        {info?.componentStack ? (
          <details open>
            <summary>Component stack</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              {info.componentStack}
            </pre>
          </details>
        ) : null}
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
}
