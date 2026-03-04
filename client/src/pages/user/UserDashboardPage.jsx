/**
 * @file UserDashboardPage.jsx
 * @description Professional intelligence dashboard — 9 structured data sections.
 *
 * Layout: sidebar-left + wide center feed (no right sidebar)
 *
 * Sections:
 *   1. Risk Overview           5. Contributing Factors    9. Active Alerts + Efficiency
 *   2. Volatility Index        6. Personal Exposure Score
 *   3. Severity Pressure       7. 48h Risk Forecast
 *   4. 24h Distribution        8. Top Risk Roads
 */
import React, { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import '../../styles/UserDashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ═══════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════ */

const weeklyTrend     = [42, 47, 44, 52, 58, 55, 61]
const weekLabels      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const volatilityTrend = [30, 38, 25, 44, 50, 42, 47]

const hourlyDist = [
  { label: '00:00 – 06:00', count: 12, pct: 10, peak: false },
  { label: '06:00 – 12:00', count: 34, pct: 28, peak: false },
  { label: '12:00 – 18:00', count: 41, pct: 34, peak: true  },
  { label: '18:00 – 24:00', count: 35, pct: 29, peak: false },
]

const sevPressure = {
  high:   { pct: 34, change: +5 },
  medium: { pct: 41, change: -2 },
  low:    { pct: 25, change: -3 },
}

const factors = [
  { label: 'Traffic density',            pct: '+28%', icon: '🚗' },
  { label: 'Rain forecast',              pct: '+17%', icon: '🌧️' },
  { label: 'Poor visibility',            pct: '+12%', icon: '🌫️' },
  { label: 'Road type (urban junction)', pct: null,   icon: '🛣️' },
]

const forecast48h = [55, 48, 43, 52, 64, 68, 58, 50, 46, 54, 66, 74, 62]
const fcLabels    = ['Now', '+4h', '+8h', '+12h', '+16h', '+20h', '+24h',
                     '+28h', '+32h', '+36h', '+40h', '+44h', '+48h']

const topRoads = [
  { rank: 1, road: 'A1 Highway (Bab Ezzouar)', score: 92, change: '+8%' },
  { rank: 2, road: 'RN5 – Rouiba Stretch',     score: 84, change: '+3%' },
  { rank: 3, road: 'Rocade Sud – Birtouta',     score: 71, change: '-2%' },
]

const activeAlerts = [
  { id: 1, alert: 'Multi-car collision',    area: 'A1 Highway',      severity: 'high',   lastTrigger: '15 min ago', status: 'active'    },
  { id: 2, alert: 'Dense fog warning',      area: 'East-West Hwy',   severity: 'high',   lastTrigger: '32 min ago', status: 'active'    },
  { id: 3, alert: 'Lane closure',           area: 'Bab Ezzouar',     severity: 'medium', lastTrigger: '1h ago',     status: 'active'    },
  { id: 4, alert: 'School zone congestion', area: 'Bir Mourad Raïs', severity: 'medium', lastTrigger: '2h ago',     status: 'active'    },
  { id: 5, alert: 'Night roadwork',         area: 'RN11',            severity: 'low',    lastTrigger: '3h ago',     status: 'scheduled' },
]

const alertEff = { triggered: 12, matchedHigh: 83, falseRatio: 8 }

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

export default function UserDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuiz, setShowQuiz]         = useState(false)
  const [liveTime, setLiveTime]         = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const handleQuizComplete = (r) => { console.log('Quiz:', r); setShowQuiz(false) }
  const handleLogout        = () => { logout(); navigate('/home') }
  const fmtTime             = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  /* ── Reusable SVG sparkline ── */
  const Sparkline = ({ data, w = 200, h = 48, gid = 'spk' }) => {
    const pad = 4
    const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1
    const pts = data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * (w - 2 * pad),
      y: h - pad - ((v - min) / rng) * (h - 2 * pad),
    }))
    const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ud-sparkline">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--siara-primary)" stopOpacity=".15" />
            <stop offset="100%" stopColor="var(--siara-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${pad},${h - pad} ${poly} ${w - pad},${h - pad}`} fill={`url(#${gid})`} />
        <polyline points={poly} fill="none" stroke="var(--siara-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--siara-primary)" />)}
      </svg>
    )
  }

  /* ── 48 h forecast line chart ── */
  const ForecastChart = () => {
    const w = 680, h = 130, px = 36, py = 16
    const max = Math.max(...forecast48h), min = Math.min(...forecast48h), rng = max - min || 1
    const pts = forecast48h.map((v, i) => ({
      x: px + (i / (forecast48h.length - 1)) * (w - 2 * px),
      y: py + ((max - v) / rng) * (h - 2 * py),
      v,
    }))
    const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="ud-forecast-svg">
        <defs>
          <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--siara-primary)" stopOpacity=".10" />
            <stop offset="100%" stopColor="var(--siara-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[.25, .5, .75].map(p => (
          <line key={p} x1={px} x2={w - px} y1={py + p * (h - 2 * py)} y2={py + p * (h - 2 * py)} stroke="#F1F5F9" strokeWidth="1" />
        ))}
        <polygon points={`${px},${h - py} ${poly} ${w - px},${h - py}`} fill="url(#fcFill)" />
        <polyline points={poly} fill="none" stroke="var(--siara-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.v >= 70 ? 4 : 3} fill={p.v >= 70 ? '#DC2626' : 'var(--siara-primary)'} />
        ))}
        {fcLabels.map((lbl, i) => {
          if (i % 2 !== 0 && i !== forecast48h.length - 1) return null
          return (
            <text key={lbl} x={px + (i / (forecast48h.length - 1)) * (w - 2 * px)} y={h - 1}
              textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="inherit">{lbl}</text>
          )
        })}
        <text x={px - 6} y={py + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{max}</text>
        <text x={px - 6} y={h - py + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{min}</text>
      </svg>
    )
  }

  const SeverityPill = ({ level }) => (
    <span className={`ud-severity-pill ${level}`}>{level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}</span>
  )

  const RiskBar = ({ score }) => (
    <div className="ud-risk-bar-track">
      <div className={`ud-risk-bar-fill ${score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'}`} style={{ width: `${score}%` }} />
    </div>
  )

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="siara-news-root">
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══ HEADER ═══ */}
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
              <button className="dash-tab dash-tab-active">Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Search for an incident, a road, a wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={handleLogout}>🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ 3-COLUMN LAYOUT ═══ */}
      <div className="siara-news-layout">

        {/* ═══ LEFT SIDEBAR ═══ */}
        <aside className="sidebar-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">Zitouni Mohamed</p>
              <span className="role-badge role-citoyen">Citizen</span>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">Feed</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Map</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alerts</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></button>
            <button className="nav-item" onClick={() => navigate('/predictions')}><span className="nav-accent"></span><span className="nav-icon">🔮</span><span className="nav-label">Predictions</span></button>
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Driver Quiz</span></button>
            <button className="nav-item" onClick={() => navigate('/report')}><span className="nav-accent"></span><span className="nav-icon">📝</span><span className="nav-label">Report</span></button>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Settings</span></button>
          </nav>
        </aside>

        {/* ═══ CENTER — DASHBOARD FEED ═══ */}
        <main className="feed-center ud-feed-wide">

          {/* ────────────────────────────────────────
              1. RISK OVERVIEW  (hero section)
              ──────────────────────────────────────── */}
          <section className="card ud-section ud-risk-overview">
            <div className="ud-section-header">
              <h2 className="ud-section-title">Your Current Risk Overview</h2>
              <div className="ud-freshness">
                <span className="ud-pulse-dot"></span>
                Updated {fmtTime(liveTime)}
              </div>
            </div>
            <div className="ud-risk-hero">
              <div className="ud-risk-level-block">
                <div className="ud-risk-badge moderate">
                  <span className="ud-risk-score">61</span>
                  <span className="ud-risk-label-text">Moderate</span>
                </div>
                <div className="ud-risk-meta">
                  <span className="ud-trend up">↑ +12% vs yesterday</span>
                  <span className="ud-confidence">AI Confidence: <strong>87%</strong></span>
                </div>
              </div>
              <div className="ud-risk-sparkline">
                <span className="ud-sparkline-label">7-day trend</span>
                <Sparkline data={weeklyTrend} gid="riskSpk" />
                <div className="ud-sparkline-days">
                  {weekLabels.map(d => <span key={d}>{d}</span>)}
                </div>
              </div>
            </div>
          </section>

          {/* ────────────────────────────────────────
              2 + 3. VOLATILITY INDEX  |  SEVERITY PRESSURE  (2-up)
              ──────────────────────────────────────── */}
          <div className="ud-grid-2up">

            {/* 2. Risk Volatility Index */}
            <section className="card ud-section ud-volatility">
              <h3 className="ud-mini-title">Risk Volatility Index</h3>
              <div className="ud-vol-row">
                <div className="ud-vol-score-block">
                  <span className="ud-vol-score">47</span>
                  <span className="ud-vol-of">/100</span>
                </div>
                <div className="ud-vol-meta">
                  <span className="ud-vol-change down">↓ -3% <span className="ud-vol-period">24h</span></span>
                  <span className="ud-vol-level medium">Medium Volatility</span>
                </div>
              </div>
              <Sparkline data={volatilityTrend} w={320} h={40} gid="volSpk" />
              <div className="ud-sparkline-days ud-sparkline-days--sm">
                {weekLabels.map(d => <span key={d}>{d}</span>)}
              </div>
            </section>

            {/* 3. Severity Pressure Indicator */}
            <section className="card ud-section ud-severity-pressure">
              <h3 className="ud-mini-title">Severity Pressure</h3>
              <div className="ud-sev-bar-track">
                <div className="ud-sev-seg high"   style={{ width: `${sevPressure.high.pct}%` }}></div>
                <div className="ud-sev-seg medium" style={{ width: `${sevPressure.medium.pct}%` }}></div>
                <div className="ud-sev-seg low"    style={{ width: `${sevPressure.low.pct}%` }}></div>
              </div>
              <div className="ud-sev-legend">
                {Object.entries(sevPressure).map(([key, { pct, change }]) => (
                  <div key={key} className="ud-sev-item">
                    <span className={`ud-sev-dot ${key}`}></span>
                    <span className="ud-sev-key">{key === 'high' ? 'High' : key === 'medium' ? 'Medium' : 'Low'}</span>
                    <span className="ud-sev-pct">{pct}%</span>
                    <span className={`ud-sev-arrow ${change >= 0 ? 'up' : 'down'}`}>
                      {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="ud-sev-caption">Change vs last week</p>
            </section>
          </div>

          {/* ────────────────────────────────────────
              4. 24-HOUR INCIDENT DISTRIBUTION
              ──────────────────────────────────────── */}
          <section className="card ud-section ud-distribution">
            <h3 className="ud-mini-title">24-Hour Incident Distribution</h3>
            <div className="ud-dist-bars">
              {hourlyDist.map((block, i) => (
                <div key={i} className={`ud-dist-row ${block.peak ? 'peak' : ''}`}>
                  <span className="ud-dist-label">{block.label}</span>
                  <div className="ud-dist-bar-track">
                    <div
                      className={`ud-dist-bar-fill ${block.peak ? 'peak' : ''}`}
                      style={{ width: `${(block.pct / 34) * 100}%` }}
                    ></div>
                  </div>
                  <span className="ud-dist-count">{block.count} incidents</span>
                </div>
              ))}
            </div>
            <p className="ud-dist-caption">Peak risk occurs between 17:00–19:00.</p>
          </section>

          {/* ────────────────────────────────────────
              5 + 6. CONTRIBUTING FACTORS  |  EXPOSURE SCORE  (2-up)
              ──────────────────────────────────────── */}
          <div className="ud-grid-2up">

            {/* 5. Top Contributing Factors */}
            <section className="card ud-section ud-factors">
              <h3 className="ud-mini-title">Top Contributing Factors</h3>
              <div className="ud-factor-list">
                {factors.map((f, i) => (
                  <div key={i} className="ud-factor-row">
                    <span className="ud-factor-icon">{f.icon}</span>
                    <span className="ud-factor-label">{f.label}</span>
                    {f.pct && <span className="ud-factor-pct">{f.pct}</span>}
                  </div>
                ))}
              </div>
              <p className="ud-factor-caption">Explains why risk increased.</p>
            </section>

            {/* 6. Personal Exposure Score */}
            <section className="card ud-section ud-exposure">
              <h3 className="ud-mini-title">Your Exposure Index</h3>
              <div className="ud-exp-level-row">
                <div className="ud-exp-badge moderate">Moderate</div>
              </div>
              <div className="ud-exp-metrics">
                <div className="ud-exp-metric">
                  <span className="ud-exp-value">3</span>
                  <span className="ud-exp-label">Monitored zones</span>
                </div>
                <div className="ud-exp-metric">
                  <span className="ud-exp-value">5</span>
                  <span className="ud-exp-label">Active alerts</span>
                </div>
                <div className="ud-exp-metric">
                  <span className="ud-exp-value">Daily</span>
                  <span className="ud-exp-label">Commute detected</span>
                </div>
              </div>
            </section>
          </div>

          {/* ────────────────────────────────────────
              7. RISK FORECAST — NEXT 48 HOURS
              ──────────────────────────────────────── */}
          <section className="card ud-section ud-forecast">
            <div className="ud-section-header">
              <h3 className="ud-mini-title" style={{ marginBottom: 0 }}>Risk Forecast — Next 48 Hours</h3>
            </div>
            <ForecastChart />
            <p className="ud-forecast-caption">Expected increase tomorrow evening due to forecasted rain and reduced visibility.</p>
          </section>

          {/* ────────────────────────────────────────
              8. HIGH-RISK ROAD RANKING
              ──────────────────────────────────────── */}
          <section className="card ud-section ud-roads">
            <div className="ud-section-header">
              <h3 className="ud-mini-title" style={{ marginBottom: 0 }}>High-Risk Road Ranking</h3>
            </div>
            <div className="ud-table-wrapper">
              <table className="ud-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Road</th>
                    <th>Risk Score</th>
                    <th>Change</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {topRoads.map(r => (
                    <tr key={r.rank}>
                      <td className="ud-road-rank">{r.rank}</td>
                      <td className="ud-cell-primary">{r.road}</td>
                      <td>
                        <div className="ud-score-cell">
                          <span className={`ud-score-value ${r.score >= 80 ? 'high' : r.score >= 50 ? 'medium' : 'low'}`}>{r.score}</span>
                          <RiskBar score={r.score} />
                        </div>
                      </td>
                      <td>
                        <span className={`ud-trend ${r.change.startsWith('+') ? 'up' : 'down'}`}>
                          {r.change.startsWith('+') ? '↑' : '↓'} {r.change}
                        </span>
                      </td>
                      <td>
                        <button className="ud-map-btn" onClick={() => navigate('/map')}>Map →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ────────────────────────────────────────
              9. ACTIVE ALERTS + ALERT EFFICIENCY
              ──────────────────────────────────────── */}
          <section className="card ud-section ud-alerts-section">
            <div className="ud-section-header">
              <h2 className="ud-section-title">Active Alerts</h2>
              <button className="ud-link-btn" onClick={() => navigate('/alerts')}>View all →</button>
            </div>

            {/* Efficiency KPI strip */}
            <div className="ud-efficiency-strip">
              <div className="ud-eff-kpi">
                <span className="ud-eff-value">{alertEff.triggered}</span>
                <span className="ud-eff-label">Triggered this week</span>
              </div>
              <div className="ud-eff-kpi">
                <span className="ud-eff-value">{alertEff.matchedHigh}%</span>
                <span className="ud-eff-label">Matched high severity</span>
              </div>
              <div className="ud-eff-kpi">
                <span className="ud-eff-value">{alertEff.falseRatio}%</span>
                <span className="ud-eff-label">False alert ratio</span>
              </div>
            </div>

            <div className="ud-table-wrapper">
              <table className="ud-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Area</th>
                    <th>Severity</th>
                    <th>Last Trigger</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAlerts.map(a => (
                    <tr key={a.id}>
                      <td className="ud-cell-primary">{a.alert}</td>
                      <td>{a.area}</td>
                      <td><SeverityPill level={a.severity} /></td>
                      <td className="ud-cell-muted">{a.lastTrigger}</td>
                      <td>
                        <span className={`ud-status-dot ${a.status}`}></span>
                        {a.status === 'active' ? 'Active' : 'Scheduled'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <aside className="sidebar-right ud-sidebar-right">

          {/* Most Volatile Zone Today */}
          <div className="card ud-context-card">
            <h3 className="ud-context-title">
              <span className="ud-context-icon">🔎</span>
              Most Volatile Zone Today
            </h3>
            <div className="ud-volatile-zone">
              <span className="ud-zone-name">Alger Centre</span>
              <span className="ud-zone-score">Risk: <strong>92</strong></span>
              <span className="ud-zone-change up">↑ +8% risk change</span>
            </div>
            <button className="ud-context-btn" onClick={() => navigate('/map')}>
              View on Map →
            </button>
          </div>

          {/* AI Insight of the Week */}
          <div className="card ud-context-card ud-insight-card">
            <h3 className="ud-context-title">
              <span className="ud-context-icon">🧠</span>
              AI Insight of the Week
            </h3>
            <ul className="ud-insight-list">
              <li>Evening congestion remains the dominant risk factor in urban areas.</li>
              <li>Rain-related incidents increased 23% this week compared to last.</li>
              <li>School zones show peak risk between 07:30–08:15 and 15:45–16:30.</li>
            </ul>
          </div>

          {/* System Health */}
          <div className="card ud-context-card">
            <h3 className="ud-context-title">
              <span className="ud-context-icon">📊</span>
              System Overview
            </h3>
            <div className="ud-sys-kpis">
              <div className="ud-sys-kpi">
                <span className="ud-sys-value">248</span>
                <span className="ud-sys-label">Total incidents</span>
              </div>
              <div className="ud-sys-kpi">
                <span className="ud-sys-value">87%</span>
                <span className="ud-sys-label">AI confidence</span>
              </div>
              <div className="ud-sys-kpi">
                <span className="ud-sys-value ud-trend up">+18%</span>
                <span className="ud-sys-label">vs last week</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card ud-context-card">
            <h3 className="ud-context-title">
              <span className="ud-context-icon">⚡</span>
              Quick Actions
            </h3>
            <div className="ud-quick-actions">
              <button className="ud-action-link" onClick={() => navigate('/report')}>📝 Report Incident</button>
              <button className="ud-action-link" onClick={() => navigate('/alerts/create')}>🔔 Create Alert</button>
              <button className="ud-action-link" onClick={() => setShowQuiz(true)}>🚗 Driving Quiz</button>
            </div>
          </div>

        </aside>
      </div>
    </div>
  )
}
