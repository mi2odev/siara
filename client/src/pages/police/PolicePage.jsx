import React from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import {
  formatPoliceDateTime,
  getPoliceDashboard,
  syncPoliceBrowserLocation,
} from '../../services/policeService'

function severityColor(severity) {
  if (severity === 'critical') return '#991b1b'
  if (severity === 'high') return '#dc2626'
  if (severity === 'medium') return '#f59e0b'
  return '#16a34a'
}

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatIncidentCardTime(incident) {
  const value = incident?.occurredAt || incident?.createdAt || null
  return value ? formatPoliceDateTime(value, { includeYear: false }) : 'Unknown time'
}

function formatIncidentRelativeAge(incident) {
  const value = incident?.occurredAt || incident?.createdAt || null
  if (!value) {
    return 'Unknown time'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (diffMinutes < 60) {
    const minutes = Math.max(1, diffMinutes)
    return `${minutes} min ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

export default function PolicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { policeMe } = usePoliceAccess()
  const [dashboard, setDashboard] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(null)

  const activeView = searchParams.get('view') === 'active'

  const loadDashboard = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      await syncPoliceBrowserLocation().catch(() => null)
      const nextDashboard = await getPoliceDashboard()
      setDashboard(nextDashboard)
      setLastUpdatedAt(new Date().toISOString())
    } catch (loadError) {
      setError(loadError.message || 'Failed to load police dashboard.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

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

  const incidentsToShow = activeIncidents.slice(0, activeView ? 30 : 5)
  const criticalCount = activeIncidents.filter((item) => item.severity === 'critical').length
  const unassignedCount = activeIncidents.filter((item) => !item.assignedOfficer?.id).length
  const officerInitials = String(officer?.name || 'Officer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'OF'

  const mapCenter = mapMarkers[0]
    ? [mapMarkers[0].lat, mapMarkers[0].lng]
    : [36.7538, 3.0588]

  const rightPanel = (
    <>
      <section className="police-section police-dashboard-side-card">
        <h2>Officer</h2>
        <div className="police-dashboard-officer-head">
          <div className="police-dashboard-officer-meta">
            <strong>{officer?.name || 'Officer'}</strong>
            <p className="police-meta">{officer?.rank || 'Police Officer'}</p>
          </div>
          {officer?.avatarUrl ? (
            <img
              src={officer.avatarUrl}
              alt={officer?.name || 'Officer'}
              className="police-dashboard-officer-avatar-image"
            />
          ) : (
            <span className="police-dashboard-officer-avatar" aria-hidden="true">{officerInitials}</span>
          )}
        </div>

        <div className="police-selected-details police-dashboard-side-details">
          <div className="police-selected-line"><span>Name</span><strong>{officer?.name || 'Officer'}</strong></div>
          <div className="police-selected-line"><span>Rank</span><strong>{officer?.rank || 'Police Officer'}</strong></div>
          <div className="police-selected-line"><span>Badge</span><strong>{officer?.badgeNumber || 'Pending'}</strong></div>
          <div className="police-selected-line">
            <span>Status</span>
            <strong>
              <span className={`police-dashboard-duty ${officer?.isOnDuty ? 'on' : 'off'}`}>
                {officer?.isOnDuty ? 'On Duty' : 'Off Duty'}
              </span>
            </strong>
          </div>
        </div>
      </section>

      <section className="police-section police-dashboard-side-card">
        <h2>Work Zone</h2>
        <ul className="police-list police-dashboard-side-list">
          <li><strong>Wilaya:</strong> {workZone?.wilaya?.name || 'Not selected'}</li>
          <li><strong>Commune:</strong> {workZone?.commune?.name || 'Not selected'}</li>
          <li><strong>Unread alerts:</strong> {stats.unreadAlertsCount}</li>
          <li><strong>Pending verification:</strong> {stats.pendingVerificationCount}</li>
        </ul>
      </section>
    </>
  )

  return (
    <PoliceShell
      activeKey={activeView ? 'active-incidents' : 'dashboard'}
      rightPanel={rightPanel}
      notificationCount={stats.unreadAlertsCount}
      verificationPendingCount={stats.pendingVerificationCount}
      emergencyMode={stats.highPriorityCount >= 3}
    >
      <section className="police-section police-dashboard-overview">
        <div className="police-command-section-head police-dashboard-head">
          <div>
            <h2>{activeView ? 'Active Incidents' : 'Police Dashboard'}</h2>
            <p className="police-shortcuts-hint">
              {activeView
                ? 'Live active incident stream for your current police work zone.'
                : `Live operations summary for ${workZone?.commune?.name || workZone?.wilaya?.name || 'your assigned zone'}.`}
            </p>
          </div>
          <div className="police-dashboard-head-actions">
            <div className="police-dashboard-sync">
              <span>Last sync</span>
              <strong>{lastUpdatedAt ? formatPoliceDateTime(lastUpdatedAt) : 'Pending'}</strong>
            </div>
            <button type="button" className="police-action police-action-secondary police-dashboard-refresh" onClick={loadDashboard}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="police-meta police-dashboard-feedback police-dashboard-feedback-error">{error}</p> : null}
        {isLoading ? <p className="police-meta police-dashboard-feedback">Loading dashboard...</p> : null}

        {!activeView ? (
          <div className="police-stats-grid police-dashboard-stats">
            <div className="police-stat police-dashboard-stat"><span>Active Incidents</span><strong>{stats.activeCount}</strong><em>Open in assigned zone</em></div>
            <div className="police-stat police-dashboard-stat"><span>High Priority</span><strong>{stats.highPriorityCount}</strong><em>Requires fast response</em></div>
            <div className="police-stat police-dashboard-stat"><span>Pending Verification</span><strong>{stats.pendingVerificationCount}</strong><em>Awaiting decision</em></div>
            <div className="police-stat police-dashboard-stat"><span>Unread Alerts</span><strong>{stats.unreadAlertsCount}</strong><em>Supervisor channel</em></div>
            <div className="police-stat police-dashboard-stat"><span>Critical Incidents</span><strong>{criticalCount}</strong><em>Top severity now</em></div>
            <div className="police-stat police-dashboard-stat"><span>Unassigned Cases</span><strong>{unassignedCount}</strong><em>No officer attached</em></div>
          </div>
        ) : null}
      </section>

      {!activeView ? (
        <section className="police-section">
          <div className="police-command-section-head">
            <h2>Operations Map</h2>
          </div>

          <div className="police-mini-map police-detail-map">
            <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="police-leaflet-map">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {mapMarkers.map((item) => (
                <CircleMarker
                  key={item.id}
                  center={[item.lat, item.lng]}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: severityColor(item.severity),
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <strong>{item.title || item.locationLabel || item.id}</strong><br />
                    {displayLabel(item.status)}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </section>
      ) : null}

      <section className="police-section police-dashboard-incidents-section">
        <div className="police-command-section-head">
          <h2>Active Incidents</h2>
          {!activeView ? (
            <button type="button" className="police-action police-action-view" onClick={() => navigate('/police?view=active')}>
              Open stream
            </button>
          ) : null}
        </div>

        <div className="police-feed">
          {incidentsToShow.map((incident) => (
            <article key={incident.id} className="police-stream-row police-dashboard-incident-card" data-severity={incident.severity}>
              <span className={`police-severity-strip ${incident.severity}`} aria-hidden="true"></span>
              <div className="police-stream-main">
                <div className="police-dashboard-incident-id-row">
                  <div className="police-dashboard-incident-id-left">
                    <span className="police-stream-id">{incident.displayId}</span>
                    <span className={`police-badge ${incident.severity} police-dashboard-severity-badge`}>{displayLabel(incident.severity)}</span>
                  </div>
                  <div className="police-dashboard-time-wrap">
                    <span className="police-stream-time police-dashboard-incident-time">{formatIncidentCardTime(incident)}</span>
                    <span className="police-meta police-dashboard-incident-time-ago">{formatIncidentRelativeAge(incident)}</span>
                  </div>
                </div>
                <div className="police-stream-headline police-dashboard-incident-headline">
                  <strong className="police-stream-title">{incident.title || 'Untitled incident'}</strong>
                </div>
                <p className="police-stream-description">{incident.description || 'No description provided.'}</p>
                <div className="police-stream-meta-line police-dashboard-incident-meta">
                  <span className="police-dashboard-incident-chip">Location: {incident.locationText}</span>
                  <span className="police-dashboard-incident-chip">Status: {displayLabel(incident.status)}</span>
                  {incident.sourceChannel ? (
                    <span className="police-dashboard-incident-chip">Source: {displayLabel(incident.sourceChannel)}</span>
                  ) : null}
                  {incident.reportedBy?.name ? (
                    <span className="police-dashboard-incident-chip">Reporter: {incident.reportedBy.name}</span>
                  ) : null}
                  <span className="police-dashboard-incident-chip">Notes: {incident.fieldNoteCount}</span>
                </div>
              </div>
              <div className="police-stream-actions police-dashboard-incident-actions">
                <button
                  type="button"
                  className="police-action police-action-view police-dashboard-open-btn"
                  onClick={() => navigate(`/police/incident/${incident.id}`)}
                >
                  Open Case
                </button>
              </div>
            </article>
          ))}

          {!isLoading && activeIncidents.length === 0 ? (
            <div className="police-empty-state" role="status">
              <div className="police-empty-icon" aria-hidden="true">🚓</div>
              <h3>No active incidents</h3>
              <p>The current work zone has no active police incidents.</p>
            </div>
          ) : null}
        </div>
      </section>

      {!activeView ? (
        <>
          <section className="police-section">
            <div className="police-command-section-head">
              <h2>Nearby Incidents</h2>
              <button type="button" className="police-action police-action-view" onClick={() => navigate('/police/nearby')}>
                Open nearby
              </button>
            </div>

            {dashboard?.nearbyLocationRequired ? (
              <p className="police-meta">Location access is required to show nearby incidents within 500 meters.</p>
            ) : null}

            <div className="police-table-wrap">
              <table className="police-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Location</th>
                    <th>Distance</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nearbyIncidents.slice(0, 5).map((incident) => (
                    <tr key={incident.id} className="police-nearby-table-row" data-severity={incident.severity}>
                      <td>{incident.displayId}</td>
                      <td>{incident.locationText}</td>
                      <td>{incident.distanceLabel || '-'}</td>
                      <td><span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span></td>
                      <td>{displayLabel(incident.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isLoading && nearbyIncidents.length === 0 && !dashboard?.nearbyLocationRequired ? (
              <p className="police-meta">No nearby incidents were found within 500 meters.</p>
            ) : null}
          </section>

          <section className="police-section">
            <div className="police-command-section-head">
              <h2>My Incidents</h2>
              <button type="button" className="police-action police-action-view" onClick={() => navigate('/police/my-incidents')}>
                View all
              </button>
            </div>
            <ul className="police-list police-dashboard-list">
              {myIncidents.slice(0, 5).map((incident) => (
                <li key={incident.id}>
                  <strong>{incident.displayId}</strong> {incident.title} in {incident.locationText} ({displayLabel(incident.status)})
                  <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                </li>
              ))}
              {!isLoading && myIncidents.length === 0 ? <li>No incidents are assigned to you yet.</li> : null}
            </ul>
          </section>

          <section className="police-section">
            <div className="police-command-section-head">
              <h2>Recent History</h2>
              <button type="button" className="police-action police-action-view" onClick={() => navigate('/police/history')}>
                Full history
              </button>
            </div>
            <ul className="police-list police-dashboard-list">
              {recentHistory.map((entry) => (
                <li key={entry.id}>
                  <strong>{displayLabel(entry.actionType)}</strong> on {formatPoliceDateTime(entry.createdAt)}{entry.reportId ? ` for ${entry.reportId}` : ''}
                </li>
              ))}
              {!isLoading && recentHistory.length === 0 ? <li>No police actions recorded yet.</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </PoliceShell>
  )
}
