import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import AirOutlinedIcon from '@mui/icons-material/AirOutlined'
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined'
import DeviceThermostatOutlinedIcon from '@mui/icons-material/DeviceThermostatOutlined'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import '../../styles/UserDashboardPage.css'
import '../../styles/TravelHistory.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import TravelHistoryDetailModal from '../../components/travel/TravelHistoryDetailModal'
import PersonalSafetyScoreCard from '../../components/travel/PersonalSafetyScoreCard'
import { fetchDashboard } from '../../services/dashboardService'
import { getMyTravelHistory } from '../../services/travelHistoryService'

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
  'Weather condition': <CloudOutlinedIcon fontSize="inherit" className="icon-info" />,
  'Wind speed': <AirOutlinedIcon fontSize="inherit" className="icon-info" />,
  Visibility: <FilterDramaOutlinedIcon fontSize="inherit" className="icon-info" />,
  Temperature: <DeviceThermostatOutlinedIcon fontSize="inherit" className="icon-warning" />,
  Humidity: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" />,
  Pressure: <ExploreOutlinedIcon fontSize="inherit" className="icon-muted" />,
  'Signalized intersections': <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" />,
  'Pedestrian crossings': <DirectionsWalkOutlinedIcon fontSize="inherit" className="icon-muted" />,
  'Road junctions': <RouteOutlinedIcon fontSize="inherit" className="icon-muted" />,
  accident: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" />,
  traffic: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" />,
  danger: <WarningAmberOutlinedIcon fontSize="inherit" className="icon-fire" />,
  weather: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" />,
  roadworks: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" />,
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

function SeverityPill({ level, t }) {
  return <span className={`ud-severity-pill ${level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low'}`}>{level === 'high' ? t('userDashboardPage.severity.high') : level === 'medium' ? t('userDashboardPage.severity.medium') : t('userDashboardPage.severity.low')}</span>
}

export default function UserDashboardPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['pages', 'common'])
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [showQuiz, setShowQuiz] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [travelHistoryItems, setTravelHistoryItems] = useState([])
  const [travelHistoryState, setTravelHistoryState] = useState('idle')
  const [travelHistoryError, setTravelHistoryError] = useState('')
  const [selectedTripId, setSelectedTripId] = useState(null)

  const loadDashboard = useCallback(async (refresh = false) => {
    try {
      setIsLoading(true)
      setError('')
      const payload = await fetchDashboard({ refresh })
      setDashboardData(payload || EMPTY_DASHBOARD)
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('userDashboardPage.errors.loadDashboard'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const loadTravelHistory = useCallback(async () => {
    try {
      setTravelHistoryState('loading')
      setTravelHistoryError('')
      const payload = await getMyTravelHistory({ limit: 12 })
      setTravelHistoryItems(Array.isArray(payload?.items) ? payload.items : [])
      setTravelHistoryState('success')
    } catch (err) {
      setTravelHistoryError(err.message || t('userDashboardPage.errors.loadTravelHistory'))
      setTravelHistoryState('error')
    }
  }, [t])

  useEffect(() => {
    loadTravelHistory()
  }, [loadTravelHistory])

  const handleRatingUpdated = useCallback((tripId, { rating, feedbackText }) => {
    setTravelHistoryItems((items) =>
      items.map((item) => (item.id === tripId ? { ...item, rating, feedbackText } : item)),
    )
  }, [])

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
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const profileInitials = getInitialsFromName(profileName)
  const updatedAt = dashboard.currentRiskOverview?.updatedAt ? new Date(dashboard.currentRiskOverview.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : t('userDashboardPage.unavailable')
  const forecastPoints = Array.isArray(dashboard.riskForecast48h?.points) ? dashboard.riskForecast48h.points : []
  const hourlyDist = dashboard.incidentDistribution24h.map((item) => ({ ...item, count: Number(item.incidents || 0) }))
  const peakDist = Math.max(...hourlyDist.map((item) => item.count), 1)
  const factors = dashboard.topContributingFactors.map((factor) => ({ ...factor, icon: FACTOR_ICONS[factor.name] || '•' }))
  const topRoads = dashboard.highRiskRoadRanking || []
  const activeAlerts = dashboard.activeAlerts?.items || []
  const insightItems = Array.isArray(dashboard.aiInsightOfWeek?.items) ? dashboard.aiInsightOfWeek.items : []

  const sevPressure = useMemo(() => ([
    { key: 'high', label: t('userDashboardPage.severity.high'), pct: Number(dashboard.severityPressure?.high || 0), change: Number(dashboard.severityPressure?.highChange || 0) },
    { key: 'medium', label: t('userDashboardPage.severity.medium'), pct: Number(dashboard.severityPressure?.medium || 0), change: Number(dashboard.severityPressure?.mediumChange || 0) },
    { key: 'low', label: t('userDashboardPage.severity.low'), pct: Number(dashboard.severityPressure?.low || 0), change: Number(dashboard.severityPressure?.lowChange || 0) },
  ]), [dashboard, t])

  const openMostVolatileZone = () => {
    if (dashboard.mostVolatileZoneToday?.alertId) {
      navigate('/map', { state: { mapLayer: 'zones', focusAlertId: dashboard.mostVolatileZoneToday.alertId } })
      return
    }
    navigate('/map')
  }

  const headerActions = [
    { label: t('userDashboardPage.nav.feed'), path: '/news' },
    { label: t('common:nav.map'), path: '/map' },
    { label: t('common:nav.alerts'), path: '/alerts' },
    { label: t('userDashboardPage.nav.report'), path: '/report' },
    { label: t('userDashboardPage.nav.dashboard'), active: true },
    { label: t('common:nav.predictions'), path: '/predictions' },
  ]

  return (
    <div className="siara-news-root">
      <DrivingQuiz onComplete={() => setShowQuiz(false)} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
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
              placeholder={t('userDashboardPage.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('userDashboardPage.userProfileAriaLabel')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('userDashboardPage.userAvatarAlt')} className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => navigate('/profile')}>{t('userDashboardPage.dropdown.myProfile')}</button>
                  <button className="dropdown-item" onClick={() => navigate('/settings')}>{t('common:nav.settings')}</button>
                  <button className="dropdown-item" onClick={() => navigate('/notifications')}>{t('common:nav.notifications')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => Promise.resolve(logout()).finally(() => navigate('/home'))}>{t('common:nav.logout')}</button>
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
              <img src={profileAvatarUrl} alt={t('common:nav.profile')} className="profile-avatar-large" loading="lazy" />            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleBadgeClass}`}>{roleBadgeLabel}</span>
              <p className="profile-bio">{t('userDashboardPage.profileBio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>{t('userDashboardPage.viewProfile')}</button>
            </div>
          </div>
          <FeedSidebarNav activeKey="dashboard" onOpenQuiz={() => setShowQuiz(true)} />
        </aside>

        <main className="feed-center ud-feed-wide">
          {error && <section className="card ud-section" style={{ marginBottom: 16 }}><div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>{t('userDashboardPage.dashboardUnavailable')}</h3><button className="ud-link-btn" onClick={() => loadDashboard(true)}>{t('common:actions.retry')}</button></div><p className="ud-forecast-caption" style={{ marginBottom: 0 }}>{error}</p></section>}
          {isLoading && !dashboardData && <section className="card ud-section" style={{ marginBottom: 16 }}><h3 className="ud-mini-title">{t('userDashboardPage.loadingDashboard')}</h3><p className="ud-forecast-caption" style={{ marginBottom: 0 }}>{t('userDashboardPage.loadingDashboardCaption')}</p></section>}

          <section className="card ud-section ud-risk-overview">
            <div className="ud-section-header"><h2 className="ud-section-title">{t('userDashboardPage.riskOverview.title')}</h2><div className="ud-freshness"><span className="ud-pulse-dot"></span>{t('userDashboardPage.riskOverview.updated', { time: updatedAt })}</div></div>
            <div className="ud-risk-hero">
              <div className="ud-risk-level-block">
                <div className={`ud-risk-badge ${String(dashboard.currentRiskOverview?.label || '').toLowerCase() === 'high' ? 'high' : String(dashboard.currentRiskOverview?.label || '').toLowerCase() === 'medium' ? 'medium' : 'low'}`}>
                  <span className="ud-risk-score">{dashboard.currentRiskOverview?.score ?? '--'}</span>
                  <span className="ud-risk-label-text">{dashboard.currentRiskOverview?.label || t('userDashboardPage.unavailable')}</span>
                </div>
                <div className="ud-risk-meta">
                  <span className={`ud-trend ${trendTone(dashboard.currentRiskOverview?.changeVsYesterday)}`}>{Number(dashboard.currentRiskOverview?.changeVsYesterday || 0) >= 0 ? <ArrowUpwardRoundedIcon fontSize="inherit" /> : <ArrowDownwardRoundedIcon fontSize="inherit" />} {signedPct(dashboard.currentRiskOverview?.changeVsYesterday)} {t('userDashboardPage.riskOverview.vsYesterday')}</span>
                  <span className="ud-confidence">{t('userDashboardPage.riskOverview.aiConfidence')} <strong>{metric(dashboard.currentRiskOverview?.aiConfidence, '%')}</strong></span>
                </div>
              </div>
              <div className="ud-risk-sparkline"><span className="ud-sparkline-label">{t('userDashboardPage.riskOverview.sevenDayTrend')}</span><Sparkline data={dashboard.currentRiskOverview?.trend7d || []} gid="riskSpk" /><div className="ud-sparkline-days">{weekLabels.map((day) => <span key={day}>{day}</span>)}</div></div>
            </div>
          </section>

          <div className="ud-grid-2up">
            <section className="card ud-section ud-volatility">
              <h3 className="ud-mini-title">{t('userDashboardPage.volatility.title')}</h3>
              <div className="ud-vol-row"><div className="ud-vol-score-block"><span className="ud-vol-score">{dashboard.riskVolatilityIndex?.score ?? 0}</span><span className="ud-vol-of">/100</span></div><div className="ud-vol-meta"><span className={`ud-vol-change ${trendTone(dashboard.riskVolatilityIndex?.change24h)}`}>{Number(dashboard.riskVolatilityIndex?.change24h || 0) >= 0 ? <ArrowUpwardRoundedIcon fontSize="inherit" /> : <ArrowDownwardRoundedIcon fontSize="inherit" />} {signedPct(dashboard.riskVolatilityIndex?.change24h)} <span className="ud-vol-period">{t('userDashboardPage.volatility.period24h')}</span></span><span className={`ud-vol-level ${String(dashboard.riskVolatilityIndex?.label || '').toLowerCase().includes('high') ? 'high' : String(dashboard.riskVolatilityIndex?.label || '').toLowerCase().includes('medium') ? 'medium' : 'low'}`}>{dashboard.riskVolatilityIndex?.label || t('userDashboardPage.unavailable')}</span></div></div>
              <Sparkline data={dashboard.riskVolatilityIndex?.trend7d || []} w={320} h={40} gid="volSpk" />
              <div className="ud-sparkline-days ud-sparkline-days--sm">{weekLabels.map((day) => <span key={day}>{day}</span>)}</div>
            </section>

            <section className="card ud-section ud-severity-pressure">
              <h3 className="ud-mini-title">{t('userDashboardPage.severityPressure.title')}</h3>
              <div className="ud-sev-bar-track">{sevPressure.map((item) => <div key={item.key} className={`ud-sev-seg ${item.key}`} style={{ width: `${item.pct}%` }}></div>)}</div>
              <div className="ud-sev-legend">{sevPressure.map((item) => <div key={item.key} className="ud-sev-item"><span className={`ud-sev-dot ${item.key}`}></span><span className="ud-sev-key">{item.label}</span><span className="ud-sev-pct">{item.pct}%</span><span className={`ud-sev-arrow ${trendTone(item.change)}`}>{Number(item.change) >= 0 ? <ArrowUpwardRoundedIcon fontSize="inherit" /> : <ArrowDownwardRoundedIcon fontSize="inherit" />} {Math.abs(item.change)}%</span></div>)}</div>
              <p className="ud-sev-caption">{t('userDashboardPage.severityPressure.changeVsLastWeek')}</p>
            </section>
          </div>

          <section className="card ud-section ud-distribution">
            <h3 className="ud-mini-title">{t('userDashboardPage.distribution.title')}</h3>
            <div className="ud-dist-bars">{hourlyDist.map((block) => <div key={block.bucket} className={`ud-dist-row ${block.count === peakDist && peakDist > 0 ? 'peak' : ''}`}><span className="ud-dist-label">{block.bucket}</span><div className="ud-dist-bar-track"><div className={`ud-dist-bar-fill ${block.count === peakDist && peakDist > 0 ? 'peak' : ''}`} style={{ width: `${(block.count / peakDist) * 100}%` }}></div></div><span className="ud-dist-count">{t('userDashboardPage.distribution.incidents', { count: block.count })}</span></div>)}</div>
            <p className="ud-dist-caption">{t('userDashboardPage.distribution.caption', { scope: dashboard.meta?.scopeMode === 'watched_zones' ? t('userDashboardPage.distribution.watchedZones') : t('userDashboardPage.distribution.systemFallback') })}</p>
          </section>

          <div className="ud-grid-2up">
            <section className="card ud-section ud-factors">
              <h3 className="ud-mini-title">{t('userDashboardPage.factors.title')}</h3>
              <div className="ud-factor-list">{factors.length === 0 ? <p className="ud-factor-caption">{t('userDashboardPage.factors.noData')}</p> : factors.map((factor) => <div key={factor.name} className="ud-factor-row"><span className="ud-factor-icon">{factor.icon}</span><span className="ud-factor-label">{factor.name}</span><span className="ud-factor-pct">{factor.impactPct == null ? '--' : `+${Math.round(Number(factor.impactPct))}%`}</span></div>)}</div>
              <p className="ud-factor-caption">{t('userDashboardPage.factors.caption')}</p>
            </section>
            <section className="card ud-section ud-exposure">
              <h3 className="ud-mini-title">{t('userDashboardPage.exposure.title')}</h3>
              <div className="ud-exp-level-row"><div className={`ud-exp-badge ${String(dashboard.exposureIndex?.label || '').toLowerCase() === 'high' ? 'high' : String(dashboard.exposureIndex?.label || '').toLowerCase() === 'medium' ? 'medium' : 'low'}`}>{dashboard.exposureIndex?.label || t('userDashboardPage.unavailable')}</div></div>
              <div className="ud-exp-metrics"><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.monitoredZones ?? 0}</span><span className="ud-exp-label">{t('userDashboardPage.exposure.monitoredZones')}</span></div><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.activeAlerts ?? 0}</span><span className="ud-exp-label">{t('userDashboardPage.exposure.activeAlerts')}</span></div><div className="ud-exp-metric"><span className="ud-exp-value">{dashboard.exposureIndex?.commutePattern || 'n/a'}</span><span className="ud-exp-label">{t('userDashboardPage.exposure.commuteDetected')}</span></div></div>
            </section>
          </div>

          <section className="card ud-section ud-forecast">
            <div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>{t('userDashboardPage.forecast.title')}</h3></div>
            <ForecastChart points={forecastPoints} />
            <p className="ud-forecast-caption">{dashboard.riskForecast48h?.note || t('userDashboardPage.forecast.noData')}</p>
          </section>

          <section className="card ud-section ud-roads">
            <div className="ud-section-header"><h3 className="ud-mini-title" style={{ marginBottom: 0 }}>{t('userDashboardPage.roads.title')}</h3></div>
            <div className="ud-table-wrapper"><table className="ud-table"><thead><tr><th>#</th><th>{t('userDashboardPage.roads.colRoad')}</th><th>{t('userDashboardPage.roads.colRiskScore')}</th><th>{t('userDashboardPage.roads.colChange')}</th><th></th></tr></thead><tbody>{topRoads.length === 0 ? <tr><td colSpan="5" className="ud-cell-muted">{t('userDashboardPage.roads.noData')}</td></tr> : topRoads.map((road) => <tr key={road.rank}><td className="ud-road-rank">{road.rank}</td><td className="ud-cell-primary">{road.road}</td><td><div className="ud-score-cell"><span className={`ud-score-value ${riskTone(road.riskScore)}`}>{road.riskScore}</span><RiskBar score={road.riskScore} /></div></td><td><span className={`ud-trend ${trendTone(road.change)}`}>{Number(road.change || 0) >= 0 ? <ArrowUpwardRoundedIcon fontSize="inherit" /> : <ArrowDownwardRoundedIcon fontSize="inherit" />} {signedPct(road.change)}</span></td><td><button className="ud-map-btn" onClick={() => navigate('/map')}>{t('common:nav.map')} <ArrowForwardRoundedIcon fontSize="inherit" /></button></td></tr>)}</tbody></table></div>
          </section>

          <section className="ud-section" style={{ marginTop: 16 }}>
            <PersonalSafetyScoreCard refreshKey={travelHistoryItems?.length || 0} />
          </section>

          <section className="card ud-section">
            <div className="ud-section-header">
              <h2 className="ud-section-title">{t('userDashboardPage.travelHistory.title')}</h2>
              {travelHistoryState === 'success' && (
                <button className="ud-link-btn" onClick={() => loadTravelHistory()}>{t('userDashboardPage.travelHistory.refresh')}</button>
              )}
            </div>
            {travelHistoryState === 'loading' && (
              <p className="ud-forecast-caption">{t('userDashboardPage.travelHistory.loading')}</p>
            )}
            {travelHistoryState === 'error' && (
              <p className="ud-forecast-caption" role="alert">{travelHistoryError}</p>
            )}
            {travelHistoryState === 'success' && travelHistoryItems.length === 0 && (
              <div className="ud-travel-empty">
                {t('userDashboardPage.travelHistory.empty')}
              </div>
            )}
            {travelHistoryState === 'success' && travelHistoryItems.length > 0 && (
              <div className="ud-travel-list">
                {travelHistoryItems.map((trip) => {
                  const startedDate = trip.startedAt ? new Date(trip.startedAt) : null
                  const dateLabel = startedDate && !Number.isNaN(startedDate.getTime())
                    ? startedDate.toLocaleString()
                    : '—'
                  const distanceLabel = Number.isFinite(Number(trip.distanceKm))
                    ? `${Number(trip.distanceKm).toFixed(1)} km`
                    : '—'
                  let durationLabel = '—'
                  const durationSeconds = Number(trip.durationSeconds)
                  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                    const minutes = Math.floor(durationSeconds / 60)
                    if (minutes < 60) {
                      durationLabel = `${minutes} min`
                    } else {
                      const hours = Math.floor(minutes / 60)
                      const remaining = minutes % 60
                      durationLabel = remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
                    }
                  }
                  const riskPercentValue = Number(trip.overallRiskPercent)
                  const riskTextLevel = String(trip.overallRiskLevel || '').trim().toLowerCase()
                  const riskBadgeTone =
                    riskTextLevel === 'high'
                      ? 'high'
                      : riskTextLevel === 'medium' ||
                          (Number.isFinite(riskPercentValue) && riskPercentValue >= 50)
                        ? 'medium'
                        : 'low'
                  const riskLabelText = Number.isFinite(riskPercentValue)
                    ? `${Math.round(riskPercentValue)}%${trip.overallRiskLevel ? ` • ${trip.overallRiskLevel}` : ''}`
                    : trip.overallRiskLevel || '—'
                  const ratingValue = Number(trip.rating)
                  const stars = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : 0
                  return (
                    <article key={trip.id} className="ud-travel-card">
                      <div className="ud-travel-card-header">
                        <div>
                          <p className="ud-travel-destination">
                            {trip.destinationName || t('userDashboardPage.travelHistory.savedTrip')}
                          </p>
                          <p className="ud-travel-date">{dateLabel}</p>
                        </div>
                        <span className={`th-risk-badge ${riskBadgeTone}`}>{riskLabelText}</span>
                      </div>
                      <div className="ud-travel-meta">
                        <div className="ud-travel-meta-item">
                          <span>{t('userDashboardPage.travelHistory.distance')}</span>
                          <strong>{distanceLabel}</strong>
                        </div>
                        <div className="ud-travel-meta-item">
                          <span>{t('userDashboardPage.travelHistory.duration')}</span>
                          <strong>{durationLabel}</strong>
                        </div>
                        <div className="ud-travel-meta-item">
                          <span>{t('userDashboardPage.travelHistory.route')}</span>
                          <strong>{trip.routeType || '—'}</strong>
                        </div>
                      </div>
                      <div className="ud-travel-card-footer">
                        <div className={`ud-travel-stars ${stars === 0 ? 'is-empty' : ''}`}>
                          {stars === 0
                            ? t('userDashboardPage.travelHistory.notRated')
                            : <>{Array.from({ length: stars }).map((_, i) => <StarRoundedIcon key={`f${i}`} fontSize="inherit" className="icon-rating" />)}{Array.from({ length: 5 - stars }).map((_, i) => <StarBorderRoundedIcon key={`e${i}`} fontSize="inherit" className="icon-rating-empty" />)}</>}
                        </div>
                        <button className="ud-link-btn" onClick={() => setSelectedTripId(trip.id)}>
                          {t('userDashboardPage.travelHistory.viewDetails')} <ArrowForwardRoundedIcon fontSize="inherit" />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <TravelHistoryDetailModal
            tripId={selectedTripId}
            open={Boolean(selectedTripId)}
            onClose={() => setSelectedTripId(null)}
            onRatingUpdated={handleRatingUpdated}
          />

          <section className="card ud-section ud-alerts-section">
            <div className="ud-section-header"><h2 className="ud-section-title">{t('userDashboardPage.alerts.title')}</h2><button className="ud-link-btn" onClick={() => navigate('/alerts')}>{t('userDashboardPage.alerts.viewAll')} <ArrowForwardRoundedIcon fontSize="inherit" /></button></div>
            <div className="ud-efficiency-strip"><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.triggeredThisWeek ?? 0}</span><span className="ud-eff-label">{t('userDashboardPage.alerts.triggeredThisWeek')}</span></div><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.matchedHighSeverityPct == null ? '--' : `${dashboard.activeAlerts.matchedHighSeverityPct}%`}</span><span className="ud-eff-label">{t('userDashboardPage.alerts.matchedHighSeverity')}</span></div><div className="ud-eff-kpi"><span className="ud-eff-value">{dashboard.activeAlerts?.falseAlertRatio == null ? '--' : `${dashboard.activeAlerts.falseAlertRatio}%`}</span><span className="ud-eff-label">{t('userDashboardPage.alerts.falseAlertRatio')}</span></div></div>
            <div className="ud-table-wrapper"><table className="ud-table"><thead><tr><th>{t('userDashboardPage.alerts.colAlert')}</th><th>{t('userDashboardPage.alerts.colArea')}</th><th>{t('userDashboardPage.alerts.colSeverity')}</th><th>{t('userDashboardPage.alerts.colLastTrigger')}</th><th>{t('userDashboardPage.alerts.colStatus')}</th></tr></thead><tbody>{activeAlerts.length === 0 ? <tr><td colSpan="5" className="ud-cell-muted">{t('userDashboardPage.alerts.noData')}</td></tr> : activeAlerts.map((alert) => <tr key={alert.id}><td className="ud-cell-primary">{alert.title}</td><td>{alert.area}</td><td><SeverityPill level={alert.severity} t={t} /></td><td className="ud-cell-muted">{alert.lastTrigger}</td><td><span className={`ud-status-dot ${alert.status}`}></span>{alert.status === 'active' ? t('userDashboardPage.alerts.statusActive') : t('userDashboardPage.alerts.statusScheduled')}</td></tr>)}</tbody></table></div>
          </section>
        </main>

        <aside className="sidebar-right ud-sidebar-right">
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon"><SearchOutlinedIcon fontSize="inherit" /></span>{t('userDashboardPage.volatileZone.title')}</h3>
            {dashboard.mostVolatileZoneToday ? <><div className="ud-volatile-zone"><span className="ud-zone-name">{dashboard.mostVolatileZoneToday.name}</span><span className="ud-zone-score">{t('userDashboardPage.volatileZone.risk')} <strong>{dashboard.mostVolatileZoneToday.risk}</strong></span><span className={`ud-zone-change ${trendTone(dashboard.mostVolatileZoneToday.change)}`}>{Number(dashboard.mostVolatileZoneToday.change || 0) >= 0 ? <ArrowUpwardRoundedIcon fontSize="inherit" /> : <ArrowDownwardRoundedIcon fontSize="inherit" />} {signedPct(dashboard.mostVolatileZoneToday.change)} {t('userDashboardPage.volatileZone.riskChange')}</span></div><button className="ud-context-btn" onClick={openMostVolatileZone}>{t('userDashboardPage.volatileZone.viewOnMap')} <ArrowForwardRoundedIcon fontSize="inherit" /></button></> : <p className="ud-factor-caption" style={{ marginBottom: 0 }}>{t('userDashboardPage.volatileZone.noData')}</p>}
          </div>
          <div className="card ud-context-card ud-insight-card">
            <h3 className="ud-context-title"><span className="ud-context-icon"><PsychologyOutlinedIcon fontSize="inherit" /></span>{dashboard.aiInsightOfWeek?.title || t('userDashboardPage.insight.title')}</h3>
            {insightItems.length === 0 ? <p className="ud-factor-caption" style={{ marginBottom: 0 }}>{t('userDashboardPage.insight.noData')}</p> : <ul className="ud-insight-list">{insightItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
          </div>
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon"><BarChartOutlinedIcon fontSize="inherit" /></span>{t('userDashboardPage.systemOverview.title')}</h3>
            <div className="ud-sys-kpis"><div className="ud-sys-kpi"><span className="ud-sys-value">{dashboard.systemOverview?.totalIncidents ?? 0}</span><span className="ud-sys-label">{t('userDashboardPage.systemOverview.totalIncidents')}</span></div><div className="ud-sys-kpi"><span className="ud-sys-value">{metric(dashboard.systemOverview?.aiConfidence, '%')}</span><span className="ud-sys-label">{t('userDashboardPage.systemOverview.aiConfidence')}</span></div><div className="ud-sys-kpi"><span className={`ud-sys-value ud-trend ${trendTone(dashboard.systemOverview?.changeVsLastWeek)}`}>{signedPct(dashboard.systemOverview?.changeVsLastWeek)}</span><span className="ud-sys-label">{t('userDashboardPage.systemOverview.vsLastWeek')}</span></div></div>
          </div>
          <div className="card ud-context-card">
            <h3 className="ud-context-title"><span className="ud-context-icon"><BoltOutlinedIcon fontSize="inherit" /></span>{t('userDashboardPage.quickActions.title')}</h3>
            <div className="ud-quick-actions"><button className="ud-action-link" onClick={() => navigate('/report')}><EditNoteOutlinedIcon fontSize="inherit" /> {t('userDashboardPage.quickActions.reportIncident')}</button><button className="ud-action-link" onClick={() => navigate('/alerts/create')}><NotificationsOutlinedIcon fontSize="inherit" /> {t('userDashboardPage.quickActions.createAlert')}</button><button className="ud-action-link" onClick={() => setShowQuiz(true)}><DirectionsCarOutlinedIcon fontSize="inherit" /> {t('userDashboardPage.quickActions.drivingQuiz')}</button></div>
          </div>
        </aside>
      </div>
    </div>
  )
}
