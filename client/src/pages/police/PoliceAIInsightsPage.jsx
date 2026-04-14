import React, { useMemo } from 'react'

import PoliceShell from '../../components/layout/PoliceShell'
import { POLICE_ACTIVE_ALERTS, POLICE_INCIDENTS } from '../../data/policeMockData'

function severityOrder(value) {
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return 1
}

function displayStatus(value) {
  return String(value || '')
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function reliabilityTier(score) {
  const value = Number(score || 0)
  if (value >= 90) return 'high'
  if (value >= 70) return 'medium'
  return 'low'
}

export default function PoliceAIInsightsPage() {
  const incidents = useMemo(() => [...POLICE_INCIDENTS], [])

  const verificationPendingCount = useMemo(
    () => incidents.filter((item) => item.status === 'reported').length,
    [incidents],
  )

  const highPriority = useMemo(
    () => incidents.filter((item) => item.severity === 'high' && item.status !== 'resolved'),
    [incidents],
  )

  const criticalCount = highPriority.length

  const zoneScore = useMemo(() => {
    const scores = new Map()
    incidents.forEach((incident) => {
      scores.set(incident.zone, (scores.get(incident.zone) || 0) + severityOrder(incident.severity))
    })
    return [...scores.entries()].sort((left, right) => right[1] - left[1])
  }, [incidents])

  const topZone = zoneScore[0]?.[0] || 'N/A'

  const trendIncrease = useMemo(() => {
    const high = incidents.filter((item) => item.severity === 'high').length
    const active = incidents.filter((item) => item.status !== 'resolved').length
    return `${Math.max(0, high * 6 + active * 2)}%`
  }, [incidents])

  const peakTime = useMemo(() => {
    const hourBuckets = new Map()
    incidents.forEach((incident) => {
      const date = new Date(incident.occurredAt)
      const hour = Number.isNaN(date.getTime()) ? '17:00' : `${String(date.getHours()).padStart(2, '0')}:00`
      hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1)
    })

    return [...hourBuckets.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '17:00'
  }, [incidents])

  const reliabilityAverage = useMemo(() => {
    if (!incidents.length) return 0
    return Math.round(incidents.reduce((sum, item) => sum + Number(item.reliability || 0), 0) / incidents.length)
  }, [incidents])

  const responseAverage = useMemo(() => {
    if (!incidents.length) return 0
    return Math.round(incidents.reduce((sum, item) => sum + Number(item.responseMinutes || 0), 0) / incidents.length)
  }, [incidents])

  const reliabilityDistribution = useMemo(() => {
    const high = incidents.filter((item) => Number(item.reliability || 0) >= 90).length
    const medium = incidents.filter((item) => Number(item.reliability || 0) >= 70 && Number(item.reliability || 0) < 90).length
    const low = incidents.filter((item) => Number(item.reliability || 0) < 70).length
    return { high, medium, low }
  }, [incidents])

  const statusBreakdown = useMemo(() => ({
    reported: incidents.filter((item) => item.status === 'reported').length,
    underReview: incidents.filter((item) => item.status === 'under_review').length,
    verified: incidents.filter((item) => item.status === 'verified').length,
    dispatched: incidents.filter((item) => item.status === 'dispatched').length,
    resolved: incidents.filter((item) => item.status === 'resolved').length,
  }), [incidents])

  const confidenceScore = useMemo(() => {
    const weighted = (reliabilityDistribution.high * 3) + (reliabilityDistribution.medium * 2) + reliabilityDistribution.low
    const max = incidents.length * 3 || 1
    return Math.round((weighted / max) * 100)
  }, [incidents.length, reliabilityDistribution.high, reliabilityDistribution.low, reliabilityDistribution.medium])

  const recommendedActions = useMemo(() => {
    const actions = []
    if (statusBreakdown.reported > 0) {
      actions.push(`Prioritize ${statusBreakdown.reported} newly reported incident(s) for first review.`)
    }
    if (reliabilityDistribution.low > 0) {
      actions.push(`Cross-check ${reliabilityDistribution.low} low-reliability report(s) with nearby evidence.`)
    }
    if (criticalCount > 0) {
      actions.push(`Deploy proactive patrol focus around ${topZone} due to critical severity concentration.`)
    }
    if (responseAverage > 12) {
      actions.push('Average response time is elevated; shift one unit to high-pressure corridor.')
    }
    return actions.slice(0, 4)
  }, [criticalCount, reliabilityDistribution.low, responseAverage, statusBreakdown.reported, topZone])

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Context Snapshot</h2>
        <div className="police-selected-details">
          <div className="police-selected-line"><span>High-risk zone</span><strong>{topZone}</strong></div>
          <div className="police-selected-line"><span>Trend increase</span><strong>{trendIncrease}</strong></div>
          <div className="police-selected-line"><span>Peak time</span><strong>{peakTime} - 19:00</strong></div>
          <div className="police-selected-line"><span>Avg reliability</span><strong>{reliabilityAverage}%</strong></div>
          <div className="police-selected-line"><span>Model confidence</span><strong>{confidenceScore}%</strong></div>
        </div>
      </section>

      <section className="police-section">
        <h2>Active Alerts</h2>
        <ul className="police-list">
          {highPriority.slice(0, 5).map((incident) => (
            <li key={incident.id} className="police-alert-item">
              <span className="police-alert-severity high">HIGH</span>
              <span>{incident.type} - {incident.location}</span>
            </li>
          ))}
          {highPriority.length === 0 ? POLICE_ACTIVE_ALERTS.map((alert) => <li key={alert}>{alert}</li>) : null}
        </ul>
      </section>

      <section className="police-section">
        <h2>AI Notes</h2>
        <div className="police-insight-list">
          <div className="police-insight-item danger">Hot zone concentrated around <strong>{topZone}</strong>.</div>
          <div className="police-insight-item warning">Incident pressure rising by <strong>{trendIncrease}</strong> in recent window.</div>
          <div className="police-insight-item info">Operational peak expected around <strong>{peakTime} - 19:00</strong>.</div>
        </div>
      </section>

      <section className="police-section">
        <h2>Decision Support</h2>
        <ul className="police-list">
          {recommendedActions.map((item) => <li key={item}>{item}</li>)}
          {recommendedActions.length === 0 ? <li>No immediate recommendations.</li> : null}
        </ul>
      </section>
    </>
  )

  return (
    <PoliceShell
      activeKey="analytics"
      rightPanel={rightPanel}
      notificationCount={criticalCount}
      emergencyMode={criticalCount >= 3}
      verificationPendingCount={verificationPendingCount}
    >
      <section className="police-section">
        <h2>AI Insights</h2>
        <p className="police-shortcuts-hint">Actionable intelligence for quick policing decisions.</p>

        <div className="police-stats-grid">
          <div className="police-stat"><span>Critical Incidents</span><strong>{criticalCount}</strong><em className="trend-up">priority</em></div>
          <div className="police-stat"><span>High-risk Zone</span><strong>{topZone}</strong><em className="trend-stable">hotspot</em></div>
          <div className="police-stat"><span>Trend Increase</span><strong>{trendIncrease}</strong><em className="trend-up">rising</em></div>
          <div className="police-stat"><span>Reliability Avg</span><strong>{reliabilityAverage}%</strong><em className="trend-stable">confidence</em></div>
        </div>
      </section>

      <section className="police-section">
        <h2>Reliability and Response Analysis</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Value</th>
                <th>Operational Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Model confidence</td>
                <td>{confidenceScore}%</td>
                <td>{confidenceScore >= 75 ? 'High trust in automated prioritization.' : 'Use manual validation for borderline cases.'}</td>
              </tr>
              <tr>
                <td>Avg response time</td>
                <td>{responseAverage} min</td>
                <td>{responseAverage <= 10 ? 'Response target is healthy.' : 'Response target needs route or resource adjustment.'}</td>
              </tr>
              <tr>
                <td>High reliability reports</td>
                <td>{reliabilityDistribution.high}</td>
                <td>Fast-track verification and closure.</td>
              </tr>
              <tr>
                <td>Low reliability reports</td>
                <td>{reliabilityDistribution.low}</td>
                <td>Require additional evidence before dispatch decisions.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>Priority Incidents</h2>
        <div className="police-feed">
          {highPriority.slice(0, 3).map((incident) => (
            <article key={incident.id} className="police-stream-row" data-severity="high" data-reliability={reliabilityTier(incident.reliability)}>
              <span className="police-severity-strip high" aria-hidden="true"></span>
              <div className="police-stream-main">
                <div className="police-stream-headline">
                  <span className="police-badge high">HIGH</span>
                  <strong className="police-stream-title">{incident.location} - {incident.type}</strong>
                  <span className="police-stream-time">{incident.timeAgo}</span>
                </div>
                <div className="police-stream-meta-line">
                  <span className={`police-reliability ${reliabilityTier(incident.reliability)}`}>Reliability {incident.reliability}%</span>
                  <span className="police-status-label">Status: {displayStatus(incident.status)}</span>
                </div>
                <p className="police-stream-description">{incident.description}</p>
              </div>
            </article>
          ))}
          {highPriority.length === 0 ? <p className="police-meta">No critical incidents right now.</p> : null}
        </div>
      </section>

      <section className="police-section">
        <h2>Zone Risk Ranking</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Risk Score</th>
                <th>Suggested Focus</th>
              </tr>
            </thead>
            <tbody>
              {zoneScore.map(([zone, score]) => (
                <tr key={zone}>
                  <td>{zone}</td>
                  <td>{score}</td>
                  <td>{score >= 5 ? 'Immediate patrol' : score >= 3 ? 'Close monitoring' : 'Routine monitoring'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="police-section">
        <h2>Status Pressure</h2>
        <div className="police-stats-grid">
          <div className="police-stat"><span>Reported</span><strong>{statusBreakdown.reported}</strong><em className="trend-up">queue</em></div>
          <div className="police-stat"><span>Under Review</span><strong>{statusBreakdown.underReview}</strong><em className="trend-stable">processing</em></div>
          <div className="police-stat"><span>Verified</span><strong>{statusBreakdown.verified}</strong><em className="trend-stable">ready</em></div>
          <div className="police-stat"><span>Resolved</span><strong>{statusBreakdown.resolved}</strong><em className="trend-down">closed</em></div>
        </div>
      </section>
    </PoliceShell>
  )
}
