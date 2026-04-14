import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import '../../styles/UserDashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import { fetchDashboard } from '../../services/dashboardService'

const EMPTY_DASHBOARD = {
  profile: { name: 'SIARA User', role: 'citizen', monitoredZones: 0, activeAlerts: 0 },
  currentRiskOverview: { score: null, label: 'Unavailable', changeVsYesterday: null, aiConfidence: null, updatedAt: null, trend7d: [0, 0, 0, 0, 0, 0, 0] },
  riskVolatilityIndex: { score: 0, label: 'Unavailable', change24h: null, trend7d: [0, 0, 0, 0, 0, 0, 0] },
  severityPressure: { high: 0, medium: 0, low: 0, highChange: 0, mediumChange: 0, lowChange: 0 },
  mostVolatileZoneToday: null,
  aiInsightOfWeek: { title: 'AI Insight of the Week', items: [] },
  systemOverview: { totalIncidents: 0, aiConfidence: null, changeVsLastWeek: null },
  activeAlerts: { triggeredThisWeek: 0, matchedHighSeverityPct: null, falseAlertRatio: null, items: [] },
  riskForecast48h: { points: [], note: 'Forecast data is not available yet.' },
  highRiskRoadRanking: [],
  incidentDistribution24h: [
    { bucket: '00:00–06:00', incidents: 0 },
    { bucket: '06:00–12:00', incidents: 0 },
    { bucket: '12:00–18:00', incidents: 0 },
    { bucket: '18:00–24:00', incidents: 0 },
  ],
  topContributingFactors: [],
  exposureIndex: { label: 'Unavailable', monitoredZones: 0, activeAlerts: 0, commutePattern: 'Not enough data' },
  meta: { scopeMode: 'global_fallback' },
}

const FACTOR_ICONS = {
  'Weather condition': '🌦️',
  'Wind speed': '💨',
  Visibility: '🌫️',
  Temperature: '🌡️',
  Humidity: '💧',
  Pressure: '🧭',
  'Signalized intersections': '🚦',
  'Pedestrian crossings': '🚶',
  'Road junctions': '🛣️',
  accident: '🚗',
  traffic: '🚦',
  danger: '⚠️',
  weather: '🌧️',
  roadworks: '🚧',
}

const signedPct = (value) => `${Number(value || 0) >= 0 ? '+' : '-'}${Math.abs(Math.round(Number(value || 0)))}%`
const trendTone = (value) => Number(value) >= 0 ? 'up' : 'down'
const riskTone = (score) => Number(score) >= 80 ? 'high' : Number(score) >= 50 ? 'medium' : 'low'
const metric = (value, suffix = '') => (value == null || Number.isNaN(Number(value)) ? '--' : `${Math.round(Number(value))}${suffix}`)
const weekLabels = (() => {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
  return [...Array(7)].map((_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    return formatter.format(day)
  })
})()

function Sparkline({ data, w = 200, h = 48, gid = 'spk' }) {
  const values = Array.isArray(data) && data.length > 1 ? data : [0, 0]
  const pad = 4
  const max = Math.max(...values)
  const min = Math.min(...values)
  const rng = max - min || 1
  const pts = values.map((value, index) => ({
    x: pad + (index / (values.length - 1)) * (w - 2 * pad),
    y: h - pad - ((value - min) / rng) * (h - 2 * pad),
  }))
  const poly = pts.map((point) => `${point.x},${point.y}`).join(' ')

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
      {pts.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="2.5" fill="var(--siara-primary)" />)}
    </svg>
  )
}

function ForecastChart({ points }) {
  const values = points.length > 1 ? points.map((item) => Number(item.value || 0)) : [0, 0]
  const labels = points.length > 1 ? points.map((item) => item.label || '') : ['Now', '+4h']
  const w = 680
  const h = 130
  const px = 36
  const py = 16
  const max = Math.max(...values)
  const min = Math.min(...values)
  const rng = max - min || 1
  const pts = values.map((value, index) => ({
    x: px + (index / (values.length - 1)) * (w - 2 * px),
    y: py + ((max - value) / rng) * (h - 2 * py),
    v: value,
  }))
  const poly = pts.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="ud-forecast-svg">
      <defs>
        <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--siara-primary)" stopOpacity=".10" />
          <stop offset="100%" stopColor="var(--siara-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1={px} x2={w - px} y1={py + fraction * (h - 2 * py)} y2={py + fraction * (h - 2 * py)} stroke="#F1F5F9" strokeWidth="1" />)}
      <polygon points={`${px},${h - py} ${poly} ${w - px},${h - py}`} fill="url(#fcFill)" />
      <polyline points={poly} fill="none" stroke="var(--siara-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={point.v >= 70 ? 4 : 3} fill={point.v >= 70 ? '#DC2626' : 'var(--siara-primary)'} />)}
      {labels.map((label, index) => (index % 2 !== 0 && index !== labels.length - 1 ? null : <text key={label} x={px + (index / (labels.length - 1)) * (w - 2 * px)} y={h - 1} textAnchor="middle" fontSize="9" fill="#94A3B8">{label}</text>))}
    </svg>
  )
}

function RiskBar({ score }) {
  return <div className="ud-risk-bar-track"><div className={`ud-risk-bar-fill ${riskTone(score)}`} style={{ width: `${Math.max(0, Math.min(100, Number(score || 0)))}%` }} /></div>
}

function SeverityPill({ level }) {
  return <span className={`ud-severity-pill ${level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low'}`}>{level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}</span>
}

export default function UserDashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [showQuiz, setShowQuiz] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (refresh = false) => {
    try {
      setIsLoading(true)
      setError('')
      const payload = await fetchDashboard({ refresh })
      setDashboardData(payload || EMPTY_DASHBOARD)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load your dashboard right now.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const dashboard = dashboardData || EMPTY_DASHBOARD
  const profileName = dashboard.profile?.name || user?.name || 'SIARA User'
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleBadgeLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleBadgeClass = primaryRole === 'admin'
    ? 'role-admin'
    : primaryRole === 'police'
      ? 'role-police'
      : 'role-citoyen'
  const updatedAt = dashboard.currentRiskOverview?.updatedAt ? new Date(dashboard.currentRiskOverview.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unavailable'
  const forecastPoints = Array.isArray(dashboard.riskForecast48h?.points) ? dashboard.riskForecast48h.points : []
  const hourlyDist = dashboard.incidentDistribution24h.map((item) => ({ ...item, count: Number(item.incidents || 0) }))
  const peakDist = Math.max(...hourlyDist.map((item) => item.count), 1)
  const factors = dashboard.topContributingFactors.map((factor) => ({ ...factor, icon: FACTOR_ICONS[factor.name] || '•' }))
  const topRoads = dashboard.highRiskRoadRanking || []
  const activeAlerts = dashboard.activeAlerts?.items || []
  const insightItems = Array.isArray(dashboard.aiInsightOfWeek?.items) ? dashboard.aiInsightOfWeek.items : []

  const sevPressure = useMemo(() => ([
    { key: 'high', label: 'High', pct: Number(dashboard.severityPressure?.high || 0), change: Number(dashboard.severityPressure?.highChange || 0) },
    { key: 'medium', label: 'Medium', pct: Number(dashboard.severityPressure?.medium || 0), change: Number(dashboard.severityPressure?.mediumChange || 0) },
    { key: 'low', label: 'Low', pct: Number(dashboard.severityPressure?.low || 0), change: Number(dashboard.severityPressure?.lowChange || 0) },
  ]), [dashboard])

  const openMostVolatileZone = () => {
    if (dashboard.mostVolatileZoneToday?.alertId) {
      navigate('/map', { state: { mapLayer: 'zones', focusAlertId: dashboard.mostVolatileZoneToday.alertId } })
      return
    }
    navigate('/map')
  }

  const headerActions = [
    { label: 'Feed', path: '/news' },
    { label: 'Map', path: '/map' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Report', path: '/report' },
    { label: 'Dashboard', active: true },
    { label: 'Predictions', path: '/predictions' },
  ]

  return (
    <div className="siara-news-root">
      <DrivingQuiz onComplete={() => setShowQuiz(false)} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              {headerActions.map((item) => <button key={item.label} className={`dash-tab ${item.active ? 'dash-tab-active' : ''}`} onClick={() => item.path && navigate(item.path)}>{item.label}</button>)}
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}></button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{profileName.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2)}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => navigate('/profile')}>My Profile</button>
                  <button className="dropdown-item" onClick={() => navigate('/settings')}>Settings</button>
                  <button className="dropdown-item" onClick={() => navigate('/notifications')}>Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => Promise.resolve(logout()).finally(() => navigate('/home'))}>Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="siara-news-layout">
        <aside className="sidebar-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleBadgeClass}`}>{roleBadgeLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>
          <FeedSidebarNav activeKey="dashboard" onOpenQuiz={() => setShowQuiz(true)} />
        </aside>

        <main className="feed-center ud-feed-wide">
          {error && <section className="card ud-section" style={{ marginBottom: 16 }}><div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>Dashboard unavailable</h3><button className="ud-link-btn" onClick={() => loadDashboard(true)}>Retry</button></div><p className="ud-forecast-caption" style={{ marginBottom: 0 }}>{error}</p></section>}
          {isLoading && !dashboardData && <section className="card ud-section" style={{ marginBottom: 16 }}><h3 className="ud-mini-title">Loading live dashboard...</h3><p className="ud-forecast-caption" style={{ marginBottom: 0 }}>Pulling current SIARA incident, alert, and risk data.</p></section>}

          <section className="card ud-section ud-risk-overview">
            <div className="ud-section-header"><h2 className="ud-section-title">Your Current Risk Overview</h2><div className="ud-freshness"><span className="ud-pulse-dot"></span>Updated {updatedAt}</div></div>
            <div className="ud-risk-hero">
              <div className="ud-risk-level-block">
                <div className={`ud-risk-badge ${String(dashboard.currentRiskOverview?.label || '').toLowerCase() === 'high' ? 'high' : String(dashboard.currentRiskOverview?.label || '').toLowerCase() === 'moderate' ? 'moderate' : 'low'}`}>
                  <span className="ud-risk-score">{dashboard.currentRiskOverview?.score ?? '--'}</span>
                  <span className="ud-risk-label-text">{dashboard.currentRiskOverview?.label || 'Unavailable'}</span>
                </div>
                <div className="ud-risk-meta">
                  <span className={`ud-trend ${trendTone(dashboard.currentRiskOverview?.changeVsYesterday)}`}>{Number(dashboard.currentRiskOverview?.changeVsYesterday || 0) >= 0 ? '↑' : '↓'} {signedPct(dashboard.currentRiskOverview?.changeVsYesterday)} vs yesterday</span>
                  <span className="ud-confidence">AI Confidence: <strong>{metric(dashboard.currentRiskOverview?.aiConfidence, '%')}</strong></span>
                </div>
              </div>
              <div className="ud-risk-sparkline"><span className="ud-sparkline-label">7-day trend</span><Sparkline data={dashboard.currentRiskOverview?.trend7d || []} gid="riskSpk" /><div className="ud-sparkline-days">{weekLabels.map((day) => <span key={day}>{day}</span>)}</div></div>
            </div>
          </section>

          <div className="ud-grid-2up">
            <section className="card ud-section ud-volatility">
              <h3 className="ud-mini-title">Risk Volatility Index</h3>
              <div className="ud-vol-row"><div className="ud-vol-score-block"><span className="ud-vol-score">{dashboard.riskVolatilityIndex?.score ?? 0}</span><span className="ud-vol-of">/100</span></div><div className="ud-vol-meta"><span className={`ud-vol-change ${trendTone(dashboard.riskVolatilityIndex?.change24h)}`}>{Number(dashboard.riskVolatilityIndex?.change24h || 0) >= 0 ? '↑' : '↓'} {signedPct(dashboard.riskVolatilityIndex?.change24h)} <span className="ud-vol-period">24h</span></span><span className={`ud-vol-level ${String(dashboard.riskVolatilityIndex?.label || '').toLowerCase().includes('high') ? 'high' : String(dashboard.riskVolatilityIndex?.label || '').toLowerCase().includes('medium') ? 'medium' : 'low'}`}>{dashboard.riskVolatilityIndex?.label || 'Unavailable'}</span></div></div>
              <Sparkline data={dashboard.riskVolatilityIndex?.trend7d || []} w={320} h={40} gid="volSpk" />
              <div className="ud-sparkline-days ud-sparkline-days--sm">{weekLabels.map((day) => <span key={day}>{day}</span>)}</div>
            </section>

            <section className="card ud-section ud-severity-pressure">
              <h3 className="ud-mini-title">Severity Pressure</h3>
              <div className="ud-sev-bar-track">{sevPressure.map((item) => <div key={item.key} className={`ud-sev-seg ${item.key}`} style={{ width: `${item.pct}%` }}></div>)}</div>
              <div className="ud-sev-legend">{sevPressure.map((item) => <div key={item.key} className="ud-sev-item"><span className={`ud-sev-dot ${item.key}`}></span><span className="ud-sev-key">{item.label}</span><span className="ud-sev-pct">{item.pct}%</span><span className={`ud-sev-arrow ${trendTone(item.change)}`}>{Number(item.change) >= 0 ? '↑' : '↓'} {Math.abs(item.change)}%</span></div>)}</div>
              <p className="ud-sev-caption">Change vs last week</p>
            </section>
          </div>

          <section className="card ud-section ud-distribution">
            <h3 className="ud-mini-title">24-Hour Incident Distribution</h3>
            <div className="ud-dist-bars">{hourlyDist.map((block) => <div key={block.bucket} className={`ud-dist-row ${block.count === peakDist && peakDist > 0 ? 'peak' : ''}`}><span className="ud-dist-label">{block.bucket}</span><div className="ud-dist-bar-track"><div className={`ud-dist-bar-fill ${block.count === peakDist && peakDist > 0 ? 'peak' : ''}`} style={{ width: `${(block.count / peakDist) * 100}%` }}></div></div><span className="ud-dist-count">{block.count} incidents</span></div>)}</div>
            <p className="ud-dist-caption">Powered by the last 24 hours of incidents in your {dashboard.meta?.scopeMode === 'watched_zones' ? 'watched zones' : 'system fallback'}.</p>
          </section>

          <div className="ud-grid-2up">
            <section className="card ud-section ud-factors">
              <h3 className="ud-mini-title">Top Contributing Factors</h3>
              <div className="ud-factor-list">{factors.length === 0 ? <p className="ud-factor-caption">No factor data available yet.</p> : factors.map((factor) => <div key={factor.name} className="ud-factor-row"><span className="ud-factor-icon">{factor.icon}</span><span className="ud-factor-label">{factor.name}</span><span className="ud-factor-pct">{factor.impactPct == null ? '--' : `+${Math.round(Number(factor.impactPct))}%`}</span></div>)}</div>
              <p className="ud-factor-caption">Explains why risk increased.</p>
            </section>
            <section className="card ud-section ud-exposure">
              <h3 className="ud-mini-title">Your Exposure Index</h3>
              <div className="ud-exp-level-row"><div className={`ud-exp-badge ${String(dashboard.exposureIndex?.label || '').toLowerCase() === 'high' ? 'high' : String(dashboard.exposureIndex?.label || '').toLowerCase() === 'moderate' ? 'moderate' : 'low'}`}>{dashboard.exposureIndex?.label || 'Unavailable'}</div></div>
              <div className="ud-exp-metrics"><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.monitoredZones ?? 0}</span><span className="ud-exp-label">Monitored zones</span></div><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.activeAlerts ?? 0}</span><span className="ud-exp-label">Active alerts</span></div><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.commutePattern || 'n/a'}</span><span className="ud-exp-label">Commute detected</span></div></div>
            </section>
          </div>

          <section className="card ud-section ud-forecast">
            <div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>Risk Forecast — Next 48 Hours</h3></div>
            <ForecastChart points={forecastPoints} />
            <p className="ud-forecast-caption">{dashboard.riskForecast48h?.note || 'Forecast data is not available yet.'}</p>
          </section>

          <section className="card ud-section ud-roads">
            <div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>High-Risk Road Ranking</h3></div>
            <div className="ud-table-wrapper"><table className="ud-table"><thead><tr><th>#</th><th>Road</th><th>Risk Score</th><th>Change</th><th></th></tr></thead><tbody>{topRoads.length === 0 ? <tr><td colSpan="5" className="ud-cell-muted">No road risk data available yet.</td></tr> : topRoads.map((road) => <tr key={road.rank}><td className="ud-road-rank">{road.rank}</td><td className="ud-cell-primary">{road.road}</td><td><div className="ud-score-cell"><span className={`ud-score-value ${riskTone(road.riskScore)}`}>{road.riskScore}</span><RiskBar score={road.riskScore} /></div></td><td><span className={`ud-trend ${trendTone(road.change)}`}>{Number(road.change || 0) >= 0 ? '↑' : '↓'} {signedPct(road.change)}</span></td><td><button className="ud-map-btn" onClick={() => navigate('/map')}>Map →</button></td></tr>)}</tbody></table></div>
          </section>

          <section className="card ud-section ud-alerts-section">
            <div className="ud-section-header"><h2 className="ud-section-title">Active Alerts</h2><button className="ud-link-btn" onClick={() => navigate('/alerts')}>View all →</button></div>
            <div className="ud-efficiency-strip"><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.triggeredThisWeek ?? 0}</span><span className="ud-eff-label">Triggered this week</span></div><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.matchedHighSeverityPct == null ? '--' : `${dashboard.activeAlerts.matchedHighSeverityPct}%`}</span><span className="ud-eff-label">Matched high severity</span></div><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.falseAlertRatio == null ? '--' : `${dashboard.activeAlerts.falseAlertRatio}%`}</span><span className="ud-eff-label">False alert ratio</span></div></div>
            <div className="ud-table-wrapper"><table className="ud-table"><thead><tr><th>Alert</th><th>Area</th><th>Severity</th><th>Last Trigger</th><th>Status</th></tr></thead><tbody>{activeAlerts.length === 0 ? <tr><td colSpan="5" className="ud-cell-muted">No active alerts yet.</td></tr> : activeAlerts.map((alert) => <tr key={alert.id}><td className="ud-cell-primary">{alert.title}</td><td>{alert.area}</td><td><SeverityPill level={alert.severity} /></td><td className="ud-cell-muted">{alert.lastTrigger}</td><td><span className={`ud-status-dot ${alert.status}`}></span>{alert.status === 'active' ? 'Active' : 'Scheduled'}</td></tr>)}</tbody></table></div>
          </section>
        </main>

        <aside className="sidebar-right ud-sidebar-right">
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon">🔎</span>Most Volatile Zone Today</h3>
            {dashboard.mostVolatileZoneToday ? <><div className="ud-volatile-zone"><span className="ud-zone-name">{dashboard.mostVolatileZoneToday.name}</span><span className="ud-zone-score">Risk: <strong>{dashboard.mostVolatileZoneToday.risk}</strong></span><span className={`ud-zone-change ${trendTone(dashboard.mostVolatileZoneToday.change)}`}>{Number(dashboard.mostVolatileZoneToday.change || 0) >= 0 ? '↑' : '↓'} {signedPct(dashboard.mostVolatileZoneToday.change)} risk change</span></div><button className="ud-context-btn" onClick={openMostVolatileZone}>View on Map →</button></> : <p className="ud-factor-caption" style={{ marginBottom: 0 }}>No zone volatility detected yet.</p>}
          </div>
          <div className="card ud-context-card ud-insight-card">
            <h3 className="ud-context-title"><span className="ud-context-icon">🧠</span>{dashboard.aiInsightOfWeek?.title || 'AI Insight of the Week'}</h3>
            {insightItems.length === 0 ? <p className="ud-factor-caption" style={{ marginBottom: 0 }}>Insights will appear as soon as SIARA has enough recent activity.</p> : <ul className="ud-insight-list">{insightItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
          </div>
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon">📊</span>System Overview</h3>
            <div className="ud-sys-kpis"><div className="ud-sys-kpi"><span className="ud-sys-value">{dashboard.systemOverview?.totalIncidents ?? 0}</span><span className="ud-sys-label">Total incidents</span></div><div className="ud-sys-kpi"><span className="ud-sys-value">{metric(dashboard.systemOverview?.aiConfidence, '%')}</span><span className="ud-sys-label">AI confidence</span></div><div className="ud-sys-kpi"><span className={`ud-sys-value ud-trend ${trendTone(dashboard.systemOverview?.changeVsLastWeek)}`}>{signedPct(dashboard.systemOverview?.changeVsLastWeek)}</span><span className="ud-sys-label">vs last week</span></div></div>
          </div>
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon">⚡</span>Quick Actions</h3>
            <div className="ud-quick-actions"><button className="ud-action-link" onClick={() => navigate('/report')}>📝 Report Incident</button><button className="ud-action-link" onClick={() => navigate('/alerts/create')}>🔔 Create Alert</button><button className="ud-action-link" onClick={() => setShowQuiz(true)}>🚗 Driving Quiz</button></div>
          </div>
        </aside>
      </div>
    </div>
  )
}
