import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import RssFeedOutlinedIcon from '@mui/icons-material/RssFeedOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined'
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'

import {
  fetchAdminOverview,
  normalizeOverviewResponse,
  normalizeRange,
} from '../../services/adminOverviewService'
import { fetchAdminIncidentCounts } from '../../services/adminIncidentsService'

const EMPTY_OVERVIEW = normalizeOverviewResponse()
const EMPTY_TEXT = '\u2014'
const KPI_ICONS = {
  incidents: <BoltOutlinedIcon fontSize="inherit" className="icon-danger" />,
  pendingReview: <HourglassEmptyOutlinedIcon fontSize="inherit" className="icon-warning" />,
  aiConfidence: <PsychologyAltOutlinedIcon fontSize="inherit" className="icon-info" />,
  highRiskZones: <LocationOnOutlinedIcon fontSize="inherit" className="icon-danger" />,
  activeAlerts: <NotificationsActiveOutlinedIcon fontSize="inherit" className="icon-success" />,
  reportsPerMin: <RssFeedOutlinedIcon fontSize="inherit" className="icon-info" />,
}
const RANGE_TITLE_SUFFIX = {
  '1h': 'Last hour',
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

/** Direction of a trend string: 'up' | 'down' | 'stable'. */
function getTrendDirection(trend) {
  const value = String(trend || '').trim().toLowerCase()
  if (!value || value === 'stable' || value === 'live') return 'stable'
  if (value.startsWith('-')) return 'down'
  if (value.startsWith('+')) return 'up'
  return 'stable'
}

/** Treat trends like "0", "0%", "0.0", "+0", "-0.0" as no movement. */
function isZeroTrend(trend) {
  if (!trend) return true
  const numeric = String(trend).replace(/[^0-9.]/g, '')
  return numeric === '' || Number(numeric) === 0
}

/**
 * Map a trend direction + polarity to a tone class.
 *   polarity = 'negative-up' → up movement is bad (e.g. incidents, pending review)
 *   polarity = 'positive-up' → up movement is good (e.g. AI confidence)
 *   polarity = 'neutral'     → never tinted as good/bad
 */
function getTrendTone(trend, polarity = 'neutral') {
  if (isZeroTrend(trend)) return 'stable'
  const direction = getTrendDirection(trend)
  if (direction === 'stable') return 'stable'
  if (polarity === 'neutral') return 'stable'
  if (polarity === 'positive-up') return direction === 'up' ? 'good' : 'bad'
  return direction === 'up' ? 'bad' : 'good'
}

function formatTrendText(trend) {
  if (!trend) return EMPTY_TEXT
  const value = String(trend).trim()
  if (value.startsWith('+')) return `Up ${value.slice(1)}`
  if (value.startsWith('-')) return `Down ${value.slice(1)}`
  return value
}

const TREND_DIRECTION_ICON = {
  up: ArrowUpwardRoundedIcon,
  down: ArrowDownwardRoundedIcon,
  stable: RemoveRoundedIcon,
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

      {overview.highSeverityAlerts.map((alert) => (
        <div className="admin-high-bar" key={`${alert.type}-${alert.route}`}>
          <span className="high-dot"></span>
          <span className="high-text">{alert.text}</span>
          <button
            className="high-action"
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
          {(() => {
            const operationsKpis = [
              {
                key: 'incidents',
                label: `${RANGE_TITLE_SUFFIX[timeRange]} Incidents`,
                value: overview.kpis.incidents.value,
                trend: overview.kpis.incidents.trend,
                polarity: 'negative-up',
                iconKey: 'incidents',
                iconTone: 'danger',
              },
              {
                key: 'pendingReview',
                label: 'Pending Review',
                value: overview.kpis.pendingReview.value,
                trend: overview.kpis.pendingReview.trend,
                polarity: 'negative-up',
                iconKey: 'pendingReview',
                iconTone: 'warning',
              },
              {
                key: 'aiConfidence',
                label: 'AI Confidence',
                value: formatPercent(overview.kpis.aiConfidence.value),
                trend: overview.kpis.aiConfidence.trend,
                polarity: 'positive-up',
                iconKey: 'aiConfidence',
                iconTone: 'primary',
              },
              {
                key: 'highRiskZones',
                label: 'High Risk Zones',
                value: overview.kpis.highRiskZones.value,
                trend: overview.kpis.highRiskZones.trend,
                polarity: 'negative-up',
                iconKey: 'highRiskZones',
                iconTone: 'danger',
              },
              {
                key: 'activeAlerts',
                label: 'Active Alerts',
                value: overview.kpis.activeAlerts.value,
                trend: overview.kpis.activeAlerts.trend,
                polarity: 'neutral',
                iconKey: 'activeAlerts',
                iconTone: 'success',
              },
              {
                key: 'reportsPerMin',
                label: 'Reports/min',
                value: formatDecimal(overview.kpis.reportsPerMin.value),
                trend: overview.kpis.reportsPerMin.trend,
                polarity: 'neutral',
                iconKey: 'reportsPerMin',
                iconTone: 'info',
              },
            ]
            const spamKpis = [
              {
                key: 'suspectedSpam',
                label: 'Suspected Spam Reports',
                value: incidentCounts.suspicious,
                hint: 'Live admin queue count',
                icon: <FlagOutlinedIcon fontSize="inherit" className="icon-warning" />,
                iconTone: 'warning',
              },
              {
                key: 'pendingManualReview',
                label: 'Pending Manual Review',
                value: incidentCounts['pending-review'],
                hint: 'Spam-labelled, not yet reviewed',
                icon: <HourglassBottomOutlinedIcon fontSize="inherit" className="icon-warning" />,
                iconTone: 'warning',
              },
              {
                key: 'spamRate',
                label: 'Spam Rate',
                value: formatPercent(spamRate),
                hint: incidentCounts.all
                  ? `${incidentCounts.suspicious} of ${incidentCounts.all} reports`
                  : 'No reports yet',
                icon: <PercentOutlinedIcon fontSize="inherit" className="icon-info" />,
                iconTone: 'primary',
              },
            ]

            const renderTrend = (kpi) => {
              const tone = getTrendTone(kpi.trend, kpi.polarity)
              if (isZeroTrend(kpi.trend)) {
                return <span className="admin-kpi-trend stable">No change</span>
              }
              const direction = getTrendDirection(kpi.trend)
              const Icon = TREND_DIRECTION_ICON[direction] || RemoveRoundedIcon
              return (
                <span className={`admin-kpi-trend ${tone}`}>
                  <Icon sx={{ fontSize: 11 }} />
                  {formatTrendText(kpi.trend)}
                </span>
              )
            }

            return (
              <>
                <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {operationsKpis.map((kpi) => (
                    <div className="admin-kpi" key={kpi.key}>
                      <div className={`admin-kpi-icon ${kpi.iconTone}`}>{KPI_ICONS[kpi.iconKey]}</div>
                      <div className="admin-kpi-body">
                        <span className="admin-kpi-label">{kpi.label}</span>
                        <span className="admin-kpi-value">{kpi.value}</span>
                        {renderTrend(kpi)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="admin-kpi-section-label">Spam Triage</div>
                <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
                  {spamKpis.map((kpi) => (
                    <div className="admin-kpi" key={kpi.key}>
                      <div className={`admin-kpi-icon ${kpi.iconTone}`}>{kpi.icon}</div>
                      <div className="admin-kpi-body">
                        <span className="admin-kpi-label">{kpi.label}</span>
                        <span className="admin-kpi-value">{kpi.value}</span>
                        <span className="admin-kpi-trend stable">{kpi.hint}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}

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
                        <td style={{ fontSize: 11, color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap', minWidth: 150 }}>
                          <div>{incident.reviewVerdict || (incident.pendingSpamReview ? 'Awaiting review' : EMPTY_TEXT)}</div>
                          <div style={{ marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(incident.classifiedAt)}</div>
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
                  { label: 'High', pct: overview.severityDistribution.high, cls: 'danger' },
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
