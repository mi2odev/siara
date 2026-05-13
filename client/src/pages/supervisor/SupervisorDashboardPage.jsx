import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined'
import RssFeedOutlinedIcon from '@mui/icons-material/RssFeedOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'

import PoliceShell from '../../components/layout/PoliceShell'
import { AuthContext } from '../../contexts/AuthContext'
import { getSupervisorDashboard } from '../../services/policeService'
import '../../styles/SupervisorMode.css'

const AUTO_REFRESH_MS = 30_000

function formatRelative(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff} min ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms) || ms < 0) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return '<1 m'
  if (minutes < 60) return `${minutes} m`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} h`
}

function severityClass(sev) {
  if (sev === 'high' || sev >= 4) return 'sev-high'
  if (sev === 'medium' || sev === 3) return 'sev-medium'
  return 'sev-low'
}

function severityLabel(hint) {
  if (hint >= 4) return 'High'
  if (hint === 3) return 'Medium'
  return 'Low'
}

function activityLabel(actionType, officerName, reportTitle) {
  const officer = officerName || 'An officer'
  const report = reportTitle ? `"${reportTitle}"` : 'an incident'

  switch (actionType) {
    case 'verify_incident': return `${officer} verified ${report}`
    case 'reject_incident': return `${officer} rejected ${report}`
    case 'assign_self': return `${officer} assigned themselves to ${report}`
    case 'request_backup': return `${officer} requested backup for ${report}`
    case 'update_status': return `${officer} updated status on ${report}`
    case 'field_note': return `${officer} added a field note on ${report}`
    case 'mark_alert_read': return `${officer} acknowledged an alert`
    case 'manual_log_entry': return `${officer} logged a manual entry`
    case 'assign_officer': return `Supervisor assigned an officer to ${report}`
    default: return `${officer} performed an action`
  }
}

export default function SupervisorDashboardPage() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const load = useCallback(async () => {
    try {
      const result = await getSupervisorDashboard()
      setData(result)
      setLastRefreshed(new Date())
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  const stats = data?.stats || {}
  const officerStatus = data?.officerStatus || {}
  const highSeverityIncidents = data?.highSeverityIncidents || []
  const recentActivity = data?.recentActivity || []

  return (
    <PoliceShell activeKey="supervisor-dashboard" rightPanelCollapsed>
      <div className="supervisor-page">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Command Overview</span>
            <h1 className="sv-page-title">Supervisor Dashboard</h1>
            <p className="sv-page-subtitle">
              Real-time operational status &middot;{' '}
              {lastRefreshed ? `Updated ${formatRelative(lastRefreshed)}` : 'Loading...'}
            </p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost" onClick={load} disabled={loading}>
              <RefreshRoundedIcon fontSize="inherit" /> Refresh
            </button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 20 }}>{error}</div>}

        {/* KPI Bar */}
        <div className="sv-kpi-bar">
          <div className="sv-kpi-card kpi-primary">
            <div className="sv-kpi-label">Active Incidents</div>
            <div className="sv-kpi-value">{loading ? '—' : stats.activeIncidents ?? 0}</div>
            <div className="sv-kpi-sub">Unresolved in system</div>
          </div>
          <div className="sv-kpi-card kpi-high">
            <div className="sv-kpi-label">High</div>
            <div className="sv-kpi-value">{loading ? '—' : stats.highSeverityIncidents ?? 0}</div>
            <div className="sv-kpi-sub">Severity high</div>
          </div>
          <div className="sv-kpi-card kpi-warning">
            <div className="sv-kpi-label">Pending Verification</div>
            <div className="sv-kpi-value">{loading ? '—' : stats.pendingVerification ?? 0}</div>
            <div className="sv-kpi-sub">Awaiting officer action</div>
          </div>
          <div className="sv-kpi-card kpi-good">
            <div className="sv-kpi-label">Active Officers</div>
            <div className="sv-kpi-value">{loading ? '—' : stats.activeOfficers ?? 0}</div>
            <div className="sv-kpi-sub">Currently on duty</div>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <div className="sv-kpi-label">Avg Response</div>
            <div className="sv-kpi-value" style={{ fontSize: 22 }}>
              {loading ? '—' : formatDuration(stats.avgResponseTimeMs)}
            </div>
            <div className="sv-kpi-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Report <ArrowRightAltRoundedIcon fontSize="inherit" /> verified (30d)</div>
          </div>
        </div>

        <div className="sv-grid-2">
          {/* High-Severity Incidents */}
          <div className="sv-section">
            <div className="sv-section-head">
              <h2 className="sv-section-title">
                <span className="sv-section-title-icon"><FiberManualRecordIcon fontSize="inherit" className="icon-severity-high" /></span>
                High-Severity Incidents
              </h2>
              <button
                className="sv-btn sv-btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => navigate('/police/supervisor/coordination')}
              >
                Coordinate <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            </div>
            <div className="sv-section-body">
              {loading ? (
                <div className="sv-loading"><div className="sv-loading-spinner" /></div>
              ) : highSeverityIncidents.length === 0 ? (
                <div className="sv-empty">
                  <span className="sv-empty-icon"><CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" /></span>
                  No high-severity incidents
                </div>
              ) : (
                <div className="sv-incident-list">
                  {highSeverityIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="sv-incident-row"
                      onClick={() => navigate(`/police/incident/${inc.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={`sv-incident-severity-dot ${severityClass(inc.severityHint)}`} />
                      <div className="sv-incident-main">
                        <div className="sv-incident-title">{inc.title || inc.id?.slice(0, 8)}</div>
                        <div className="sv-incident-meta">
                          {inc.locationLabel || 'Unknown location'}
                          {inc.assignedOfficerName && ` · ${inc.assignedOfficerName}`}
                        </div>
                      </div>
                      <div className="sv-incident-right">
                        <span className={`sv-badge sv-badge-${inc.severityHint >= 3 ? 'high' : 'medium'}`}>
                          {severityLabel(inc.severityHint)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--sv-text-muted)' }}>
                          {formatRelative(inc.occurredAt || inc.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Officer Status + Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="sv-section">
              <div className="sv-section-head">
                <h2 className="sv-section-title">
                  <span className="sv-section-title-icon"><GroupsOutlinedIcon fontSize="inherit" /></span>
                  Officer Status
                </h2>
                <button
                  className="sv-btn sv-btn-ghost"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => navigate('/police/supervisor/officers')}
                >
                  Monitor <ArrowForwardRoundedIcon fontSize="inherit" />
                </button>
              </div>
              <div className="sv-section-body">
                {loading ? (
                  <div className="sv-loading"><div className="sv-loading-spinner" /></div>
                ) : (
                  <div className="sv-status-summary">
                    <div className="sv-status-item">
                      <div className="sv-status-dot on-duty" />
                      <div>
                        <div className="sv-status-count">{officerStatus.onDuty ?? 0}</div>
                        <div className="sv-status-label">On Duty</div>
                      </div>
                    </div>
                    <div className="sv-status-item">
                      <div className="sv-status-dot off-duty" />
                      <div>
                        <div className="sv-status-count">{officerStatus.offDuty ?? 0}</div>
                        <div className="sv-status-label">Off Duty</div>
                      </div>
                    </div>
                    <div className="sv-status-item">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sv-primary)', flexShrink: 0 }} />
                      <div>
                        <div className="sv-status-count">{officerStatus.total ?? 0}</div>
                        <div className="sv-status-label">Total Officers</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sv-section">
              <div className="sv-section-head">
                <h2 className="sv-section-title">
                  <span className="sv-section-title-icon"><BoltOutlinedIcon fontSize="inherit" /></span>
                  Quick Actions
                </h2>
              </div>
              <div className="sv-section-body">
                <div className="sv-quick-actions">
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/supervisor/coordination')}>
                    <span className="sv-quick-action-icon"><GpsFixedOutlinedIcon fontSize="inherit" /></span>
                    Incident Coordination
                  </button>
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/supervisor/officers')}>
                    <span className="sv-quick-action-icon"><GroupsOutlinedIcon fontSize="inherit" /></span>
                    Monitor Officers
                  </button>
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/supervisor/alerts')}>
                    <span className="sv-quick-action-icon"><CampaignOutlinedIcon fontSize="inherit" /></span>
                    Send Alert
                  </button>
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/supervisor/map')}>
                    <span className="sv-quick-action-icon"><MapOutlinedIcon fontSize="inherit" /></span>
                    Operations Map
                  </button>
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/supervisor/analytics')}>
                    <span className="sv-quick-action-icon"><InsightsOutlinedIcon fontSize="inherit" /></span>
                    Analytics
                  </button>
                  <button className="sv-quick-action-btn" onClick={() => navigate('/police/verification')}>
                    <span className="sv-quick-action-icon"><PendingActionsOutlinedIcon fontSize="inherit" /></span>
                    Verification Queue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="sv-section" style={{ marginTop: 20 }}>
          <div className="sv-section-head">
            <h2 className="sv-section-title">
              <span className="sv-section-title-icon"><RssFeedOutlinedIcon fontSize="inherit" /></span>
              Live Activity Feed
            </h2>
            <button
              className="sv-btn sv-btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => navigate('/police/history')}
            >
              Full History <ArrowForwardRoundedIcon fontSize="inherit" />
            </button>
          </div>
          <div className="sv-section-body">
            {loading ? (
              <div className="sv-loading"><div className="sv-loading-spinner" /></div>
            ) : recentActivity.length === 0 ? (
              <div className="sv-empty">
                <span className="sv-empty-icon"><AssignmentOutlinedIcon fontSize="inherit" /></span>
                No recent activity
              </div>
            ) : (
              <div className="sv-activity-feed">
                {recentActivity.map((item, idx) => (
                  <div key={idx} className="sv-activity-item">
                    <div className="sv-activity-dot" />
                    <div className="sv-activity-content">
                      <div className="sv-activity-text">
                        {activityLabel(item.actionType, item.officerName, item.reportTitle)}
                        {item.note && (
                          <span style={{ color: 'var(--sv-text-muted)' }}> — {item.note.slice(0, 60)}{item.note.length > 60 ? '...' : ''}</span>
                        )}
                      </div>
                      <div className="sv-activity-time">{formatRelative(item.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PoliceShell>
  )
}
