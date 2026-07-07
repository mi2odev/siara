import React from 'react'
import i18n from '../../i18n/index.js'

/**
 * Route-level error boundary. Unlike the top-level AppErrorBoundary (which shows
 * a raw stack for developers when the whole tree dies), this isolates a crash to
 * a single routed panel: the surrounding shell (nav, header, sidebar) stays
 * alive and the user gets a friendly recovery card instead of a blank region.
 *
 * Pass `resetKey` (typically the current pathname) so navigating away
 * auto-clears the error and the next page renders normally.
 */
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, lastResetKey: props.resetKey }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    // When the caller's resetKey changes (e.g. the route changed), drop any
    // captured error so the freshly-mounted route is given a clean slate.
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary] uncaught error', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const homePath = this.props.homePath || '/home'

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          textAlign: 'center',
          padding: '40px 24px',
          margin: '24px auto',
          maxWidth: '520px',
          borderRadius: '16px',
          // Self-contained surface so it stays legible over any page theme.
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          color: '#1f2937',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            fontSize: '32px',
            lineHeight: 1,
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#f3e8ff',
          }}
        >
          ⚠️
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
          {i18n.t('pages:routeErrorBoundary.heading')}
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>
          {i18n.t('pages:routeErrorBoundary.body')}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {i18n.t('pages:routeErrorBoundary.tryAgain')}
          </button>
          <a
            href={homePath}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {i18n.t('pages:routeErrorBoundary.goHome')}
          </a>
        </div>
      </div>
    )
  }
}
