import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Circle, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import LeftQuickInfoLinks from '../../components/layout/LeftQuickInfoLinks'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { createAlert, fetchCommunes, fetchWilayas, updateAlert } from '../../services/alertService'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/CreateAlertPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const ALGIERS = { lat: 36.753, lng: 3.0588 }
const STEPS = ['Alert Type', 'Zone', 'Conditions', 'Frequency', 'Confirmation']
const ALERT_TYPES = [
  { id: 'accident', icon: '🚗', label: 'Accident', desc: 'Collision, road accident' },
  { id: 'traffic', icon: '🚦', label: 'Traffic', desc: 'Traffic jam, slowdown' },
  { id: 'danger', icon: '🔥', label: 'Danger', desc: 'Obstacle, dangerous situation' },
  { id: 'weather', icon: '🌧️', label: 'Weather', desc: 'Dangerous weather conditions' },
  { id: 'roadworks', icon: '🚧', label: 'Roadworks', desc: 'Construction, lane closure' },
  { id: 'other', icon: '❓', label: 'Other', desc: 'Other type of incident' },
]
const SEVERITY_OPTIONS = [
  {
    id: 'high',
    label: 'High',
    desc: 'Urgent incidents that need immediate attention.',
    color: '#DC2626',
  },
  {
    id: 'medium',
    label: 'Medium',
    desc: 'Important incidents with moderate impact.',
    color: '#F59E0B',
  },
  {
    id: 'low',
    label: 'Low',
    desc: 'Minor incidents useful for awareness.',
    color: '#10B981',
  },
]
const TIME_RANGE_OPTIONS = [
  { id: 'all', label: 'All day' },
  { id: 'day', label: 'Daytime' },
  { id: 'night', label: 'Night' },
  { id: 'custom', label: 'Custom' },
]
const FREQUENCY_OPTIONS = [
  {
    id: 'immediate',
    icon: '⚡',
    label: 'Immediate',
    desc: 'Receive a notification as soon as a matching incident is detected.',
  },
  {
    id: 'digest',
    icon: '🗓️',
    label: 'Digest',
    desc: 'Bundle incidents in a summary so you receive fewer notifications.',
  },
  {
    id: 'first',
    icon: '🔕',
    label: 'First only',
    desc: 'Notify on the first matching incident, then silence repeated updates.',
  },
]
const DIGEST_INTERVALS = ['hourly', 'daily', 'weekly']

function renderHeaderIcon(type) {
  if (type === 'notification') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 16V11C18 7.7 15.8 5 12.7 4.2V3.5C12.7 3 12.3 2.7 11.8 2.7C11.3 2.7 10.9 3 10.9 3.5V4.2C7.8 5 5.6 7.7 5.6 11V16L4.2 17.4C3.8 17.8 4.1 18.6 4.7 18.6H19C19.6 18.6 19.9 17.8 19.5 17.4L18 16Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.6 19.4C10 20.4 10.8 21 11.8 21C12.8 21 13.6 20.4 14 19.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 17.2L3.8 20.2C3.4 20.8 3.8 21.6 4.5 21.6H16.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 15.8C5.8 15.8 4 14 4 11.8V8.8C4 6.6 5.8 4.8 8 4.8H16C18.2 4.8 20 6.6 20 8.8V11.8C20 14 18.2 15.8 16 15.8H8Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function renderTypeIcon(type) {
  return ALERT_TYPES.find((item) => item.id === type)?.icon || '❓'
}

function getInitialState(editAlert) {
  const zoneType = editAlert?.zone?.zoneType || ''
  return {
    name: editAlert?.name || '',
    types: editAlert?.incidentTypes || [],
    zoneType,
    zoneRadius: editAlert?.zone?.radiusM ? Math.round(editAlert.zone.radiusM / 1000) : 5,
    zoneWilayaId: String(zoneType === 'wilaya' ? (editAlert?.zone?.adminAreaId || editAlert?.zone?.wilayaId || '') : (editAlert?.zone?.wilayaId || '')),
    zoneCommuneId: String(zoneType === 'commune' ? (editAlert?.zone?.adminAreaId || editAlert?.zone?.communeId || '') : ''),
    radiusCenter: editAlert?.zone?.center || ALGIERS,
    severities: editAlert?.severityLevels?.length ? editAlert.severityLevels : ['high', 'medium'],
    timeRange: editAlert?.timeRangeType || 'all',
    timeStart: editAlert?.customTimeStart || '00:00',
    timeEnd: editAlert?.customTimeEnd || '23:59',
    weatherRelated: Boolean(editAlert?.weatherRelated),
    aiConfidence: editAlert?.aiConfidenceMin ?? 70,
    frequency: editAlert?.frequencyType || 'immediate',
    digestInterval: editAlert?.digestInterval || 'daily',
    muteDuplicates: editAlert?.muteDuplicates ?? true,
    deliveryApp: editAlert?.notifications?.app ?? true,
    deliveryEmail: editAlert?.notifications?.email ?? false,
    deliverySms: editAlert?.notifications?.sms ?? false,
  }
}

function zoneReady(data) {
  if (data.zoneType === 'radius') return Boolean(data.radiusCenter && data.zoneRadius > 0)
  if (data.zoneType === 'wilaya') return Boolean(data.zoneWilayaId)
  if (data.zoneType === 'commune') return Boolean(data.zoneWilayaId && data.zoneCommuneId)
  return false
}

function formatTimeRangeLabel(alertData) {
  if (alertData.timeRange === 'custom') {
    if (alertData.timeStart && alertData.timeEnd) {
      return `${alertData.timeStart} - ${alertData.timeEnd}`
    }
    return 'Custom'
  }

  const option = TIME_RANGE_OPTIONS.find((item) => item.id === alertData.timeRange)
  return option?.label || 'All day'
}

function formatSeverityLabelList(ids = []) {
  const labels = ids
    .map((id) => SEVERITY_OPTIONS.find((item) => item.id === id)?.label)
    .filter(Boolean)
  return labels.length > 0 ? labels.join(', ') : 'Not set'
}

export default function CreateAlertPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const editAlert = location.state?.editAlert || null
  const isEditMode = Boolean(editAlert)
  const initialState = useMemo(() => getInitialState(editAlert), [editAlert])
  const { isLoaded: mapReady } = useLoadScript({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '' })

  const [showDropdown, setShowDropdown] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [shakeNav, setShakeNav] = useState(false)
  const [loadingWilayas, setLoadingWilayas] = useState(true)
  const [loadingCommunes, setLoadingCommunes] = useState(false)
  const [radiusLocationAttempted, setRadiusLocationAttempted] = useState(Boolean(isEditMode))
  const [wilayas, setWilayas] = useState([])
  const [communes, setCommunes] = useState([])
  const [nameDirty, setNameDirty] = useState(isEditMode)
  const [alertData, setAlertData] = useState(initialState)

  const selectedWilaya = wilayas.find((item) => String(item.id) === String(alertData.zoneWilayaId)) || null
  const selectedCommune = communes.find((item) => String(item.id) === String(alertData.zoneCommuneId)) || null
  const zoneLabel =
    alertData.zoneType === 'radius'
      ? `${alertData.zoneRadius} km radius`
      : alertData.zoneType === 'wilaya'
        ? selectedWilaya?.name || 'Selected wilaya'
        : alertData.zoneType === 'commune'
          ? [selectedCommune?.name, selectedWilaya?.name].filter(Boolean).join(', ') || 'Selected commune'
          : 'Zone'
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileInitials = getInitialsFromName(user?.name || user?.email || 'User')

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const items = await fetchWilayas()
        if (!ignore) setWilayas(items)
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || 'Unable to load wilayas.')
      } finally {
        if (!ignore) setLoadingWilayas(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (alertData.zoneType !== 'commune' || !alertData.zoneWilayaId) {
      setCommunes([])
      return
    }
    let ignore = false
    setLoadingCommunes(true)
    ;(async () => {
      try {
        const items = await fetchCommunes(alertData.zoneWilayaId)
        if (!ignore) setCommunes(items)
      } catch (error) {
        if (!ignore) setErrorMessage(error.response?.data?.message || 'Unable to load communes.')
      } finally {
        if (!ignore) setLoadingCommunes(false)
      }
    })()
    return () => { ignore = true }
  }, [alertData.zoneType, alertData.zoneWilayaId])

  useEffect(() => {
    if (nameDirty || alertData.types.length === 0 || !zoneReady(alertData)) return
    const typeLabel = alertData.types.map((type) => ALERT_TYPES.find((item) => item.id === type)?.label || type).join(' + ')
    setAlertData((prev) => ({ ...prev, name: `${typeLabel} - ${zoneLabel}` }))
  }, [alertData.types, alertData.zoneType, alertData.zoneRadius, alertData.zoneWilayaId, alertData.zoneCommuneId, zoneLabel, nameDirty])

  useEffect(() => {
    if (isEditMode || alertData.zoneType !== 'radius' || radiusLocationAttempted) {
      return
    }

    if (!navigator?.geolocation) {
      setRadiusLocationAttempted(true)
      return
    }

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return
        }

        const lat = Number(position?.coords?.latitude)
        const lng = Number(position?.coords?.longitude)

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setAlertData((prev) => {
            const currentLat = Number(prev?.radiusCenter?.lat)
            const currentLng = Number(prev?.radiusCenter?.lng)
            const stillDefaultCenter = Math.abs(currentLat - ALGIERS.lat) < 0.0001
              && Math.abs(currentLng - ALGIERS.lng) < 0.0001

            if (!stillDefaultCenter) {
              return prev
            }

            return {
              ...prev,
              radiusCenter: { lat, lng },
            }
          })
        }

        setRadiusLocationAttempted(true)
      },
      () => {
        if (!cancelled) {
          setRadiusLocationAttempted(true)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    )

    return () => {
      cancelled = true
    }
  }, [alertData.zoneType, isEditMode, radiusLocationAttempted])

  function isStepValid(step) {
    if (step === 1) return alertData.types.length > 0
    if (step === 2) return zoneReady(alertData)
    if (step === 3) return alertData.severities.length > 0 && (alertData.timeRange !== 'custom' || (alertData.timeStart && alertData.timeEnd))
    if (step === 4) return alertData.frequency !== 'digest' || Boolean(alertData.digestInterval)
    if (step === 5) return alertData.name.trim().length > 0
    return false
  }

  function bounce() {
    setShakeNav(true)
    setTimeout(() => setShakeNav(false), 600)
  }

  function goToStep(step) {
    if (step <= currentStep) return setCurrentStep(step)
    for (let i = currentStep; i < step; i += 1) {
      if (!isStepValid(i)) return bounce()
    }
    setCurrentStep(step)
  }

  function toggleInList(key, value) {
    setAlertData((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }))
  }

  async function saveAlert() {
    if (!isStepValid(5)) return bounce()
    setIsSaving(true)
    setErrorMessage('')
    const payload = {
      name: alertData.name.trim(),
      incidentTypes: alertData.types,
      severityLevels: alertData.severities,
      timeRangeType: alertData.timeRange,
      customTimeStart: alertData.timeRange === 'custom' ? alertData.timeStart : null,
      customTimeEnd: alertData.timeRange === 'custom' ? alertData.timeEnd : null,
      weatherRelated: alertData.weatherRelated,
      aiConfidenceMin: alertData.types.includes('ai_prediction') ? alertData.aiConfidence : null,
      frequencyType: alertData.frequency,
      digestInterval: alertData.frequency === 'digest' ? alertData.digestInterval : null,
      muteDuplicates: alertData.muteDuplicates,
      deliveryApp: alertData.deliveryApp || (!alertData.deliveryEmail && !alertData.deliverySms),
      deliveryEmail: alertData.deliveryEmail,
      deliverySms: alertData.deliverySms,
      zone:
        alertData.zoneType === 'radius'
          ? { zoneType: 'radius', displayName: zoneLabel, radiusM: alertData.zoneRadius * 1000, center: alertData.radiusCenter }
          : alertData.zoneType === 'wilaya'
            ? { zoneType: 'wilaya', adminAreaId: Number(alertData.zoneWilayaId), wilayaId: Number(alertData.zoneWilayaId), displayName: selectedWilaya?.name || 'Wilaya' }
            : { zoneType: 'commune', adminAreaId: Number(alertData.zoneCommuneId), wilayaId: Number(alertData.zoneWilayaId), displayName: selectedCommune?.name || 'Commune' },
    }

    try {
      const saved = isEditMode ? await updateAlert(editAlert.id, payload) : await createAlert(payload)
      navigate('/alerts', { state: isEditMode ? { editedAlert: saved?.name || alertData.name } : { newAlert: saved?.name || alertData.name } })
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Unable to save this alert.')
      setIsSaving(false)
    }
  }

  return (
    <div className="create-alert-page">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab dash-tab-active" onClick={() => navigate('/alerts')}>Alerts</button>
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
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              {renderHeaderIcon('notification')}<span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn" aria-label="Messages">{renderHeaderIcon('message')}</button>
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

      <div className="create-grid">
        <aside className="create-left">
          <div className="stepper-header">
            <span className="stepper-icon">🔔</span>
            <h2>{isEditMode ? 'Edit alert' : 'Create an alert'}</h2>
          </div>
          <div className="stepper">
            {STEPS.map((label, index) => (
              <div key={label} className={`step ${currentStep === index + 1 ? 'active' : ''} ${currentStep > index + 1 ? 'completed' : ''} ${currentStep < index + 1 ? 'disabled' : ''}`} onClick={() => goToStep(index + 1)} style={{ cursor: currentStep > index + 1 ? 'pointer' : 'default' }}>
                <div className="step-indicator">{currentStep > index + 1 ? '✓' : index + 1}</div>
                <div className="step-content"><span className="step-label">{label}</span></div>
                {index < STEPS.length - 1 && <div className="step-line"></div>}
              </div>
            ))}
          </div>
          <div className="trust-notice">
            <span className="trust-icon">🛡️</span>
            <div className="trust-text">
              <strong>Secure alerts</strong>
              <p>Only incidents matching your selected filters and area trigger notifications.</p>
            </div>
          </div>
          <LeftQuickInfoLinks />
          <button className="cancel-btn" onClick={() => navigate('/alerts')}>✕ Cancel</button>
        </aside>

        <main className="create-center">
          {errorMessage && <div className="step-hint" style={{ color: '#b91c1c', marginBottom: 12 }}>{errorMessage}</div>}

          {currentStep === 1 && (
            <div className="step-panel create-alert-type-step">
              <div className="step-header"><h1>What type of alert do you want to create?</h1><p>Select the category that best matches your alert.</p></div>
              <div className="type-grid">
                {ALERT_TYPES.map((type) => (
                  <div key={type.id} className={`type-card ${alertData.types[0] === type.id ? 'selected' : ''}`} onClick={() => setAlertData((prev) => ({ ...prev, types: [type.id] }))}>
                    <div className="type-check">{alertData.types[0] === type.id ? '✓' : ''}</div>
                    <span className="type-icon">{renderTypeIcon(type.id)}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </div>
                ))}
              </div>
              {alertData.types.length === 0 && (
                <p className="step-hint">⚠️ Select an alert type to continue.</p>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header"><h1>Where should SIARA watch?</h1><p>Wilaya, commune, or a radius around a point.</p></div>
              <div className="zone-options">
                <div className={`zone-card ${alertData.zoneType === 'wilaya' ? 'selected' : ''}`} onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'wilaya', zoneCommuneId: '' }))}><span className="zone-icon">🏙️</span><div className="zone-info"><span className="zone-label">Wilaya</span></div></div>
                <div className={`zone-card ${alertData.zoneType === 'commune' ? 'selected' : ''}`} onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'commune' }))}><span className="zone-icon">📌</span><div className="zone-info"><span className="zone-label">Commune</span></div></div>
                <div className={`zone-card ${alertData.zoneType === 'radius' ? 'selected' : ''}`} onClick={() => setAlertData((prev) => ({ ...prev, zoneType: 'radius' }))}><span className="zone-icon">📍</span><div className="zone-info"><span className="zone-label">Radius</span></div></div>

                {alertData.zoneType === 'wilaya' && (
                  <div className="zone-config">
                    <label>Select a wilaya</label>
                    <select value={alertData.zoneWilayaId} onChange={(event) => setAlertData((prev) => ({ ...prev, zoneWilayaId: event.target.value }))}>
                      <option value="">{loadingWilayas ? 'Loading wilayas...' : 'Choose a wilaya'}</option>
                      {wilayas.map((wilaya) => <option key={wilaya.id} value={wilaya.id}>{wilaya.name}</option>)}
                    </select>
                  </div>
                )}

                {alertData.zoneType === 'commune' && (
                  <div className="zone-config">
                    <label>Wilaya</label>
                    <select value={alertData.zoneWilayaId} onChange={(event) => setAlertData((prev) => ({ ...prev, zoneWilayaId: event.target.value, zoneCommuneId: '' }))}>
                      <option value="">{loadingWilayas ? 'Loading wilayas...' : 'Choose a wilaya'}</option>
                      {wilayas.map((wilaya) => <option key={wilaya.id} value={wilaya.id}>{wilaya.name}</option>)}
                    </select>
                    <label style={{ marginTop: 12 }}>Commune</label>
                    <select value={alertData.zoneCommuneId} onChange={(event) => setAlertData((prev) => ({ ...prev, zoneCommuneId: event.target.value }))} disabled={!alertData.zoneWilayaId || loadingCommunes}>
                      <option value="">{!alertData.zoneWilayaId ? 'Choose a wilaya first' : loadingCommunes ? 'Loading communes...' : 'Choose a commune'}</option>
                      {communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name}</option>)}
                    </select>
                  </div>
                )}

                {alertData.zoneType === 'radius' && (
                  <div className="zone-config">
                    <label>Radius</label>
                    <div className="radius-slider">
                      <input type="range" min="1" max="50" value={alertData.zoneRadius} onChange={(event) => setAlertData((prev) => ({ ...prev, zoneRadius: Number(event.target.value) }))} />
                      <span className="radius-value">{alertData.zoneRadius} km</span>
                    </div>
                    <div className="map-preview" style={{ height: 260 }}>
                      {mapReady ? (
                        <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={alertData.radiusCenter} zoom={Math.max(7, 12 - Math.floor(alertData.zoneRadius / 6))} onClick={(event) => event?.latLng && setAlertData((prev) => ({ ...prev, radiusCenter: { lat: event.latLng.lat(), lng: event.latLng.lng() } }))}>
                          <Marker position={alertData.radiusCenter} />
                          <Circle center={alertData.radiusCenter} radius={alertData.zoneRadius * 1000} options={{ fillColor: '#0f766e', fillOpacity: 0.16, strokeColor: '#0f766e', strokeWeight: 2 }} />
                        </GoogleMap>
                      ) : (
                        <div className="mini-map-fallback">Loading map...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header"><h1>Conditions</h1><p>Choose severity and schedule.</p></div>
              <div className="severity-grid">
                {SEVERITY_OPTIONS.map((severity) => (
                  <div key={severity.id} className={`severity-card ${alertData.severities.includes(severity.id) ? 'selected' : ''}`} onClick={() => toggleInList('severities', severity.id)}>
                    <span className="sev-dot" style={{ background: severity.color }}></span>
                    <div className="sev-info">
                      <span className="sev-label">{severity.label}</span>
                      <span className="sev-desc">{severity.desc}</span>
                    </div>
                    <div className="sev-check">{alertData.severities.includes(severity.id) ? '✓' : ''}</div>
                  </div>
                ))}
              </div>
              {alertData.severities.length === 0 && (
                <p className="step-hint">⚠️ Select at least one severity level.</p>
              )}
              <div className="digest-config" style={{ marginTop: 20 }}>
                <label>Time range</label>
                <div className="digest-options">
                  {TIME_RANGE_OPTIONS.map((option) => (
                    <button key={option.id} className={`digest-btn ${alertData.timeRange === option.id ? 'selected' : ''}`} onClick={() => setAlertData((prev) => ({ ...prev, timeRange: option.id }))}>{option.label}</button>
                  ))}
                </div>
              </div>
              {alertData.timeRange === 'custom' && (
                <div className="custom-time">
                  <div className="time-input"><label>From</label><input type="time" value={alertData.timeStart} onChange={(event) => setAlertData((prev) => ({ ...prev, timeStart: event.target.value }))} /></div>
                  <div className="time-input"><label>To</label><input type="time" value={alertData.timeEnd} onChange={(event) => setAlertData((prev) => ({ ...prev, timeEnd: event.target.value }))} /></div>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header"><h1>Frequency</h1><p>Set how often SIARA should notify you.</p></div>
              <div className="frequency-card-grid">
                {FREQUENCY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`frequency-card ${alertData.frequency === option.id ? 'selected' : ''}`}
                    onClick={() => setAlertData((prev) => ({ ...prev, frequency: option.id }))}
                  >
                    <span className="frequency-card-icon">{option.icon}</span>
                    <span className="frequency-card-content">
                      <span className="frequency-card-title">{option.label}</span>
                      <span className="frequency-card-desc">{option.desc}</span>
                    </span>
                    <span className="frequency-card-check">{alertData.frequency === option.id ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
              {alertData.frequency === 'immediate' && (
                <div className="frequency-note">
                  <strong>High volume mode:</strong> Immediate alerts can be frequent during peak incidents.
                </div>
              )}
              {alertData.frequency === 'digest' && (
                <div className="digest-config">
                  <label>Digest interval</label>
                  <div className="digest-options digest-options-tight">
                    {DIGEST_INTERVALS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`digest-btn ${alertData.digestInterval === value ? 'selected' : ''}`}
                    <div className="frequency-autodelivery-note">
                      <span className="frequency-autodelivery-icon">🔔</span>
                      <p>Delivery channels are managed automatically by your account notification settings.</p>
                    </div>
                        onClick={() => setAlertData((prev) => ({ ...prev, digestInterval: value }))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
                    <div className="delivery-info">
                      <span className="delivery-label">{label}</span>
                      <span className="delivery-desc">{desc}</span>
                    </div>
                    <span className="delivery-check">{alertData[key] ? '✓' : ''}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header"><h1>Confirmation</h1><p>Review before saving.</p></div>
              <input className="alert-name-input" value={alertData.name} onChange={(event) => { setNameDirty(true); setAlertData((prev) => ({ ...prev, name: event.target.value })) }} placeholder="Alert name" />
              <div className="confirm-summary">
                <div className="summary-row"><span className="summary-label">Types</span><span className="summary-value">{alertData.types.map((type) => ALERT_TYPES.find((item) => item.id === type)?.label || type).join(', ')}</span></div>
                <div className="summary-row"><span className="summary-label">Zone</span><span className="summary-value">{zoneLabel}</span></div>
                <div className="summary-row"><span className="summary-label">Severity</span><span className="summary-value">{alertData.severities.join(', ')}</span></div>
                <div className="summary-row"><span className="summary-label">Frequency</span><span className="summary-value">{alertData.frequency}</span></div>
              </div>
            </div>
          )}

          <div className="step-nav">
            {currentStep > 1 && <button className="nav-btn back" onClick={() => setCurrentStep((prev) => prev - 1)}>← Back</button>}
            <div className="nav-spacer"></div>
            {currentStep < 5 ? (
              <button className={`nav-btn next ${shakeNav ? 'shake' : ''}`} onClick={() => (isStepValid(currentStep) ? setCurrentStep((prev) => prev + 1) : bounce())}>Continue →</button>
            ) : (
              <button className={`nav-btn create ${shakeNav ? 'shake' : ''}`} onClick={saveAlert} disabled={isSaving}>{isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Alert'}</button>
            )}
          </div>
        </main>

        <aside className="create-right">
          <div className="preview-header"><h3>Live Preview</h3></div>
          <div className="preview-section">
            <span className="preview-label">Alert</span>
            <div className="alert-preview-card">
              <div className="apc-header">
                <span className="apc-icons">
                  {alertData.types.length > 0 ? alertData.types.slice(0, 2).map((type) => (
                    <span key={type} className="apc-icon-chip">{renderTypeIcon(type)}</span>
                  )) : <span className="apc-icon-chip">{renderHeaderIcon('notification')}</span>}
                </span>
                <span className="apc-name">{alertData.name || 'New alert'}</span>
              </div>
              <div className="apc-body">
                <div className="apc-row"><span className="apc-label">Zone</span><span className="apc-value">{zoneLabel}</span></div>
                <div className="apc-row"><span className="apc-label">Severity</span><span className="apc-value">{formatSeverityLabelList(alertData.severities)}</span></div>
                <div className="apc-row"><span className="apc-label">Schedule</span><span className="apc-value">{formatTimeRangeLabel(alertData)}</span></div>
                <div className="apc-row"><span className="apc-label">Estimated volume</span><span className="apc-value">{alertData.types.length + alertData.severities.length} signals/week</span></div>
              </div>
            </div>
          </div>
          <div className="preview-section why-section">
            <span className="preview-label">Why you will be notified</span>
            <p className="why-text">{alertData.types.length > 0 && zoneReady(alertData) ? `SIARA will notify you when ${alertData.types.map((type) => ALERT_TYPES.find((item) => item.id === type)?.label.toLowerCase()).join(' or ')} incidents match your filters in ${zoneLabel}.` : 'Complete the steps to see a personalized explanation.'}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
