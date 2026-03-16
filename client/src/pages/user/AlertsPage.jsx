import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'

import { AuthContext } from '../../contexts/AuthContext'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import { deleteAlert, fetchAlerts, updateAlertStatus } from '../../services/alertService'
import '../../styles/NewsPage.css'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'archived', label: 'Archived' },
]

const DEFAULT_CENTER = { lat: 36.753, lng: 3.0588 }

function icon(type) {
  return { accident: '🚗', traffic: '🚦', danger: '⚠️', roadworks: '🚧', ai_prediction: '🤖' }[type] || '🔔'
}

function color(severity) {
  return { high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[severity] || '#64748B'
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const { isLoaded: mapReady } = useLoadScript({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '' })

  const [showDropdown, setShowDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState('active')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [selectedAlertId, setSelectedAlertId] = useState(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [alerts, setAlerts] = useState([])
  const [showQuiz, setShowQuiz] = useState(false)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const items = await fetchAlerts()
        if (!ignore) setAlerts(items)
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || 'Unable to load alerts.')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (location.state?.newAlert) {
      setToast(`Alert "${location.state.newAlert}" created successfully`)
      window.history.replaceState({}, '')
    } else if (location.state?.editedAlert) {
      setToast(`Alert "${location.state.editedAlert}" updated successfully`)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const wilayas = useMemo(
    () => [...new Set(alerts.map((alert) => alert.area?.wilaya).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [alerts]
  )

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab !== 'all' && alert.status !== activeTab) return false
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (areaFilter !== 'all' && alert.area?.wilaya !== areaFilter) return false
    return true
  })

  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) || null
  const stats = {
    active: alerts.filter((alert) => alert.status === 'active').length,
    paused: alerts.filter((alert) => alert.status === 'paused').length,
    archived: alerts.filter((alert) => alert.status === 'archived').length,
  }

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setSelectedAlertId(null)
      return
    }

    if (selectedAlertId && filteredAlerts.some((alert) => alert.id === selectedAlertId)) {
      return
    }

    setSelectedAlertId(filteredAlerts[0].id)
  }, [filteredAlerts, selectedAlertId])

  async function handleToggleStatus(event, alert) {
    event.stopPropagation()
    try {
      const nextStatus = alert.status === 'active' ? 'paused' : 'active'
      const updated = await updateAlertStatus(alert.id, nextStatus)
      setAlerts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to update alert status.')
    }
  }

  async function handleDelete(event, alertId) {
    event.stopPropagation()
    if (!window.confirm('Delete this alert?')) return
    try {
      await deleteAlert(alertId)
      setAlerts((prev) => prev.filter((item) => item.id !== alertId))
      setToast('Alert deleted')
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to delete alert.')
    }
  }

  const mapCenter = selectedAlert?.area?.center || DEFAULT_CENTER

  return (
    <div className="alerts-page">
      <DrivingQuiz onComplete={() => setShowQuiz(false)} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab dash-tab-active">Alerts</button>
            </nav>
          </div>
          <div className="dash-header-right">
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)}>{user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {toast && <div className="al-toast" onClick={() => setToast('')}>{toast}</div>}

      <div className="al-grid">
        <aside className="al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{user?.name || 'SIARA User'}</p>
              <span className="role-badge role-citoyen">Citizen</span>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <div className="card al-filter-section">
            <div className="nav-section-label">ALERT STATUS</div>
            <nav className="al-nav">
              {STATUS_TABS.map((tab) => (
                <button key={tab.key} className={`al-nav-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                  <span className="nav-label">{tab.label}</span>
                  <span className="nav-count">{stats[tab.key]}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="card nav-menu">
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-label">Driver Quiz</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-label">Open Map</span></button>
            <button className="nav-item" onClick={() => navigate('/report')}><span className="nav-label">Report Incident</span></button>
          </div>

          <button className="al-cta" onClick={() => navigate('/alerts/create')}>+ New Alert</button>
        </aside>

        <main className="al-center">
          <div className="al-page-head">
            <h1>My Alerts</h1>
            <p>Manage database-backed alert rules for wilayas, communes, and radius zones.</p>
          </div>

          <div className="al-filters">
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="all">Area</option>
              {wilayas.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}
            </select>
          </div>

          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          <div className="al-list">
            {loading ? (
              <div className="al-empty"><h3>Loading alerts...</h3></div>
            ) : filteredAlerts.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon">🔔</span>
                <h3>No Alerts</h3>
                <p>Create your first alert to get notified.</p>
                <button className="empty-btn" onClick={() => navigate('/alerts/create')}>Create an Alert</button>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className={`al-card ${selectedAlertId === alert.id ? 'selected' : ''}`} onClick={() => setSelectedAlertId(alert.id)}>
                  <div className="card-head">
                    <h3 className="card-name">{alert.name}</h3>
                    <span className={`card-status ${alert.status}`}>{alert.status}</span>
                    <span className="card-sev" style={{ background: `${color(alert.severity)}18`, color: color(alert.severity) }}>
                      <span className="sev-dot" style={{ background: color(alert.severity) }}></span>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info">📍 {alert.area?.name || alert.zone?.displayName}</span>
                      <span className="info">🕐 {alert.timeWindow}</span>
                    </div>
                    <div className="body-line">
                      <span className="types">{alert.incidentTypes.map((type) => <span key={type}>{icon(type)}</span>)}</span>
                      <span className="meta">Last: {alert.lastTriggered}</span>
                      <span className="meta">{alert.triggerCount} triggers</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className={`act-btn act-toggle ${alert.status === 'active' ? 'on' : 'off'}`} onClick={(event) => handleToggleStatus(event, alert)}>
                      <span>{alert.status === 'active' ? 'Pause' : 'Activate'}</span>
                    </button>
                    <button className="act-btn act-edit" onClick={(event) => { event.stopPropagation(); navigate('/alerts/create', { state: { editAlert: alert } }) }}>
                      <span>Edit</span>
                    </button>
                    <button className="act-btn act-delete" onClick={(event) => handleDelete(event, alert.id)}>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        <aside className="al-right">
          {selectedAlert ? (
            <>
              <div className="al-panel summary">
                <div className="panel-head">
                  <span className="panel-name">{selectedAlert.name}</span>
                  <span className={`panel-status ${selectedAlert.status}`}>{selectedAlert.status}</span>
                </div>
                <div className="summary-grid">
                  <div className="sum-item"><span className="sum-l">Area</span><span className="sum-v">{selectedAlert.area?.name || selectedAlert.zone?.displayName}</span></div>
                  <div className="sum-item"><span className="sum-l">Wilaya</span><span className="sum-v">{selectedAlert.area?.wilaya || 'N/A'}</span></div>
                  <div className="sum-item"><span className="sum-l">Schedule</span><span className="sum-v">{selectedAlert.timeWindow}</span></div>
                  <div className="sum-item"><span className="sum-l">Triggers</span><span className="sum-v">{selectedAlert.triggerCount}</span></div>
                </div>
              </div>

              <div className="al-panel map">
                <span className="panel-label">Monitored Area</span>
                <div className="mini-map-wrap">
                  {mapReady ? (
                    <GoogleMap
                      mapContainerClassName="al-gmap"
                      center={mapCenter}
                      zoom={selectedAlert.zone?.zoneType === 'radius' ? 10 : 11}
                      options={{ disableDefaultUI: true, zoomControl: false, gestureHandling: 'none' }}
                    >
                      <Marker position={mapCenter} />
                    </GoogleMap>
                  ) : (
                    <div className="mini-map-fallback">Loading...</div>
                  )}
                </div>
                <span className="map-text">{selectedAlert.zone?.displayName || selectedAlert.area?.name}</span>
              </div>

              <div className="al-panel triggers">
                <span className="panel-label">Recent Triggers</span>
                {selectedAlert.recentTriggers?.length ? (
                  <div className="trigger-list">
                    {selectedAlert.recentTriggers.map((trigger) => (
                      <div key={trigger.id} className="trigger-row">
                        <span className="t-icon">{icon(trigger.type)}</span>
                        <span className="t-title">{trigger.title}</span>
                        <span className="t-time">{trigger.time}</span>
                        <span className="t-dot" style={{ background: color(trigger.severity) }}></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-triggers">No triggers yet</div>
                )}
              </div>
            </>
          ) : (
            <div className="al-no-sel"><p>Select an alert</p></div>
          )}
        </aside>
      </div>
    </div>
  )
}
