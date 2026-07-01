import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import { getSupervisorPilotDashboard } from '../../services/policeService'
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

const SEVERITY_BADGE = { high: 'sv-badge-high', medium: 'sv-badge-medium', low: 'sv-badge-low' }

export default function SupervisorPilotDashboardPage() {
  const { t } = useTranslation(['supervisor', 'common'])
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)

  const logIntervention = (seg) => {
    navigate('/police/supervisor/interventions', {
      state: { prefillSegment: { roadSegmentId: seg.roadSegmentId, locationLabel: seg.road } },
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSupervisorPilotDashboard({ days })
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message || t('supervisorPilotDashboardPage.errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [days, t])

  useEffect(() => {
    load()
  }, [load])

  const segments = data?.segments || []
  const weather = data?.weatherContext || null
  const throughput = data?.throughput || null

  const CONFIDENCE_STYLE = {
    confirmed: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    likely: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
    unconfirmed: { color: 'var(--sv-text-muted)', bg: 'rgba(148,163,184,0.14)' },
  }

  const occLabel = (level) => {
    const key = String(level || '').trim().toLowerCase()
    if (['high', 'critical', 'extreme'].includes(key)) return t('supervisorPilotDashboardPage.occLevel.high')
    if (['medium', 'moderate'].includes(key)) return t('supervisorPilotDashboardPage.occLevel.medium')
    if (key === 'low') return t('supervisorPilotDashboardPage.occLevel.low')
    return '—'
  }

  return (
    <PoliceShell activeKey="pilot-dashboard" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">{t('supervisorPilotDashboardPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorPilotDashboardPage.title')}</h1>
            <p className="sv-page-subtitle">{t('supervisorPilotDashboardPage.subtitle')}</p>
          </div>
          <div className="sv-page-actions">
            {[7, 30, 90, 180].map((d) => (
              <button
                key={d}
                className={`sv-filter-btn ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {t('supervisorPilotDashboardPage.daysFilter', { count: d })}
              </button>
            ))}
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading} aria-label={t('common:actions.retry')}><RefreshRoundedIcon fontSize="small" /></button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* Beta disclaimer for occurrence risk */}
        <div className="sv-callout sv-callout-beta" style={{ marginBottom: 16 }}>
          <span className="sv-callout-icon"><ScienceOutlinedIcon fontSize="inherit" /></span>
          <div>
            <strong>{t('supervisorPilotDashboardPage.betaTitle')}</strong>
            <p>{t('supervisorPilotDashboardPage.betaBody')}</p>
          </div>
        </div>

        {/* Verification throughput — how much report volume is being confirmed,
            so the pilot reads as "alive" even when officer-verified counts are low. */}
        <div className="sv-kpi-bar" style={{ marginBottom: 20 }}>
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">{t('supervisorPilotDashboardPage.throughput.totalReports')}</div>
            <div className="sv-kpi-value">{loading ? '—' : throughput?.totalReports ?? 0}</div>
            <div className="sv-kpi-sub">{t('supervisorPilotDashboardPage.throughput.lastDays', { count: days })}</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">{t('supervisorPilotDashboardPage.throughput.verifiedRate')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 24 }}>
              {loading || throughput?.verifiedRatePct == null ? '—' : `${throughput.verifiedRatePct}%`}
            </div>
            <div className="sv-kpi-sub">{t('supervisorPilotDashboardPage.throughput.officerCount', { count: throughput?.officerVerified ?? 0 })}</div>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <div className="sv-kpi-label">{t('supervisorPilotDashboardPage.throughput.aiAssisted')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 24 }}>{loading ? '—' : throughput?.aiVerified ?? 0}</div>
            <div className="sv-kpi-sub">{t('supervisorPilotDashboardPage.throughput.aiSub')}</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">{t('supervisorPilotDashboardPage.throughput.pendingBacklog')}</div>
            <div className="sv-kpi-value" style={{ fontSize: 24 }}>{loading ? '—' : throughput?.pendingBacklog ?? 0}</div>
            <div className="sv-kpi-sub">{t('supervisorPilotDashboardPage.throughput.medianVerify', { value: formatDuration(throughput?.medianTimeToVerifyMs) })}</div>
          </div>
        </div>

        {/* Current weather context (single zone-centroid lookup) */}
        {weather && (
          <div className="sv-weather-strip" style={{ marginBottom: 20 }}>
            <span className="sv-weather-icon"><ThermostatOutlinedIcon fontSize="inherit" /></span>
            <span className="sv-weather-main">
              {weather.condition || t('supervisorPilotDashboardPage.weather.unknown')}
              {weather.temperatureC != null ? ` · ${weather.temperatureC}°C` : ''}
            </span>
            <span className="sv-weather-detail">
              {weather.windKmh != null ? t('supervisorPilotDashboardPage.weather.wind', { kmh: weather.windKmh }) : ''}
              {weather.visibilityKm != null ? ` · ${t('supervisorPilotDashboardPage.weather.visibility', { km: weather.visibilityKm })}` : ''}
              {weather.precipitationMm != null ? ` · ${t('supervisorPilotDashboardPage.weather.precip', { mm: weather.precipitationMm })}` : ''}
            </span>
            <span className="sv-weather-note">{t('supervisorPilotDashboardPage.weather.contextNote')}</span>
          </div>
        )}

        <div className="sv-section">
          <div className="sv-section-head">
            <h2 className="sv-section-title">
              <span className="sv-section-title-icon"><WarningAmberOutlinedIcon fontSize="inherit" /></span>
              {t('supervisorPilotDashboardPage.sections.topSegments', { count: days })}
            </h2>
          </div>
          <div className="sv-section-body">
            {loading ? (
              <div className="sv-loading" style={{ padding: 48 }}>
                <div className="sv-loading-spinner" />
                <span>{t('supervisorPilotDashboardPage.loading')}</span>
              </div>
            ) : segments.length === 0 ? (
              <div className="sv-empty"><span className="sv-empty-icon"><RouteOutlinedIcon fontSize="inherit" /></span>{t('supervisorPilotDashboardPage.empty')}</div>
            ) : (
              <div className="sv-table-wrap">
                <table className="sv-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('supervisorPilotDashboardPage.table.segment')}</th>
                      <th>{t('supervisorPilotDashboardPage.table.reports')}</th>
                      <th>{t('supervisorPilotDashboardPage.table.severity')}</th>
                      <th>{t('supervisorPilotDashboardPage.table.occurrenceRisk')}</th>
                      <th>{t('supervisorPilotDashboardPage.table.timeOfDay')}</th>
                      <th>{t('supervisorPilotDashboardPage.table.responseTime')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((seg, idx) => (
                      <tr key={seg.roadSegmentId}>
                        <td style={{ color: 'var(--sv-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>
                          {seg.road}
                          {seg.ref ? <span style={{ color: 'var(--sv-text-muted)', fontWeight: 400 }}> · {seg.ref}</span> : null}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span><strong>{seg.totalReports}</strong> <span style={{ color: 'var(--sv-text-muted)', fontSize: 11 }}>{t('supervisorPilotDashboardPage.table.reportsTotal')}</span></span>
                            <span
                              className="sv-badge"
                              style={{
                                color: (CONFIDENCE_STYLE[seg.confidence] || CONFIDENCE_STYLE.unconfirmed).color,
                                background: (CONFIDENCE_STYLE[seg.confidence] || CONFIDENCE_STYLE.unconfirmed).bg,
                              }}
                            >
                              {t(`supervisorPilotDashboardPage.confidence.${seg.confidence || 'unconfirmed'}`)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 11 }}>
                            {seg.verifiedReports > 0 && (
                              <span style={{ color: '#16a34a' }}>{t('supervisorPilotDashboardPage.breakdown.officer', { count: seg.verifiedReports })}</span>
                            )}
                            {seg.aiVerifiedReports > 0 && (
                              <span style={{ color: '#0ea5e9' }}>{t('supervisorPilotDashboardPage.breakdown.ai', { count: seg.aiVerifiedReports })}</span>
                            )}
                            {seg.pendingReports > 0 && (
                              <span style={{ color: 'var(--sv-text-muted)' }}>{t('supervisorPilotDashboardPage.breakdown.pending', { count: seg.pendingReports })}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`sv-badge ${SEVERITY_BADGE[seg.severity] || 'sv-badge-low'}`}>
                            {t(`supervisorPilotDashboardPage.severity.${seg.severity}`)}
                          </span>
                        </td>
                        <td>
                          {seg.occurrence
                            ? <span title={t('supervisorPilotDashboardPage.occBetaHint')}>{seg.occurrence.percent}% <span style={{ color: 'var(--sv-text-muted)', fontSize: 11 }}>({occLabel(seg.occurrence.level)})</span></span>
                            : <span style={{ color: 'var(--sv-text-muted)' }}>—</span>}
                        </td>
                        <td>
                          {seg.timeOfDay
                            ? t(`supervisorPilotDashboardPage.bands.${seg.timeOfDay}`)
                            : <span style={{ color: 'var(--sv-text-muted)' }}>—</span>}
                        </td>
                        <td>{formatDuration(seg.avgResponseTimeMs)}</td>
                        <td>
                          <button
                            className="sv-btn sv-btn-ghost"
                            style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}
                            onClick={() => logIntervention(seg)}
                            title={t('supervisorPilotDashboardPage.logIntervention')}
                          >
                            <BuildOutlinedIcon fontSize="small" /> {t('supervisorPilotDashboardPage.logIntervention')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PoliceShell>
  )
}
