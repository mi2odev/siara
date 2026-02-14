import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import SiaraMap from '../../components/map/SiaraMap'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

export default function DashboardPage(){
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ date: '', wilaya: '', severity: '' })
  const [showFilterBanner, setShowFilterBanner] = useState(false)
  const [activeKPI, setActiveKPI] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [mapLayer, setMapLayer] = useState('heatmap')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [showQuiz, setShowQuiz] = useState(false)

  // Mock markers for the dashboard map
  const mockMarkers = [
    { id: 1, lat: 36.7525, lng: 3.04197, severity: 'high', title: 'Boulevard Zirout Youcef' },
    { id: 2, lat: 36.7600, lng: 3.05500, severity: 'medium', title: 'RN11 – Industrial Zone' },
    { id: 3, lat: 36.7450, lng: 3.03000, severity: 'low', title: 'Rue Didouche Mourad' },
    { id: 4, lat: 36.7700, lng: 3.06000, severity: 'high', title: 'El Harrach Bridge' },
    { id: 5, lat: 36.7380, lng: 3.02500, severity: 'medium', title: 'Place des Martyrs' },
  ]

  const handleFilterApply = () => {
    setShowFilterBanner(true)
    setTimeout(() => setShowFilterBanner(false), 4000)
  }

  const handleFilterClear = () => {
    setFilters({ date: '', wilaya: '', severity: '' })
    setShowFilterBanner(false)
  }

  const handleKPIClick = (kpi) => {
    setActiveKPI(kpi)
  }

  const handleIncidentClick = (incident) => {
    console.log('Center map on:', incident)
  }

  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  const handleOpenQuiz = () => {
    setShowQuiz(true)
    setShowDropdown(false)
  }

  return (
    <div className="siara-dashboard-root">
      {/* DRIVING QUIZ POPUP - Shows only first time or when manually opened */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

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
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab dash-tab-active">Dashboard</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Rechercher un incident, une route, une wilaya…"
              aria-label="Search dashboard"
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <span className="notification-badge"></span>
              🔔
            </button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => navigate('/profile')}>👤 Mon profil</button>
                  <button className="dropdown-item">⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => navigate('/notifications')}>🔔 Notifications</button>
                  <button className="dropdown-item" onClick={handleOpenQuiz}>🚗 Quiz Conducteur</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {showFilterBanner && (
        <div className="filter-banner">
          <span>✓ Filters applied — 3 results showing on map</span>
          <button onClick={handleFilterClear}>Undo</button>
        </div>
      )}

      <main className={`siara-dashboard-main ${showFilterBanner ? 'with-banner' : ''}`}>
        {/* DATA FRESHNESS INDICATOR */}
        <div className="data-freshness">
          <span className="freshness-dot"></span>
          Data updated 3m ago — Last 24h
          <span className="demo-badge">DEMO MODE</span>
        </div>

        {/* SECTION 1 — KPIs */}
        <section className="dash-section kpi-section" aria-label="Key performance indicators">
          <div className="dash-kpi-grid">
            <article 
              className={`kpi-card ${activeKPI === 'zones' ? 'active' : ''}`}
              onClick={() => handleKPIClick('zones')}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-header">
                <span className="kpi-icon">🔥</span>
                <span className="kpi-label">High Risk Zones</span>
              </div>
              <div className="kpi-main">
                <div className="kpi-value-group">
                  <span className="kpi-value">128</span>
                  <span className="kpi-unit">zones</span>
                </div>
                <svg className="kpi-sparkline" width="60" height="24" viewBox="0 0 60 24">
                  <path d="M0 20 L10 18 L20 15 L30 12 L40 10 L50 8 L60 5" fill="none" stroke="#059669" strokeWidth="2"/>
                </svg>
              </div>
              <div className="kpi-footer">
                <span className="kpi-trend up">▲ 12%</span>
                <span className="kpi-period">vs last week</span>
              </div>
            </article>

            <article 
              className={`kpi-card ${activeKPI === 'ai' ? 'active' : ''}`}
              onClick={() => handleKPIClick('ai')}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-header">
                <span className="kpi-icon">🤖</span>
                <span className="kpi-label">AI Model Precision</span>
              </div>
              <div className="kpi-main">
                <div className="kpi-value-group">
                  <span className="kpi-value">92%</span>
                  <span className="kpi-unit">accuracy</span>
                </div>
                <svg className="kpi-sparkline" width="60" height="24" viewBox="0 0 60 24">
                  <path d="M0 12 L10 12 L20 11 L30 12 L40 11 L50 12 L60 11" fill="none" stroke="#6366F1" strokeWidth="2"/>
                </svg>
              </div>
              <div className="kpi-footer">
                <span className="kpi-trend stable">—</span>
                <span className="kpi-period">stable</span>
              </div>
            </article>

            <article 
              className={`kpi-card ${activeKPI === 'accidents' ? 'active' : ''}`}
              onClick={() => handleKPIClick('accidents')}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-header">
                <span className="kpi-icon">🚧</span>
                <span className="kpi-label">Reported Accidents</span>
              </div>
              <div className="kpi-main">
                <div className="kpi-value-group">
                  <span className="kpi-value">54</span>
                  <span className="kpi-unit">24h</span>
                </div>
                <svg className="kpi-sparkline" width="60" height="24" viewBox="0 0 60 24">
                  <path d="M0 8 L10 10 L20 12 L30 14 L40 17 L50 19 L60 20" fill="none" stroke="#DC2626" strokeWidth="2"/>
                </svg>
              </div>
              <div className="kpi-footer">
                <span className="kpi-trend down">▼ 8%</span>
                <span className="kpi-period">vs yesterday</span>
              </div>
            </article>

            <article 
              className={`kpi-card ${activeKPI === 'alerts' ? 'active' : ''}`}
              onClick={() => handleKPIClick('alerts')}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-header">
                <span className="kpi-icon">⚠️</span>
                <span className="kpi-label">Active Alerts</span>
              </div>
              <div className="kpi-main">
                <div className="kpi-value-group">
                  <span className="kpi-value">9</span>
                  <span className="kpi-unit">priority</span>
                </div>
                <button className="kpi-action" aria-label="Manage alerts">Manage →</button>
              </div>
              <div className="kpi-footer">
                <span className="kpi-trend high">+3 new</span>
                <span className="kpi-period">last hour</span>
              </div>
            </article>
          </div>
        </section>

        {/* SECTION 2 — CONTROLS & MAP */}
        <section className="dash-section map-section" aria-label="Risk map and controls">
          <div className="dash-card dash-map-card">
            {/* UNIFIED CONTROL PANEL */}
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
              <div className="controls-center">
                <button className="toggle-btn active" aria-label="Toggle heatmap">
                  🗺️ Heatmap
                </button>
                <button className="toggle-btn" aria-label="Toggle clusters">
                  📍 Clusters
                </button>
              </div>
              <div className="controls-right">
                <button className="btn-secondary" onClick={handleFilterClear} aria-label="Clear filters">
                  Reset
                </button>
                <button className="btn-primary" onClick={handleFilterApply} aria-label="Apply filters">
                  Apply
                </button>
                <button className="btn-icon" aria-label="Export map data">📤</button>
              </div>
            </div>

            {/* MAP CONTAINER */}
            <div className="dash-map-container">
              <div className="dash-map-wrapper">
                <SiaraMap
                  mockMarkers={mockMarkers}
                  mapLayer={mapLayer}
                  setSelectedIncident={setSelectedIncident}
                  userPosition={null}
                />
              </div>
              
              {/* MAP LAYER TOGGLES */}
              <div className="dash-map-layers">
                <button 
                  className={`layer-toggle ${mapLayer === 'heatmap' ? 'active' : ''}`} 
                  aria-label="Heatmap layer"
                  onClick={() => setMapLayer('heatmap')}
                >
                  <span className="layer-indicator"></span>
                  Heatmap
                </button>
                <button 
                  className={`layer-toggle ${mapLayer === 'points' ? 'active' : ''}`} 
                  aria-label="Points layer"
                  onClick={() => setMapLayer('points')}
                >
                  <span className="layer-indicator"></span>
                  Points
                </button>
                <button className="layer-toggle" aria-label="Clusters layer">
                  <span className="layer-indicator"></span>
                  Clusters
                </button>
                <button className="layer-toggle" aria-label="AI predictions layer">
                  <span className="layer-indicator"></span>
                  AI Pred.
                </button>
              </div>

              {/* MAP LEGEND */}
              <div className="dash-map-legend">
                <div className="legend-title">Risk Level</div>
                <div className="legend-item"><span className="legend-dot danger"></span>High</div>
                <div className="legend-item"><span className="legend-dot warning"></span>Medium</div>
                <div className="legend-item"><span className="legend-dot info"></span>Low</div>
                <div className="legend-divider"></div>
                <div className="legend-confidence">
                  Model confidence: 92%
                  <button className="tooltip-btn" aria-label="Model info">ⓘ</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — INCIDENTS TABLE + SIDEBAR */}
        <section className="dash-section incidents-layout">
          <div className="dash-incidents-left">
            <div className="dash-card incidents-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">Recent Incidents</h2>
                <div className="header-actions">
                  <button className="btn-outline-small" aria-label="Export to CSV">
                    📤 Export CSV
                  </button>
                  <button className="btn-outline-small" aria-label="Share">
                    🔗 Share
                  </button>
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
                      <td>
                        <div className="location-cell">
                          Boulevard Zirout Youcef
                          <span className="location-verified">✓ Verified</span>
                        </div>
                      </td>
                      <td>Collision</td>
                      <td>
                        <div className="time-cell">
                          08:34
                          <span className="time-ago">45m ago</span>
                        </div>
                      </td>
                      <td><span className="status-badge verified">✓ Verified</span></td>
                      <td>
                        <button className="link-action" aria-label="View on map">
                          View on map →
                        </button>
                      </td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-2')} className="incident-row">
                      <td><span className="pill pill-medium">Medium</span></td>
                      <td>
                        <div className="location-cell">
                          RN11 – Industrial Zone
                        </div>
                      </td>
                      <td>Roadwork</td>
                      <td>
                        <div className="time-cell">
                          07:18
                          <span className="time-ago">2h ago</span>
                        </div>
                      </td>
                      <td><span className="status-badge pending">⏳ Pending</span></td>
                      <td>
                        <button className="link-action" aria-label="View on map">
                          View on map →
                        </button>
                      </td>
                    </tr>
                    <tr onClick={() => handleIncidentClick('incident-3')} className="incident-row">
                      <td><span className="pill pill-low">Low</span></td>
                      <td>
                        <div className="location-cell">
                          University District
                          <span className="location-verified">✓ Verified</span>
                        </div>
                      </td>
                      <td>Rain</td>
                      <td>
                        <div className="time-cell">
                          06:02
                          <span className="time-ago">3h ago</span>
                        </div>
                      </td>
                      <td><span className="status-badge verified">✓ Verified</span></td>
                      <td>
                        <button className="link-action" aria-label="View on map">
                          View on map →
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button className="btn-load-more" aria-label="Load more incidents">
                  Load more incidents
                </button>
              </div>
            </div>
          </div>

          <aside className="dash-incidents-right" aria-label="Incident context">
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
                  <div className="side-progress">
                    <div className="progress-bar" style={{width:'85%'}}></div>
                  </div>
                </li>
                <li className="side-item">
                  <div className="side-item-header">
                    <span className="trend-icon">🟠</span>
                    <div className="side-text">
                      <p className="side-label">East-West Highway</p>
                      <span className="side-meta">45 min ago • 🚧 Roadwork</span>
                    </div>
                  </div>
                  <div className="side-progress">
                    <div className="progress-bar" style={{width:'65%'}}></div>
                  </div>
                </li>
              </ul>
              <button className="btn-see-more">See more</button>
            </div>

            <div className="dash-card side-card priority-card">
              <div className="card-icon-header">
                <span className="header-icon">⚠️</span>
                <h2 className="dash-card-title">Priority Alerts</h2>
              </div>
              <ul className="alert-list">
                <li className="alert-item high">
                  <span className="alert-dot"></span>
                  School zone — dismissal time
                </li>
                <li className="alert-item medium">
                  <span className="alert-dot"></span>
                  East-West axis — dense fog
                </li>
                <li className="alert-item low">
                  <span className="alert-dot"></span>
                  Night roadwork scheduled
                </li>
              </ul>
              <button className="btn-primary-full" aria-label="Enable alerts">
                🔔 Enable Alerts
              </button>
            </div>

            <div className="dash-card side-card">
              <h2 className="dash-card-title">Weather Conditions</h2>
              <div className="weather-grid">
                <div className="weather-item good">
                  <span className="weather-icon">👁️</span>
                  <span className="weather-label">Visibility</span>
                  <span className="weather-value">Good</span>
                </div>
                <div className="weather-item moderate">
                  <span className="weather-icon">💨</span>
                  <span className="weather-label">Wind</span>
                  <span className="weather-value">Moderate</span>
                </div>
                <div className="weather-item risk">
                  <span className="weather-icon">🌧️</span>
                  <span className="weather-label">Rain</span>
                  <span className="weather-value">Light risk</span>
                </div>
                <div className="weather-item">
                  <span className="weather-icon">🌡️</span>
                  <span className="weather-label">Temperature</span>
                  <span className="weather-value">18°C</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* SECTION 4 — AI PREDICTIONS */}
        <section className="dash-section predictions-section">
          <div className="dash-card predictions-card">
            <div className="predictions-header">
              <div>
                <h2 className="dash-card-title">🤖 AI Risk Predictions — Today</h2>
                <p className="predictions-meta">Model v0.3 • Confidence: 92% • Demo data</p>
              </div>
              <button className="btn-outline-small" aria-label="Model information">
                Model info
              </button>
            </div>
            <ul className="predictions-list">
              <li className="prediction-item">
                <div className="prediction-header">
                  <span className="prediction-road">East-West Highway, km 120</span>
                  <div className="prediction-score-group">
                    <span className="prediction-score high">82</span>
                    <span className="score-label">Risk score</span>
                  </div>
                </div>
                <div className="prediction-bar">
                  <span style={{width:'82%'}}></span>
                </div>
                <div className="prediction-footer">
                  <span className="prediction-meta">High traffic + Rain forecast</span>
                  <button className="link-action" aria-label="View on map">
                    View on map →
                  </button>
                </div>
              </li>
              <li className="prediction-item">
                <div className="prediction-header">
                  <span className="prediction-road">RN11 — Industrial Zone</span>
                  <div className="prediction-score-group">
                    <span className="prediction-score medium">67</span>
                    <span className="score-label">Risk score</span>
                  </div>
                </div>
                <div className="prediction-bar">
                  <span style={{width:'67%'}}></span>
                </div>
                <div className="prediction-footer">
                  <span className="prediction-meta">Morning congestion</span>
                  <button className="link-action" aria-label="View on map">
                    View on map →
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* SECTION 5 — CHARTS */}
        <section className="dash-section stats-section">
          <div className="dash-stats-grid">
            <div className="dash-card stats-card">
              <h2 className="dash-card-title">Incidents (30 days)</h2>
              <div className="chart-placeholder">
                <div className="skeleton-chart"></div>
              </div>
            </div>
            <div className="dash-card stats-card">
              <h2 className="dash-card-title">By Wilaya</h2>
              <div className="chart-placeholder">
                <div className="skeleton-chart"></div>
              </div>
            </div>
            <div className="dash-card stats-card">
              <h2 className="dash-card-title">Accident Types</h2>
              <div className="chart-placeholder">
                <div className="skeleton-chart"></div>
              </div>
            </div>
            <div className="dash-card stats-card">
              <h2 className="dash-card-title">Weather vs Accidents</h2>
              <div className="chart-placeholder">
                <div className="skeleton-chart"></div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="dash-footer">
          <span>© 2025 SIARA — Prototype</span>
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
