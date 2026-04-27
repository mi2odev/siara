import React from 'react'
import { MapContainer, Pane, TileLayer } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'

import ReportMapMarker from '../../components/map/ReportMapMarker'

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ReportRoundedIcon from '@mui/icons-material/ReportRounded'
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded'
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded'
import PersonPinCircleOutlinedIcon from '@mui/icons-material/PersonPinCircleOutlined'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import NotificationImportantOutlinedIcon from '@mui/icons-material/NotificationImportantOutlined'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import RuleFolderOutlinedIcon from '@mui/icons-material/RuleFolderOutlined'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import {
  formatPoliceDateTime,
  getPoliceDashboard,
  listPoliceAlerts,
  syncPoliceBrowserLocation,
} from '../../services/policeService'

const AUTO_REFRESH_MS = 30_000

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatRelativeAge(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} d ago`
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  const minutes = Math.round(milliseconds / 60000)
  if (minutes < 1) return '<1 m'
  if (minutes < 60) return `${minutes} m`
  const hours = Math.round((minutes / 60) * 10) / 10
  if (hours < 24) return `${hours} h`
  const days = Math.round((hours / 24) * 10) / 10
  return `${days} d`
}

function computeAverageIncidentAge(incidents = []) {
  const ages = incidents
    .map((incident) => incident?.occurredAt || incident?.createdAt)
    .filter(Boolean)
    .map((value) => Date.now() - new Date(value).getTime())
    .filter((n) => Number.isFinite(n) && n >= 0)

  if (!ages.length) return null
  return ages.reduce((sum, n) => sum + n, 0) / ages.length
}

function SeverityBadgeIcon({ severity }) {
  const props = { fontSize: 'inherit' }
  if (severity === 'critical' || severity === 'high') return <PriorityHighRoundedIcon {...props} />
  if (severity === 'medium') return <ReportProblemOutlinedIcon {...props} />
  return <CheckCircleOutlinedIcon {...props} />
}

function ActivityIcon({ actionType }) {
  const props = { fontSize: 'inherit' }
  if (actionType === 'verify_incident') return <CheckCircleOutlinedIcon {...props} />
  if (actionType === 'reject_incident') return <ReportProblemOutlinedIcon {...props} />
  if (actionType === 'request_backup') return <NotificationImportantOutlinedIcon {...props} />
  if (actionType === 'assign_self') return <PersonPinCircleOutlinedIcon {...props} />
  if (actionType === 'mark_alert_read') return <NotificationImportantOutlinedIcon {...props} />
  return <FiberManualRecordRoundedIcon {...props} />
}

function activityActionLabel(actionType) {
  if (actionType === 'verify_incident') return 'Officer verified incident'
  if (actionType === 'reject_incident') return 'Officer rejected report'
  if (actionType === 'assign_self') return 'Officer assigned themselves'
  if (actionType === 'request_backup') return 'Backup requested'
  if (actionType === 'update_status') return 'Status updated'
  if (actionType === 'field_note') return 'Field note added'
  if (actionType === 'mark_alert_read') return 'Alert acknowledged'
  if (actionType === 'manual_log_entry') return 'Manual log entry'
  return displayLabel(actionType)
}

export default function PolicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { policeMe } = usePoliceAccess()
  const [dashboard, setDashboard] = React.useState(null)
  const [alerts, setAlerts] = React.useState([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(null)
  const [selectedMarkerId, setSelectedMarkerId] = React.useState(null)
  const [isFullMapOpen, setIsFullMapOpen] = React.useState(false)

  const activeView = searchParams.get('view') === 'active'

  React.useEffect(() => {
    if (!isFullMapOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setIsFullMapOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isFullMapOpen])

  const loadDashboard = React.useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true)
    setError('')

    try {
      await syncPoliceBrowserLocation().catch(() => null)
      const [nextDashboard, alertsResponse] = await Promise.all([
        getPoliceDashboard(),
        listPoliceAlerts({ page: 1, pageSize: 8 }).catch(() => ({ items: [] })),
      ])
      setDashboard(nextDashboard)
      setAlerts(Array.isArray(alertsResponse?.items) ? alertsResponse.items : [])
      setLastUpdatedAt(new Date().toISOString())
    } catch (loadError) {
      setError(loadError.message || 'Failed to load police dashboard.')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  React.useEffect(() => {
    if (activeView) return undefined
    const interval = setInterval(() => {
      loadDashboard({ silent: true })
    }, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [activeView, loadDashboard])

  const officer = dashboard?.officer || policeMe?.officer
  const workZone = dashboard?.workZone || policeMe?.workZone
  const activeIncidents = dashboard?.activeIncidents || []
  const nearbyIncidents = dashboard?.nearbyIncidents || []
  const myIncidents = dashboard?.myIncidents || []
  const recentHistory = dashboard?.recentHistory || []
  const stats = dashboard?.stats || {
    activeCount: 0,
    highPriorityCount: 0,
    pendingVerificationCount: 0,
    unreadAlertsCount: 0,
  }

  const mapMarkers = Array.isArray(dashboard?.mapMarkers)
    ? dashboard.mapMarkers.filter((item) => item?.lat != null && item?.lng != null)
    : []

  const criticalCount = activeIncidents.filter((item) => item.severity === 'critical').length
  const officerInitials = String(officer?.name || 'Officer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'OF'

  const avgAgeMs = computeAverageIncidentAge(activeIncidents)
  const avgResponseLabel = avgAgeMs == null ? '—' : formatDuration(avgAgeMs)

  const priorityIncidents = React.useMemo(
    () => activeIncidents
      .filter((item) => item.severity === 'critical' || item.severity === 'high')
      .slice(0, 3),
    [activeIncidents],
  )

  const mapReports = React.useMemo(() => {
    const incidentById = new Map()
    for (const list of [myIncidents, nearbyIncidents, activeIncidents]) {
      for (const incident of list) {
        incidentById.set(incident.id, incident)
      }
    }
    return mapMarkers.map((marker) => {
      const enriched = incidentById.get(marker.id)
      if (enriched) {
        return {
          ...enriched,
          locationLabel: enriched.locationLabel || enriched.locationText || 'Reported location',
        }
      }
      return {
        id: marker.id,
        location: { lat: marker.lat, lng: marker.lng },
        severity: marker.severity,
        title: marker.title || 'Incident',
        locationLabel: marker.locationLabel || 'Reported location',
        status: marker.status,
        incidentType: marker.incidentType || 'other',
        description: marker.description || '',
        media: Array.isArray(marker.media) ? marker.media : [],
        occurredAt: marker.occurredAt || marker.createdAt || null,
        createdAt: marker.createdAt || null,
      }
    })
  }, [activeIncidents, nearbyIncidents, myIncidents, mapMarkers])

  const recentIncidentsCompact = React.useMemo(
    () => activeIncidents.slice(0, 5),
    [activeIncidents],
  )

  const topAlerts = React.useMemo(() => alerts.slice(0, 4), [alerts])
  const activityFeedItems = React.useMemo(() => recentHistory.slice(0, 8), [recentHistory])

  const kpis = [
    {
      key: 'active',
      tone: 'blue',
      label: 'Active Incidents',
      value: stats.activeCount,
      hint: 'Open in zone',
      icon: <ReportRoundedIcon fontSize="inherit" />,
    },
    {
      key: 'critical',
      tone: 'red',
      label: 'Critical Incidents',
      value: criticalCount || stats.highPriorityCount || 0,
      hint: 'High severity now',
      icon: <LocalFireDepartmentRoundedIcon fontSize="inherit" />,
    },
    {
      key: 'pending',
      tone: 'amber',
      label: 'Pending Verification',
      value: stats.pendingVerificationCount,
      hint: 'Awaiting decision',
      icon: <HourglassBottomRoundedIcon fontSize="inherit" />,
    },
    {
      key: 'response',
      tone: 'teal',
      label: 'Avg Incident Age',
      value: avgResponseLabel,
      hint: 'Across active cases',
      icon: <SpeedRoundedIcon fontSize="inherit" />,
    },
  ]

  const quickActions = [
    {
      key: 'verification',
      label: 'Verification Queue',
      hint: 'Review pending reports',
      count: stats.pendingVerificationCount,
      icon: <VerifiedUserOutlinedIcon fontSize="inherit" />,
      tone: 'amber',
      path: '/police/verification',
    },
    {
      key: 'all',
      label: 'All Incidents',
      hint: 'Live active stream',
      count: stats.activeCount,
      icon: <ListAltRoundedIcon fontSize="inherit" />,
      tone: 'blue',
      path: '/police?view=active',
    },
    {
      key: 'mine',
      label: 'My Assigned',
      hint: 'Cases on me',
      count: myIncidents.length,
      icon: <PersonPinCircleOutlinedIcon fontSize="inherit" />,
      tone: 'violet',
      path: '/police/my-incidents',
    },
    {
      key: 'nearby',
      label: 'Nearby Incidents',
      hint: 'Within 5 km',
      count: nearbyIncidents.length,
      icon: <MyLocationRoundedIcon fontSize="inherit" />,
      tone: 'teal',
      path: '/police/nearby',
    },
  ]

  const mapCenter = mapMarkers[0]
    ? [mapMarkers[0].lat, mapMarkers[0].lng]
    : [36.7538, 3.0588]

  const focusMarker = (markerId) => {
    setSelectedMarkerId(markerId === selectedMarkerId ? null : markerId)
  }

  const rightPanel = (
    <>
      <section className="police-section police-dashboard-side-card">
        <div className="police-dashboard-side-header">
          <h2>Officer</h2>
          <span className={`police-dashboard-duty ${officer?.isOnDuty ? 'on' : 'off'}`}>
            <span className="police-dashboard-duty-dot" aria-hidden="true"></span>
            {officer?.isOnDuty ? 'On Duty' : 'Off Duty'}
          </span>
        </div>

        <div className="police-dashboard-officer-head">
          {officer?.avatarUrl ? (
            <img
              src={officer.avatarUrl}
              alt={officer?.name || 'Officer'}
              className="police-dashboard-officer-avatar-image"
            />
          ) : (
            <span className="police-dashboard-officer-avatar" aria-hidden="true">{officerInitials}</span>
          )}
          <div className="police-dashboard-officer-meta">
            <strong>{officer?.name || 'Officer'}</strong>
            <p className="police-meta">{officer?.rank || 'Police Officer'}</p>
          </div>
        </div>

        <div className="police-selected-details police-dashboard-side-details">
          <div className="police-selected-line"><span>Rank</span><strong>{officer?.rank || 'Police Officer'}</strong></div>
          <div className="police-selected-line"><span>Badge</span><strong>{officer?.badgeNumber || 'Pending'}</strong></div>
        </div>
      </section>

      <section className="police-section police-dashboard-side-card">
        <div className="police-dashboard-side-header">
          <h2>Work Zone</h2>
        </div>
        <div className="police-selected-details police-dashboard-side-details">
          <div className="police-selected-line"><span>Wilaya</span><strong>{workZone?.wilaya?.name || 'Not selected'}</strong></div>
          <div className="police-selected-line"><span>Commune</span><strong>{workZone?.commune?.name || 'Not selected'}</strong></div>
        </div>
      </section>
    </>
  )

  if (activeView) {
    return (
      <PoliceShell
        activeKey="active-incidents"
        rightPanel={rightPanel}
        notificationCount={stats.unreadAlertsCount}
        verificationPendingCount={stats.pendingVerificationCount}
        emergencyMode={stats.highPriorityCount >= 3}
      >
        <section className="police-section police-dashboard-overview">
          <div className="police-command-section-head police-dashboard-head">
            <div className="police-dashboard-head-text">
              <h2>Active Incidents Stream</h2>
              <p className="police-shortcuts-hint">
                Live active incident stream for your current police work zone.
              </p>
            </div>
            <button
              type="button"
              className="police-cc-btn-primary police-cc-refresh-pill"
              onClick={() => loadDashboard()}
              title="Refresh"
              aria-label="Refresh"
              disabled={isLoading}
            >
              <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </section>

        <section className="police-section police-dashboard-incidents-section">
          <div className="police-feed">
            {activeIncidents.slice(0, 30).map((incident) => (
              <article
                key={incident.id}
                className="police-stream-row police-dashboard-incident-card"
                data-severity={incident.severity}
              >
                <span className={`police-severity-strip ${incident.severity}`} aria-hidden="true"></span>
                <div className="police-stream-main">
                  <div className="police-dashboard-incident-id-row">
                    <div className="police-dashboard-incident-id-left">
                      <span className="police-stream-id">{incident.displayId}</span>
                      <span className={`police-badge ${incident.severity} police-dashboard-severity-badge`}>
                        <SeverityBadgeIcon severity={incident.severity} />
                        {displayLabel(incident.severity)}
                      </span>
                    </div>
                    <span className="police-dashboard-incident-timeline">
                      {formatRelativeAge(incident.occurredAt || incident.createdAt)}
                    </span>
                  </div>
                  <strong className="police-stream-title">{incident.title || 'Untitled incident'}</strong>
                  <p className="police-stream-description">{incident.description || 'No description provided.'}</p>
                  <div className="police-stream-meta-line police-dashboard-incident-meta">
                    <span className="police-dashboard-incident-chip">Location: {incident.locationText}</span>
                    <span className="police-dashboard-incident-chip">Status: {displayLabel(incident.status)}</span>
                  </div>
                </div>
                <div className="police-stream-actions">
                  <button
                    type="button"
                    className="police-cc-btn-primary"
                    onClick={() => navigate(`/police/incident/${incident.id}`)}
                  >
                    Open Case
                  </button>
                </div>
              </article>
            ))}

            {!isLoading && activeIncidents.length === 0 ? (
              <div className="police-empty-state" role="status">
                <div className="police-empty-icon" aria-hidden="true"><LocalPoliceOutlinedIcon fontSize="inherit" /></div>
                <h3>No active incidents</h3>
                <p>The current work zone has no active police incidents.</p>
              </div>
            ) : null}
          </div>
        </section>
      </PoliceShell>
    )
  }

  return (
    <PoliceShell
      activeKey="dashboard"
      rightPanel={rightPanel}
      notificationCount={stats.unreadAlertsCount}
      verificationPendingCount={stats.pendingVerificationCount}
      emergencyMode={stats.highPriorityCount >= 3}
    >
      <div className="police-cc">
        {/* Command bar */}
        <div className="police-cc-bar">
          <div className="police-cc-bar-left">
            <span className="police-cc-bar-pulse" aria-hidden="true"></span>
            <div>
              <h1 className="police-cc-title">Command Center</h1>
              <p className="police-cc-subtitle">
                Live operations for {workZone?.commune?.name || workZone?.wilaya?.name || 'your assigned zone'}
              </p>
            </div>
          </div>
          <div className="police-cc-bar-right">
            <span className="police-cc-sync">
              <span className="police-cc-sync-dot" aria-hidden="true"></span>
              Live · synced {lastUpdatedAt ? formatRelativeAge(lastUpdatedAt) : '…'}
            </span>
            <button
              type="button"
              className="police-cc-refresh"
              onClick={() => loadDashboard()}
              disabled={isLoading}
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
            >
              <RefreshRoundedIcon fontSize="inherit" className={isLoading ? 'is-spinning' : ''} />
            </button>
          </div>
        </div>

        {error ? <p className="police-history-feedback police-history-feedback-error">{error}</p> : null}

        {/* 1. KPI BAR */}
        <section className="police-cc-kpis" aria-label="Operational metrics">
          {kpis.map((kpi) => (
            <article key={kpi.key} className={`police-cc-kpi tone-${kpi.tone}`}>
              <div className="police-cc-kpi-icon" aria-hidden="true">{kpi.icon}</div>
              <div className="police-cc-kpi-body">
                <span className="police-cc-kpi-label">{kpi.label}</span>
                <strong className="police-cc-kpi-value">{kpi.value}</strong>
                <span className="police-cc-kpi-hint">{kpi.hint}</span>
              </div>
            </article>
          ))}
        </section>

        {/* 2. PRIORITY INCIDENTS */}
        <section className="police-cc-section police-cc-priority" aria-label="Priority incidents">
          <header className="police-cc-section-head">
            <div className="police-cc-section-title">
              <PriorityHighRoundedIcon fontSize="inherit" className="police-cc-section-icon critical" />
              <h2>Priority Incidents</h2>
              <span className="police-cc-section-count">{priorityIncidents.length}</span>
            </div>
            <button
              type="button"
              className="police-cc-section-link"
              onClick={() => navigate('/police?view=active')}
            >
              Open stream <ArrowForwardRoundedIcon fontSize="inherit" />
            </button>
          </header>

          {priorityIncidents.length === 0 ? (
            <div className="police-cc-empty">
              <CheckCircleOutlinedIcon fontSize="inherit" />
              <span>No high-severity incidents right now.</span>
            </div>
          ) : (
            <div className="police-cc-priority-grid">
              {priorityIncidents.map((incident) => (
                <article
                  key={incident.id}
                  className="police-cc-priority-card"
                  data-severity={incident.severity}
                >
                  <header className="police-cc-priority-head">
                    <span className="police-cc-priority-id">{incident.displayId}</span>
                    <span className={`police-badge ${incident.severity}`}>
                      <SeverityBadgeIcon severity={incident.severity} />
                      {displayLabel(incident.severity)}
                    </span>
                  </header>
                  <strong className="police-cc-priority-title">{incident.title || 'Untitled incident'}</strong>
                  <p className="police-cc-priority-location">
                    <MyLocationRoundedIcon fontSize="inherit" />
                    {incident.locationText || 'Unknown location'}
                  </p>
                  <p className="police-cc-priority-desc">
                    {incident.description || 'No description provided.'}
                  </p>
                  <footer className="police-cc-priority-foot">
                    <time>{formatRelativeAge(incident.occurredAt || incident.createdAt)}</time>
                    <div className="police-cc-priority-actions">
                      <button
                        type="button"
                        className="police-cc-btn-ghost"
                        onClick={() => navigate(`/police/incident/${incident.id}`)}
                      >
                        <VisibilityOutlinedIcon fontSize="inherit" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        className="police-cc-btn-primary"
                        onClick={() => navigate('/police/verification')}
                      >
                        <RuleFolderOutlinedIcon fontSize="inherit" />
                        <span>Start Review</span>
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Workspace: 3 + 4 + 5 + 6 + 7 */}
        <div className="police-cc-grid">
          {/* 3. MAP OVERVIEW */}
          <section className="police-cc-section police-cc-map" aria-label="Map overview">
            <header className="police-cc-section-head">
              <div className="police-cc-section-title">
                <MyLocationRoundedIcon fontSize="inherit" className="police-cc-section-icon blue" />
                <h2>Map Overview</h2>
                <span className="police-cc-section-count">{mapMarkers.length}</span>
              </div>
              <button
                type="button"
                className="police-cc-section-link police-cc-fullmap-btn"
                onClick={() => setIsFullMapOpen(true)}
                title="Open full map"
              >
                <OpenInFullRoundedIcon fontSize="inherit" />
                <span>Full Map</span>
              </button>
            </header>

            <div className="police-cc-map-shell">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="police-leaflet-map">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Pane name="police-cc-marker-layer" style={{ zIndex: 9999 }}>
                  {mapReports.map((report) => (
                    <ReportMapMarker
                      key={report.id}
                      report={report}
                      tooltipPane="police-cc-marker-layer"
                      onClick={(item) => {
                        focusMarker(item.id)
                        navigate(`/police/incident/${item.id}`)
                      }}
                    />
                  ))}
                </Pane>
              </MapContainer>

              {mapMarkers.length > 0 ? (
                <div className="police-cc-map-legend" aria-hidden="true">
                  <span className="police-cc-map-pill critical"><span className="dot" /> Critical</span>
                  <span className="police-cc-map-pill high"><span className="dot" /> High</span>
                  <span className="police-cc-map-pill medium"><span className="dot" /> Medium</span>
                  <span className="police-cc-map-pill low"><span className="dot" /> Low</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* 4. QUICK ACTIONS */}
          <section className="police-cc-section police-cc-quick" aria-label="Quick actions">
            <header className="police-cc-section-head">
              <div className="police-cc-section-title">
                <ListAltRoundedIcon fontSize="inherit" className="police-cc-section-icon blue" />
                <h2>Quick Actions</h2>
              </div>
            </header>
            <div className="police-cc-quick-grid">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`police-cc-quick-btn tone-${action.tone}`}
                  onClick={() => navigate(action.path)}
                >
                  <span className="police-cc-quick-icon">{action.icon}</span>
                  <span className="police-cc-quick-text">
                    <strong>{action.label}</strong>
                    <span>{action.hint}</span>
                  </span>
                  <span className="police-cc-quick-count">{action.count}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 5. ALERTS PANEL */}
          <section className="police-cc-section police-cc-alerts" aria-label="Important alerts">
            <header className="police-cc-section-head">
              <div className="police-cc-section-title">
                <NotificationImportantOutlinedIcon fontSize="inherit" className="police-cc-section-icon amber" />
                <h2>Alerts</h2>
                <span className="police-cc-section-count">{alerts.length}</span>
              </div>
              <button
                type="button"
                className="police-cc-section-link"
                onClick={() => navigate('/police/alerts')}
              >
                Open center <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            </header>

            {topAlerts.length === 0 ? (
              <div className="police-cc-empty">
                <CheckCircleOutlinedIcon fontSize="inherit" />
                <span>No active alerts.</span>
              </div>
            ) : (
              <ul className="police-cc-alerts-list">
                {topAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={`police-cc-alert-item severity-${alert.severity}`}
                    role={alert.relatedReportId ? 'button' : undefined}
                    tabIndex={alert.relatedReportId ? 0 : undefined}
                    onClick={() => {
                      if (alert.relatedReportId) navigate(`/police/incident/${alert.relatedReportId}`)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && alert.relatedReportId) {
                        navigate(`/police/incident/${alert.relatedReportId}`)
                      }
                    }}
                  >
                    <span className={`police-cc-alert-dot severity-${alert.severity}`} aria-hidden="true" />
                    <div className="police-cc-alert-body">
                      <strong>{alert.title || 'Alert'}</strong>
                      <span>{alert.locationLabel || displayLabel(alert.severity)}</span>
                    </div>
                    <span className={`police-badge ${alert.severity}`}>
                      <SeverityBadgeIcon severity={alert.severity} />
                      {displayLabel(alert.severity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 6. ACTIVITY FEED */}
          <section className="police-cc-section police-cc-activity" aria-label="Activity feed">
            <header className="police-cc-section-head">
              <div className="police-cc-section-title">
                <FiberManualRecordRoundedIcon fontSize="inherit" className="police-cc-section-icon teal" />
                <h2>Activity</h2>
              </div>
              <button
                type="button"
                className="police-cc-section-link"
                onClick={() => navigate('/police/history')}
              >
                Full history <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            </header>

            {activityFeedItems.length === 0 ? (
              <div className="police-cc-empty">
                <FiberManualRecordRoundedIcon fontSize="inherit" />
                <span>No activity yet.</span>
              </div>
            ) : (
              <ol className="police-cc-timeline">
                {activityFeedItems.map((entry) => (
                  <li key={entry.id} className="police-cc-timeline-item">
                    <span className="police-cc-timeline-dot" aria-hidden="true">
                      <ActivityIcon actionType={entry.actionType} />
                    </span>
                    <div className="police-cc-timeline-body">
                      <strong>{activityActionLabel(entry.actionType)}</strong>
                      <span>
                        {entry.officer?.name || 'Officer'}
                        {entry.reportId ? ` · ${entry.reportTitle || entry.reportId}` : ''}
                      </span>
                      <time dateTime={entry.createdAt || undefined}>
                        {formatRelativeAge(entry.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* 7. RECENT INCIDENTS (compact) */}
          <section className="police-cc-section police-cc-recent" aria-label="Recent incidents">
            <header className="police-cc-section-head">
              <div className="police-cc-section-title">
                <ReportRoundedIcon fontSize="inherit" className="police-cc-section-icon blue" />
                <h2>Recent Incidents</h2>
                <span className="police-cc-section-count">{recentIncidentsCompact.length}</span>
              </div>
              <button
                type="button"
                className="police-cc-section-link"
                onClick={() => navigate('/police?view=active')}
              >
                Stream <ArrowForwardRoundedIcon fontSize="inherit" />
              </button>
            </header>

            {recentIncidentsCompact.length === 0 ? (
              <div className="police-cc-empty">
                <LocalPoliceOutlinedIcon fontSize="inherit" />
                <span>No active incidents.</span>
              </div>
            ) : (
              <ul className="police-cc-recent-list">
                {recentIncidentsCompact.map((incident) => (
                  <li
                    key={incident.id}
                    className="police-cc-recent-item"
                    data-severity={incident.severity}
                  >
                    <span className={`police-cc-recent-strip ${incident.severity}`} aria-hidden="true" />
                    <div className="police-cc-recent-body">
                      <div className="police-cc-recent-top">
                        <strong>{incident.title || 'Untitled incident'}</strong>
                        <span className={`police-badge ${incident.severity}`}>
                          <SeverityBadgeIcon severity={incident.severity} />
                          {displayLabel(incident.severity)}
                        </span>
                      </div>
                      <span className="police-cc-recent-meta">
                        {incident.locationText || 'Unknown location'} · {displayLabel(incident.status)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="police-cc-btn-ghost police-cc-recent-btn"
                      onClick={() => navigate(`/police/incident/${incident.id}`)}
                      aria-label={`View incident ${incident.displayId}`}
                    >
                      <VisibilityOutlinedIcon fontSize="inherit" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {isFullMapOpen ? (
        <div
          className="police-cc-fullmap-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Full map"
          onClick={() => setIsFullMapOpen(false)}
        >
          <div
            className="police-cc-fullmap-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="police-cc-fullmap-head">
              <div className="police-cc-fullmap-title">
                <MyLocationRoundedIcon fontSize="inherit" className="police-cc-section-icon blue" />
                <div>
                  <h2>Operations Map</h2>
                  <span>{mapMarkers.length} marker{mapMarkers.length === 1 ? '' : 's'} · {workZone?.commune?.name || workZone?.wilaya?.name || 'assigned zone'}</span>
                </div>
              </div>
              <div className="police-cc-fullmap-legend">
                <span className="police-cc-map-pill critical"><span className="dot" /> Critical</span>
                <span className="police-cc-map-pill high"><span className="dot" /> High</span>
                <span className="police-cc-map-pill medium"><span className="dot" /> Medium</span>
                <span className="police-cc-map-pill low"><span className="dot" /> Low</span>
              </div>
              <button
                type="button"
                className="police-cc-fullmap-close"
                onClick={() => setIsFullMapOpen(false)}
                aria-label="Close full map"
                title="Close"
              >
                <CloseRoundedIcon fontSize="inherit" />
              </button>
            </header>

            <div className="police-cc-fullmap-body">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="police-leaflet-map">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Pane name="police-cc-fullmap-layer" style={{ zIndex: 9999 }}>
                  {mapReports.map((report) => (
                    <ReportMapMarker
                      key={`fullmap-${report.id}`}
                      report={report}
                      tooltipPane="police-cc-fullmap-layer"
                      onClick={(item) => navigate(`/police/incident/${item.id}`)}
                    />
                  ))}
                </Pane>
              </MapContainer>
            </div>
          </div>
        </div>
      ) : null}
    </PoliceShell>
  )
}
