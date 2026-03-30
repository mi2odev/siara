/**
 * @file PredictionsPage.jsx
 * @description AI-powered predictions page showcasing the SIARA risk-analysis engine.
 *
 * Layout: 3-column (sidebar-left / center feed / sidebar-right)
 *   - Left sidebar:  user profile card, navigation menu, model summary, data sources widget
 *   - Center:        hero banner with KPIs, feature preview cards, mock chart visualization,
 *                    risk-zone ranking table, "how it works" explainer, tech stack banner
 *   - Right sidebar: model status metrics, forecast snapshot, feature importance bars,
 *                    live activity feed, CTA card, predictive alerts widget
 *
 * Features:
 *   - Live clock updated every minute (displayed in hero)
 *   - DrivingQuiz integration (popup triggered from sidebar nav)
 *   - Mock risk-zone data with severity scoring & trend arrows
 *   - Tabbed visualization placeholder (heatmap / timeline / clusters)
 */
import React, { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import '../../styles/PredictionsPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ═══ MOCK DATA — risk zones ranked by predicted score ═══ */
const riskZones = [
  { rank: 1, name: 'Alger Centre', wilaya: 'Alger',    score: 92, trend: '+8',  severity: 'high' },
  { rank: 2, name: 'Bab Ezzouar',  wilaya: 'Alger',    score: 84, trend: '+3',  severity: 'high' },
  { rank: 3, name: 'Es-Sénia',     wilaya: 'Oran',     score: 71, trend: '-2',  severity: 'medium' },
  { rank: 4, name: 'El Khroub',    wilaya: 'Constantine', score: 65, trend: '+1', severity: 'medium' },
  { rank: 5, name: 'Hydra',        wilaya: 'Alger',    score: 48, trend: '-5',  severity: 'low' },
]

/* Mock real-time activity log entries */
const activityFeed = [
  { id: 1, icon: '🔴', text: 'Risk peak detected – RN5 Algiers', time: '2 min ago', type: 'critical' },
  { id: 2, icon: '🟡', text: 'Model recalibrated – Bab Ezzouar area', time: '15 min ago', type: 'warning' },
  { id: 3, icon: '🟢', text: 'Risk reduced – Hydra after roadwork', time: '32 min ago', type: 'success' },
  { id: 4, icon: '🔵', text: 'New weather dataset integrated', time: '1h ago', type: 'info' },
  { id: 5, icon: '🟡', text: 'School alert – Bir Mourad Raïs 08h', time: '1h 20 min ago', type: 'warning' },
]

/* Data sources feeding the ML model */
const dataSources = [
  { name: 'Citizen reports', count: '12,847', status: 'live', icon: '👥' },
  { name: 'Weather sensors (ONM)',  count: '48 stations', status: 'live', icon: '🌤️' },
  { name: 'DGRSDT traffic flow',    count: '340 sensors', status: 'live', icon: '🚦' },
  { name: 'DGSN historical data',   count: '5 years', status: 'synced', icon: '📋' },
]

export default function PredictionsPage() {
  /* ═══ STATE ═══ */
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)  // Header avatar dropdown
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [showQuiz, setShowQuiz] = useState(false)          // DrivingQuiz popup visibility
  const [vizTab, setVizTab] = useState('heatmap')          // Active visualization tab
  const [liveTime, setLiveTime] = useState(new Date())     // Clock displayed in hero banner

  /* ═══ LIVE CLOCK EFFECT — ticks every 60 s ═══ */
  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Callback when DrivingQuiz finishes
  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  // Format Date as HH:MM (French-Algerian locale)
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const profileName = String(
    user?.name
      || user?.fullName
      || user?.full_name
      || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
      || user?.email
      || 'SIARA User',
  ).trim()
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleClass = primaryRole === 'admin'
    ? 'role-admin'
    : primaryRole === 'police'
      ? 'role-police'
      : 'role-citoyen'
  const profileInitials = profileName
    ? profileName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : 'U'

  /* ═══ RENDER ═══ */
  return (
    <div className="siara-news-root">
      {/* DRIVING QUIZ POPUP */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ── 1. FLOATING HEADER ── */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab dash-tab-active">Predictions</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya…"
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}><span className="notification-badge"></span></button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{profileInitials}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN LAYOUT — 3 Columns ═══ */}
      <div className="siara-news-layout">

        {/* ═══ LEFT SIDEBAR — profile, nav, model info, data sources ═══ */}
        <aside className="sidebar-left">
          {/* Profile Summary */}
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">V</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/home')}><span className="nav-accent"></span><span className="nav-icon">🏠</span><span className="nav-label">Home</span></button>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">News Feed</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Incident Map</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">🔮</span><span className="nav-label">Predictions</span></button>

            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Driver Quiz</span></button>
            <button className="nav-item" onClick={() => navigate('/dashboard')}><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Statistics</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alerts</span></button>

            <div className="nav-section-label">SETTINGS</div>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Settings</span></button>
          </nav>

          {/* Model Summary Widget */}
          <div className="card pred-model-sidebar">
            <h3 className="card-title">🧠 AI Model</h3>
            <div className="pred-model-rows">
              <div className="pred-model-row"><span>Version</span><span className="pred-model-val">v1.2</span></div>
              <div className="pred-model-row"><span>Algorithm</span><span className="pred-model-val">LightGBM + CatBoost</span></div>
              <div className="pred-model-row"><span>Last Update</span><span className="pred-model-val">Today</span></div>
              <div className="pred-model-row"><span>Status</span><span className="pred-model-val green">● Active</span></div>
              <div className="pred-model-row"><span>Accuracy</span><span className="pred-model-val blue">89.2%</span></div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="card pred-sources-sidebar">
            <h3 className="card-title">📡 Data Sources</h3>
            <div className="pred-sources-list">
              {dataSources.map((s, i) => (
                <div key={i} className="pred-source-item">
                  <span className="pred-source-icon">{s.icon}</span>
                  <div className="pred-source-info">
                    <span className="pred-source-name">{s.name}</span>
                    <span className="pred-source-count">{s.count}</span>
                  </div>
                  <span className={`pred-source-dot ${s.status}`}></span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ═══ CENTER FEED — hero, features, viz, risk table, how-it-works, tech stack ═══ */}
        <main className="feed-center">

          {/* A. Hero Section — live badge, clock, KPI strip */}
          <div className="pred-hero">
            <div className="pred-hero-top">
              <div className="pred-hero-badge">
                <span className="pulse-dot"></span>
                AI Model Active
              </div>
              <span className="pred-hero-clock">🕐 {fmtTime(liveTime)}</span>
            </div>
            <h1>Advanced <span>Predictions</span></h1>
            <p className="pred-hero-subtitle">
              Harness the power of our machine-learning-based predictive engine to anticipate risk zones,
              analyze temporal trends, and make informed decisions in real time.
            </p>
            {/* Hero KPI Strip */}
            <div className="pred-hero-kpis">
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">12 847</span>
                <span className="pred-hero-kpi-label">Data Points Analyzed</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">48</span>
                <span className="pred-hero-kpi-label">Provinces Covered</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">89.2%</span>
                <span className="pred-hero-kpi-label">Accuracy</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">&lt; 2s</span>
                <span className="pred-hero-kpi-label">Response Time</span>
              </div>
            </div>
          </div>

          {/* B. Feature Preview Cards — heatmaps, time series, export */}
          <div className="pred-features-grid">
            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon heatmap">🗺️</div>
                <span className="pred-feature-status ready">● Ready</span>
              </div>
              <h3>Heat Maps</h3>
              <p>Visualization of accident density zones with dynamic risk layer overlay across 48 provinces.</p>
              <div className="pred-feature-meta">
                <span>🔄 Update: 5 min</span>
                <span>📍 48 provinces</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon timeseries">📈</div>
                <span className="pred-feature-status beta">◐ Beta</span>
              </div>
              <h3>Time Series</h3>
              <p>Predictive analysis by time slot and seasonality with LSTM and LightGBM models trained on 5 years of data.</p>
              <div className="pred-feature-meta">
                <span>⏱️ Horizon: 24h</span>
                <span>📊 RMSE : 0.12</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon export">📤</div>
                <span className="pred-feature-status coming">○ Coming Soon</span>
              </div>
              <h3>Export &amp; Reports</h3>
              <p>Automatic generation of PDF reports and CSV/GeoJSON export for authorities and researchers.</p>
              <div className="pred-feature-meta">
                <span>📄 PDF, CSV, GeoJSON</span>
                <span>🔐 Certified</span>
              </div>
            </div>
          </div>

          {/* C. Mock Visualization — tabbed bar chart with lock overlay */}
          <div className="pred-viz-card">
            <div className="pred-viz-header">
              <h3>📊 Predictive Overview — Risk Distribution by Zone</h3>
              <div className="pred-viz-tabs">
                <button className={`pred-viz-tab ${vizTab === 'heatmap' ? 'active' : ''}`} onClick={() => setVizTab('heatmap')}>Heatmap</button>
                <button className={`pred-viz-tab ${vizTab === 'timeline' ? 'active' : ''}`} onClick={() => setVizTab('timeline')}>Timeline</button>
                <button className={`pred-viz-tab ${vizTab === 'clusters' ? 'active' : ''}`} onClick={() => setVizTab('clusters')}>Clusters</button>
              </div>
            </div>
            <div className="pred-viz-body">
              <div className="pred-mock-chart">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="pred-mock-bar" />
                ))}
              </div>
              <div className="pred-viz-x-axis">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                  <span key={m}>{m}</span>
                ))}
              </div>
              <div className="pred-viz-overlay">
                <span className="pred-viz-overlay-icon">🔒</span>
                <span className="pred-viz-overlay-text">Full visualization coming soon</span>
                <span className="pred-viz-overlay-sub">The model is being calibrated on your regional data</span>
              </div>
            </div>
          </div>

          {/* D. Top Risk Zones Table — ranked by AI score */}
          <div className="pred-zones-card">
            <div className="pred-zones-header">
              <h3>🏙️ Risk Zone Ranking</h3>
              <span className="pred-zones-updated">Updated: {fmtTime(liveTime)}</span>
            </div>
            <table className="pred-zones-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Zone</th>
                  <th>Wilaya</th>
                  <th>Score</th>
                  <th>Trend</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {riskZones.map((z) => (
                  <tr key={z.rank}>
                    <td className="pred-zone-rank">{z.rank}</td>
                    <td className="pred-zone-name">{z.name}</td>
                    <td className="pred-zone-wilaya">{z.wilaya}</td>
                    <td>
                      <div className="pred-zone-score-wrap">
                        <div className="pred-zone-score-bar">
                          <div className={`pred-zone-score-fill ${z.severity}`} style={{ width: `${z.score}%` }}></div>
                        </div>
                        <span className="pred-zone-score-num">{z.score}</span>
                      </div>
                    </td>
                    <td className={`pred-zone-trend ${z.trend.startsWith('+') ? 'up' : 'down'}`}>{z.trend.startsWith('+') ? '↑' : '↓'} {z.trend}</td>
                    <td><span className={`pred-severity-badge ${z.severity}`}>{z.severity === 'high' ? 'High' : z.severity === 'medium' ? 'Moderate' : 'Low'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* E. How it Works — 4-step pipeline explainer */}
          <div className="pred-how-card">
            <h3>💡 How Does It Work?</h3>
            <div className="pred-how-steps">
              <div className="pred-how-step">
                <div className="pred-how-num">1</div>
                <div className="pred-how-content">
                  <h4>Data Collection</h4>
                  <p>Citizen reports, ONM weather sensors, DGSN historical data (5 years), and real-time DGRSDT traffic flow combined in a unified pipeline.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">2</div>
                <div className="pred-how-content">
                  <h4>Feature Engineering</h4>
                  <p>Extraction of 120+ variables: weather conditions, road density, hour/day/season, proximity to schools/hospitals, history by zone.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">3</div>
                <div className="pred-how-content">
                  <h4>Predictive Model</h4>
                  <p>LightGBM + CatBoost ensemble with temporal cross-validation. Risk score 0–100 generated by geographic zone and time slot.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">4</div>
                <div className="pred-how-content">
                  <h4>Smart Alerts</h4>
                  <p>Proactive push notifications sent to users before entering a high-risk zone, with suggested alternate route.</p>
                </div>
              </div>
            </div>
          </div>

          {/* F. Tech Stack Banner — icons for Python, LightGBM, CatBoost, etc. */}
          <div className="pred-tech-card">
            <h3>🛠️ Technology Stack</h3>
            <div className="pred-tech-grid">
              <div className="pred-tech-item"><span className="pred-tech-logo">🐍</span><span>Python</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">⚡</span><span>LightGBM</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🐱</span><span>CatBoost</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🧠</span><span>Scikit-learn</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">📊</span><span>Pandas</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">⚛️</span><span>React</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🗺️</span><span>Leaflet</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🟢</span><span>Node.js</span></div>
            </div>
          </div>

        </main>

        {/* ═══ RIGHT SIDEBAR — model status, forecast, feature importance, activity, CTA ═══ */}
        <aside className="sidebar-right">

          {/* A. Prediction Status — model version, algo, confidence + metric trio */}
          <div className="pred-status-card">
            <h3>⚡ Model Status</h3>
            <div className="pred-status-row">
              <span className="pred-status-label">Version</span>
              <span className="pred-status-value">SIARA v1.2</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Algorithm</span>
              <span className="pred-status-value">LightGBM</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Last Update</span>
              <span className="pred-status-value blue">Today, 08:30</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Overall Confidence</span>
              <span className="pred-status-value green">89%</span>
            </div>
            <div className="pred-confidence-bar">
              <div className="pred-confidence-fill" style={{ width: '89%' }}></div>
            </div>
            <div className="pred-status-metrics">
              <div className="pred-metric"><span className="pred-metric-label">Accuracy</span><span className="pred-metric-val">89.2%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">Recall</span><span className="pred-metric-val">85.7%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">F1-Score</span><span className="pred-metric-val">87.4%</span></div>
            </div>
          </div>

          {/* B. Forecast Snapshot — risk level bars at 6h / 12h / 18h / 24h / 48h */}
          <div className="pred-forecast-card">
            <h3>📅 Risk Forecast</h3>
            <div className="pred-forecast-items">
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">6h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '25%' }}></div></div>
                <span className="pred-forecast-label low">Low</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">12h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '60%' }}></div></div>
                <span className="pred-forecast-label medium">Moderate</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">18h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill high" style={{ width: '85%' }}></div></div>
                <span className="pred-forecast-label high">High</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">24h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '50%' }}></div></div>
                <span className="pred-forecast-label medium">Moderate</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">48h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '30%' }}></div></div>
                <span className="pred-forecast-label low">Low</span>
              </div>
            </div>
          </div>

          {/* C. Model Transparency — feature importance horizontal bars */}
          <div className="pred-transparency-card">
            <h3>🔍 Feature Importance</h3>
            <div className="pred-factor">
              <span className="pred-factor-name">Weather</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '78%' }}></div></div>
              <span className="pred-factor-pct">78%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Hour</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '65%' }}></div></div>
              <span className="pred-factor-pct">65%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Traffic</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '52%' }}></div></div>
              <span className="pred-factor-pct">52%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">History</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '44%' }}></div></div>
              <span className="pred-factor-pct">44%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Road Infra.</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '38%' }}></div></div>
              <span className="pred-factor-pct">38%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Day/Season</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '31%' }}></div></div>
              <span className="pred-factor-pct">31%</span>
            </div>
          </div>

          {/* D. Live Activity Feed — real-time model events */}
          <div className="pred-activity-card">
            <h3>📡 Live Activity</h3>
            <div className="pred-activity-list">
              {activityFeed.map((a) => (
                <div key={a.id} className={`pred-activity-item ${a.type}`}>
                  <span className="pred-activity-icon">{a.icon}</span>
                  <div className="pred-activity-info">
                    <span className="pred-activity-text">{a.text}</span>
                    <span className="pred-activity-time">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* E. CTA — early access call-to-action */}
          <div className="pred-cta-card">
            <h4>🚀 Early Access</h4>
            <p>Be among the first to test real-time predictions on your daily route.</p>
            <button className="pred-cta-btn" onClick={() => navigate('/map')}>View on Map</button>
          </div>

          {/* F. Predictive Alerts — upcoming risk warnings */}
          <div className="card widget-alerts">
            <h3 className="widget-title">Predictive Alerts</h3>
            <div className="alert-item">• Risk peak expected at 5 PM – Algiers Centre</div>
            <div className="alert-item">• Heavy rain expected tomorrow morning</div>
            <div className="alert-item">• School zone – increased risk 08h-09h</div>
            <div className="alert-item">• Fog expected A1 – reduced visibility</div>
            <button className="btn-activate-alerts" onClick={() => navigate('/alerts')}>Manage Alerts</button>
          </div>

        </aside>
      </div>
    </div>
  )
}