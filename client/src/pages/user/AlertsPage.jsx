import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SkeletonList } from '../../components/common/Skeleton'
import { useLocation, useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import FancySelect from '../../components/ui/FancySelect'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'

const leafletIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import { deleteAlert, fetchAlerts, updateAlertStatus } from '../../services/alertService'
import { fetchEmailPreferences, updateEmailPreferences } from '../../services/authService'
import {
  fetchPushPreferences,
  getExistingPushSubscription,
  getPushPermissionState,
  isPushSupported,
  sendPushTest,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
  updatePushPreferences,
} from '../../services/pushService'
import '../../styles/NewsPage.css'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

const STATUS_TABS = [
  { key: 'active' },
  { key: 'paused' },
  { key: 'archived' },
]

const DEFAULT_CENTER = { lat: 36.753, lng: 3.0588 }

function icon(type) {
  switch (type) {
    case 'accident': return <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" />
    case 'traffic': return <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" />
    case 'danger': return <WarningAmberOutlinedIcon fontSize="inherit" className="icon-fire" />
    case 'roadworks': return <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" />
    case 'ai_prediction': return <SmartToyOutlinedIcon fontSize="inherit" className="icon-security" />
    default: return <NotificationsOutlinedIcon fontSize="inherit" className="icon-muted" />
  }
}

function renderSidebarIcon(type) {
  if (type === 'quiz') return <DirectionsCarOutlinedIcon fontSize="inherit" />
  if (type === 'map') return <MapOutlinedIcon fontSize="inherit" />
  if (type === 'report') return <EditNoteOutlinedIcon fontSize="inherit" />
  return <ExploreOutlinedIcon fontSize="inherit" />
}

function PinIcon() {
  return (
    <svg className="info-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.68 2 6 4.68 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.32-2.68-6-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="12" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="info-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 7.5v4.5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function color(severity) {
  return { high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[severity] || '#64748B'
}

function normalizeTrigger(trigger, index) {
  return {
    id: trigger?.id || `trigger-${index}`,
    type: trigger?.type || trigger?.incident_type || 'ai_prediction',
    title: trigger?.title || trigger?.incident_title || 'Alert trigger',
    time: trigger?.time || trigger?.triggered_at || 'Unknown time',
    severity: trigger?.severity || trigger?.max_severity || 'medium',
  }
}

function normalizeAlert(alert) {
  const normalizedStatus = alert?.status === 'expired' ? 'archived' : (alert?.status || 'active')
  const incidentTypes = Array.isArray(alert?.incidentTypes)
    ? alert.incidentTypes
    : Array.isArray(alert?.incident_types)
      ? alert.incident_types
      : []

  const areaName = alert?.area?.name || alert?.area_name || alert?.zone?.displayName || alert?.zone?.display_name || 'Unknown area'
  const zoneType = alert?.zone?.zoneType || alert?.zone?.zone_type || null
  const zoneDisplayName = alert?.zone?.displayName || alert?.zone?.display_name || areaName
  const triggerCount = Number(alert?.triggerCount ?? alert?.trigger_count ?? 0)

  return {
    ...alert,
    name: alert?.name || alert?.title || 'Untitled alert',
    status: normalizedStatus,
    severity: alert?.severity || alert?.minSeverity || alert?.min_severity || 'medium',
    timeWindow: alert?.timeWindow || alert?.time_window || 'Any time',
    triggerCount,
    lastTriggered: alert?.lastTriggered || alert?.last_triggered || 'Never',
    incidentTypes,
    area: {
      ...alert?.area,
      name: areaName,
      wilaya: alert?.area?.wilaya || alert?.area_wilaya || 'N/A',
      center: alert?.area?.center || DEFAULT_CENTER,
    },
    zone: {
      ...alert?.zone,
      zoneType,
      displayName: zoneDisplayName,
    },
    recentTriggers: Array.isArray(alert?.recentTriggers)
      ? alert.recentTriggers.map(normalizeTrigger)
      : Array.isArray(alert?.recent_triggers)
        ? alert.recent_triggers.map(normalizeTrigger)
        : [],
  }
}

export default function AlertsPage() {
  const { t } = useTranslation(['alerts', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('active')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [selectedAlertId, setSelectedAlertId] = useState(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [alerts, setAlerts] = useState([])
  const [showQuiz, setShowQuiz] = useState(false)
  const [pushBusyAction, setPushBusyAction] = useState('')
  const [pushError, setPushError] = useState('')
  const [pushNotice, setPushNotice] = useState('')
  const [pushPermission, setPushPermission] = useState(getPushPermissionState())
  const [pushPreferences, setPushPreferences] = useState(null)
  const [pushSettingsLoading, setPushSettingsLoading] = useState(true)
  const [pushSupported, setPushSupported] = useState(isPushSupported())
  const [hasBrowserSubscription, setHasBrowserSubscription] = useState(false)
  const [emailPreferences, setEmailPreferences] = useState(null)
  const [emailPreferencesLoading, setEmailPreferencesLoading] = useState(true)
  const [emailPreferencesBusyKey, setEmailPreferencesBusyKey] = useState('')
  const [emailPreferencesError, setEmailPreferencesError] = useState('')
  const [emailPreferencesNotice, setEmailPreferencesNotice] = useState('')

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const items = await fetchAlerts()
        if (!ignore) setAlerts(items.map(normalizeAlert))
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || t('alertsPage.errors.unableToLoadAlerts'))
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [t])

  useEffect(() => {
    let ignore = false

    ;(async () => {
      try {
        const [preferences, subscription] = await Promise.all([
          fetchPushPreferences(),
          getExistingPushSubscription().catch(() => null),
        ])

        if (ignore) {
          return
        }

        setPushPreferences(preferences)
        setHasBrowserSubscription(Boolean(subscription))
        setPushSupported(isPushSupported())
        setPushPermission(getPushPermissionState())
      } catch (error) {
        if (!ignore) {
          setPushError(error.response?.data?.message || t('alertsPage.errors.unableToLoadPushSettings'))
        }
      } finally {
        if (!ignore) {
          setPushSettingsLoading(false)
        }
      }
    })()

    return () => { ignore = true }
  }, [t])

  useEffect(() => {
    let ignore = false

    ;(async () => {
      try {
        const preferences = await fetchEmailPreferences()
        if (!ignore) {
          setEmailPreferences(preferences)
        }
      } catch (error) {
        if (!ignore) {
          setEmailPreferencesError(error.response?.data?.message || t('alertsPage.errors.unableToLoadEmailPrefs'))
        }
      } finally {
        if (!ignore) {
          setEmailPreferencesLoading(false)
        }
      }
    })()

    return () => { ignore = true }
  }, [t])

  useEffect(() => {
    if (location.state?.newAlert) {
      setToast(t('alertsPage.toast.alertCreated', { name: location.state.newAlert }))
      window.history.replaceState({}, '')
    } else if (location.state?.editedAlert) {
      setToast(t('alertsPage.toast.alertUpdated', { name: location.state.editedAlert }))
      window.history.replaceState({}, '')
    }
  }, [location.state, t])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!pushNotice) {
      return undefined
    }

    const timer = setTimeout(() => setPushNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [pushNotice])

  useEffect(() => {
    if (!emailPreferencesNotice) {
      return undefined
    }

    const timer = setTimeout(() => setEmailPreferencesNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [emailPreferencesNotice])

  const wilayas = useMemo(
    () => [...new Set(alerts.map((alert) => alert.area?.wilaya).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [alerts]
  )

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab !== 'all' && alert.status !== activeTab) return false
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (areaFilter !== 'all' && alert.area?.wilaya !== areaFilter) return false
    return true
  })

  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) || null
  const stats = {
    active: alerts.filter((alert) => alert.status === 'active').length,
    paused: alerts.filter((alert) => alert.status === 'paused').length,
    archived: alerts.filter((alert) => alert.status === 'archived').length,
  }

  const profileName = user?.name || user?.email || 'SIARA User'
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

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setSelectedAlertId(null)
      return
    }

    if (selectedAlertId && filteredAlerts.some((alert) => alert.id === selectedAlertId)) {
      return
    }

    setSelectedAlertId(filteredAlerts[0].id)
  }, [filteredAlerts, selectedAlertId])

  async function handleToggleStatus(event, alert) {
    event.stopPropagation()
    try {
      const nextStatus = alert.status === 'active' ? 'paused' : 'active'
      const updated = normalizeAlert(await updateAlertStatus(alert.id, nextStatus))
      setAlerts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('alertsPage.errors.unableToUpdateStatus'))
    }
  }

  async function handleDelete(event, alertId) {
    event.stopPropagation()
    if (!window.confirm(t('alertsPage.confirm.deleteAlert'))) return
    try {
      await deleteAlert(alertId)
      setAlerts((prev) => prev.filter((item) => item.id !== alertId))
      setToast(t('alertsPage.toast.alertDeleted'))
    } catch (error) {
      setErrorMessage(error.response?.data?.message || t('alertsPage.errors.unableToDeleteAlert'))
    }
  }

  const mapCenter = selectedAlert?.area?.center || DEFAULT_CENTER
  const pushEnabled = Boolean(pushPreferences?.pushEnabled && pushPreferences?.pushMode !== 'off')

  async function refreshBrowserPushState() {
    const subscription = await getExistingPushSubscription().catch(() => null)
    setHasBrowserSubscription(Boolean(subscription))
    setPushPermission(getPushPermissionState())
    setPushSupported(isPushSupported())
    return subscription
  }

  async function handlePushModeChange(nextMode) {
    if (!pushSupported) {
      setPushError(t('alertsPage.push.notSupportedError'))
      return
    }

    setPushBusyAction(nextMode)
    setPushError('')
    setPushNotice('')

    try {
      await subscribeCurrentBrowserToPush()
      const preferences = await updatePushPreferences({
        pushEnabled: true,
        pushMode: nextMode,
      })
      setPushPreferences(preferences)
      setHasBrowserSubscription(true)
      setPushPermission(getPushPermissionState())
      setPushNotice(nextMode === 'all'
        ? t('alertsPage.push.noticeAllMode')
        : t('alertsPage.push.noticeImportantOnlyMode'))
    } catch (error) {
      await refreshBrowserPushState()
      setPushError(error.response?.data?.message || error.message || t('alertsPage.errors.unableToEnablePush'))
    } finally {
      setPushBusyAction('')
    }
  }

  async function handleDisableSystemAlerts() {
    setPushBusyAction('off')
    setPushError('')
    setPushNotice('')

    try {
      const preferences = await updatePushPreferences({
        pushEnabled: false,
        pushMode: 'off',
      })

      setPushPreferences(preferences)
      await unsubscribeCurrentBrowserFromPush().catch(() => null)
      await refreshBrowserPushState()
      setPushNotice(t('alertsPage.push.noticeTurnedOff'))
    } catch (error) {
      setPushError(error.response?.data?.message || error.message || t('alertsPage.errors.unableToDisablePush'))
    } finally {
      setPushBusyAction('')
    }
  }

  async function handleSendPushTest() {
    setPushBusyAction('test')
    setPushError('')
    setPushNotice('')

    try {
      const result = await sendPushTest()
      if (!result.ok || result.sentCount === 0) {
        setPushError(result.reason === 'no_active_subscriptions'
          ? t('alertsPage.push.noActiveSubscription')
          : t('alertsPage.errors.unableToSendTestAlert'))
        return
      }

      setPushNotice(t('alertsPage.push.testAlertSent'))
    } catch (error) {
      setPushError(error.response?.data?.message || error.message || t('alertsPage.errors.unableToSendTestAlert'))
    } finally {
      setPushBusyAction('')
    }
  }

  async function handleEmailPreferenceToggle(key, value) {
    setEmailPreferencesBusyKey(key)
    setEmailPreferencesError('')
    setEmailPreferencesNotice('')

    try {
      const preferences = await updateEmailPreferences({
        weeklySummaryEnabled: key === 'weekly_summary_enabled' ? value : undefined,
        productUpdatesEnabled: key === 'product_updates_enabled' ? value : undefined,
        marketingEnabled: key === 'marketing_enabled' ? value : undefined,
      })

      setEmailPreferences(preferences)
      setEmailPreferencesNotice(t('alertsPage.email.preferencesUpdated'))
    } catch (error) {
      setEmailPreferencesError(error.response?.data?.message || t('alertsPage.errors.unableToUpdateEmailPrefs'))
    } finally {
      setEmailPreferencesBusyKey('')
    }
  }

  function formatPushPermission(permission) {
    if (permission === 'granted') {
      return t('alertsPage.push.permissionAllowed')
    }
    if (permission === 'denied') {
      return t('alertsPage.push.permissionBlocked')
    }
    if (permission === 'default') {
      return t('alertsPage.push.permissionAskFirst')
    }
    return t('alertsPage.push.permissionUnavailable')
  }

  function describePushMode(preferences) {
    if (!preferences?.pushEnabled || preferences?.pushMode === 'off') {
      return t('alertsPage.push.descOff')
    }

    if (preferences.pushMode === 'all') {
      return t('alertsPage.push.descAll')
    }

    return t('alertsPage.push.descImportantOnly')
  }

  function describeEmailPreferences(preferences) {
    if (!preferences) {
      return t('alertsPage.email.descDefault')
    }

    if (!preferences.weekly_summary_enabled && !preferences.product_updates_enabled && !preferences.marketing_enabled) {
      return t('alertsPage.email.descAllOff')
    }

    return t('alertsPage.email.descSome')
  }

  function toTitleCase(value) {
    const normalized = String(value || '').trim()
    if (!normalized) return t('alertsPage.unknown')
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  return (
    <div className="alerts-page">
      <DrivingQuiz onComplete={() => setShowQuiz(false)} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('common:nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab dash-tab-active">{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('common:nav.report')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('common:nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('alertsPage.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('alertsPage.ariaUserProfile')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('alertsPage.ariaUserAvatar')} className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('alertsPage.dropdown.myProfile')}</button>
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

      {toast && <div className="al-toast" onClick={() => setToast('')}>{toast}</div>}

      <div className="al-grid">
        <aside className="al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatarUrl} alt={t('alertsPage.ariaProfile')} className="profile-avatar-large" loading="lazy" />            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">{t('alertsPage.profileBio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>{t('alertsPage.viewProfile')}</button>
            </div>
          </div>

          <button className="al-cta" onClick={() => navigate('/alerts/create')}>{t('alertsPage.newAlert')}</button>

          <div className="card al-filter-section">
            <div className="nav-section-label">{t('alertsPage.alertStatusLabel')}</div>
            <nav className="al-nav">
              {STATUS_TABS.map((tab) => (
                <button key={tab.key} className={`al-nav-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                  <span className="nav-label">{t(`alertsPage.statusTab.${tab.key}`)}</span>
                  <span className="nav-count">{stats[tab.key]}</span>
                </button>
              ))}
            </nav>
          </div>

          <FeedSidebarNav activeKey="alerts" onOpenQuiz={() => setShowQuiz(true)} />
        </aside>

        <main className="al-center">
          <div className="al-page-head">
            <h1>{t('alertsPage.pageTitle')}</h1>
            <p>{t('alertsPage.pageDescription')}</p>
          </div>

          <div className="al-filters">
            <FancySelect
              value={severityFilter}
              onChange={setSeverityFilter}
              options={[
                { value: 'all',    label: t('alertsPage.filter.severity') },
                { value: 'high',   label: t('alertsPage.filter.high') },
                { value: 'medium', label: t('alertsPage.filter.medium') },
                { value: 'low',    label: t('alertsPage.filter.low') },
              ]}
              menuAlign="left"
            />
            <FancySelect
              value={areaFilter}
              onChange={setAreaFilter}
              options={[
                { value: 'all', label: t('alertsPage.filter.area') },
                ...wilayas.map((wilaya) => ({ value: wilaya, label: wilaya })),
              ]}
              menuAlign="left"
            />
          </div>

          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          <div className="al-list">
            {loading ? (
              <SkeletonList rows={5} label={t('alertsPage.loadingAlerts')} />
            ) : filteredAlerts.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon" aria-hidden="true">{icon('notification')}</span>
                <h3>{t('alertsPage.empty.title')}</h3>
                <p>{t('alertsPage.empty.description')}</p>
                <button className="empty-btn" onClick={() => navigate('/alerts/create')}>{t('alertsPage.empty.createButton')}</button>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className={`al-card sev-${alert.severity || 'unknown'} ${selectedAlertId === alert.id ? 'selected' : ''}`} onClick={() => setSelectedAlertId(alert.id)}>
                  <div className="card-head">
                    <h3 className="card-name">{alert.name}</h3>
                    <span className={`card-status ${alert.status}`}>{toTitleCase(alert.status)}</span>
                    <span className="card-sev" style={{ background: `${color(alert.severity)}15`, color: color(alert.severity) }}>
                      <span className="sev-dot" style={{ background: color(alert.severity) }}></span>
                      {toTitleCase(alert.severity)}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info truncate">
                        <PinIcon />
                        {alert.area?.name || alert.zone?.displayName}
                      </span>
                      <span className="info" style={{ flexShrink: 0 }}>
                        <ClockIcon />
                        {alert.timeWindow}
                      </span>
                    </div>
                    <div className="body-line">
                      <span className="types">
                        {alert.incidentTypes.length > 0
                          ? alert.incidentTypes.map((type) => <span key={type} className="type-badge">{toTitleCase(type)}</span>)
                          : null}
                      </span>
                      <span className="meta" style={{ marginLeft: 'auto' }}>{t('alertsPage.card.last')} {alert.lastTriggered} · {t('alertsPage.card.trigger', { count: alert.triggerCount })}</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className={`act-btn act-toggle ${alert.status === 'active' ? 'on' : 'off'}`} onClick={(event) => handleToggleStatus(event, alert)}>
                      {alert.status === 'active' ? t('alertsPage.card.pause') : t('alertsPage.card.activate')}
                    </button>
                    <button className="act-btn act-edit" onClick={(event) => { event.stopPropagation(); navigate('/alerts/create', { state: { editAlert: alert } }) }}>
                      {t('common:actions.edit')}
                    </button>
                    <button className="act-btn act-delete" onClick={(event) => handleDelete(event, alert.id)}>
                      {t('common:actions.delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        <aside className="al-right">
          <div className="al-panel al-push-panel">
            <div className="panel-head al-push-head">
              <div>
                <span className="panel-label" style={{ marginBottom: 4 }}>{t('alertsPage.push.panelLabel')}</span>
                <div className="al-push-panel-status">
                  <span className={`al-push-status-dot ${pushEnabled ? 'on' : 'off'}`} />
                  <span className={`al-push-chip ${pushEnabled ? 'enabled' : 'disabled'}`}>
                    {pushEnabled ? t('alertsPage.on') : t('alertsPage.off')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="al-push-primary"
                onClick={() => { void handlePushModeChange('important_only') }}
                disabled={!pushSupported || pushBusyAction !== '' || pushSettingsLoading || pushEnabled}
              >
                {pushEnabled ? t('alertsPage.push.alertsEnabled') : t('alertsPage.push.enableAlerts')}
              </button>
            </div>

            <p className="al-push-copy">{describePushMode(pushPreferences)}</p>

            <div className="al-push-status-grid">
              <div className="al-push-status-item">
                <span className="al-push-status-label">{t('alertsPage.push.statusBrowser')}</span>
                <strong>{pushSupported ? t('alertsPage.push.supported') : t('alertsPage.push.unavailable')}</strong>
              </div>
              <div className="al-push-status-item">
                <span className="al-push-status-label">{t('alertsPage.push.statusPermission')}</span>
                <strong>{formatPushPermission(pushPermission)}</strong>
              </div>
              <div className="al-push-status-item">
                <span className="al-push-status-label">{t('alertsPage.push.statusSubscription')}</span>
                <strong>{hasBrowserSubscription ? t('alertsPage.push.subscriptionActive') : t('alertsPage.push.subscriptionInactive')}</strong>
              </div>
            </div>

            {pushSettingsLoading ? (
              <div className="al-push-feedback subtle">{t('alertsPage.push.loadingSettings')}</div>
            ) : null}
            {pushError ? (
              <div className="al-push-feedback error">{pushError}</div>
            ) : null}
            {pushNotice ? (
              <div className="al-push-feedback success">{pushNotice}</div>
            ) : null}

            <div className="al-push-options">
              <button
                type="button"
                className={`al-push-option ${pushPreferences?.pushMode === 'important_only' && pushEnabled ? 'active' : ''}`}
                onClick={() => { void handlePushModeChange('important_only') }}
                disabled={!pushSupported || pushBusyAction !== '' || pushSettingsLoading}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2L4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.push.optionHighRiskTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.push.optionHighRiskCopy')}</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${pushPreferences?.pushMode === 'all' && pushEnabled ? 'active' : ''}`}
                onClick={() => { void handlePushModeChange('all') }}
                disabled={!pushSupported || pushBusyAction !== '' || pushSettingsLoading}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.push.optionAllTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.push.optionAllCopy')}</span>
              </button>

              <button
                type="button"
                className={`al-push-option danger ${!pushEnabled ? 'active' : ''}`}
                onClick={() => { void handleDisableSystemAlerts() }}
                disabled={pushBusyAction !== '' || pushSettingsLoading}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.push.optionOffTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.push.optionOffCopy')}</span>
              </button>
            </div>

            <div className="al-push-actions">
              <button
                type="button"
                className="al-push-secondary"
                onClick={() => { void handleSendPushTest() }}
                disabled={!pushEnabled || !hasBrowserSubscription || pushBusyAction !== ''}
              >
                {t('alertsPage.push.sendTestAlert')}
              </button>
            </div>
          </div>

          <div className="al-panel al-email-panel">
            <div className="panel-head al-push-head">
              <div>
                <span className="panel-label" style={{ marginBottom: 4 }}>{t('alertsPage.email.panelLabel')}</span>
                <div className="al-push-panel-status">
                  <span className={`al-push-status-dot ${(emailPreferences?.weekly_summary_enabled || emailPreferences?.product_updates_enabled || emailPreferences?.marketing_enabled) ? 'on' : 'off'}`} />
                  <span className={`al-push-chip ${(emailPreferences?.weekly_summary_enabled || emailPreferences?.product_updates_enabled || emailPreferences?.marketing_enabled) ? 'enabled' : 'disabled'}`}>
                    {(emailPreferences?.weekly_summary_enabled || emailPreferences?.product_updates_enabled || emailPreferences?.marketing_enabled) ? t('alertsPage.on') : t('alertsPage.off')}
                  </span>
                </div>
              </div>
            </div>

            <p className="al-push-copy">{describeEmailPreferences(emailPreferences)}</p>

            {emailPreferencesLoading ? (
              <div className="al-push-feedback subtle">{t('alertsPage.email.loadingSettings')}</div>
            ) : null}
            {emailPreferencesError ? (
              <div className="al-push-feedback error">{emailPreferencesError}</div>
            ) : null}
            {emailPreferencesNotice ? (
              <div className="al-push-feedback success">{emailPreferencesNotice}</div>
            ) : null}

            <div className="al-push-options">
              <button
                type="button"
                className={`al-push-option ${emailPreferences?.weekly_summary_enabled ? 'active' : ''}`}
                onClick={() => { void handleEmailPreferenceToggle('weekly_summary_enabled', !emailPreferences?.weekly_summary_enabled) }}
                disabled={emailPreferencesLoading || emailPreferencesBusyKey !== ''}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.7"/>
                      <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.email.weeklySummaryTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.email.weeklySummaryCopy')}</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${emailPreferences?.product_updates_enabled ? 'active' : ''}`}
                onClick={() => { void handleEmailPreferenceToggle('product_updates_enabled', !emailPreferences?.product_updates_enabled) }}
                disabled={emailPreferencesLoading || emailPreferencesBusyKey !== ''}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2l2.4 6.4H21l-5.6 4 2.2 6.6L12 15l-5.6 4 2.2-6.6L3 8.4h6.6L12 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.email.productUpdatesTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.email.productUpdatesCopy')}</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${emailPreferences?.marketing_enabled ? 'active' : ''}`}
                onClick={() => { void handleEmailPreferenceToggle('marketing_enabled', !emailPreferences?.marketing_enabled) }}
                disabled={emailPreferencesLoading || emailPreferencesBusyKey !== ''}
              >
                <div className="al-push-option-head">
                  <span className="al-push-option-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 12H4m0 0 6-6m-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="al-push-option-title">{t('alertsPage.email.marketingUpdatesTitle')}</span>
                </div>
                <span className="al-push-option-copy">{t('alertsPage.email.marketingUpdatesCopy')}</span>
              </button>
            </div>
          </div>

          {selectedAlert ? (
            <>
              <div className="al-panel summary">
                <div className="panel-head">
                  <span className="panel-name">{selectedAlert.name}</span>
                  <span className={`panel-status ${selectedAlert.status}`}>{toTitleCase(selectedAlert.status)}</span>
                </div>
                <div className="summary-grid">
                  <div className="sum-item"><span className="sum-l">{t('alertsPage.summary.area')}</span><span className="sum-v">{selectedAlert.area?.name || selectedAlert.zone?.displayName}</span></div>
                  <div className="sum-item"><span className="sum-l">{t('alertsPage.summary.wilaya')}</span><span className="sum-v">{selectedAlert.area?.wilaya || 'N/A'}</span></div>
                  <div className="sum-item"><span className="sum-l">{t('alertsPage.summary.schedule')}</span><span className="sum-v">{selectedAlert.timeWindow}</span></div>
                  <div className="sum-item"><span className="sum-l">{t('alertsPage.summary.triggers')}</span><span className="sum-v">{selectedAlert.triggerCount}</span></div>
                </div>
              </div>

              <div className="al-panel map">
                <span className="panel-label">{t('alertsPage.map.monitoredArea')}</span>
                <div className="mini-map-wrap">
                  <MapContainer
                    className="al-gmap"
                    center={[mapCenter.lat, mapCenter.lng]}
                    zoom={selectedAlert.zone?.zoneType === 'radius' ? 10 : 11}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    doubleClickZoom={false}
                    attributionControl={false}
                    key={`${mapCenter.lat}-${mapCenter.lng}`}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[mapCenter.lat, mapCenter.lng]} icon={leafletIcon} />
                  </MapContainer>
                </div>
                <span className="map-text">{selectedAlert.zone?.displayName || selectedAlert.area?.name}</span>
                <button
                  type="button"
                  className="al-map-link"
                  onClick={() => navigate('/map', { state: { mapLayer: 'zones', focusAlertId: selectedAlert.id } })}
                >
                  {t('alertsPage.map.openZoneOnMap')}
                </button>
              </div>

              <div className="al-panel triggers">
                <span className="panel-label">{t('alertsPage.triggers.panelLabel')}</span>
                {selectedAlert.recentTriggers?.length ? (
                  <div className="trigger-list">
                    {selectedAlert.recentTriggers.map((trigger) => (
                      <div key={trigger.id} className="trigger-row">
                        <span className="t-icon">{icon(trigger.type)}</span>
                        <span className="t-title">{trigger.title}</span>
                        <span className="t-time">{trigger.time}</span>
                        <span className="t-dot" style={{ background: color(trigger.severity) }}></span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-triggers">{t('alertsPage.triggers.noTriggers')}</div>
                )}
              </div>
            </>
          ) : (
            <div className="al-panel al-no-sel">
              <span className="no-sel-icon">{renderSidebarIcon('map')}</span>
              <h4>{t('alertsPage.noSelection.title')}</h4>
              <p>{t('alertsPage.noSelection.description')}</p>
              <button type="button" className="al-map-link" onClick={() => navigate('/alerts/create')}>
                {t('alertsPage.noSelection.createButton')}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
