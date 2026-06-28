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
import { useTranslation } from 'react-i18next'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import SatelliteAltOutlinedIcon from '@mui/icons-material/SatelliteAltOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EnhancedEncryptionOutlinedIcon from '@mui/icons-material/EnhancedEncryptionOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined'
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import ScatterPlotOutlinedIcon from '@mui/icons-material/ScatterPlotOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import RadioButtonCheckedOutlinedIcon from '@mui/icons-material/RadioButtonCheckedOutlined'
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined'
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
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
  { id: 1, icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-high" />, textKey: 'predictionsPage.activity.riskPeakRN5', time: '2 min ago', type: 'high' },
  { id: 2, icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-medium" />, textKey: 'predictionsPage.activity.modelRecalibrated', time: '15 min ago', type: 'warning' },
  { id: 3, icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-low" />, textKey: 'predictionsPage.activity.riskReducedHydra', time: '32 min ago', type: 'success' },
  { id: 4, icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-info" />, textKey: 'predictionsPage.activity.newWeatherDataset', time: '1h ago', type: 'info' },
  { id: 5, icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-medium" />, textKey: 'predictionsPage.activity.schoolAlertBMR', time: '1h 20 min ago', type: 'warning' },
]

export default function PredictionsPage() {
  const { t } = useTranslation(['pages', 'common'])

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
    const timer = setInterval(() => setLiveTime(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // Callback when DrivingQuiz finishes
  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  // Format Date as HH:MM (French-Algerian locale)
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  /* Data sources feeding the ML model */
  const dataSources = [
    { nameKey: 'predictionsPage.dataSources.citizenReports', count: '12,847', status: 'live', icon: <GroupsOutlinedIcon fontSize="inherit" /> },
    { nameKey: 'predictionsPage.dataSources.weatherSensors', count: '48 stations', status: 'live', icon: <CloudOutlinedIcon fontSize="inherit" /> },
    { nameKey: 'predictionsPage.dataSources.trafficFlow',    count: '340 sensors', status: 'live', icon: <TrafficOutlinedIcon fontSize="inherit" /> },
    { nameKey: 'predictionsPage.dataSources.historicalData', count: '5 years', status: 'synced', icon: <AssignmentOutlinedIcon fontSize="inherit" /> },
  ]

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
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const profileInitials = getInitialsFromName(profileName)

  /* ═══ RENDER ═══ */
  return (
    <div className="siara-news-root">
      {/* DRIVING QUIZ POPUP */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ── 1. FLOATING HEADER ── */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('common:nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('common:nav.report')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('common:nav.dashboard')}</button>
              <button className="dash-tab dash-tab-active">{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('predictionsPage.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('predictionsPage.ariaUserProfile')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('predictionsPage.ariaUserAvatar')} className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('common:nav.profile')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>{t('common:nav.settings')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>{t('common:nav.notifications')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>{t('common:nav.logout')}</button>
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
              <img src={profileAvatarUrl} alt={t('predictionsPage.ariaProfile')} className="profile-avatar-large" loading="lazy" />            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">{t('predictionsPage.profileBio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>{t('predictionsPage.viewProfile')}</button>
            </div>
          </div>

          {/* Navigation */}
          <FeedSidebarNav activeKey="predictions" onOpenQuiz={() => setShowQuiz(true)} />

          {/* Model Summary Widget */}
          <div className="card pred-model-sidebar">
            <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PsychologyOutlinedIcon fontSize="inherit" /> {t('predictionsPage.modelSidebar.title')}</h3>
            <div className="pred-model-rows">
              <div className="pred-model-row"><span>{t('predictionsPage.modelSidebar.version')}</span><span className="pred-model-val">v1.0</span></div>
              <div className="pred-model-row"><span>{t('predictionsPage.modelSidebar.algorithm')}</span><span className="pred-model-val">LightGBM + CatBoost</span></div>
              <div className="pred-model-row"><span>{t('predictionsPage.modelSidebar.lastUpdate')}</span><span className="pred-model-val">{t('predictionsPage.modelSidebar.today')}</span></div>
              <div className="pred-model-row"><span>{t('predictionsPage.modelSidebar.status')}</span><span className="pred-model-val green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FiberManualRecordIcon fontSize="inherit" /> {t('predictionsPage.modelSidebar.active')}</span></div>
              <div className="pred-model-row"><span>{t('predictionsPage.modelSidebar.accuracy')}</span><span className="pred-model-val blue">89.2%</span></div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="card pred-sources-sidebar">
            <h3 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SatelliteAltOutlinedIcon fontSize="inherit" /> {t('predictionsPage.dataSourcesTitle')}</h3>
            <div className="pred-sources-list">
              {dataSources.map((s, i) => (
                <div key={i} className="pred-source-item">
                  <span className="pred-source-icon">{s.icon}</span>
                  <div className="pred-source-info">
                    <span className="pred-source-name">{t(s.nameKey)}</span>
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
                {t('predictionsPage.hero.aiModelActive')}
              </div>
              <span className="pred-hero-clock" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AccessTimeOutlinedIcon fontSize="inherit" /> {fmtTime(liveTime)}</span>
            </div>
            <h1>{t('predictionsPage.hero.title')} <span>{t('predictionsPage.hero.titleHighlight')}</span></h1>
            <p className="pred-hero-subtitle">
              {t('predictionsPage.hero.subtitle')}
            </p>
            {/* Hero KPI Strip */}
            <div className="pred-hero-kpis">
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">12 847</span>
                <span className="pred-hero-kpi-label">{t('predictionsPage.hero.kpiDataPoints')}</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">48</span>
                <span className="pred-hero-kpi-label">{t('predictionsPage.hero.kpiProvinces')}</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">89.2%</span>
                <span className="pred-hero-kpi-label">{t('predictionsPage.hero.kpiAccuracy')}</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">&lt; 2s</span>
                <span className="pred-hero-kpi-label">{t('predictionsPage.hero.kpiResponseTime')}</span>
              </div>
            </div>
          </div>

          {/* B. Feature Preview Cards — heatmaps, time series, export */}
          <div className="pred-features-grid">
            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon heatmap"><MapOutlinedIcon fontSize="inherit" /></div>
                <span className="pred-feature-status ready" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><RadioButtonCheckedOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.statusReady')}</span>
              </div>
              <h3>{t('predictionsPage.features.heatmaps.title')}</h3>
              <p>{t('predictionsPage.features.heatmaps.description')}</p>
              <div className="pred-feature-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><RefreshOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.heatmaps.update')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LocationOnOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.heatmaps.coverage')}</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon timeseries"><TrendingUpOutlinedIcon fontSize="inherit" /></div>
                <span className="pred-feature-status beta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PieChartOutlineOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.statusBeta')}</span>
              </div>
              <h3>{t('predictionsPage.features.timeSeries.title')}</h3>
              <p>{t('predictionsPage.features.timeSeries.description')}</p>
              <div className="pred-feature-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TimerOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.timeSeries.horizon')}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BarChartOutlinedIcon fontSize="inherit" /> RMSE : 0.12</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon export"><IosShareOutlinedIcon fontSize="inherit" /></div>
                <span className="pred-feature-status coming" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><RadioButtonUncheckedOutlinedIcon fontSize="inherit" /> {t('predictionsPage.features.statusComingSoon')}</span>
              </div>
              <h3>{t('predictionsPage.features.export.title')}</h3>
              <p>{t('predictionsPage.features.export.description')}</p>
              <div className="pred-feature-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><DescriptionOutlinedIcon fontSize="inherit" /> PDF, CSV, GeoJSON</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><EnhancedEncryptionOutlinedIcon fontSize="inherit" className="icon-security" /> {t('predictionsPage.features.export.certified')}</span>
              </div>
            </div>
          </div>

          {/* C. Mock Visualization — tabbed bar chart with lock overlay */}
          <div className="pred-viz-card">
            <div className="pred-viz-header">
              <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BarChartOutlinedIcon fontSize="inherit" /> {t('predictionsPage.viz.title')}</h3>
              <div className="pred-viz-tabs">
                <button className={`pred-viz-tab ${vizTab === 'heatmap' ? 'active' : ''}`} onClick={() => setVizTab('heatmap')}>{t('predictionsPage.viz.tabHeatmap')}</button>
                <button className={`pred-viz-tab ${vizTab === 'timeline' ? 'active' : ''}`} onClick={() => setVizTab('timeline')}>{t('predictionsPage.viz.tabTimeline')}</button>
                <button className={`pred-viz-tab ${vizTab === 'clusters' ? 'active' : ''}`} onClick={() => setVizTab('clusters')}>{t('predictionsPage.viz.tabClusters')}</button>
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
                <span className="pred-viz-overlay-icon"><LockOutlinedIcon fontSize="inherit" className="icon-security" /></span>
                <span className="pred-viz-overlay-text">{t('predictionsPage.viz.overlayText')}</span>
                <span className="pred-viz-overlay-sub">{t('predictionsPage.viz.overlaySub')}</span>
              </div>
            </div>
          </div>

          {/* D. Top Risk Zones Table — ranked by AI score */}
          <div className="pred-zones-card">
            <div className="pred-zones-header">
              <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LocationCityOutlinedIcon fontSize="inherit" /> {t('predictionsPage.zones.title')}</h3>
              <span className="pred-zones-updated">{t('predictionsPage.zones.updated', { time: fmtTime(liveTime) })}</span>
            </div>
            <table className="pred-zones-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('predictionsPage.zones.colZone')}</th>
                  <th>{t('predictionsPage.zones.colWilaya')}</th>
                  <th>{t('predictionsPage.zones.colScore')}</th>
                  <th>{t('predictionsPage.zones.colTrend')}</th>
                  <th>{t('predictionsPage.zones.colLevel')}</th>
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
                    <td className={`pred-zone-trend ${z.trend.startsWith('+') ? 'up' : 'down'}`}>{z.trend.startsWith('+') ? <TrendingUpRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} /> : <TrendingDownRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} />} {z.trend}</td>
                    <td><span className={`pred-severity-badge ${z.severity}`}>{z.severity === 'high' ? t('predictionsPage.severity.high') : z.severity === 'medium' ? t('predictionsPage.severity.medium') : t('predictionsPage.severity.low')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* E. How it Works — 4-step pipeline explainer */}
          <div className="pred-how-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><TipsAndUpdatesOutlinedIcon fontSize="inherit" className="icon-info" /> {t('predictionsPage.howItWorks.title')}</h3>
            <div className="pred-how-steps">
              <div className="pred-how-step">
                <div className="pred-how-num">1</div>
                <div className="pred-how-content">
                  <h4>{t('predictionsPage.howItWorks.step1.title')}</h4>
                  <p>{t('predictionsPage.howItWorks.step1.description')}</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">2</div>
                <div className="pred-how-content">
                  <h4>{t('predictionsPage.howItWorks.step2.title')}</h4>
                  <p>{t('predictionsPage.howItWorks.step2.description')}</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">3</div>
                <div className="pred-how-content">
                  <h4>{t('predictionsPage.howItWorks.step3.title')}</h4>
                  <p>{t('predictionsPage.howItWorks.step3.description')}</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">4</div>
                <div className="pred-how-content">
                  <h4>{t('predictionsPage.howItWorks.step4.title')}</h4>
                  <p>{t('predictionsPage.howItWorks.step4.description')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* F. Tech Stack Banner — icons for Python, LightGBM, CatBoost, etc. */}
          <div className="pred-tech-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BuildOutlinedIcon fontSize="inherit" /> {t('predictionsPage.techStack.title')}</h3>
            <div className="pred-tech-grid">
              <div className="pred-tech-item"><span className="pred-tech-logo"><CodeOutlinedIcon fontSize="inherit" /></span><span>Python</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><BoltOutlinedIcon fontSize="inherit" /></span><span>LightGBM</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><ScatterPlotOutlinedIcon fontSize="inherit" /></span><span>CatBoost</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><PsychologyOutlinedIcon fontSize="inherit" /></span><span>Scikit-learn</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><BarChartOutlinedIcon fontSize="inherit" /></span><span>Pandas</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><HubOutlinedIcon fontSize="inherit" /></span><span>React</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><MapOutlinedIcon fontSize="inherit" /></span><span>Leaflet</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo"><CodeOutlinedIcon fontSize="inherit" /></span><span>Node.js</span></div>
            </div>
          </div>

        </main>

        {/* ═══ RIGHT SIDEBAR — model status, forecast, feature importance, activity, CTA ═══ */}
        <aside className="sidebar-right">

          {/* A. Prediction Status — model version, algo, confidence + metric trio */}
          <div className="pred-status-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BoltOutlinedIcon fontSize="inherit" /> {t('predictionsPage.modelStatus.title')}</h3>
            <div className="pred-status-row">
              <span className="pred-status-label">{t('predictionsPage.modelSidebar.version')}</span>
              <span className="pred-status-value">SIARA v1.0</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">{t('predictionsPage.modelSidebar.algorithm')}</span>
              <span className="pred-status-value">LightGBM</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">{t('predictionsPage.modelSidebar.lastUpdate')}</span>
              <span className="pred-status-value blue">{t('predictionsPage.modelStatus.lastUpdateValue')}</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">{t('predictionsPage.modelStatus.overallConfidence')}</span>
              <span className="pred-status-value green">89%</span>
            </div>
            <div className="pred-confidence-bar">
              <div className="pred-confidence-fill" style={{ width: '89%' }}></div>
            </div>
            <div className="pred-status-metrics">
              <div className="pred-metric"><span className="pred-metric-label">{t('predictionsPage.modelSidebar.accuracy')}</span><span className="pred-metric-val">89.2%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">{t('predictionsPage.modelStatus.recall')}</span><span className="pred-metric-val">85.7%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">{t('predictionsPage.modelStatus.f1Score')}</span><span className="pred-metric-val">87.4%</span></div>
            </div>
          </div>

          {/* B. Forecast Snapshot — risk level bars at 6h / 12h / 18h / 24h / 48h */}
          <div className="pred-forecast-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarMonthOutlinedIcon fontSize="inherit" /> {t('predictionsPage.forecast.title')}</h3>
            <div className="pred-forecast-items">
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">6h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '25%' }}></div></div>
                <span className="pred-forecast-label low">{t('predictionsPage.severity.low')}</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">12h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '60%' }}></div></div>
                <span className="pred-forecast-label medium">{t('predictionsPage.severity.medium')}</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">18h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill high" style={{ width: '85%' }}></div></div>
                <span className="pred-forecast-label high">{t('predictionsPage.severity.high')}</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">24h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '50%' }}></div></div>
                <span className="pred-forecast-label medium">{t('predictionsPage.severity.medium')}</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">48h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '30%' }}></div></div>
                <span className="pred-forecast-label low">{t('predictionsPage.severity.low')}</span>
              </div>
            </div>
          </div>

          {/* C. Model Transparency — feature importance horizontal bars */}
          <div className="pred-transparency-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SearchOutlinedIcon fontSize="inherit" /> {t('predictionsPage.featureImportance.title')}</h3>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.weather')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '78%' }}></div></div>
              <span className="pred-factor-pct">78%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.hour')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '65%' }}></div></div>
              <span className="pred-factor-pct">65%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.traffic')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '52%' }}></div></div>
              <span className="pred-factor-pct">52%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.history')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '44%' }}></div></div>
              <span className="pred-factor-pct">44%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.roadInfra')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '38%' }}></div></div>
              <span className="pred-factor-pct">38%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">{t('predictionsPage.featureImportance.daySeason')}</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '31%' }}></div></div>
              <span className="pred-factor-pct">31%</span>
            </div>
          </div>

          {/* D. Live Activity Feed — real-time model events */}
          <div className="pred-activity-card">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SatelliteAltOutlinedIcon fontSize="inherit" /> {t('predictionsPage.liveActivity.title')}</h3>
            <div className="pred-activity-list">
              {activityFeed.map((a) => (
                <div key={a.id} className={`pred-activity-item ${a.type}`}>
                  <span className="pred-activity-icon">{a.icon}</span>
                  <div className="pred-activity-info">
                    <span className="pred-activity-text">{t(a.textKey)}</span>
                    <span className="pred-activity-time">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* E. CTA — early access call-to-action */}
          <div className="pred-cta-card">
            <h4 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RocketLaunchOutlinedIcon fontSize="inherit" className="icon-accent" /> {t('predictionsPage.cta.title')}</h4>
            <p>{t('predictionsPage.cta.description')}</p>
            <button className="pred-cta-btn" onClick={() => navigate('/map')}>{t('predictionsPage.cta.button')}</button>
          </div>

          {/* F. Predictive Alerts — upcoming risk warnings */}
          <div className="card widget-alerts">
            <h3 className="widget-title">{t('predictionsPage.predictiveAlerts.title')}</h3>
            <div className="alert-item">{t('predictionsPage.predictiveAlerts.alert1')}</div>
            <div className="alert-item">{t('predictionsPage.predictiveAlerts.alert2')}</div>
            <div className="alert-item">{t('predictionsPage.predictiveAlerts.alert3')}</div>
            <div className="alert-item">{t('predictionsPage.predictiveAlerts.alert4')}</div>
            <button className="btn-activate-alerts" onClick={() => navigate('/alerts')}>{t('predictionsPage.predictiveAlerts.manageButton')}</button>
          </div>

        </aside>
      </div>
    </div>
  )
}
