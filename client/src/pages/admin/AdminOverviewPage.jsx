import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FancySelect from '../../components/ui/FancySelect'

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
const EMPTY_TEXT = '—'
const KPI_ICONS = {
  incidents: <BoltOutlinedIcon fontSize="inherit" className="icon-danger" />,
  pendingReview: <HourglassEmptyOutlinedIcon fontSize="inherit" className="icon-warning" />,
  aiConfidence: <PsychologyAltOutlinedIcon fontSize="inherit" className="icon-info" />,
  highRiskZones: <LocationOnOutlinedIcon fontSize="inherit" className="icon-danger" />,
  activeAlerts: <NotificationsActiveOutlinedIcon fontSize="inherit" className="icon-success" />,
  reportsPerMin: <RssFeedOutlinedIcon fontSize="inherit" className="icon-info" />,
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

function formatTrendText(trend, t) {
  if (!trend) return EMPTY_TEXT
  const value = String(trend).trim()
  if (value.startsWith('+')) return t('adminOverviewPage.trend.up', { value: value.slice(1) })
  if (value.startsWith('-')) return t('adminOverviewPage.trend.down', { value: value.slice(1) })
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

function formatPredictedLabel(value, t) {
  if (!value) {
    return t('adminOverviewPage.predictedLabel.unclassified')
  }

  return value === 'spam'
    ? t('adminOverviewPage.predictedLabel.spam')
    : t('adminOverviewPage.predictedLabel.real')
}

function formatMlStatus(value, t) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return t('adminOverviewPage.mlStatus.notStarted')
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

function getConfidenceText(incident, t) {
  if (typeof incident?.confidence === 'number' && incident?.confidenceStatus === 'completed') {
    return `${incident.confidence}%`
  }

  if (incident?.confidenceStatus === 'pending') {
    return t('adminOverviewPage.confidence.pending')
  }

  if (incident?.confidenceStatus === 'failed') {
    return t('adminOverviewPage.confidence.failed')
  }

  return EMPTY_TEXT
}

export default function AdminOverviewPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['admin', 'common'])
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

  const OVERVIEW_TIME_RANGE_OPTIONS = [
    { value: '1h',  label: t('adminOverviewPage.timeRange.lastHour') },
    { value: '24h', label: t('adminOverviewPage.timeRange.last24h') },
    { value: '7d',  label: t('adminOverviewPage.timeRange.last7days') },
    { value: '30d', label: t('adminOverviewPage.timeRange.last30days') },
  ]

  const RANGE_TITLE_SUFFIX = {
    '1h': t('adminOverviewPage.timeRange.lastHour'),
    '24h': t('adminOverviewPage.timeRange.last24h'),
    '7d': t('adminOverviewPage.timeRange.last7days'),
    '30d': t('adminOverviewPage.timeRange.last30days'),
  }

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
    <div className="admin-overview">
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
              <h2 className="admin-card-title">{t('adminOverviewPage.error.title')}</h2>
              <p className="admin-card-subtitle">
                {error.message || t('adminOverviewPage.error.description')}
              </p>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t('common:actions.retry')}
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
          <h1 className="admin-page-title">{t('adminOverviewPage.pageTitle')}</h1>
          <p className="admin-page-subtitle">
            {t('adminOverviewPage.pageSubtitle')}
            {loading && hasResolvedInitialLoad ? <> &middot; {t('adminOverviewPage.refreshing')}</> : null}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <FancySelect
            value={timeRange}
            onChange={(v) => setTimeRange(normalizeRange(v))}
            options={OVERVIEW_TIME_RANGE_OPTIONS}
            label={t('adminOverviewPage.rangeLabel')}
          />
          <button className="admin-btn admin-btn-ghost" type="button" onClick={() => navigate('/admin/incidents?filter=suspicious')}>
            {t('adminOverviewPage.openSpamQueue')}
          </button>
        </div>
      </div>

      {showInitialLoading ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <h2 className="admin-card-title">{t('adminOverviewPage.loading.title')}</h2>
          <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
            {t('adminOverviewPage.loading.description')}
          </p>
        </div>
      ) : (
        <>
          {(() => {
            const operationsKpis = [
              {
                key: 'incidents',
                label: t('adminOverviewPage.kpi.incidents', { range: RANGE_TITLE_SUFFIX[timeRange] }),
                value: overview.kpis.incidents.value,
                trend: overview.kpis.incidents.trend,
                polarity: 'negative-up',
                iconKey: 'incidents',
                iconTone: 'danger',
              },
              {
                key: 'pendingReview',
                label: t('adminOverviewPage.kpi.pendingReview'),
                value: overview.kpis.pendingReview.value,
                trend: overview.kpis.pendingReview.trend,
                polarity: 'negative-up',
                iconKey: 'pendingReview',
                iconTone: 'warning',
              },
              {
                key: 'aiConfidence',
                label: t('adminOverviewPage.kpi.aiConfidence'),
                value: formatPercent(overview.kpis.aiConfidence.value),
                trend: overview.kpis.aiConfidence.trend,
                polarity: 'positive-up',
                iconKey: 'aiConfidence',
                iconTone: 'primary',
              },
              {
                key: 'highRiskZones',
                label: t('adminOverviewPage.kpi.highRiskZones'),
                value: overview.kpis.highRiskZones.value,
                trend: overview.kpis.highRiskZones.trend,
                polarity: 'negative-up',
                iconKey: 'highRiskZones',
                iconTone: 'danger',
              },
              {
                key: 'activeAlerts',
                label: t('adminOverviewPage.kpi.activeAlerts'),
                value: overview.kpis.activeAlerts.value,
                trend: overview.kpis.activeAlerts.trend,
                polarity: 'neutral',
                iconKey: 'activeAlerts',
                iconTone: 'success',
              },
              {
                key: 'reportsPerMin',
                label: t('adminOverviewPage.kpi.reportsPerMin'),
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
                label: t('adminOverviewPage.spam.suspectedSpam'),
                value: incidentCounts.suspicious,
                hint: t('adminOverviewPage.spam.liveQueueCount'),
                icon: <FlagOutlinedIcon fontSize="inherit" className="icon-warning" />,
                iconTone: 'warning',
              },
              {
                key: 'pendingManualReview',
                label: t('adminOverviewPage.spam.pendingManualReview'),
                value: incidentCounts['pending-review'],
                hint: t('adminOverviewPage.spam.pendingManualReviewHint'),
                icon: <HourglassBottomOutlinedIcon fontSize="inherit" className="icon-warning" />,
                iconTone: 'warning',
              },
              {
                key: 'spamRate',
                label: t('adminOverviewPage.spam.spamRate'),
                value: formatPercent(spamRate),
                hint: incidentCounts.all
                  ? t('adminOverviewPage.spam.spamRateHint', { suspicious: incidentCounts.suspicious, all: incidentCounts.all })
                  : t('adminOverviewPage.spam.noReports'),
                icon: <PercentOutlinedIcon fontSize="inherit" className="icon-info" />,
                iconTone: 'primary',
              },
            ]

            const renderTrend = (kpi) => {
              const tone = getTrendTone(kpi.trend, kpi.polarity)
              if (isZeroTrend(kpi.trend)) {
                return <span className="admin-kpi-trend stable">{t('adminOverviewPage.trend.noChange')}</span>
              }
              const direction = getTrendDirection(kpi.trend)
              const Icon = TREND_DIRECTION_ICON[direction] || RemoveRoundedIcon
              return (
                <span className={`admin-kpi-trend ${tone}`}>
                  <Icon sx={{ fontSize: 11 }} />
                  {formatTrendText(kpi.trend, t)}
                </span>
              )
            }

            return (
              <>
                <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {operationsKpis.map((kpi) => (
                    <div className={`admin-kpi admin-kpi--${kpi.iconTone}`} key={kpi.key}>
                      <div className={`admin-kpi-icon ${kpi.iconTone}`}>{KPI_ICONS[kpi.iconKey]}</div>
                      <div className="admin-kpi-body">
                        <span className="admin-kpi-label">{kpi.label}</span>
                        <span className="admin-kpi-value">{kpi.value}</span>
                        {renderTrend(kpi)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="admin-kpi-section-label">{t('adminOverviewPage.spam.sectionLabel')}</div>
                <div className="admin-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
                  {spamKpis.map((kpi) => (
                    <div className={`admin-kpi admin-kpi--${kpi.iconTone}`} key={kpi.key}>
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
                <h2 className="admin-card-title">{t('adminOverviewPage.reviewQueue.title')}</h2>
                <p className="admin-card-subtitle">
                  {t('adminOverviewPage.reviewQueue.subtitle', { count: reviewQueueCount })}
                </p>
              </div>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => navigate('/admin/incidents?filter=pending-review')}
              >
                {t('adminOverviewPage.reviewQueue.openButton')} &rarr;
              </button>
            </div>
            <div className="admin-table-wrapper">
              {overview.reviewQueue.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('adminOverviewPage.table.id')}</th>
                      <th>{t('adminOverviewPage.table.location')}</th>
                      <th>{t('adminOverviewPage.table.severity')}</th>
                      <th>{t('adminOverviewPage.table.spamAnalysis')}</th>
                      <th>{t('adminOverviewPage.table.aiConfidence')}</th>
                      <th>{t('adminOverviewPage.table.review')}</th>
                      <th>{t('adminOverviewPage.table.sinceReported')}</th>
                      <th>{t('adminOverviewPage.table.action')}</th>
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
                                {formatPredictedLabel(incident.predictedLabel, t)}
                              </span>
                              <span className={`admin-pill ${incident.pendingSpamReview ? 'warning' : ''}`}>
                                {incident.pendingSpamReview ? t('adminOverviewPage.table.pendingReview') : formatMlStatus(incident.mlStatus, t)}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                              {t('adminOverviewPage.table.scoreRow', { score: formatPercent(incident.spamScore), ml: formatPercent(incident.mlConfidence), version: incident.modelVersion || EMPTY_TEXT })}
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
                              {getConfidenceText(incident, t)}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap', minWidth: 150 }}>
                          <div>{incident.reviewVerdict || (incident.pendingSpamReview ? t('adminOverviewPage.table.awaitingReview') : EMPTY_TEXT)}</div>
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
                            {t('adminOverviewPage.table.reviewButton')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '18px 4px', color: 'var(--admin-text-muted)', fontSize: 11.5 }}>
                  {t('adminOverviewPage.reviewQueue.empty')}
                </div>
              )}
            </div>
          </div>

          <div className="admin-grid-3">
            <div className="admin-card">
              <h3 className="admin-card-title">{t('adminOverviewPage.charts.weeklyVolume')}</h3>
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
              <h3 className="admin-card-title">{t('adminOverviewPage.charts.severityDistribution')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { label: t('adminOverviewPage.severity.high'), pct: overview.severityDistribution.high, cls: 'danger' },
                  { label: t('adminOverviewPage.severity.medium'), pct: overview.severityDistribution.medium, cls: 'warning' },
                  { label: t('adminOverviewPage.severity.low'), pct: overview.severityDistribution.low, cls: 'success' },
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
              <h3 className="admin-card-title">{t('adminOverviewPage.charts.topRiskZones')}</h3>
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
                          {t('adminOverviewPage.charts.zoneIncidents', { count: zone.incidents })}
                        </div>
                      </div>
                      <span className={`admin-pill ${zone.risk}`}>{zone.risk}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 8 }}>
                  {t('adminOverviewPage.charts.noZoneActivity')}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
