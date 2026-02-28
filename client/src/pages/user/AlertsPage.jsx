/**
 * @file AlertsPage.jsx
 * @description Full alert-management page with list view, detail panel, and CRUD operations.
 *
 * Layout (3-column grid):
 *   Left   — Sidebar navigation (Active / Paused / Expired / History) + stats + "New alert" CTA
 *   Center — Filterable alert list with cards (severity & area dropdowns)
 *   Right  — Detail panel for the selected alert: summary, mini Google Map, recent triggers, notification channels
 *
 * Persistence: alerts are stored in localStorage under key "siara_alerts".
 *              On first visit SEED_ALERTS are written as default data.
 *
 * Features:
 *   - Filter by severity / wilaya (area)
 *   - Toggle active ↔ paused
 *   - Delete with confirmation
 *   - Edit via navigation to CreateAlertPage with pre-filled state
 *   - Toast feedback when creating / editing an alert
 *   - Mini Google Map (via @react-google-maps/api) in the detail panel
 *
 * Dependencies: react-router-dom, @react-google-maps/api, localStorage
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api' // Google Maps components
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

/**
 * SEED_ALERTS — default alert data used to populate localStorage on the user's
 * very first visit. Each alert object contains:
 *   id, name, status (active|paused|expired), severity (high|medium|low),
 *   area {name, wilaya}, incidentTypes[], timeWindow, lastTriggered,
 *   triggerCount, notifications {app, email, sms}, recentTriggers[]
 */
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

/**
 * loadAlerts — reads "siara_alerts" from localStorage.
 * Returns the parsed array if valid and non-empty; otherwise seeds
 * localStorage with SEED_ALERTS and returns them.
 */
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

  // --- UI state ---
  const [showDropdown, setShowDropdown] = useState(false)  // header user-menu dropdown
  const [activeNav, setActiveNav] = useState('active')     // sidebar nav: 'active' | 'paused' | 'expired' | 'history'
  const [selectedAlert, setSelectedAlert] = useState(null) // currently highlighted alert for the detail panel
  const [severityFilter, setSeverityFilter] = useState('all')  // severity dropdown: 'all' | 'high' | 'medium' | 'low'
  const [areaFilter, setAreaFilter] = useState('all')          // wilaya dropdown filter
  const [toast, setToast] = useState(null)                     // transient success message string

  // --- Core alerts data (initialised from localStorage via loadAlerts) ---
  const [alerts, setAlerts] = useState(() => loadAlerts())

  /** Available wilaya options for the area filter dropdown */
  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida']

  // Persist alerts to localStorage whenever the array changes
  useEffect(() => {
    localStorage.setItem('siara_alerts', JSON.stringify(alerts))
  }, [alerts])

  // Show a toast notification when arriving back from CreateAlertPage (create or edit)
  useEffect(() => {
    if (location.state?.newAlert) {
      setToast(`✅ Alerte « ${location.state.newAlert} » créée avec succès`)
      window.history.replaceState({}, '')
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
    if (location.state?.editedAlert) {
      setToast(`✅ Alerte « ${location.state.editedAlert} » modifiée avec succès`)
      window.history.replaceState({}, '')
      // Reload alerts from localStorage to reflect edits
      setAlerts(loadAlerts())
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  // Auto-select the first active alert if nothing is selected yet
  useEffect(() => {
    const activeAlerts = alerts.filter(a => a.status === 'active')
    if (activeAlerts.length > 0 && !selectedAlert) {
      setSelectedAlert(activeAlerts[0])
    }
  }, [alerts])

  // --- Derived stats shown in the left sidebar ---
  const stats = {
    active: alerts.filter(a => a.status === 'active').length,       // total active alerts
    today:  alerts.filter(a => a.lastTriggered?.includes('m') || a.lastTriggered?.includes('h')).length, // triggered today (minutes or hours ago)
    high:   alerts.filter(a => a.severity === 'high' && a.status === 'active').length  // high-severity active alerts
  }

  // --- Filtering: combine nav tab, severity, and area filters ---
  const filteredAlerts = alerts.filter(alert => {
    if (activeNav === 'active' && alert.status !== 'active') return false
    if (activeNav === 'paused' && alert.status !== 'paused') return false
    if (activeNav === 'expired' && alert.status !== 'expired') return false
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (areaFilter !== 'all' && alert.area.wilaya !== areaFilter) return false
    return true
  })

  // --- Event handlers ---

  /** Toggle an alert between 'active' and 'paused'. Stops event propagation to avoid selecting the card. */
  const toggleAlert = (e, id) => {
    e.stopPropagation()
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
    ))
  }

  /** Delete an alert after confirmation. Clears selectedAlert if it was the deleted one. */
  const deleteAlert = (e, id) => {
    e.stopPropagation()
    if (confirm('Supprimer cette alerte ?')) {
      setAlerts(prev => prev.filter(a => a.id !== id))
      if (selectedAlert?.id === id) setSelectedAlert(null)
    }
  }

  /** Load Google Maps script (lazy). Uses env var VITE_GOOGLE_MAP_KEY. */
  const { isLoaded: mapReady } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '',
  })

  /** Map severity → hex colour for badges and dots */
  const color = (sev) => ({ high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[sev] || '#64748B')
  /** Map incident type → emoji icon */
  const icon = (type) => ({ accident: '🚗', traffic: '🚦', danger: '⚠️', roadworks: '🚧', weather: '🌧️' }[type] || '📍')

  return (
    <div className="alerts-page">
      {/* ═══ HEADER (shared dashboard header) ═══ */}
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
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
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

      {/* ═══ TOAST NOTIFICATION ═══ */}
      {/* Transient success message shown after creating / editing an alert */}
      {toast && (
        <div className="al-toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <div className="al-grid">

        {/* ═══ LEFT SIDEBAR: nav tabs, quick stats, new-alert CTA ═══ */}
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

        {/* ═══ CENTER: page heading, filters, alert card list ═══ */}
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

          {/* Alert card list — empty state or iterable cards */}
          <div className="al-list">
            {filteredAlerts.length === 0 ? (
              /* Empty state placeholder with CTA */
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
                    <button className={`act-btn act-toggle ${alert.status === 'active' ? 'on' : 'off'}`} onClick={e => toggleAlert(e, alert.id)} title={alert.status === 'active' ? 'Désactiver' : 'Activer'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {alert.status === 'active' ? <><circle cx="12" cy="12" r="10"/><path d="M10 15V9l5 3-5 3z"/></> : <><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></>}
                      </svg>
                      <span>{alert.status === 'active' ? 'Actif' : 'Pausé'}</span>
                    </button>
                    <button className="act-btn act-edit" onClick={e => { e.stopPropagation(); navigate('/alerts/create', { state: { editAlert: alert } }) }} title="Modifier">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      <span>Modifier</span>
                    </button>
                    <button className="act-btn act-pause" onClick={e => toggleAlert(e, alert.id)} title={alert.status === 'active' ? 'Mettre en pause' : 'Reprendre'}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {alert.status === 'active' ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></> : <polygon points="5 3 19 12 5 21 5 3"/>}
                      </svg>
                      <span>{alert.status === 'active' ? 'Pause' : 'Reprendre'}</span>
                    </button>
                    <button className="act-btn act-delete" onClick={e => deleteAlert(e, alert.id)} title="Supprimer">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* ═══ RIGHT DETAIL PANEL: selected alert info + mini map + triggers ═══ */}
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
                <div className="mini-map-wrap">
                  {mapReady ? (
                    <GoogleMap
                      mapContainerClassName="al-gmap"
                      center={{ lat: selectedAlert.area.wilaya === 'Oran' ? 35.6969 : selectedAlert.area.wilaya === 'Constantine' ? 36.365 : 36.753, lng: selectedAlert.area.wilaya === 'Oran' ? -0.6331 : selectedAlert.area.wilaya === 'Constantine' ? 6.6147 : 3.0588 }}
                      zoom={12}
                      options={{ disableDefaultUI: true, zoomControl: false, gestureHandling: 'none', styles: [{ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'simplified' }] }] }}
                    >
                      <Marker position={{ lat: selectedAlert.area.wilaya === 'Oran' ? 35.6969 : selectedAlert.area.wilaya === 'Constantine' ? 36.365 : 36.753, lng: selectedAlert.area.wilaya === 'Oran' ? -0.6331 : selectedAlert.area.wilaya === 'Constantine' ? 6.6147 : 3.0588 }} />
                    </GoogleMap>
                  ) : (
                    <div className="mini-map-fallback">🗺️ Chargement...</div>
                  )}
                </div>
                <span className="map-text">{selectedAlert.area.name}</span>
                <button className="map-btn" onClick={() => navigate('/map')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                  Ouvrir la carte
                </button>
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
