import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import { getSupervisorAnalytics } from '../../services/policeService'
import '../../styles/SupervisorMode.css'

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms) || ms < 0) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '<1 m'
  if (minutes < 60) return `${minutes} m`
  const hours = Math.round((minutes / 60) * 10) / 10
  if (hours < 24) return `${hours} h`
  return `${Math.round((hours / 24) * 10) / 10} d`
}

function BarChart({ data, colorClass = '' }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="sv-bar-chart">
      {data.map((item) => (
        <div key={item.label} className="sv-bar-row">
          <div className="sv-bar-label">{item.label}</div>
          <div className="sv-bar-track">
            <div
              className={`sv-bar-fill ${colorClass || item.colorClass || ''}`}
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
          <div className="sv-bar-count">{item.count}</div>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ trend }) {
  const { t } = useTranslation(['supervisor'])
  if (!trend || trend.length === 0) {
    return <div className="sv-empty" style={{ padding: 24 }}><span className="sv-empty-icon"><TrendingUpOutlinedIcon fontSize="inherit" /></span>{t('supervisorAnalyticsPage.noTrendData')}</div>
  }
  const max = Math.max(...trend.map((d) => d.count), 1)
  return (
    <div className="sv-trend-chart">
      {trend.map((point) => (
        <div key={point.date} className="sv-trend-bar-wrap" title={t('supervisorAnalyticsPage.trendBarTitle', { date: point.date, count: point.count })}>
          <div
            className="sv-trend-bar"
            style={{ height: `${Math.max(3, Math.round((point.count / max) * 100))}%` }}
          />
          <div className="sv-trend-date">
            {point.date ? point.date.slice(5) : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

const STATUS_ORDER = ['pending', 'under_review', 'verified', 'dispatched', 'resolved', 'rejected']
const STATUS_LABEL_KEYS = {
  pending: 'supervisorAnalyticsPage.status.pending',
  under_review: 'supervisorAnalyticsPage.status.underReview',
  verified: 'supervisorAnalyticsPage.status.verified',
  dispatched: 'supervisorAnalyticsPage.status.dispatched',
  resolved: 'supervisorAnalyticsPage.status.resolved',
  rejected: 'supervisorAnalyticsPage.status.rejected',
}
const STATUS_COLOR = {
  pending: 'fill-medium',
  under_review: 'fill-accent',
  verified: 'fill-low',
  dispatched: 'fill-accent',
  resolved: '',
  rejected: 'fill-high',
}

export default function SupervisorAnalyticsPage() {
  const { t } = useTranslation(['supervisor', 'common'])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSupervisorAnalytics({ days })
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message || t('supervisorAnalyticsPage.errorLoadAnalytics'))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const metrics = data?.responseMetrics || {}
  const impact = data?.impact || {}
  const byStatus = data?.incidentsByStatus || {}
  const bySeverity = data?.incidentsBySeverity || {}
  const zones = data?.busiestZones || []
  const workload = data?.officerWorkload || []
  const trend = data?.trendByDay || []

  const statusData = STATUS_ORDER.map((s) => ({
    label: STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s,
    count: byStatus[s] || 0,
    colorClass: STATUS_COLOR[s] || '',
  })).filter((d) => d.count > 0)

  const severityData = ['high', 'medium', 'low'].map((s) => ({
    label: t(`supervisorAnalyticsPage.severity.${s}`),
    count: bySeverity[s] || 0,
    colorClass: `fill-${s}`,
  })).filter((d) => d.count > 0)

  return (
    <PoliceShell activeKey="operational-analytics" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">{t('supervisorAnalyticsPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorAnalyticsPage.title')}</h1>
            <p className="sv-page-subtitle">
              {t('supervisorAnalyticsPage.subtitle')}
            </p>
          </div>
          <div className="sv-page-actions">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                className={`sv-filter-btn ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {t('supervisorAnalyticsPage.daysFilter', { count: d })}
              </button>
            ))}
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading} aria-label={t('common:actions.retry')}><RefreshRoundedIcon fontSize="small" /></button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* KPI Cards */}
        <div className="sv-kpi-bar">
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">{t('supervisorAnalyticsPage.kpi.totalIncidents')}</div>
            <div className="sv-kpi-value">{loading ? '—' : metrics.totalIncidents ?? 0}</div>
            <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.kpi.lastDays', { count: days })}</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">{t('supervisorAnalyticsPage.kpi.resolutionRate')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 24 }}>
              {loading ? '—' : `${metrics.resolutionRate ?? 0}%`}
            </div>
            <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.kpi.resolvedCount', { count: metrics.resolvedIncidents ?? 0 })}</div>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <div className="sv-kpi-label">{t('supervisorAnalyticsPage.kpi.avgResponseTime')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 22 }}>
              {loading ? '—' : formatDuration(metrics.avgResponseTimeMs)}
            </div>
            <div className="sv-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('supervisorAnalyticsPage.kpi.reportToVerified.before')} <ArrowRightAltRoundedIcon fontSize="inherit" /> {t('supervisorAnalyticsPage.kpi.reportToVerified.after')}</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">{t('supervisorAnalyticsPage.kpi.avgResolution')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 22 }}>
              {loading ? '—' : formatDuration(metrics.avgResolutionTimeMs)}
            </div>
            <div className="sv-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('supervisorAnalyticsPage.kpi.reportToResolved.before')} <ArrowRightAltRoundedIcon fontSize="inherit" /> {t('supervisorAnalyticsPage.kpi.reportToResolved.after')}</div>
          </div>
        </div>

        {loading ? (
          <div className="sv-loading" style={{ padding: 60 }}>
            <div className="sv-loading-spinner" />
            <span>{t('supervisorAnalyticsPage.computingAnalytics')}</span>
          </div>
        ) : (
          <>
            {/* Impact measurement */}
            <div className="sv-section" style={{ marginBottom: 20 }}>
              <div className="sv-section-head">
                <h2 className="sv-section-title">
                  <span className="sv-section-title-icon"><GpsFixedOutlinedIcon fontSize="inherit" /></span>
                  {t('supervisorAnalyticsPage.impact.title')}
                </h2>
                <span className="sv-section-hint">{t('supervisorAnalyticsPage.impact.hint')}</span>
              </div>
              <div className="sv-section-body">
                <div className="sv-kpi-bar">
                  <div className="sv-kpi-card kpi-good">
                    <div className="sv-kpi-label">{t('supervisorAnalyticsPage.impact.verifiedRate')}</div>
                    <div className="sv-kpi-value" style={{ fontSize: 24 }}>{impact.verifiedAlertRate ?? 0}%</div>
                    <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.impact.ofReports', { count: impact.verifiedAlerts ?? 0 })}</div>
                  </div>
                  <div className="sv-kpi-card kpi-warning">
                    <div className="sv-kpi-label">{t('supervisorAnalyticsPage.impact.falseRate')}</div>
                    <div className="sv-kpi-value" style={{ fontSize: 24 }}>{impact.falseAlertRate ?? 0}%</div>
                    <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.impact.rejectedCount', { count: impact.falseAlerts ?? 0 })}</div>
                  </div>
                  <div className="sv-kpi-card kpi-accent">
                    <div className="sv-kpi-label">{t('supervisorAnalyticsPage.impact.repeated')}</div>
                    <div className="sv-kpi-value" style={{ fontSize: 24 }}>{impact.repeatedReports ?? 0}</div>
                    <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.impact.repeatedSub', { pct: impact.repeatedReportRate ?? 0 })}</div>
                  </div>
                  <div className="sv-kpi-card kpi-primary">
                    <div className="sv-kpi-label">{t('supervisorAnalyticsPage.impact.resolved')}</div>
                    <div className="sv-kpi-value" style={{ fontSize: 24 }}>{impact.resolvedIncidents ?? 0}</div>
                    <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.impact.lastDays', { count: days })}</div>
                  </div>
                  <div className={`sv-kpi-card ${(impact.highRiskZones?.reductionPct ?? 0) >= 0 ? 'kpi-good' : 'kpi-warning'}`}>
                    <div className="sv-kpi-label">{t('supervisorAnalyticsPage.impact.highRiskZones')}</div>
                    <div className="sv-kpi-value" style={{ fontSize: 22 }}>
                      {impact.highRiskZones?.reductionPct == null
                        ? '—'
                        : `${impact.highRiskZones.reductionPct > 0 ? '↓' : impact.highRiskZones.reductionPct < 0 ? '↑' : ''} ${Math.abs(impact.highRiskZones.reductionPct)}%`}
                    </div>
                    <div className="sv-kpi-sub">{t('supervisorAnalyticsPage.impact.zonesNow', { current: impact.highRiskZones?.current ?? 0, previous: impact.highRiskZones?.previous ?? 0 })}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Incident Trends + By Status */}
            <div className="sv-grid-2" style={{ marginBottom: 20 }}>
              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><TrendingUpOutlinedIcon fontSize="inherit" /></span>
                    {t('supervisorAnalyticsPage.sections.dailyTrend', { count: days })}
                  </h2>
                </div>
                <div className="sv-section-body">
                  <TrendChart trend={trend} />
                </div>
              </div>

              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><BarChartOutlinedIcon fontSize="inherit" /></span>
                    {t('supervisorAnalyticsPage.sections.incidentsByStatus')}
                  </h2>
                </div>
                <div className="sv-section-body">
                  {statusData.length === 0
                    ? <div className="sv-empty"><span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>{t('supervisorAnalyticsPage.noData')}</div>
                    : <BarChart data={statusData} />}
                </div>
              </div>
            </div>

            <div className="sv-grid-2" style={{ marginBottom: 20 }}>
              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><GpsFixedOutlinedIcon fontSize="inherit" /></span>
                    {t('supervisorAnalyticsPage.sections.incidentsBySeverity')}
                  </h2>
                </div>
                <div className="sv-section-body">
                  {severityData.length === 0
                    ? <div className="sv-empty"><span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>{t('supervisorAnalyticsPage.noData')}</div>
                    : <BarChart data={severityData} />}
                </div>
              </div>

              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><LocationOnOutlinedIcon fontSize="inherit" /></span>
                    {t('supervisorAnalyticsPage.sections.busiestZones')}
                  </h2>
                </div>
                <div className="sv-section-body">
                  {zones.length === 0 ? (
                    <div className="sv-empty"><span className="sv-empty-icon"><MapOutlinedIcon fontSize="inherit" /></span>{t('supervisorAnalyticsPage.noZoneData')}</div>
                  ) : (
                    <div className="sv-bar-chart">
                      {zones.map((zone, idx) => {
                        const max = zones[0]?.count || 1
                        return (
                          <div key={zone.name + idx} className="sv-bar-row">
                            <div className="sv-bar-label" style={{ width: 110 }}>{zone.name}</div>
                            <div className="sv-bar-track">
                              <div
                                className="sv-bar-fill fill-accent"
                                style={{ width: `${Math.round((zone.count / max) * 100)}%` }}
                              />
                            </div>
                            <div className="sv-bar-count">{zone.count}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Officer Workload */}
            <div className="sv-section">
              <div className="sv-section-head">
                <h2 className="sv-section-title">
                  <span className="sv-section-title-icon"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>
                  {t('supervisorAnalyticsPage.sections.officerWorkload')}
                </h2>
              </div>
              <div className="sv-section-body">
                {workload.length === 0 ? (
                  <div className="sv-empty"><span className="sv-empty-icon"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>{t('supervisorAnalyticsPage.noWorkloadData')}</div>
                ) : (
                  <div className="sv-table-wrap">
                    <table className="sv-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t('supervisorAnalyticsPage.table.officer')}</th>
                          <th>{t('supervisorAnalyticsPage.table.activeIncidents')}</th>
                          <th>{t('supervisorAnalyticsPage.table.totalHandled')}</th>
                          <th>{t('supervisorAnalyticsPage.table.workload')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workload.map((off, idx) => {
                          const max = workload[0]?.activeIncidents || 1
                          const pct = max > 0 ? Math.round((off.activeIncidents / max) * 100) : 0
                          return (
                            <tr key={off.name + idx}>
                              <td style={{ color: 'var(--sv-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600 }}>{off.name}</td>
                              <td>
                                <span className={`sv-badge ${off.activeIncidents > 3 ? 'sv-badge-high' : off.activeIncidents > 1 ? 'sv-badge-medium' : 'sv-badge-low'}`}>
                                  {off.activeIncidents}
                                </span>
                              </td>
                              <td style={{ color: 'var(--sv-text-muted)' }}>{off.totalIncidents}</td>
                              <td style={{ width: 120 }}>
                                <div className="sv-bar-track" style={{ height: 6 }}>
                                  <div
                                    className={`sv-bar-fill ${off.activeIncidents > 3 ? 'fill-high' : 'fill-accent'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PoliceShell>
  )
}
