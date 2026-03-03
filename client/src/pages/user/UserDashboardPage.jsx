/**
 * @file UserDashboardPage.jsx
 * @description Personal user dashboard providing an at-a-glance overview of road safety.
 *
 * Layout:
 *   • Top header with navigation tabs, search bar, and user avatar dropdown
 *   • Welcome bar with real-time data-freshness indicator
 *   • KPI cards row (reports count, active alerts, nearby incidents, quiz CTA)
 *   • Two-column section: interactive SiaraMap + side cards (alerts, saved routes, weather)
 *   • Reports table listing the user’s own incident submissions
 *   • Quick-actions grid for common tasks
 *
 * Features:
 *   • AuthContext integration for user name / logout
 *   • SiaraMap component with mock severity markers
 *   • DrivingQuiz pop-up triggered from multiple entry points
 *   • Weather conditions widget (visibility, wind, rain, temperature)
 */
import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/DashboardPage.css'
import '../../styles/UserDashboardPage.css'
import '../../styles/MapPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import SiaraMap from '../../components/map/SiaraMap'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ═══ MOCK DATA (simulated API responses) ═══ */

/** Nearby incidents used as map markers — each has lat/lng and a severity level */
const nearbyIncidents = [
  { id: 1, lat: 36.7525, lng: 3.04197, severity: 'high', title: 'Boulevard Zirout Youcef' },
  { id: 2, lat: 36.7600, lng: 3.05500, severity: 'medium', title: 'RN11 – Industrial Zone' },
  { id: 3, lat: 36.7450, lng: 3.03000, severity: 'low', title: 'Rue Didouche Mourad' },
]

/** User’s own submitted reports shown in the reports table */
const myReports = [
  { id: 1, title: 'Accident on RN5', status: 'verified', date: '25 Feb 2026', severity: 'high' },
  { id: 2, title: 'Slippery road — Bab el Oued', status: 'pending', date: '24 Feb 2026', severity: 'medium' },
  { id: 3, title: 'Traffic light out of order', status: 'verified', date: '22 Feb 2026', severity: 'low' },
]

/** Saved commute routes with risk assessment */
const savedRoutes = [
  { id: 1, from: 'Alger Centre', to: 'Bab Ezzouar', risk: 'low', time: '25 min' },
  { id: 2, from: 'Hussein Dey', to: 'Rouiba', risk: 'medium', time: '40 min' },
  { id: 3, from: 'El Harrach', to: 'Blida', risk: 'high', time: '1h 15min' },
]

/** Priority alerts relevant to the user’s zone */
const recentAlerts = [
  { id: 1, text: 'School zone — dismissal time', level: 'high' },
  { id: 2, text: 'Dense fog — East-West Highway', level: 'medium' },
  { id: 3, text: 'Night roadwork planned — RN11', level: 'low' },
]

export default function UserDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext) // current user session + logout action

  /* ═══ LOCAL UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false) // header avatar dropdown visibility
  const [showQuiz, setShowQuiz] = useState(false)          // DrivingQuiz modal visibility

  /* ═══ EVENT HANDLERS ═══ */
  const handleQuizComplete = (result) => { console.log('Quiz completed:', result); setShowQuiz(false) }
  const handleOpenQuiz = () => { setShowQuiz(true); setShowDropdown(false) }
  const handleLogout = () => { logout(); navigate('/home') }

  /** Derive up-to-2-letter initials from user name for the avatar button */
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'

  return (
    <div className="siara-dashboard-root">
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══ HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab dash-tab-active">Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Search for an incident, a road, a wilaya…" aria-label="Search dashboard" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{initials}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <button className="dropdown-item" onClick={handleOpenQuiz}>🚗 Driving Quiz</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={handleLogout}>🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="siara-dashboard-main">
        {/* ═══ WELCOME ═══ */}
        <div className="dash-welcome-bar">
          <div className="welcome-text">
            <h1 className="welcome-title">Hello, {user?.name || 'User'} 👋</h1>
            <p className="welcome-sub">Your personal dashboard — real-time road safety</p>
          </div>
          <div className="welcome-right">
            <div className="data-freshness">
              <span className="freshness-dot"></span>
              Live — Updated 3 min ago
            </div>
          </div>
        </div>

        {/* ═══ QUICK STATS ═══ */}
        <section className="dash-section kpi-section" aria-label="Your stats">
          <div className="dash-kpi-grid">
            <article className="kpi-card" onClick={() => navigate('/report')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">My Reports</span>
                <div className="kpi-main">
                  <span className="kpi-value">{myReports.length}</span>
                </div>
                <span className="kpi-period">total submitted</span>
              </div>
            </article>

            <article className="kpi-card" onClick={() => navigate('/alerts')} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Active Alerts</span>
                <div className="kpi-main">
                  <span className="kpi-value">{recentAlerts.length}</span>
                </div>
                <span className="kpi-period">in your area</span>
              </div>
            </article>

            <article className="kpi-card" role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Nearby Incidents</span>
                <div className="kpi-main">
                  <span className="kpi-value">{nearbyIncidents.length}</span>
                </div>
                <span className="kpi-period">25 km radius</span>
              </div>
            </article>

            <article className="kpi-card" onClick={handleOpenQuiz} role="button" tabIndex={0}>
              <div className="kpi-icon-wrap kpi-icon-danger">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">Driving Quiz</span>
                <div className="kpi-main">
                  <span className="kpi-value">🚗</span>
                </div>
                <span className="kpi-period">evaluate your profile</span>
              </div>
            </article>
          </div>
        </section>

        {/* ═══ MAP + ALERTS ═══ */}
        <section className="dash-section udash-two-col">
          <div className="dash-card udash-map-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Nearby Incidents</h2>
              <button className="btn-outline-small" onClick={() => navigate('/map')}>View full map →</button>
            </div>
            <div className="dash-map-container">
              <div className="dash-map-wrapper">
                <SiaraMap mockMarkers={nearbyIncidents} mapLayer="points" setSelectedIncident={() => {}} userPosition={{ lat: 36.7525, lng: 3.04197 }} />
              </div>
              <div className="dash-map-legend">
                <div className="legend-title">Risk Level</div>
                <div className="legend-item"><span className="legend-dot danger"></span>High</div>
                <div className="legend-item"><span className="legend-dot warning"></span>Medium</div>
                <div className="legend-item"><span className="legend-dot info"></span>Low</div>
              </div>
            </div>
          </div>

          <div className="udash-side-col">
            {/* Alerts */}
            <div className="dash-card side-card priority-card">
              <div className="card-icon-header">
                <span className="header-icon">⚠️</span>
                <h2 className="dash-card-title">Priority Alerts</h2>
              </div>
              <ul className="alert-list">
                {recentAlerts.map(a => (
                  <li key={a.id} className={`alert-item ${a.level}`}>
                    <span className="alert-dot"></span>{a.text}
                  </li>
                ))}
              </ul>
              <button className="btn-primary-full" onClick={() => navigate('/alerts')}>🔔 Manage my alerts</button>
            </div>

            {/* Saved Routes */}
            <div className="dash-card side-card">
              <h2 className="dash-card-title">Saved Routes</h2>
              <ul className="side-list">
                {savedRoutes.map(r => (
                  <li key={r.id} className="side-item">
                    <div className="side-item-header">
                      <span className="trend-icon">{r.risk === 'high' ? '🔴' : r.risk === 'medium' ? '🟠' : '🟢'}</span>
                      <div className="side-text">
                        <p className="side-label">{r.from} → {r.to}</p>
                        <span className="side-meta">{r.time} • Risk: {r.risk === 'high' ? 'high' : r.risk === 'medium' ? 'medium' : 'low'}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
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
          </div>
        </section>

        {/* ═══ MY REPORTS ═══ */}
        <section className="dash-section">
          <div className="dash-card incidents-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">My Recent Reports</h2>
              <button className="btn-outline-small" onClick={() => navigate('/report')}>+ New Report</button>
            </div>
            <div className="incidents-table-wrapper">
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myReports.map(r => (
                    <tr key={r.id} className="incident-row" onClick={() => navigate(`/incident/${r.id}`)}>
                      <td><span className={`pill pill-${r.severity}`}>{r.severity === 'high' ? 'High' : r.severity === 'medium' ? 'Medium' : 'Low'}</span></td>
                      <td>{r.title}</td>
                      <td>{r.date}</td>
                      <td><span className={`status-badge ${r.status}`}>{r.status === 'verified' ? '✓ Verified' : '⏳ Pending'}</span></td>
                      <td><button className="link-action">View →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══ QUICK ACTIONS ═══ */}
        <section className="dash-section udash-actions-section">
          <h2 className="section-heading">Quick Actions</h2>
          <div className="udash-actions-grid">
            <button className="udash-action-card" onClick={() => navigate('/report')}>
              <span className="action-icon">📝</span>
              <span className="action-label">Report an Incident</span>
            </button>
            <button className="udash-action-card" onClick={() => navigate('/predictions')}>
              <span className="action-icon">🤖</span>
              <span className="action-label">AI Predictions</span>
            </button>
            <button className="udash-action-card" onClick={() => navigate('/alerts/create')}>
              <span className="action-icon">🔔</span>
              <span className="action-label">Create an Alert</span>
            </button>
            <button className="udash-action-card" onClick={handleOpenQuiz}>
              <span className="action-icon">🚗</span>
              <span className="action-label">Driving Quiz</span>
            </button>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="dash-footer">
          <span>© 2026 SIARA — Prototype</span>
          <span className="footer-divider">•</span>
          <span>Simulated Data</span>
          <span className="footer-divider">•</span>
          <button className="footer-link" onClick={() => navigate('/about')}>About</button>
          <span className="footer-divider">•</span>
          <button className="footer-link" onClick={() => navigate('/contact')}>Contact</button>
        </footer>
      </main>
    </div>
  )
}
