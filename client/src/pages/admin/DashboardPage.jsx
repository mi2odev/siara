/**
 * @file DashboardPage.jsx
 * @description Full-featured user-facing dashboard for the Siara road safety platform.
 *
 *   Layout (top → bottom):
 *     • Header bar — logo, nav tabs, search, notifications, user dropdown (with quiz)
 *     • KPI cards  — 4 clickable metrics (risk zones, AI precision, accidents, alerts)
 *     • Interactive map — SiaraMap component with filter controls, layer switches, legend
 *     • Incidents table + sidebar — recent incidents list, trending reports, priority
 *       alerts, and weather conditions
 *     • AI Predictions — risk forecasts with score bars
 *     • Analytics charts — weekly bar chart, wilaya horizontal bars, type breakdown,
 *       peak-hours heat dots
 *     • Footer
 *
 *   Components: SiaraMap (map), DrivingQuiz (modal quiz)
 *   Routing: useNavigate for page transitions; dropdown links to profile/settings/etc.
 *   Data: Entirely mock — mockMarkers, barData, wilayaData, typeData.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import SiaraMap from '../../components/map/SiaraMap'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ── Simulated data ── */

/** Map marker positions with severity for the SiaraMap heatmap/points layer. */
const mockMarkers = [
  { id: 1, lat: 36.7525, lng: 3.04197, severity: 'high', title: 'Boulevard Zirout Youcef' },
  { id: 2, lat: 36.7600, lng: 3.05500, severity: 'medium', title: 'RN11 – Industrial Zone' },
  { id: 3, lat: 36.7450, lng: 3.03000, severity: 'low', title: 'Rue Didouche Mourad' },
  { id: 4, lat: 36.7700, lng: 3.06000, severity: 'high', title: 'El Harrach Bridge' },
  { id: 5, lat: 36.7380, lng: 3.02500, severity: 'medium', title: 'Place des Martyrs' },
]

/** Daily incident counts for the weekly bar chart. */
const barData = [
  { label: 'Mon', value: 12 },
  { label: 'Tue', value: 19 },
  { label: 'Wed', value: 8 },
  { label: 'Thu', value: 15 },
  { label: 'Fri', value: 22 },
  { label: 'Sat', value: 14 },
  { label: 'Sun', value: 9 },
]
const maxBar = Math.max(...barData.map(d => d.value)) // Normalizer for bar chart heights

/** Per-wilaya incident totals for the horizontal bar chart. */
const wilayaData = [
  { label: 'Alger', value: 42, color: '#6366F1' },
  { label: 'Oran', value: 28, color: '#8B5CF6' },
  { label: 'Constantine', value: 18, color: '#A78BFA' },
  { label: 'Blida', value: 12, color: '#C4B5FD' },
]
const maxWilaya = Math.max(...wilayaData.map(d => d.value)) // Normalizer for horizontal bar widths

/** Incident type distribution (percentages) for the stacked type-breakdown bar. */
const typeData = [
  { label: 'Collision', pct: 38, color: '#DC2626' },
  { label: 'Roadwork', pct: 24, color: '#F59E0B' },
  { label: 'Weather', pct: 20, color: '#3B82F6' },
  { label: 'Other', pct: 18, color: '#10B981' },
]

export default function DashboardPage(){
  const navigate = useNavigate()

  /* ── State ── */
  const [filters, setFilters] = useState({ date: '', wilaya: '', severity: '' }) // Active filter selections
  const [showFilterBanner, setShowFilterBanner] = useState(false)  // Temporary "filters applied" toast
  const [activeKPI, setActiveKPI] = useState(null)       // Which KPI card is highlighted (null|'zones'|'ai'|'accidents'|'alerts')
  const [showDropdown, setShowDropdown] = useState(false) // User avatar dropdown visibility
  const [mapLayer, setMapLayer] = useState('heatmap')     // Active map layer: 'heatmap' | 'points'
  const [selectedIncident, setSelectedIncident] = useState(null) // Incident focused on the map
  const [showQuiz, setShowQuiz] = useState(false)         // DrivingQuiz modal visibility

  /** Apply current filters and show a temporary confirmation banner for 4 s. */
  const handleFilterApply = () => {
    setShowFilterBanner(true)
    setTimeout(() => setShowFilterBanner(false), 4000)
  }

  /** Reset every filter value and dismiss the banner. */
  const handleFilterClear = () => {
    setFilters({ date: '', wilaya: '', severity: '' })
    setShowFilterBanner(false)
  }

  const handleKPIClick = (kpi) => setActiveKPI(kpi)                  // Highlight the clicked KPI card
  const handleIncidentClick = (incident) => console.log('Center map on:', incident) // Stub: would pan the map
  const handleQuizComplete = (result) => { console.log('Quiz completed:', result); setShowQuiz(false) } // Close quiz on completion
  const handleOpenQuiz = () => { setShowQuiz(true); setShowDropdown(false) } // Open quiz from dropdown

  return (
    <div className="siara-dashboard-root">
      {/* DrivingQuiz modal — controlled via showQuiz state, triggered from dropdown */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══ HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor:'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab dash-tab-active">Dashboard</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher un incident, une route, une wilaya…" aria-label="Search dashboard" />
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
                  <button className="dropdown-item" onClick={handleOpenQuiz}>🚗 Quiz Conducteur</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Temporary banner confirming filters were applied */}
      {showFilterBanner && (
        <div className="filter-banner">
          <span>✓ Filters applied — 3 results showing on map</span>
          <button onClick={handleFilterClear}>Undo</button>
        </div>
      )}

      <main className={`siara-dashboard-main ${showFilterBanner ? 'with-banner' : ''}`}>

        {/* ═══ WELCOME BAR ═══ */}
        <div className="dash-welcome-bar">
          <div className="welcome-text">
            <h1 className="welcome-title">Dashboard</h1>
            <p className="welcome-sub">Real-time overview of road safety across Algeria</p>
          </div>
          <div className="welcome-right">
            <div className="data-freshness">
              <span className="freshness-dot"></span>
              Live — Updated 3 min ago
            </div>
            <span className="demo-badge">DEMO</span>
          </div>
        </div>

        {/* ═══ KPI CARDS ═══ */}
        <section className="dash-section kpi-section" aria-label="Key performance indicators">
          <div className="dash-kpi-grid">
            <article className={`kpi-card${activeKPI === 'zones' ? ' active' : ''}`} onClick={() => handleKPIClick('zones')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-danger">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">High Risk Zones</span>
                <div className="kpi-main">
                  <span className="kpi-value">128</span>
                  <span className="kpi-trend up">+12%</span>
                </div>
                <span className="kpi-period">vs last week</span>
              </div>
            </article>

            <article className={`kpi-card${activeKPI === 'ai' ? ' active' : ''}`} onClick={() => handleKPIClick('ai')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">AI Precision</span>
                <div className="kpi-main">
                  <span className="kpi-value">92%</span>
                  <span className="kpi-trend stable">Stable</span>
                </div>
                <span className="kpi-period">model v0.3</span>
              </div>
            </article>

            <article className={`kpi-card${activeKPI === 'accidents' ? ' active' : ''}`} onClick={() => handleKPIClick('accidents')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Reported Accidents</span>
                <div className="kpi-main">
                  <span className="kpi-value">54</span>
                  <span className="kpi-trend down">-8%</span>
                </div>
                <span className="kpi-period">last 24 hours</span>
              </div>
            </article>

            <article className={`kpi-card${activeKPI === 'alerts' ? ' active' : ''}`} onClick={() => handleKPIClick('alerts')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Active Alerts</span>
                <div className="kpi-main">
                  <span className="kpi-value">9</span>
                  <span className="kpi-trend high">+3 new</span>
                </div>
                <span className="kpi-period">last hour</span>
              </div>
            </article>
          </div>
        </section>

        {/* ═══ MAP & CONTROLS ═══ */}
        <section className="dash-section map-section" aria-label="Risk map and controls">
          <div className="dash-card dash-map-card">
            <div className="dash-controls-panel">
              <div className="controls-left">
                <label className="control-label">
                  <span>Date Range</span>
                  <select className="filter-select" aria-label="Select date range">
                    <option>Last 24 hours</option>
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Custom range</option>
                  </select>
                </label>
                <label className="control-label">
                  <span>Wilaya</span>
                  <select className="filter-select" aria-label="Select wilaya">
                    <option>All wilayas</option>
                    <option>Alger</option>
                    <option>Oran</option>
                    <option>Constantine</option>
                  </select>
                </label>
                <label className="control-label">
                  <span>Severity</span>
                  <select className="filter-select" aria-label="Select severity">
                    <option>All levels</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>
              </div>
              <div className="controls-right">
                <button className="btn-secondary" onClick={handleFilterClear}>Reset</button>
                <button className="btn-primary" onClick={handleFilterApply}>Apply</button>
              </div>
            </div>

            <div className="dash-map-container">
              <div className="dash-map-wrapper">
                <SiaraMap mockMarkers={mockMarkers} mapLayer={mapLayer} setSelectedIncident={setSelectedIncident} userPosition={null} />
              </div>

              <div className="dash-map-layers">
                <button className={`layer-toggle ${mapLayer === 'heatmap' ? 'active' : ''}`} onClick={() => setMapLayer('heatmap')}><span className="layer-indicator"></span>Heatmap</button>
                <button className={`layer-toggle ${mapLayer === 'points' ? 'active' : ''}`} onClick={() => setMapLayer('points')}><span className="layer-indicator"></span>Points</button>
                <button className="layer-toggle"><span className="layer-indicator"></span>Clusters</button>
                <button className="layer-toggle"><span className="layer-indicator"></span>AI Pred.</button>
              </div>

              <div className="dash-map-legend">
                <div className="legend-title">Risk Level</div>
                <div className="legend-item"><span className="legend-dot danger"></span>High</div>
                <div className="legend-item"><span className="legend-dot warning"></span>Medium</div>
                <div className="legend-item"><span className="legend-dot info"></span>Low</div>
                <div className="legend-divider"></div>
                <div className="legend-confidence">Model confidence: 92% <button className="tooltip-btn" aria-label="Model info">ⓘ</button></div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ INCIDENTS TABLE + SIDEBAR ═══ */}
        <section className="dash-section incidents-layout">
          <div className="dash-incidents-left">
            <div className="dash-card incidents-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">Recent Incidents</h2>
                <div className="header-actions">
                  <button className="btn-outline-small">📤 Export CSV</button>
                  <button className="btn-outline-small">🔗 Share</button>
                </div>
              </div>
              <div className="incidents-table-wrapper">
                <table className="incidents-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr onClick={() => handleIncidentClick('incident-1')} className="incident-row">
                      <td><span className="pill pill-high">High</span></td>
                      <td><div className="location-cell">Boulevard Zirout Youcef<span className="location-verified">✓ Verified</span></div></td>
                      <td>Collision</td>
                      <td><div className="time-cell">08:34<span className="time-ago">45m ago</span></div></td>
                      <td><span className="status-badge verified">✓ Verified</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-2')} className="incident-row">
                      <td><span className="pill pill-medium">Medium</span></td>
                      <td><div className="location-cell">RN11 – Industrial Zone</div></td>
                      <td>Roadwork</td>
                      <td><div className="time-cell">07:18<span className="time-ago">2h ago</span></div></td>
                      <td><span className="status-badge pending">⏳ Pending</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-3')} className="incident-row">
                      <td><span className="pill pill-low">Low</span></td>
                      <td><div className="location-cell">University District<span className="location-verified">✓ Verified</span></div></td>
                      <td>Rain</td>
                      <td><div className="time-cell">06:02<span className="time-ago">3h ago</span></div></td>
                      <td><span className="status-badge verified">✓ Verified</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-4')} className="incident-row">
                      <td><span className="pill pill-high">High</span></td>
                      <td><div className="location-cell">El Harrach Bridge</div></td>
                      <td>Collision</td>
                      <td><div className="time-cell">05:47<span className="time-ago">3.5h ago</span></div></td>
                      <td><span className="status-badge pending">⏳ Pending</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-5')} className="incident-row">
                      <td><span className="pill pill-medium">Medium</span></td>
                      <td><div className="location-cell">Place des Martyrs<span className="location-verified">✓ Verified</span></div></td>
                      <td>Traffic</td>
                      <td><div className="time-cell">04:15<span className="time-ago">5h ago</span></div></td>
                      <td><span className="status-badge verified">✓ Verified</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                  </tbody>
                </table>
                <button className="btn-load-more">Load more incidents</button>
              </div>
            </div>
          </div>

          <aside className="dash-incidents-right">
            {/* Trending */}
            <div className="dash-card side-card">
              <h2 className="dash-card-title">Trending Incidents</h2>
              <ul className="side-list">
                <li className="side-item">
                  <div className="side-item-header">
                    <span className="trend-icon">🔴</span>
                    <div className="side-text">
                      <p className="side-label">Boulevard Zirout Youcef</p>
                      <span className="side-meta">20 min ago • 🚗 Collision</span>
                    </div>
                  </div>
                  <div className="side-progress"><div className="progress-bar" style={{width:'85%'}}></div></div>
                </li>
                <li className="side-item">
                  <div className="side-item-header">
                    <span className="trend-icon">🟠</span>
                    <div className="side-text">
                      <p className="side-label">East-West Highway</p>
                      <span className="side-meta">45 min ago • 🚧 Roadwork</span>
                    </div>
                  </div>
                  <div className="side-progress"><div className="progress-bar" style={{width:'65%'}}></div></div>
                </li>
                <li className="side-item">
                  <div className="side-item-header">
                    <span className="trend-icon">🟢</span>
                    <div className="side-text">
                      <p className="side-label">University District</p>
                      <span className="side-meta">1h ago • 🌧️ Weather</span>
                    </div>
                  </div>
                  <div className="side-progress"><div className="progress-bar" style={{width:'40%'}}></div></div>
                </li>
              </ul>
            </div>

            {/* Priority Alerts */}
            <div className="dash-card side-card priority-card">
              <div className="card-icon-header">
                <span className="header-icon">⚠️</span>
                <h2 className="dash-card-title">Priority Alerts</h2>
              </div>
              <ul className="alert-list">
                <li className="alert-item high"><span className="alert-dot"></span>School zone — dismissal time</li>
                <li className="alert-item medium"><span className="alert-dot"></span>East-West axis — dense fog</li>
                <li className="alert-item low"><span className="alert-dot"></span>Night roadwork scheduled</li>
              </ul>
              <button className="btn-primary-full" onClick={() => navigate('/alerts')}>🔔 Manage Alerts</button>
            </div>

            {/* Weather */}
            <div className="dash-card side-card">
              <h2 className="dash-card-title">Weather Conditions</h2>
              <div className="weather-grid">
                <div className="weather-item good"><span className="weather-icon">👁️</span><span className="weather-label">Visibility</span><span className="weather-value">Good</span></div>
                <div className="weather-item moderate"><span className="weather-icon">💨</span><span className="weather-label">Wind</span><span className="weather-value">Moderate</span></div>
                <div className="weather-item risk"><span className="weather-icon">🌧️</span><span className="weather-label">Rain</span><span className="weather-value">Light risk</span></div>
                <div className="weather-item"><span className="weather-icon">🌡️</span><span className="weather-label">Temperature</span><span className="weather-value">18°C</span></div>
              </div>
            </div>
          </aside>
        </section>

        {/* ═══ AI PREDICTIONS ═══ */}
        <section className="dash-section predictions-section">
          <div className="dash-card predictions-card">
            <div className="predictions-header">
              <div>
                <h2 className="dash-card-title">AI Risk Predictions — Today</h2>
                <p className="predictions-meta">Model v0.3 • Confidence: 92% • Demo data</p>
              </div>
              <button className="btn-outline-small">ⓘ Model info</button>
            </div>
            <ul className="predictions-list">
              <li className="prediction-item">
                <div className="prediction-header">
                  <span className="prediction-road">East-West Highway, km 120</span>
                  <div className="prediction-score-group"><span className="prediction-score high">82</span><span className="score-label">Risk</span></div>
                </div>
                <div className="prediction-bar"><span style={{width:'82%'}}></span></div>
                <div className="prediction-footer">
                  <span className="prediction-meta">High traffic + Rain forecast</span>
                  <button className="link-action">View on map →</button>
                </div>
              </li>
              <li className="prediction-item">
                <div className="prediction-header">
                  <span className="prediction-road">RN11 — Industrial Zone</span>
                  <div className="prediction-score-group"><span className="prediction-score medium">67</span><span className="score-label">Risk</span></div>
                </div>
                <div className="prediction-bar"><span style={{width:'67%'}}></span></div>
                <div className="prediction-footer">
                  <span className="prediction-meta">Morning congestion</span>
                  <button className="link-action">View on map →</button>
                </div>
              </li>
              <li className="prediction-item">
                <div className="prediction-header">
                  <span className="prediction-road">Boulevard Zirout Youcef</span>
                  <div className="prediction-score-group"><span className="prediction-score low">35</span><span className="score-label">Risk</span></div>
                </div>
                <div className="prediction-bar"><span style={{width:'35%'}}></span></div>
                <div className="prediction-footer">
                  <span className="prediction-meta">Light traffic expected</span>
                  <button className="link-action">View on map →</button>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* ═══ ANALYTICS CHARTS ═══ */}
        <section className="dash-section stats-section">
          <h2 className="section-heading">Analytics</h2>
          <div className="dash-stats-grid">
            {/* Weekly Trend */}
            <div className="dash-card stats-card">
              <h3 className="dash-card-title">Incidents This Week</h3>
              <div className="mini-bar-chart">
                {barData.map((d, i) => (
                  <div className="bar-col" key={i}>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ height: `${(d.value / maxBar) * 100}%` }}></div>
                    </div>
                    <span className="bar-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Wilaya */}
            <div className="dash-card stats-card">
              <h3 className="dash-card-title">By Wilaya</h3>
              <div className="horiz-bar-chart">
                {wilayaData.map((d, i) => (
                  <div className="horiz-bar-row" key={i}>
                    <span className="horiz-bar-label">{d.label}</span>
                    <div className="horiz-bar-track">
                      <div className="horiz-bar-fill" style={{ width: `${(d.value / maxWilaya) * 100}%`, background: d.color }}></div>
                    </div>
                    <span className="horiz-bar-value">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accident Types */}
            <div className="dash-card stats-card">
              <h3 className="dash-card-title">Accident Types</h3>
              <div className="type-breakdown">
                {typeData.map((d, i) => (
                  <div className="type-row" key={i}>
                    <div className="type-info">
                      <span className="type-dot" style={{ background: d.color }}></span>
                      <span className="type-label">{d.label}</span>
                    </div>
                    <span className="type-pct">{d.pct}%</span>
                  </div>
                ))}
                <div className="type-bar-combined">
                  {typeData.map((d, i) => (
                    <div key={i} className="type-bar-segment" style={{ width: `${d.pct}%`, background: d.color }}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Peak Hours */}
            <div className="dash-card stats-card">
              <h3 className="dash-card-title">Peak Hours</h3>
              <div className="peak-hours-grid">
                {['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00'].map((h, i) => {
                  const intensity = [20, 90, 45, 30, 40, 85, 95, 35][i]
                  return (
                    <div className="peak-cell" key={i} style={{ opacity: 0.3 + (intensity / 100) * 0.7 }}>
                      <span className="peak-time">{h}</span>
                      <div className="peak-dot" style={{ width: 8 + (intensity / 100) * 20, height: 8 + (intensity / 100) * 20, background: intensity > 70 ? '#DC2626' : intensity > 40 ? '#F59E0B' : '#10B981' }}></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="dash-footer">
          <span>© 2026 SIARA — Prototype</span>
          <span className="footer-divider">•</span>
          <span>Demo data</span>
          <span className="footer-divider">•</span>
          <button className="footer-link">Data sources</button>
          <span className="footer-divider">•</span>
          <button className="footer-link">Privacy</button>
        </footer>
      </main>
    </div>
  )
}
