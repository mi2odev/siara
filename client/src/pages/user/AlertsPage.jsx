import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

// Default seed alerts (used only when localStorage is empty)
const SEED_ALERTS = [
  {
    id: 1,
    name: 'Accidents A1 Highway',
    status: 'active',
    severity: 'high',
    area: { name: 'A1 Highway, KM 10-50', wilaya: 'Alger' },
    incidentTypes: ['accident', 'traffic'],
    timeWindow: '24/7',
    lastTriggered: '15 min',
    triggerCount: 8,
    notifications: { app: true, email: true, sms: false },
    recentTriggers: [
      { id: 101, type: 'accident', severity: 'high', time: '15m', title: 'Multi-car collision' },
      { id: 102, type: 'traffic', severity: 'medium', time: '2h', title: 'Heavy congestion' },
      { id: 103, type: 'accident', severity: 'low', time: '1d', title: 'Minor incident' }
    ]
  },
  {
    id: 2,
    name: 'Zone Bab Ezzouar',
    status: 'active',
    severity: 'medium',
    area: { name: 'Bab Ezzouar District', wilaya: 'Alger' },
    incidentTypes: ['accident', 'danger', 'roadworks'],
    timeWindow: '06:00 - 22:00',
    lastTriggered: '3h',
    triggerCount: 23,
    notifications: { app: true, email: false, sms: false },
    recentTriggers: [
      { id: 104, type: 'roadworks', severity: 'low', time: '3h', title: 'Lane closure' },
      { id: 105, type: 'danger', severity: 'medium', time: '1d', title: 'Pothole reported' }
    ]
  },
  {
    id: 3,
    name: 'Night Watch Oran',
    status: 'paused',
    severity: 'high',
    area: { name: 'Oran Centre', wilaya: 'Oran' },
    incidentTypes: ['accident', 'danger'],
    timeWindow: '22:00 - 06:00',
    lastTriggered: '2d',
    triggerCount: 5,
    notifications: { app: true, email: true, sms: true },
    recentTriggers: [
      { id: 106, type: 'accident', severity: 'high', time: '2d', title: 'Night collision' }
    ]
  },
  {
    id: 4,
    name: 'Constantine N3',
    status: 'expired',
    severity: 'low',
    area: { name: 'Route N3', wilaya: 'Constantine' },
    incidentTypes: ['traffic'],
    timeWindow: 'Rush hours',
    lastTriggered: '1w',
    triggerCount: 12,
    notifications: { app: true, email: false, sms: false },
    recentTriggers: []
  }
]

function loadAlerts() {
  try {
    const stored = localStorage.getItem('siara_alerts')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  // First visit: seed and persist
  localStorage.setItem('siara_alerts', JSON.stringify(SEED_ALERTS))
  return SEED_ALERTS
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeNav, setActiveNav] = useState('active')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [toast, setToast] = useState(null)

  const [alerts, setAlerts] = useState(() => loadAlerts())

  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida']

  // Persist alerts to localStorage on every change
  useEffect(() => {
    localStorage.setItem('siara_alerts', JSON.stringify(alerts))
  }, [alerts])

  // Show toast when arriving from CreateAlertPage
  useEffect(() => {
    if (location.state?.newAlert) {
      setToast(`✅ Alerte « ${location.state.newAlert} » créée avec succès`)
      // Clear the state so refresh doesn't re-show toast
      window.history.replaceState({}, '')
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  // Auto-select first alert
  useEffect(() => {
    const activeAlerts = alerts.filter(a => a.status === 'active')
    if (activeAlerts.length > 0 && !selectedAlert) {
      setSelectedAlert(activeAlerts[0])
    }
  }, [alerts])

  // Stats
  const stats = {
    active: alerts.filter(a => a.status === 'active').length,
    today: alerts.filter(a => a.lastTriggered?.includes('m') || a.lastTriggered?.includes('h')).length,
    high: alerts.filter(a => a.severity === 'high' && a.status === 'active').length
  }

  // Filter
  const filteredAlerts = alerts.filter(alert => {
    if (activeNav === 'active' && alert.status !== 'active') return false
    if (activeNav === 'paused' && alert.status !== 'paused') return false
    if (activeNav === 'expired' && alert.status !== 'expired') return false
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (areaFilter !== 'all' && alert.area.wilaya !== areaFilter) return false
    return true
  })

  // Handlers
  const toggleAlert = (e, id) => {
    e.stopPropagation()
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
    ))
  }

  const deleteAlert = (e, id) => {
    e.stopPropagation()
    if (confirm('Supprimer cette alerte ?')) {
      setAlerts(prev => prev.filter(a => a.id !== id))
      if (selectedAlert?.id === id) setSelectedAlert(null)
    }
  }

  const color = (sev) => ({ high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[sev] || '#64748B')
  const icon = (type) => ({ accident: '🚗', traffic: '🚦', danger: '⚠️', roadworks: '🚧', weather: '🌧️' }[type] || '📍')

  return (
    <div className="alerts-page">
      {/* HEADER */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab dash-tab-active">Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/admin/dashboard')}>Dashboard</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher un incident, une route, une wilaya…" aria-label="Search alerts" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 Mon profil</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* TOAST */}
      {toast && (
        <div className="al-toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {/* GRID */}
      <div className="al-grid">
        {/* LEFT */}
        <aside className="al-left">
          <nav className="al-nav">
            {[
              { key: 'active', icon: '✅', label: 'Actives', count: alerts.filter(a => a.status === 'active').length },
              { key: 'paused', icon: '⏸️', label: 'Pausées', count: alerts.filter(a => a.status === 'paused').length },
              { key: 'expired', icon: '⏰', label: 'Expirées', count: alerts.filter(a => a.status === 'expired').length },
              { key: 'history', icon: '📜', label: 'Historique', count: null }
            ].map(n => (
              <button key={n.key} className={`al-nav-btn ${activeNav === n.key ? 'active' : ''}`} onClick={() => setActiveNav(n.key)}>
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
                {n.count !== null && <span className="nav-count">{n.count}</span>}
              </button>
            ))}
          </nav>

          <div className="al-stats">
            <div className="stat"><span className="dot green"></span><span>Actives</span><span className="val">{stats.active}</span></div>
            <div className="stat"><span className="dot orange"></span><span>Aujourd'hui</span><span className="val">{stats.today}</span></div>
            <div className="stat"><span className="dot red"></span><span>Haute sév.</span><span className="val">{stats.high}</span></div>
          </div>

          <button className="al-cta" onClick={() => navigate('/alerts/create')}>➕ Nouvelle alerte</button>
        </aside>

        {/* CENTER */}
        <main className="al-center">
          <div className="al-page-head">
            <h1>Mes Alertes</h1>
            <p>Gérez vos règles d'alerte automatiques</p>
          </div>

          <div className="al-filters">
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="all">Sévérité</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
            <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
              <option value="all">Zone</option>
              {wilayas.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            {(severityFilter !== 'all' || areaFilter !== 'all') && (
              <button className="al-clear" onClick={() => { setSeverityFilter('all'); setAreaFilter('all'); }}>✕</button>
            )}
          </div>

          <div className="al-list">
            {filteredAlerts.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon">🔔</span>
                <h3>Aucune alerte</h3>
                <p>Créez votre première alerte pour être notifié.</p>
                <button className="empty-btn" onClick={() => navigate('/alerts/create')}>➕ Créer une alerte</button>
              </div>
            ) : (
              filteredAlerts.map(alert => (
                <div key={alert.id} className={`al-card ${selectedAlert?.id === alert.id ? 'selected' : ''}`} onClick={() => setSelectedAlert(alert)}>
                  <div className="card-head">
                    <h3 className="card-name">{alert.name}</h3>
                    <span className={`card-status ${alert.status}`}>{alert.status === 'active' ? 'Actif' : alert.status === 'paused' ? 'Pausé' : 'Expiré'}</span>
                    <span className="card-sev" style={{ background: `${color(alert.severity)}18`, color: color(alert.severity) }}>
                      <span className="sev-dot" style={{ background: color(alert.severity) }}></span>
                      {alert.severity === 'high' ? 'Haute' : alert.severity === 'medium' ? 'Moy.' : 'Basse'}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info">📍 {alert.area.name}</span>
                      <span className="info">🕐 {alert.timeWindow}</span>
                    </div>
                    <div className="body-line">
                      <span className="types">{alert.incidentTypes.map((t, i) => <span key={i} title={t}>{icon(t)}</span>)}</span>
                      <span className="meta">Dernier: {alert.lastTriggered}</span>
                      <span className="meta">{alert.triggerCount} triggers</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className={`act-btn toggle ${alert.status === 'active' ? 'on' : ''}`} onClick={e => toggleAlert(e, alert.id)}>{alert.status === 'active' ? '🟢' : '⚪'}</button>
                    <button className="act-btn" onClick={e => e.stopPropagation()}>✏️</button>
                    <button className="act-btn" onClick={e => toggleAlert(e, alert.id)}>{alert.status === 'active' ? '⏸️' : '▶️'}</button>
                    <button className="act-btn del" onClick={e => deleteAlert(e, alert.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* RIGHT */}
        <aside className="al-right">
          {selectedAlert ? (
            <>
              <div className="al-panel summary">
                <div className="panel-head">
                  <span className="panel-name">{selectedAlert.name}</span>
                  <span className={`panel-status ${selectedAlert.status}`}>{selectedAlert.status === 'active' ? '● Actif' : selectedAlert.status === 'paused' ? '● Pausé' : '● Expiré'}</span>
                </div>
                <div className="summary-grid">
                  <div className="sum-item"><span className="sum-l">Sévérité</span><span className="sum-v" style={{ color: color(selectedAlert.severity) }}>{selectedAlert.severity === 'high' ? 'Haute' : selectedAlert.severity === 'medium' ? 'Moyenne' : 'Basse'}</span></div>
                  <div className="sum-item"><span className="sum-l">Zone</span><span className="sum-v">{selectedAlert.area.wilaya}</span></div>
                  <div className="sum-item"><span className="sum-l">Horaires</span><span className="sum-v">{selectedAlert.timeWindow}</span></div>
                  <div className="sum-item"><span className="sum-l">Triggers</span><span className="sum-v">{selectedAlert.triggerCount}</span></div>
                </div>
              </div>

              <div className="al-panel map">
                <span className="panel-label">Zone surveillée</span>
                <div className="mini-map">
                  <span className="map-bg">🗺️</span>
                  <div className="zone-ring" style={{ borderColor: color(selectedAlert.severity) }}></div>
                  <span className="map-pin">📍</span>
                </div>
                <span className="map-text">{selectedAlert.area.name}</span>
                <button className="map-btn" onClick={() => navigate('/map')}>Ouvrir la carte</button>
              </div>

              <div className="al-panel triggers">
                <span className="panel-label">Déclenchements récents</span>
                {selectedAlert.recentTriggers.length > 0 ? (
                  <div className="trigger-list">
                    {selectedAlert.recentTriggers.slice(0, 4).map(t => (
                      <div key={t.id} className="trigger-row" onClick={() => navigate(`/incident/${t.id}`)}>
                        <span className="t-icon">{icon(t.type)}</span>
                        <span className="t-title">{t.title}</span>
                        <span className="t-time">{t.time}</span>
                        <span className="t-dot" style={{ background: color(t.severity) }}></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-triggers">Aucun récent</div>
                )}
              </div>

              <div className="al-panel channels">
                <span className="panel-label">Notifications</span>
                <div className="ch-row">
                  {[
                    { key: 'app', icon: '📱', label: 'App', on: selectedAlert.notifications.app },
                    { key: 'email', icon: '📧', label: 'Email', on: selectedAlert.notifications.email },
                    { key: 'sms', icon: '💬', label: 'SMS', on: selectedAlert.notifications.sms }
                  ].map(c => (
                    <div key={c.key} className={`ch-item ${c.on ? 'on' : 'off'}`}>
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                      <span className="ch-check">{c.on ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="al-no-sel">
              <span className="no-sel-icon">👆</span>
              <p>Sélectionnez une alerte</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
