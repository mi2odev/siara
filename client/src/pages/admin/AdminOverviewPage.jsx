import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  fetchAdminOverview,
  normalizeOverviewResponse,
  normalizeRange,
} from '../../services/adminOverviewService'
import { fetchAdminIncidentCounts } from '../../services/adminIncidentsService'

const EMPTY_OVERVIEW = normalizeOverviewResponse()
const EMPTY_TEXT = '\u2014'
const KPI_ICONS = {
  incidents: '\u26A1',
  pendingReview: '\u25F7',
  aiConfidence: '\u25C7',
  highRiskZones: '\u25C8',
  activeAlerts: '\u25B2',
  reportsPerMin: '\u25EB',
}
const RANGE_TITLE_SUFFIX = {
  '1h': 'Last hour',
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

function getTrendTone(trend) {
  const value = String(trend || '').trim().toLowerCase()

  if (!value || value === 'stable' || value === 'live' || value.startsWith('0')) {
    return 'stable'
  }

  if (value.startsWith('-')) {
    return 'down'
  }

  if (value.startsWith('+')) {
    return 'up'
  }

  return 'stable'
}

function formatTrendText(trend) {
  if (!trend) {
    return EMPTY_TEXT
  }

  const value = String(trend).trim()

  if (value.startsWith('+')) {
    return `Up ${value.slice(1)}`
  }

  if (value.startsWith('-')) {
    return `Down ${value.slice(1)}`
  }

  return value
}

function formatPercent(value, digits = 1) {
  return typeof value === 'number' ? `${value.toFixed(digits)}%` : EMPTY_TEXT
}

function formatDecimal(value) {
  return typeof value === 'number' ? value.toFixed(1) : EMPTY_TEXT
}

function formatDateTime(value) {
  if (!value) {
    return EMPTY_TEXT
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return EMPTY_TEXT
  }

  return date.toLocaleString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPredictedLabel(value) {
  if (!value) {
    return 'Unclassified'
  }

  return value === 'spam' ? 'Spam' : 'Real'
}

function formatMlStatus(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return 'Not started'
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getConfidenceFillClass(confidence) {
  if (typeof confidence !== 'number') {
    return ''
  }

  if (confidence >= 85) {
    return 'success'
  }

  if (confidence >= 65) {
    return 'warning'
  }

  return 'danger'
}

function getConfidenceText(incident) {
  if (typeof incident?.confidence === 'number' && incident?.confidenceStatus === 'completed') {
    return `${incident.confidence}%`
  }

  if (incident?.confidenceStatus === 'pending') {
    return 'Pending AI'
  }

  if (incident?.confidenceStatus === 'failed') {
    return 'AI failed'
  }

  return EMPTY_TEXT
}

export default function AdminOverviewPage() {
  const navigate = useNavigate()
  const [timeRange, setTimeRange] = useState('24h')
  const [overview, setOverview] = useState(EMPTY_OVERVIEW)
  const [incidentCounts, setIncidentCounts] = useState({
    all: 0,
    pending: 0,
    suspicious: 0,
    'pending-review': 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOverview() {
      setLoading(true)
      setError(null)

      try {
        const [nextOverview, nextIncidentCounts] = await Promise.all([
          fetchAdminOverview(timeRange, {
            signal: controller.signal,
          }),
          fetchAdminIncidentCounts({
            signal: controller.signal,
          }),
        ])

        if (!controller.signal.aborted) {
          setOverview(nextOverview)
          setIncidentCounts(nextIncidentCounts)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setHasResolvedInitialLoad(true)
        }
      }
    }

    loadOverview()

    return () => controller.abort()
  }, [reloadToken, timeRange])

  const maxWeeklyCount = Math.max(...overview.weeklyVolume.map((entry) => entry.count), 0)
  const reviewQueueCount = overview.reviewQueue.length
  const spamRate = useMemo(() => {
    if (!incidentCounts.all) {
      return null
    }

    return (incidentCounts.suspicious / incidentCounts.all) * 100
  }, [incidentCounts.all, incidentCounts.suspicious])

  const showInitialLoading = loading && !hasResolvedInitialLoad

  return (
    <>
      {error && (
        <div
          className="admin-card"
          style={{
            marginBottom: 14,
            borderColor: 'rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Overview unavailable</h2>
              <p className="admin-card-subtitle">
                {error.message || 'Failed to load the admin overview.'}
              </p>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {overview.criticalAlerts.map((alert) => (
        <div className="admin-critical-bar" key={`${alert.type}-${alert.route}`}>
          <span className="critical-dot"></span>
          <span className="critical-text">{alert.text}</span>
          <button
            className="critical-action"
            onClick={() => navigate(alert.route)}
          >
            {alert.action} &rarr;
          </button>
        </div>
      ))}

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Overview</h1>
          <p className="admin-page-subtitle">
            National Risk Supervision - Real-time
            {loading && hasResolvedInitialLoad ? <> &middot; Refreshing...</> : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            className="admin-select"
            value={timeRange}
            onChange={(event) => setTimeRange(normalizeRange(event.target.value))}
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button className="admin-btn admin-btn-ghost" type="button" onClick={() => navigate('/admin/incidents?filter=suspicious')}>
            Open Spam Queue
          </button>
        </div>
      </div>

      {showInitialLoading ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <h2 className="admin-card-title">Loading overview...</h2>
          <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
            Pulling real incident, AI, and spam-classification data from the backend.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            <div className="admin-kpi">
              <div className="admin-kpi-icon danger">{KPI_ICONS.incidents}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">{RANGE_TITLE_SUFFIX[timeRange]} Incidents</span>
                <span className="admin-kpi-value">{overview.kpis.incidents.value}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.incidents.trend)}`}>
                  {formatTrendText(overview.kpis.incidents.trend)}
                </span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon warning">{KPI_ICONS.pendingReview}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Pending Review</span>
                <span className="admin-kpi-value">{overview.kpis.pendingReview.value}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.pendingReview.trend)}`}>
                  {formatTrendText(overview.kpis.pendingReview.trend)}
                </span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon primary">{KPI_ICONS.aiConfidence}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">AI Confidence</span>
                <span className="admin-kpi-value">{formatPercent(overview.kpis.aiConfidence.value)}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.aiConfidence.trend)}`}>
                  {formatTrendText(overview.kpis.aiConfidence.trend)}
                </span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon danger">{KPI_ICONS.highRiskZones}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">High Risk Zones</span>
                <span className="admin-kpi-value">{overview.kpis.highRiskZones.value}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.highRiskZones.trend)}`}>
                  {formatTrendText(overview.kpis.highRiskZones.trend)}
                </span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon success">{KPI_ICONS.activeAlerts}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Active Alerts</span>
                <span className="admin-kpi-value">{overview.kpis.activeAlerts.value}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.activeAlerts.trend)}`}>
                  {formatTrendText(overview.kpis.activeAlerts.trend)}
                </span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon info">{KPI_ICONS.reportsPerMin}</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Reports/min</span>
                <span className="admin-kpi-value">{formatDecimal(overview.kpis.reportsPerMin.value)}</span>
                <span className={`admin-kpi-trend ${getTrendTone(overview.kpis.reportsPerMin.trend)}`}>
                  {formatTrendText(overview.kpis.reportsPerMin.trend)}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
            <div className="admin-kpi">
              <div className="admin-kpi-icon warning">⚑</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Suspected Spam Reports</span>
                <span className="admin-kpi-value">{incidentCounts.suspicious}</span>
                <span className="admin-kpi-trend stable">Live admin queue count</span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon warning">⌛</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Pending Manual Review</span>
                <span className="admin-kpi-value">{incidentCounts['pending-review']}</span>
                <span className="admin-kpi-trend stable">Spam-labelled, not yet reviewed</span>
              </div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-icon primary">%</div>
              <div className="admin-kpi-body">
                <span className="admin-kpi-label">Spam Rate</span>
                <span className="admin-kpi-value">{formatPercent(spamRate)}</span>
                <span className="admin-kpi-trend stable">
                  {incidentCounts.all ? `${incidentCounts.suspicious} of ${incidentCounts.all} reports` : 'No reports yet'}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-card" style={{ marginBottom: 14 }}>
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title">Review Queue</h2>
                <p className="admin-card-subtitle">
                  Pending and flagged incidents across all time &middot; {reviewQueueCount} open
                </p>
              </div>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => navigate('/admin/incidents?filter=pending-review')}
              >
                Review Spam Queue &rarr;
              </button>
            </div>
            <div className="admin-table-wrapper">
              {overview.reviewQueue.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Location</th>
                      <th>Severity</th>
                      <th>Spam Analysis</th>
                      <th>AI Confidence</th>
                      <th>Review</th>
                      <th>Since Reported</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.reviewQueue.map((incident) => (
                      <tr key={incident.reportId}>
                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {incident.displayId}
                        </td>
                        <td
                          style={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {incident.location}
                        </td>
                        <td>
                          <span className={`admin-pill ${incident.severity}`}>{incident.severity}</span>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: 4, minWidth: 170 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span className={`admin-pill ${incident.predictedLabel === 'spam' ? 'warning' : incident.predictedLabel === 'real' ? 'success' : ''}`}>
                                {formatPredictedLabel(incident.predictedLabel)}
                              </span>
                              <span className={`admin-pill ${incident.pendingSpamReview ? 'warning' : ''}`}>
                                {incident.pendingSpamReview ? 'Pending review' : formatMlStatus(incident.mlStatus)}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                              Score {formatPercent(incident.spamScore)} · ML {formatPercent(incident.mlConfidence)} · {incident.modelVersion || EMPTY_TEXT}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="admin-progress" style={{ width: 48 }}>
                              {typeof incident.confidence === 'number' ? (
                                <div
                                  className={`admin-progress-fill ${getConfidenceFillClass(incident.confidence)}`}
                                  style={{ width: `${incident.confidence}%` }}
                                ></div>
                              ) : null}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                fontVariantNumeric: incident.confidenceStatus === 'completed' ? 'tabular-nums' : 'normal',
                              }}
                            >
                              {getConfidenceText(incident)}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                          <div>{incident.reviewVerdict || (incident.pendingSpamReview ? 'Awaiting review' : EMPTY_TEXT)}</div>
                          <div style={{ marginTop: 4 }}>{formatDateTime(incident.classifiedAt)}</div>
                        </td>
                        <td
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 11.5,
                            color: incident.ago.includes('h')
                              ? 'var(--admin-warning)'
                              : 'var(--admin-text-secondary)',
                          }}
                        >
                          {incident.ago}
                        </td>
                        <td>
                          <button
                            className="admin-btn admin-btn-sm admin-btn-primary"
                            onClick={() => navigate(`/admin/incidents/${incident.reportId}`)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '18px 4px', color: 'var(--admin-text-muted)', fontSize: 11.5 }}>
                  No pending or flagged incidents are waiting in the review queue.
                </div>
              )}
            </div>
          </div>

          <div className="admin-grid-3">
            <div className="admin-card">
              <h3 className="admin-card-title">Weekly Incident Volume</h3>
              <div className="admin-chart-placeholder" style={{ height: 120 }}>
                {overview.weeklyVolume.map((entry) => {
                  const height = maxWeeklyCount > 0 ? (entry.count / maxWeeklyCount) * 100 : 0

                  return (
                    <div
                      key={entry.label}
                      className="admin-chart-bar"
                      style={{ height: `${height}%` }}
                      title={`${entry.label}: ${entry.count}`}
                    ></div>
                  )
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 9.5,
                  color: 'var(--admin-text-muted)',
                  padding: '0 2px',
                }}
              >
                {overview.weeklyVolume.map((day) => (
                  <span key={day.label}>{day.label}</span>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Severity Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { label: 'Critical / High', pct: overview.severityDistribution.high, cls: 'danger' },
                  { label: 'Medium', pct: overview.severityDistribution.medium, cls: 'warning' },
                  { label: 'Low', pct: overview.severityDistribution.low, cls: 'success' },
                ].map((segment) => (
                  <div key={segment.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--admin-text-secondary)' }}>{segment.label}</span>
                      <span style={{ fontWeight: 600 }}>{segment.pct}%</span>
                    </div>
                    <div className="admin-progress">
                      <div
                        className={`admin-progress-fill ${segment.cls}`}
                        style={{ width: `${segment.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Top Risk Zones</h3>
              {overview.topRiskZones.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {overview.topRiskZones.map((zone) => (
                    <div
                      key={zone.zone}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--admin-border)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--admin-text)' }}>
                          {zone.zone}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>
                          {zone.incidents} incidents
                        </div>
                      </div>
                      <span className={`admin-pill ${zone.risk}`}>{zone.risk}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 8 }}>
                  No zone activity was found for this time range.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
