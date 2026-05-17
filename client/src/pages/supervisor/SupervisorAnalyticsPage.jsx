import React, { useCallback, useEffect, useState } from 'react'
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
  if (!trend || trend.length === 0) {
    return <div className="sv-empty" style={{ padding: 24 }}><span className="sv-empty-icon"><TrendingUpOutlinedIcon fontSize="inherit" /></span>No trend data</div>
  }
  const max = Math.max(...trend.map((d) => d.count), 1)
  return (
    <div className="sv-trend-chart">
      {trend.map((point) => (
        <div key={point.date} className="sv-trend-bar-wrap" title={`${point.date}: ${point.count} incidents`}>
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
const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  verified: 'Verified',
  dispatched: 'Dispatched',
  resolved: 'Resolved',
  rejected: 'Rejected',
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
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const metrics = data?.responseMetrics || {}
  const byStatus = data?.incidentsByStatus || {}
  const bySeverity = data?.incidentsBySeverity || {}
  const zones = data?.busiestZones || []
  const workload = data?.officerWorkload || []
  const trend = data?.trendByDay || []

  const statusData = STATUS_ORDER.map((s) => ({
    label: STATUS_LABELS[s] || s,
    count: byStatus[s] || 0,
    colorClass: STATUS_COLOR[s] || '',
  })).filter((d) => d.count > 0)

  const severityData = ['high', 'medium', 'low'].map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    count: bySeverity[s] || 0,
    colorClass: `fill-${s}`,
  })).filter((d) => d.count > 0)

  return (
    <PoliceShell activeKey="operational-analytics" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Supervisor — Strategic</span>
            <h1 className="sv-page-title">Operational Analytics</h1>
            <p className="sv-page-subtitle">
              Incident resolution statistics, officer workload, and response metrics
            </p>
          </div>
          <div className="sv-page-actions">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                className={`sv-filter-btn ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading} aria-label="Refresh"><RefreshRoundedIcon fontSize="small" /></button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* KPI Cards */}
        <div className="sv-kpi-bar">
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">Total Incidents</div>
            <div className="sv-kpi-value">{loading ? '—' : metrics.totalIncidents ?? 0}</div>
            <div className="sv-kpi-sub">Last {days} days</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">Resolution Rate</div>
            <div className="sv-kpi-value" style={{ fontSize: 24 }}>
              {loading ? '—' : `${metrics.resolutionRate ?? 0}%`}
            </div>
            <div className="sv-kpi-sub">{metrics.resolvedIncidents ?? 0} resolved</div>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <div className="sv-kpi-label">Avg Response Time</div>
            <div className="sv-kpi-value" style={{ fontSize: 22 }}>
              {loading ? '—' : formatDuration(metrics.avgResponseTimeMs)}
            </div>
            <div className="sv-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Report <ArrowRightAltRoundedIcon fontSize="inherit" /> verified</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">Avg Resolution</div>
            <div className="sv-kpi-value" style={{ fontSize: 22 }}>
              {loading ? '—' : formatDuration(metrics.avgResolutionTimeMs)}
            </div>
            <div className="sv-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Report <ArrowRightAltRoundedIcon fontSize="inherit" /> resolved</div>
          </div>
        </div>

        {loading ? (
          <div className="sv-loading" style={{ padding: 60 }}>
            <div className="sv-loading-spinner" />
            <span>Computing analytics...</span>
          </div>
        ) : (
          <>
            {/* Incident Trends + By Status */}
            <div className="sv-grid-2" style={{ marginBottom: 20 }}>
              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><TrendingUpOutlinedIcon fontSize="inherit" /></span>
                    Daily Trend — Last {days} Days
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
                    Incidents by Status
                  </h2>
                </div>
                <div className="sv-section-body">
                  {statusData.length === 0
                    ? <div className="sv-empty"><span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>No data</div>
                    : <BarChart data={statusData} />}
                </div>
              </div>
            </div>

            <div className="sv-grid-2" style={{ marginBottom: 20 }}>
              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><GpsFixedOutlinedIcon fontSize="inherit" /></span>
                    Incidents by Severity
                  </h2>
                </div>
                <div className="sv-section-body">
                  {severityData.length === 0
                    ? <div className="sv-empty"><span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>No data</div>
                    : <BarChart data={severityData} />}
                </div>
              </div>

              <div className="sv-section">
                <div className="sv-section-head">
                  <h2 className="sv-section-title">
                    <span className="sv-section-title-icon"><LocationOnOutlinedIcon fontSize="inherit" /></span>
                    Busiest Zones
                  </h2>
                </div>
                <div className="sv-section-body">
                  {zones.length === 0 ? (
                    <div className="sv-empty"><span className="sv-empty-icon"><MapOutlinedIcon fontSize="inherit" /></span>No zone data</div>
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
                  Officer Workload Distribution
                </h2>
              </div>
              <div className="sv-section-body">
                {workload.length === 0 ? (
                  <div className="sv-empty"><span className="sv-empty-icon"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>No workload data</div>
                ) : (
                  <div className="sv-table-wrap">
                    <table className="sv-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Officer</th>
                          <th>Active Incidents</th>
                          <th>Total Handled</th>
                          <th>Workload</th>
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
