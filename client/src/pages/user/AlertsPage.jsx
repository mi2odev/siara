import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'

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
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'archived', label: 'Archived' },
]

const DEFAULT_CENTER = { lat: 36.753, lng: 3.0588 }

function icon(type) {
  return { accident: '🚗', traffic: '🚦', danger: '⚠️', roadworks: '🚧', ai_prediction: '🤖' }[type] || '🔔'
}

function renderSidebarIcon(type) {
  if (type === 'quiz') return '🚗'
  if (type === 'map') return '🗺️'
  if (type === 'report') return '📝'
  if (type === 'pin') return '📍'
  if (type === 'time') return '🕐'
  return '🧭'
}

function color(severity) {
  return { high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[severity] || '#64748B'
}

function formatPushPermission(permission) {
  if (permission === 'granted') {
    return 'Allowed'
  }
  if (permission === 'denied') {
    return 'Blocked'
  }
  if (permission === 'default') {
    return 'Ask first'
  }
  return 'Unavailable'
}

function describePushMode(preferences) {
  if (!preferences?.pushEnabled || preferences?.pushMode === 'off') {
    return 'System alerts are currently off for this browser.'
  }

  if (preferences.pushMode === 'all') {
    return 'Medium and high-risk watched-zone alerts will appear as browser notifications.'
  }

  return 'Only high-risk watched-zone alerts will appear as browser notifications.'
}

function describeEmailPreferences(preferences) {
  if (!preferences) {
    return 'Choose which SIARA emails should reach your inbox.'
  }

  if (!preferences.weekly_summary_enabled && !preferences.product_updates_enabled && !preferences.marketing_enabled) {
    return 'Email updates are currently turned off except for required transactional messages.'
  }

  return 'Weekly summaries, product updates, and optional marketing emails are controlled here.'
}

function toTitleCase(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Unknown'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
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
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const { isLoaded: mapReady } = useLoadScript({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '' })

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
        if (!ignore) setErrorMessage(error.response?.data?.message || 'Unable to load alerts.')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

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
          setPushError(error.response?.data?.message || 'Unable to load system alert settings.')
        }
      } finally {
        if (!ignore) {
          setPushSettingsLoading(false)
        }
      }
    })()

    return () => { ignore = true }
  }, [])

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
          setEmailPreferencesError(error.response?.data?.message || 'Unable to load email preferences.')
        }
      } finally {
        if (!ignore) {
          setEmailPreferencesLoading(false)
        }
      }
    })()

    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (location.state?.newAlert) {
      setToast(`Alert "${location.state.newAlert}" created successfully`)
      window.history.replaceState({}, '')
    } else if (location.state?.editedAlert) {
      setToast(`Alert "${location.state.editedAlert}" updated successfully`)
      window.history.replaceState({}, '')
    }
  }, [location.state])

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
      setErrorMessage(error.response?.data?.message || 'Unable to update alert status.')
    }
  }

  async function handleDelete(event, alertId) {
    event.stopPropagation()
    if (!window.confirm('Delete this alert?')) return
    try {
      await deleteAlert(alertId)
      setAlerts((prev) => prev.filter((item) => item.id !== alertId))
      setToast('Alert deleted')
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to delete alert.')
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
      setPushError('System notifications are not supported in this browser.')
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
        ? 'System alerts now include medium and high-risk watched-zone incidents.'
        : 'System alerts now focus on high-risk watched-zone incidents.')
    } catch (error) {
      await refreshBrowserPushState()
      setPushError(error.response?.data?.message || error.message || 'Unable to enable system alerts.')
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
      setPushNotice('System alerts turned off for this browser.')
    } catch (error) {
      setPushError(error.response?.data?.message || error.message || 'Unable to turn off system alerts.')
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
          ? 'No active browser subscription was found for your account on this browser.'
          : 'Unable to send a test system alert right now.')
        return
      }

      setPushNotice('Test alert sent. Check your browser notifications.')
    } catch (error) {
      setPushError(error.response?.data?.message || error.message || 'Unable to send a test system alert.')
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
      setEmailPreferencesNotice('Email preferences updated.')
    } catch (error) {
      setEmailPreferencesError(error.response?.data?.message || 'Unable to update email preferences.')
    } finally {
      setEmailPreferencesBusyKey('')
    }
  }

  return (
    <div className="alerts-page">
      <DrivingQuiz onComplete={() => setShowQuiz(false)} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab dash-tab-active">Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
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
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
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

      {toast && <div className="al-toast" onClick={() => setToast('')}>{toast}</div>}

      <div className="al-grid">
        <aside className="al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatarUrl} alt="Profile" className="profile-avatar-large" loading="lazy" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <button className="al-cta" onClick={() => navigate('/alerts/create')}>+ New Alert</button>

          <div className="card al-filter-section">
            <div className="nav-section-label">ALERT STATUS</div>
            <nav className="al-nav">
              {STATUS_TABS.map((tab) => (
                <button key={tab.key} className={`al-nav-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                  <span className="nav-label">{tab.label}</span>
                  <span className="nav-count">{stats[tab.key]}</span>
                </button>
              ))}
            </nav>
          </div>

          <FeedSidebarNav activeKey="alerts" onOpenQuiz={() => setShowQuiz(true)} />
        </aside>

        <main className="al-center">
          <div className="al-page-head">
            <h1>My Alerts</h1>
            <p>Manage database-backed alert rules for wilayas, communes, and radius zones.</p>
          </div>

          <div className="al-filters">
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">Severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="all">Area</option>
              {wilayas.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}
            </select>
          </div>

          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          <div className="al-list">
            {loading ? (
              <div className="al-empty"><h3>Loading alerts...</h3></div>
            ) : filteredAlerts.length === 0 ? (
              <div className="al-empty">
                <span className="empty-icon" aria-hidden="true">{icon('notification')}</span>
                <h3>No Alerts</h3>
                <p>Create your first alert to get notified.</p>
                <button className="empty-btn" onClick={() => navigate('/alerts/create')}>Create an Alert</button>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className={`al-card ${selectedAlertId === alert.id ? 'selected' : ''}`} onClick={() => setSelectedAlertId(alert.id)}>
                  <div className="card-head">
                    <h3 className="card-name">{alert.name}</h3>
                    <span className={`card-status ${alert.status}`}>{toTitleCase(alert.status)}</span>
                    <span className="card-sev" style={{ background: `${color(alert.severity)}18`, color: color(alert.severity) }}>
                      <span className="sev-dot" style={{ background: color(alert.severity) }}></span>
                      {toTitleCase(alert.severity)}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className="body-line">
                      <span className="info">{renderSidebarIcon('pin')} {alert.area?.name || alert.zone?.displayName}</span>
                      <span className="info">{renderSidebarIcon('time')} {alert.timeWindow}</span>
                    </div>
                    <div className="body-line">
                      <span className="types">
                        {alert.incidentTypes.length > 0
                          ? alert.incidentTypes.map((type) => <span key={type}>{icon(type)}</span>)
                          : <span>—</span>}
                      </span>
                      <span className="meta">Last: {alert.lastTriggered}</span>
                      <span className="meta">{alert.triggerCount} trigger{alert.triggerCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <button className={`act-btn act-toggle ${alert.status === 'active' ? 'on' : 'off'}`} onClick={(event) => handleToggleStatus(event, alert)}>
                      <span>{alert.status === 'active' ? 'Pause' : 'Activate'}</span>
                    </button>
                    <button className="act-btn act-edit" onClick={(event) => { event.stopPropagation(); navigate('/alerts/create', { state: { editAlert: alert } }) }}>
                      <span>Edit</span>
                    </button>
                    <button className="act-btn act-delete" onClick={(event) => handleDelete(event, alert.id)}>
                      <span>Delete</span>
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
                <span className="panel-label" style={{ marginBottom: 6 }}>System Alerts</span>
                <span className={`al-push-chip ${pushEnabled ? 'enabled' : 'disabled'}`}>
                  {pushEnabled ? 'On' : 'Off'}
                </span>
              </div>
              <button
                type="button"
                className="al-push-primary"
                onClick={() => { void handlePushModeChange('important_only') }}
                disabled={!pushSupported || pushBusyAction !== '' || pushSettingsLoading || pushEnabled}
              >
                {pushEnabled ? 'System alerts enabled' : 'Enable system alerts'}
              </button>
            </div>

            <p className="al-push-copy">{describePushMode(pushPreferences)}</p>

            <div className="al-push-status-grid">
              <div className="al-push-status-item">
                <span className="al-push-status-label">Browser</span>
                <strong>{pushSupported ? 'Supported' : 'Unavailable'}</strong>
              </div>
              <div className="al-push-status-item">
                <span className="al-push-status-label">Permission</span>
                <strong>{formatPushPermission(pushPermission)}</strong>
              </div>
              <div className="al-push-status-item">
                <span className="al-push-status-label">Subscription</span>
                <strong>{hasBrowserSubscription ? 'Active' : 'Inactive'}</strong>
              </div>
            </div>

            {pushSettingsLoading ? (
              <div className="al-push-feedback subtle">Loading system alert settings...</div>
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
                <span className="al-push-option-title">High-risk alerts only</span>
                <span className="al-push-option-copy">Recommended for critical watched-zone incidents.</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${pushPreferences?.pushMode === 'all' && pushEnabled ? 'active' : ''}`}
                onClick={() => { void handlePushModeChange('all') }}
                disabled={!pushSupported || pushBusyAction !== '' || pushSettingsLoading}
              >
                <span className="al-push-option-title">All watched-zone alerts</span>
                <span className="al-push-option-copy">Includes medium and high-risk watched-zone incidents.</span>
              </button>

              <button
                type="button"
                className={`al-push-option danger ${!pushEnabled ? 'active' : ''}`}
                onClick={() => { void handleDisableSystemAlerts() }}
                disabled={pushBusyAction !== '' || pushSettingsLoading}
              >
                <span className="al-push-option-title">Turn off system alerts</span>
                <span className="al-push-option-copy">Keep in-app notifications only.</span>
              </button>
            </div>

            <div className="al-push-actions">
              <button
                type="button"
                className="al-push-secondary"
                onClick={() => { void handleSendPushTest() }}
                disabled={!pushEnabled || !hasBrowserSubscription || pushBusyAction !== ''}
              >
                Send test alert
              </button>
            </div>
          </div>

          <div className="al-panel al-email-panel">
            <div className="panel-head al-push-head">
              <div>
                <span className="panel-label" style={{ marginBottom: 6 }}>Email Preferences</span>
                <span className={`al-push-chip ${(emailPreferences?.weekly_summary_enabled || emailPreferences?.product_updates_enabled || emailPreferences?.marketing_enabled) ? 'enabled' : 'disabled'}`}>
                  {(emailPreferences?.weekly_summary_enabled || emailPreferences?.product_updates_enabled || emailPreferences?.marketing_enabled) ? 'On' : 'Off'}
                </span>
              </div>
            </div>

            <p className="al-push-copy">{describeEmailPreferences(emailPreferences)}</p>

            {emailPreferencesLoading ? (
              <div className="al-push-feedback subtle">Loading email settings...</div>
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
                <span className="al-push-option-title">Weekly summary email</span>
                <span className="al-push-option-copy">Sunday evening recap of incidents and trigger activity in your watched zones.</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${emailPreferences?.product_updates_enabled ? 'active' : ''}`}
                onClick={() => { void handleEmailPreferenceToggle('product_updates_enabled', !emailPreferences?.product_updates_enabled) }}
                disabled={emailPreferencesLoading || emailPreferencesBusyKey !== ''}
              >
                <span className="al-push-option-title">Product updates</span>
                <span className="al-push-option-copy">Occasional SIARA improvements, release notes, and feature updates.</span>
              </button>

              <button
                type="button"
                className={`al-push-option ${emailPreferences?.marketing_enabled ? 'active' : ''}`}
                onClick={() => { void handleEmailPreferenceToggle('marketing_enabled', !emailPreferences?.marketing_enabled) }}
                disabled={emailPreferencesLoading || emailPreferencesBusyKey !== ''}
              >
                <span className="al-push-option-title">Marketing updates</span>
                <span className="al-push-option-copy">Optional announcements about SIARA campaigns and outreach.</span>
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
                  <div className="sum-item"><span className="sum-l">Area</span><span className="sum-v">{selectedAlert.area?.name || selectedAlert.zone?.displayName}</span></div>
                  <div className="sum-item"><span className="sum-l">Wilaya</span><span className="sum-v">{selectedAlert.area?.wilaya || 'N/A'}</span></div>
                  <div className="sum-item"><span className="sum-l">Schedule</span><span className="sum-v">{selectedAlert.timeWindow}</span></div>
                  <div className="sum-item"><span className="sum-l">Triggers</span><span className="sum-v">{selectedAlert.triggerCount}</span></div>
                </div>
              </div>

              <div className="al-panel map">
                <span className="panel-label">Monitored Area</span>
                <div className="mini-map-wrap">
                  {mapReady ? (
                    <GoogleMap
                      mapContainerClassName="al-gmap"
                      center={mapCenter}
                      zoom={selectedAlert.zone?.zoneType === 'radius' ? 10 : 11}
                      options={{ disableDefaultUI: true, zoomControl: false, gestureHandling: 'none' }}
                    >
                      <Marker position={mapCenter} />
                    </GoogleMap>
                  ) : (
                    <div className="mini-map-fallback">Loading...</div>
                  )}
                </div>
                <span className="map-text">{selectedAlert.zone?.displayName || selectedAlert.area?.name}</span>
                <button
                  type="button"
                  className="al-map-link"
                  onClick={() => navigate('/map', { state: { mapLayer: 'zones', focusAlertId: selectedAlert.id } })}
                >
                  Open zone on map
                </button>
              </div>

              <div className="al-panel triggers">
                <span className="panel-label">Recent Triggers</span>
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
                  <div className="no-triggers">No triggers yet</div>
                )}
              </div>
            </>
          ) : (
            <div className="al-panel al-no-sel">
              <span className="no-sel-icon">{renderSidebarIcon('map')}</span>
              <h4>No Alert Selected</h4>
              <p>Select an alert from the list to view live zone details and recent trigger activity.</p>
              <button type="button" className="al-map-link" onClick={() => navigate('/alerts/create')}>
                Create a New Alert
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
