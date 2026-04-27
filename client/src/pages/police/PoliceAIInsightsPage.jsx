import React from 'react'

import PoliceShell from '../../components/layout/PoliceShell'
import { getPoliceDashboard } from '../../services/policeService'

function groupCount(items, keySelector) {
  const counts = new Map()

  items.forEach((item) => {
    const key = keySelector(item)
    if (!key) {
      return
    }

    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

export default function PoliceAIInsightsPage() {
  const [dashboard, setDashboard] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let isCancelled = false

    async function loadDashboard() {
      setIsLoading(true)
      setError('')

      try {
        const response = await getPoliceDashboard()
        if (!isCancelled) {
          setDashboard(response)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message || 'Failed to load AI insights.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()
    return () => {
      isCancelled = true
    }
  }, [])

  const incidents = [
    ...(dashboard?.activeIncidents || []),
    ...(dashboard?.myIncidents || []),
  ]

  const topCommunes = groupCount(incidents, (item) => item.commune?.name)
  const statusBreakdown = groupCount(incidents, (item) => item.status)
  const sourceBreakdown = groupCount(incidents, (item) => item.sourceChannel || 'citizen')
  const topZone = topCommunes[0]?.[0] || 'N/A'
  const criticalCount = incidents.filter((item) => ['high', 'critical'].includes(item.severity)).length

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Context Snapshot</h2>
        <div className="police-selected-details">
          <div className="police-selected-line"><span>Top commune</span><strong>{topZone}</strong></div>
          <div className="police-selected-line"><span>High priority</span><strong>{criticalCount}</strong></div>
          <div className="police-selected-line"><span>Unread alerts</span><strong>{dashboard?.stats?.unreadAlertsCount || 0}</strong></div>
          <div className="police-selected-line"><span>Pending verification</span><strong>{dashboard?.stats?.pendingVerificationCount || 0}</strong></div>
        </div>
      </section>

      <section className="police-section">
        <h2>Decision Support</h2>
        <ul className="police-list">
          <li>Prioritize {dashboard?.stats?.pendingVerificationCount || 0} reports still pending verification.</li>
          <li>Focus field patrol coverage on {topZone} if incident pressure stays elevated.</li>
          <li>Review unread supervisor alerts before dispatching new field actions.</li>
        </ul>
      </section>
    </>
  )

  return (
    <PoliceShell
      activeKey="analytics"
      rightPanel={rightPanel}
      notificationCount={dashboard?.stats?.unreadAlertsCount || 0}
      verificationPendingCount={dashboard?.stats?.pendingVerificationCount || 0}
      emergencyMode={criticalCount >= 3}
    >
      <section className="police-section">
        <div className="police-command-section-head">
          <div>
            <h2>AI Insights</h2>
            <p className="police-shortcuts-hint">Lightweight operational analytics built from the live police contract.</p>
          </div>
        </div>

        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {isLoading ? <p className="police-meta">Loading AI insights...</p> : null}

        <div className="police-stats-grid">
          <div className="police-stat"><span>Active Incidents</span><strong>{dashboard?.stats?.activeCount || 0}</strong><em>Zone pressure</em></div>
          <div className="police-stat"><span>High Priority</span><strong>{dashboard?.stats?.highPriorityCount || 0}</strong><em>Escalation watch</em></div>
          <div className="police-stat"><span>Top Zone</span><strong>{topZone}</strong><em>Most incident volume</em></div>
          <div className="police-stat"><span>Nearby Results</span><strong>{dashboard?.nearbyIncidents?.length || 0}</strong><em>5 km radius</em></div>
        </div>
      </section>

      <section className="police-section">
        <h2>Status Pressure</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {statusBreakdown.map(([status, count]) => (
                <tr key={status}>
                  <td>{status.replace(/_/g, ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>Top Communes</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>Commune</th>
                <th>Incidents</th>
              </tr>
            </thead>
            <tbody>
              {topCommunes.map(([commune, count]) => (
                <tr key={commune}>
                  <td>{commune}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {!isLoading && topCommunes.length === 0 ? (
                <tr>
                  <td colSpan="2">No incident clustering data available yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>Source Channels</h2>
        <ul className="police-list">
          {sourceBreakdown.map(([source, count]) => (
            <li key={source}><strong>{source}</strong>: {count}</li>
          ))}
          {!isLoading && sourceBreakdown.length === 0 ? <li>No source-channel data available.</li> : null}
        </ul>
      </section>
    </PoliceShell>
  )
}
