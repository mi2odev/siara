/**
 * @file CreateAlertPage.jsx
 * @description 5-step wizard for creating or editing geographic safety alerts.
 *
 * Layout: 3-column grid
 *   - Left:   vertical stepper navigation (clickable, with validation guards)
 *   - Center: step-specific form panels (Type → Zone → Conditions → Frequency → Confirmation)
 *   - Right:  live preview sidebar (alert card, notification sample, mini-map, explanation)
 *
 * Features:
 *   - Edit mode: pre-populates form from `location.state.editAlert` (passed via react-router)
 *   - Google Maps integration with Circle overlay for radius-based zones
 *   - localStorage persistence for created/updated alerts
 *   - Step validation with shake animation on blocked navigation
 *   - Auto-generated alert name suggestion based on selected type + zone
 */
import React, { useState, useEffect, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api'
import { AuthContext } from '../../contexts/AuthContext'
import '../../styles/CreateAlertPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

/* ═══ DEFAULT MAP CENTER ═══ */
const ALGIERS = { lat: 36.753, lng: 3.0588 }

export default function CreateAlertPage() {
  /* ═══ ROUTING & EDIT MODE ═══ */
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const editAlert = location.state?.editAlert || null   // Alert object passed when editing
  const isEditMode = !!editAlert                         // true → update flow; false → create flow
  const { isLoaded: mapReady } = useLoadScript({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '' })

  /* ═══ UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false) // Header profile dropdown visibility
  const [currentStep, setCurrentStep] = useState(1)       // Active wizard step (1-5)
  const [mapCenter, setMapCenter] = useState(ALGIERS)     // Center of the radius-zone map
  const [drawPin, setDrawPin] = useState(ALGIERS)         // Pin for custom-draw zone map
  const [isCreating, setIsCreating] = useState(false)     // Loading state during alert save
  const [shakeNav, setShakeNav] = useState(false)         // Triggers CSS shake animation on blocked nav

  /* ═══ EDIT-MODE DERIVATION HELPERS ═══ */
  // Reverse-engineer zone type from the stored area name string
  const deriveZoneType = (alert) => {
    if (!alert) return ''
    const areaName = alert.area?.name || ''
    if (areaName.startsWith('Rayon')) return 'location'
    if (areaName === 'Custom zone') return 'draw'
    // Check if area name matches a known road
    if (areaName.includes('Autoroute') || areaName.startsWith('RN') || areaName.includes('Rocade')) return 'road'
    return 'wilaya'
  }

  // Reverse-engineer time range preset from the stored timeWindow string
  const deriveTimeRange = (alert) => {
    if (!alert) return 'all'
    const tw = alert.timeWindow || '24/7'
    if (tw === '24/7') return 'all'
    if (tw === '06:00 - 22:00') return 'day'
    if (tw === '22:00 - 06:00') return 'night'
    return 'custom'
  }

  /* ═══ FORM STATE (lazy initializer) ═══ */
  // When editing, fields are pre-populated from editAlert; otherwise defaults are used
  const [alertData, setAlertData] = useState(() => {
    if (editAlert) {
      const zt = deriveZoneType(editAlert)
      const tr = deriveTimeRange(editAlert)
      const timeParts = (editAlert.timeWindow || '').split(' - ')
      return {
        name: editAlert.name || '',
        types: editAlert.incidentTypes || [],
        zoneType: zt,
        zoneRadius: zt === 'location' ? parseInt((editAlert.area?.name || '').match(/\d+/)?.[0] || '5') : 5,
        zoneWilaya: zt === 'wilaya' ? (editAlert.area?.wilaya || '') : '',
        zoneRoad: zt === 'road' ? (editAlert.area?.name || '') : '',
        zoneCustom: null,
        severities: editAlert.severity === 'high' ? ['high', 'medium'] : editAlert.severity === 'medium' ? ['medium'] : ['low'],
        timeRange: tr,
        timeStart: tr === 'custom' && timeParts[0] ? timeParts[0] : '00:00',
        timeEnd: tr === 'custom' && timeParts[1] ? timeParts[1] : '23:59',
        weatherRelated: false,
        aiConfidence: 70,
        frequency: 'immediate',
        digestInterval: 'daily',
        muteduplicates: true,
        deliveryApp: editAlert.notifications?.app ?? true,
        deliveryEmail: editAlert.notifications?.email ?? false,
        deliverySms: editAlert.notifications?.sms ?? false,
      }
    }
    return {
      name: '',
      types: [],
      zoneType: '',
      zoneRadius: 5,
      zoneWilaya: '',
      zoneRoad: '',
      zoneCustom: null,
      severities: ['high', 'medium'],
      timeRange: 'all',
      timeStart: '00:00',
      timeEnd: '23:59',
      weatherRelated: false,
      aiConfidence: 70,
      frequency: 'immediate',
      digestInterval: 'daily',
      muteduplicates: true,
      deliveryApp: true,
      deliveryEmail: false,
      deliverySms: false,
    }
  })

  /* ═══ WIZARD STEP DEFINITIONS ═══ */
  const steps = [
    { id: 1, label: "Alert Type", icon: '🎯' },
    { id: 2, label: 'Zone', icon: '📍' },
    { id: 3, label: 'Conditions', icon: '⚙️' },
    { id: 4, label: 'Frequency', icon: '🔔' },
    { id: 5, label: 'Confirmation', icon: '✅' }
  ]

  /* ═══ STATIC DATA — incident types, wilayas, roads ═══ */
  const alertTypes = [
    { id: 'accident', icon: '🚗', label: 'Accident', desc: 'Collisions, road accidents' },
    { id: 'roadworks', icon: '🚧', label: 'Roadworks', desc: 'Construction sites, lane closures' },
    { id: 'traffic', icon: '🚦', label: 'Heavy Traffic', desc: 'Traffic jams, slowdowns' },
    { id: 'danger', icon: '🔥', label: 'Danger', desc: 'Obstacles, hazardous conditions' },
    { id: 'ai', icon: '🤖', label: 'AI Prediction', desc: 'Alerts based on our predictive models' }
  ]

  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Boumerdès', 'Tizi Ouzou', 'Béjaïa']
  const roads = ['A1 - Autoroute Est-Ouest', 'RN1', 'RN5', 'RN11', 'RN12', 'Rocade Sud Alger']

  /* ═══ FORM HANDLERS ═══ */
  // Toggle an incident type in the multi-select array
  const toggleType = (typeId) => {
    setAlertData(prev => ({
      ...prev,
      types: prev.types.includes(typeId)
        ? prev.types.filter(t => t !== typeId)
        : [...prev.types, typeId]
    }))
  }

  // Toggle a severity level in the multi-select array
  const toggleSeverity = (sev) => {
    setAlertData(prev => ({
      ...prev,
      severities: prev.severities.includes(sev)
        ? prev.severities.filter(s => s !== sev)
        : [...prev.severities, sev]
    }))
  }

  /* ═══ STEP VALIDATION ═══ */
  // Returns true if the current step's required fields are filled
  const canProceed = () => {
    switch (currentStep) {
      case 1: return alertData.types.length > 0
      case 2: return alertData.zoneType !== ''
      case 3: return alertData.severities.length > 0
      case 4: return true
      case 5: return alertData.name.trim() !== ''
      default: return false
    }
  }

  // Advance to the next step, with shake animation on validation failure
  const nextStep = () => {
    if (currentStep >= 5) return
    if (!canProceed()) {
      setShakeNav(true)
      setTimeout(() => setShakeNav(false), 600)
      return
    }
    setCurrentStep(prev => prev + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // Check if a given step is reachable — all intermediate steps must be valid
  const canReachStep = (targetStep) => {
    if (targetStep <= currentStep) return true
    for (let s = currentStep; s < targetStep; s++) {
      switch (s) {
        case 1: if (alertData.types.length === 0) return false; break
        case 2: if (alertData.zoneType === '') return false; break
        case 3: if (alertData.severities.length === 0) return false; break
        case 4: break // always ok
        default: break
      }
    }
    return true
  }

  // Direct jump to a step (from clicking the stepper) with forward-validation
  const goToStep = (targetStep) => {
    if (targetStep === currentStep) return
    if (targetStep < currentStep) {
      setCurrentStep(targetStep)
      return
    }
    // Going forward: validate all intermediate steps
    if (canReachStep(targetStep)) {
      setCurrentStep(targetStep)
    } else {
      setShakeNav(true)
      setTimeout(() => setShakeNav(false), 600)
    }
  }

  /* ═══ CREATE / UPDATE ALERT ═══ */
  // Builds the alert payload, persists to localStorage, then navigates back to AlertsPage
  const createAlert = () => {
    setIsCreating(true)

    // Build alert object matching AlertsPage format
    const zoneNameMap = {
      location: `${alertData.zoneRadius} km radius`,
      wilaya: alertData.zoneWilaya || 'Province',
      road: alertData.zoneRoad || 'Road',
      draw: 'Custom zone'
    }
    const wilayaMap = {
      location: 'Alger',
      wilaya: alertData.zoneWilaya || 'Alger',
      road: 'Alger',
      draw: 'Alger'
    }
    const timeWindowMap = {
      all: '24/7',
      day: '06:00 - 22:00',
      night: '22:00 - 06:00',
      custom: `${alertData.timeStart} - ${alertData.timeEnd}`
    }
    const highestSeverity = alertData.severities.includes('high') ? 'high'
      : alertData.severities.includes('medium') ? 'medium' : 'low'

    const alertPayload = {
      id: isEditMode ? editAlert.id : Date.now(),
      name: alertData.name || 'New alert',
      status: isEditMode ? (editAlert.status || 'active') : 'active',
      severity: highestSeverity,
      area: {
        name: zoneNameMap[alertData.zoneType] || '—',
        wilaya: wilayaMap[alertData.zoneType] || 'Alger'
      },
      incidentTypes: alertData.types,
      timeWindow: timeWindowMap[alertData.timeRange] || '24/7',
      lastTriggered: isEditMode ? (editAlert.lastTriggered || 'Never') : 'Never',
      triggerCount: isEditMode ? (editAlert.triggerCount || 0) : 0,
      notifications: {
        app: alertData.deliveryApp,
        email: alertData.deliveryEmail,
        sms: alertData.deliverySms
      },
      recentTriggers: isEditMode ? (editAlert.recentTriggers || []) : [],
      createdAt: isEditMode ? (editAlert.createdAt || new Date().toISOString()) : new Date().toISOString()
    }

    // Persist to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('siara_alerts') || '[]')
      if (isEditMode) {
        const idx = existing.findIndex(a => a.id === editAlert.id)
        if (idx !== -1) {
          existing[idx] = alertPayload
        } else {
          existing.push(alertPayload)
        }
      } else {
        existing.push(alertPayload)
      }
      localStorage.setItem('siara_alerts', JSON.stringify(existing))
    } catch { /* ignore */ }

    setTimeout(() => {
      setIsCreating(false)
      navigate('/alerts', { state: isEditMode ? { editedAlert: alertData.name } : { newAlert: alertData.name } })
    }, 800)
  }

  /* ═══ AUTO-NAME SUGGESTION (create mode only) ═══ */
  // Generates a default alert name from selected types + zone when user hasn't typed one
  useEffect(() => {
    if (!isEditMode && alertData.types.length > 0 && alertData.zoneType && !alertData.name) {
      const typeLabels = alertData.types.map(t => alertTypes.find(at => at.id === t)?.label).join(' + ')
      const zoneName = alertData.zoneType === 'location' ? 'My location' :
                       alertData.zoneType === 'wilaya' ? alertData.zoneWilaya :
                       alertData.zoneType === 'road' ? alertData.zoneRoad : 'Custom zone'
      setAlertData(prev => ({ ...prev, name: `${typeLabels} - ${zoneName}` }))
    }
  }, [alertData.types, alertData.zoneType, alertData.zoneWilaya, alertData.zoneRoad])

  /* ═══ ESTIMATED NOTIFICATION FREQUENCY ═══ */
  // Rough heuristic: more types / lower severity / wider zone = more alerts
  const getEstimatedFrequency = () => {
    let base = alertData.types.length * 2
    if (alertData.severities.includes('low')) base += 3
    if (alertData.zoneType === 'wilaya') base += 2
    if (alertData.frequency === 'digest') base = Math.ceil(base / 3)
    return base < 3 ? '1-2 per week' : base < 7 ? '3-6 per week' : '1-2 per day'
  }

  /* ═══ RENDER ═══ */
  return (
    <div className="create-alert-page">
      {/* ═══ FLOATING HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Search for an incident, a road, a wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              🔔<span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <div className="create-grid">
        {/* ═══ LEFT COLUMN — VERTICAL STEPPER ═══ */}
        <aside className="create-left">
          <div className="stepper-header">
            <span className="stepper-icon">{isEditMode ? '✏️' : '➕'}</span>
            <h2>{isEditMode ? 'Edit Alert' : 'New Alert'}</h2>
          </div>
          <div className="stepper">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${currentStep < step.id ? 'upcoming' : ''}`}
                onClick={() => goToStep(step.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="step-indicator">
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                </div>
                {index < steps.length - 1 && <div className="step-line"></div>}
              </div>
            ))}
          </div>
          <button className="cancel-btn" onClick={() => navigate('/alerts')}>
            ✕ Cancel
          </button>
        </aside>

        {/* ═══ CENTER COLUMN — STEP FORM PANELS ═══ */}
        <main className="create-center">
          {/* STEP 1 — Alert Type Selection (multi-select cards) */}
          {currentStep === 1 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>What type of incident do you want to monitor?</h1>
                <p>Select one or more alert types.</p>
              </div>
              <div className="type-grid">
                {alertTypes.map(type => (
                  <div
                    key={type.id}
                    className={`type-card ${alertData.types.includes(type.id) ? 'selected' : ''}`}
                    onClick={() => toggleType(type.id)}
                  >
                    <div className="type-check">{alertData.types.includes(type.id) ? '✓' : ''}</div>
                    <span className="type-icon">{type.icon}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </div>
                ))}
              </div>
              {alertData.types.length === 0 && (
                <p className="step-hint">⚠️ Select at least one type to continue.</p>
              )}
            </div>
          )}

          {/* STEP 2 — Zone Selection (location/wilaya/road/custom draw) */}
          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Where do you want to be alerted?</h1>
                <p>Define the geographic monitoring zone.</p>
              </div>
              <div className="zone-options">
                <div
                  className={`zone-card ${alertData.zoneType === 'location' ? 'selected' : ''}`}
                  onClick={() => setAlertData(prev => ({ ...prev, zoneType: 'location' }))}
                >
                  <span className="zone-icon">📍</span>
                  <div className="zone-info">
                    <span className="zone-label">Around my location</span>
                    <span className="zone-desc">Alerts within a radius around you</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'location' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'location' && (
                  <div className="zone-config">
                    <label>Monitoring radius</label>
                    <div className="radius-slider">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={alertData.zoneRadius}
                        onChange={e => setAlertData(prev => ({ ...prev, zoneRadius: parseInt(e.target.value) }))}
                      />
                      <span className="radius-value">{alertData.zoneRadius} km</span>
                    </div>
                    {mapReady && (
                      <div className="zone-map-embed">
                        <GoogleMap
                          mapContainerClassName="zone-gmap"
                          center={mapCenter}
                          zoom={11 - Math.floor(alertData.zoneRadius / 10)}
                          options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }] }}
                          onClick={e => setMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                        >
                          <Marker position={mapCenter} />
                          <Circle center={mapCenter} radius={alertData.zoneRadius * 1000} options={{ fillColor: '#6366F1', fillOpacity: 0.12, strokeColor: '#6366F1', strokeOpacity: 0.6, strokeWeight: 2 }} />
                        </GoogleMap>
                        <p className="zone-map-hint">Click to move the center of the radius</p>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`zone-card ${alertData.zoneType === 'wilaya' ? 'selected' : ''}`}
                  onClick={() => setAlertData(prev => ({ ...prev, zoneType: 'wilaya' }))}
                >
                  <span className="zone-icon">🏙️</span>
                  <div className="zone-info">
                    <span className="zone-label">Province / Municipality</span>
                    <span className="zone-desc">Alerts in an administrative region</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'wilaya' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'wilaya' && (
                  <div className="zone-config">
                    <label>Select a province</label>
                    <select
                      value={alertData.zoneWilaya}
                      onChange={e => setAlertData(prev => ({ ...prev, zoneWilaya: e.target.value }))}
                    >
                      <option value="">Choose...</option>
                      {wilayas.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                )}

                <div
                  className={`zone-card ${alertData.zoneType === 'road' ? 'selected' : ''}`}
                  onClick={() => setAlertData(prev => ({ ...prev, zoneType: 'road' }))}
                >
                  <span className="zone-icon">🛣️</span>
                  <div className="zone-info">
                    <span className="zone-label">Specific Road</span>
                    <span className="zone-desc">Alerts on a specific road axis</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'road' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'road' && (
                  <div className="zone-config">
                    <label>Select a road</label>
                    <select
                      value={alertData.zoneRoad}
                      onChange={e => setAlertData(prev => ({ ...prev, zoneRoad: e.target.value }))}
                    >
                      <option value="">Choose...</option>
                      {roads.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}

                <div
                  className={`zone-card ${alertData.zoneType === 'draw' ? 'selected' : ''}`}
                  onClick={() => setAlertData(prev => ({ ...prev, zoneType: 'draw' }))}
                >
                  <span className="zone-icon">✏️</span>
                  <div className="zone-info">
                    <span className="zone-label">Draw on the map</span>
                    <span className="zone-desc">Define a custom zone</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'draw' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'draw' && (
                  <div className="zone-config map-config">
                    {mapReady ? (
                      <div className="zone-map-embed">
                        <GoogleMap
                          mapContainerClassName="zone-gmap zone-gmap-lg"
                          center={drawPin}
                          zoom={13}
                          options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }] }}
                          onClick={e => setDrawPin({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
                        >
                          <Marker position={drawPin} />
                        </GoogleMap>
                        <p className="zone-map-hint">Click on the map to place your custom zone</p>
                      </div>
                    ) : (
                      <div className="map-placeholder">
                        <span className="map-icon">🗺️</span>
                        <p>Loading map…</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — Conditions (severity, time range, advanced options) */}
          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Refine your alert conditions</h1>
                <p>Customize when you want to be notified.</p>
              </div>
              <div className="conditions-sections">
                <div className="condition-section">
                  <h3>Severity Level</h3>
                  <p className="condition-desc">Which severity levels should trigger an alert?</p>
                  <div className="severity-options">
                    {[
                      { id: 'high', label: 'High', color: '#DC2626', desc: 'Emergencies, serious accidents' },
                      { id: 'medium', label: 'Medium', color: '#F59E0B', desc: 'Moderate incidents' },
                      { id: 'low', label: 'Low', color: '#10B981', desc: 'Minor incidents, info' }
                    ].map(sev => (
                      <div
                        key={sev.id}
                        className={`severity-card ${alertData.severities.includes(sev.id) ? 'selected' : ''}`}
                        onClick={() => toggleSeverity(sev.id)}
                      >
                        <div className="sev-dot" style={{ background: sev.color }}></div>
                        <div className="sev-info">
                          <span className="sev-label">{sev.label}</span>
                          <span className="sev-desc">{sev.desc}</span>
                        </div>
                        <div className="sev-check">{alertData.severities.includes(sev.id) ? '✓' : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="condition-section">
                  <h3>Time Range</h3>
                  <p className="condition-desc">When do you want to receive alerts?</p>
                  <div className="time-options">
                    {[
                      { id: 'all', label: '24/7', desc: 'Always' },
                      { id: 'day', label: 'Daytime', desc: '06:00 - 22:00' },
                      { id: 'night', label: 'Night', desc: '22:00 - 06:00' },
                      { id: 'custom', label: 'Custom', desc: 'Define...' }
                    ].map(time => (
                      <button
                        key={time.id}
                        className={`time-btn ${alertData.timeRange === time.id ? 'selected' : ''}`}
                        onClick={() => setAlertData(prev => ({ ...prev, timeRange: time.id }))}
                      >
                        <span className="time-label">{time.label}</span>
                        <span className="time-desc">{time.desc}</span>
                      </button>
                    ))}
                  </div>
                  {alertData.timeRange === 'custom' && (
                    <div className="custom-time">
                      <div className="time-input">
                        <label>From</label>
                        <input
                          type="time"
                          value={alertData.timeStart}
                          onChange={e => setAlertData(prev => ({ ...prev, timeStart: e.target.value }))}
                        />
                      </div>
                      <div className="time-input">
                        <label>To</label>
                        <input
                          type="time"
                          value={alertData.timeEnd}
                          onChange={e => setAlertData(prev => ({ ...prev, timeEnd: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <details className="advanced-section">
                  <summary>Advanced Options</summary>
                  <div className="advanced-content">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertData.weatherRelated}
                        onChange={e => setAlertData(prev => ({ ...prev, weatherRelated: e.target.checked }))}
                      />
                      <span>Include weather-related alerts</span>
                    </label>
                    {alertData.types.includes('ai') && (
                      <div className="ai-threshold">
                        <label>Minimum AI confidence threshold</label>
                        <div className="threshold-slider">
                          <input
                            type="range"
                            min="50"
                            max="95"
                            value={alertData.aiConfidence}
                            onChange={e => setAlertData(prev => ({ ...prev, aiConfidence: parseInt(e.target.value) }))}
                          />
                          <span className="threshold-value">{alertData.aiConfidence}%</span>
                        </div>
                        <p className="threshold-hint">The higher the threshold, fewer alerts but more reliable.</p>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* STEP 4 — Notification Frequency & Delivery Channels */}
          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>How do you want to be notified?</h1>
                <p>Control the frequency and notification channels.</p>
              </div>
              <div className="frequency-sections">
                <div className="freq-section">
                  <h3>Notification Frequency</h3>
                  <div className="freq-options">
                    <div
                      className={`freq-card ${alertData.frequency === 'immediate' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'immediate' }))}
                    >
                      <span className="freq-icon">⚡</span>
                      <div className="freq-info">
                        <span className="freq-label">Immediate</span>
                        <span className="freq-desc">Notification as soon as an incident matches</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'immediate' ? '✓' : ''}</div>
                    </div>
                    <div
                      className={`freq-card ${alertData.frequency === 'digest' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'digest' }))}
                    >
                      <span className="freq-icon">📋</span>
                      <div className="freq-info">
                        <span className="freq-label">Digest</span>
                        <span className="freq-desc">Group alerts into a digest</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'digest' ? '✓' : ''}</div>
                    </div>
                    <div
                      className={`freq-card ${alertData.frequency === 'first' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'first' }))}
                    >
                      <span className="freq-icon">1️⃣</span>
                      <div className="freq-info">
                        <span className="freq-label">First Occurrence</span>
                        <span className="freq-desc">One notification per new incident</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'first' ? '✓' : ''}</div>
                    </div>
                  </div>

                  {alertData.frequency === 'digest' && (
                    <div className="digest-config">
                      <label>Digest interval</label>
                      <div className="digest-options">
                        {['hourly', 'daily', 'weekly'].map(int => (
                          <button
                            key={int}
                            className={`digest-btn ${alertData.digestInterval === int ? 'selected' : ''}`}
                            onClick={() => setAlertData(prev => ({ ...prev, digestInterval: int }))}
                          >
                            {int === 'hourly' ? 'Hourly' : int === 'daily' ? 'Daily' : 'Weekly'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {alertData.frequency === 'immediate' && (
                    <div className="immediate-warning">
                      <span className="warning-icon">💡</span>
                      <p>Immediate alerts may generate more notifications. Use severity filters to reduce noise.</p>
                    </div>
                  )}

                  <label className="checkbox-label mute-option">
                    <input
                      type="checkbox"
                      checked={alertData.muteduplicates}
                      onChange={e => setAlertData(prev => ({ ...prev, muteduplicates: e.target.checked }))}
                    />
                    <span>Ignore duplicates (similar incidents within a short time)</span>
                  </label>
                </div>

                <div className="freq-section">
                  <h3>Delivery Channels</h3>
                  <div className="delivery-options">
                    <label className={`delivery-card ${alertData.deliveryApp ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={alertData.deliveryApp}
                        onChange={e => setAlertData(prev => ({ ...prev, deliveryApp: e.target.checked }))}
                      />
                      <span className="delivery-icon">📱</span>
                      <div className="delivery-info">
                        <span className="delivery-label">Application</span>
                        <span className="delivery-desc">Notifications in SIARA</span>
                      </div>
                    </label>
                    <label className={`delivery-card ${alertData.deliveryEmail ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={alertData.deliveryEmail}
                        onChange={e => setAlertData(prev => ({ ...prev, deliveryEmail: e.target.checked }))}
                      />
                      <span className="delivery-icon">📧</span>
                      <div className="delivery-info">
                        <span className="delivery-label">Email</span>
                        <span className="delivery-desc">Receive by email</span>
                      </div>
                      <span className="coming-soon">Coming Soon</span>
                    </label>
                    <label className={`delivery-card ${alertData.deliverySms ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={alertData.deliverySms}
                        onChange={e => setAlertData(prev => ({ ...prev, deliverySms: e.target.checked }))}
                      />
                      <span className="delivery-icon">💬</span>
                      <div className="delivery-info">
                        <span className="delivery-label">SMS</span>
                        <span className="delivery-desc">Critical alerts by SMS</span>
                      </div>
                      <span className="coming-soon">Coming Soon</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — Confirmation & Summary */}
          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Review and create your alert</h1>
                <p>Check the details before confirming.</p>
              </div>
              <div className="confirmation-content">
                <div className="confirm-section">
                  <label>Alert Name</label>
                  <input
                    type="text"
                    className="alert-name-input"
                    value={alertData.name}
                    onChange={e => setAlertData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Accidents A1 Highway"
                  />
                </div>

                <div className="confirm-summary">
                  <div className="summary-row">
                    <span className="summary-label">Incident Types</span>
                    <span className="summary-value">
                      {alertData.types.map(t => alertTypes.find(at => at.id === t)?.icon).join(' ')}
                      {' '}
                      {alertData.types.map(t => alertTypes.find(at => at.id === t)?.label).join(', ')}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Zone</span>
                    <span className="summary-value">
                      {alertData.zoneType === 'location' && `📍 ${alertData.zoneRadius} km radius`}
                      {alertData.zoneType === 'wilaya' && `🏙️ ${alertData.zoneWilaya}`}
                      {alertData.zoneType === 'road' && `🛣️ ${alertData.zoneRoad}`}
                      {alertData.zoneType === 'draw' && `✏️ Custom zone`}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Severity</span>
                    <span className="summary-value">
                      {alertData.severities.map(s => s === 'high' ? '🔴 High' : s === 'medium' ? '🟡 Medium' : '🟢 Low').join(', ')}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Schedule</span>
                    <span className="summary-value">
                      {alertData.timeRange === 'all' ? '24/7' : alertData.timeRange === 'day' ? 'Daytime' : alertData.timeRange === 'night' ? 'Night' : `${alertData.timeStart} - ${alertData.timeEnd}`}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Frequency</span>
                    <span className="summary-value">
                      {alertData.frequency === 'immediate' ? '⚡ Immediate' : alertData.frequency === 'digest' ? `📋 ${alertData.digestInterval === 'hourly' ? 'Hourly' : alertData.digestInterval === 'daily' ? 'Daily' : 'Weekly'} digest` : '1️⃣ First occurrence'}
                    </span>
                  </div>
                  <div className="summary-row highlight">
                    <span className="summary-label">Estimated Frequency</span>
                    <span className="summary-value">{getEstimatedFrequency()}</span>
                  </div>
                </div>

                {alertData.name.trim() === '' && (
                  <p className="step-hint">⚠️ Give your alert a name to continue.</p>
                )}
              </div>
            </div>
          )}

          {/* ═══ BOTTOM NAVIGATION (Back / Continue / Create) ═══ */}
          <div className="step-nav">
            {currentStep > 1 && (
              <button className="nav-btn secondary" onClick={prevStep}>
                ← Back
              </button>
            )}
            <div className="nav-spacer"></div>
            {currentStep < 5 ? (
              <button className={`nav-btn secondary ${!canProceed() ? 'btn-disabled' : ''} ${shakeNav ? 'shake' : ''}`} onClick={nextStep}>
                Continue →
              </button>
            ) : (
              <button className={`nav-btn create ${shakeNav ? 'shake' : ''}`} onClick={createAlert} disabled={!canProceed() || isCreating}>
                {isCreating ? '⏳ Saving...' : isEditMode ? '✓ Save Changes' : '✓ Create Alert'}
              </button>
            )}
          </div>
        </main>

        {/* ═══ RIGHT COLUMN — LIVE PREVIEW SIDEBAR ═══ */}
        <aside className="create-right">
          <div className="preview-header">
            <span className="preview-icon">👁️</span>
            <h3>Live Preview</h3>
          </div>

          {/* Alert Card Preview */}
          <div className="preview-section">
            <span className="preview-label">Alert Card</span>
            <div className="alert-preview-card">
              <div className="apc-header">
                <span className="apc-icons">
                  {alertData.types.length > 0 
                    ? alertData.types.map(t => alertTypes.find(at => at.id === t)?.icon).join(' ')
                    : '🔔'}
                </span>
                <span className="apc-name">{alertData.name || 'New alert'}</span>
                <span className="apc-status">● Active</span>
              </div>
              <div className="apc-body">
                <div className="apc-row">
                  <span className="apc-label">Zone</span>
                  <span className="apc-value">
                    {alertData.zoneType === 'location' ? `${alertData.zoneRadius} km` :
                     alertData.zoneType === 'wilaya' ? alertData.zoneWilaya || 'Province' :
                     alertData.zoneType === 'road' ? alertData.zoneRoad || 'Road' :
                     alertData.zoneType === 'draw' ? 'Custom' : '—'}
                  </span>
                </div>
                <div className="apc-row">
                  <span className="apc-label">Schedule</span>
                  <span className="apc-value">
                    {alertData.timeRange === 'all' ? '24/7' : alertData.timeRange === 'day' ? 'Day' : alertData.timeRange === 'night' ? 'Night' : 'Custom'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preview */}
          <div className="preview-section">
            <span className="preview-label">Notification Example</span>
            <div className="notif-preview">
              <div className="np-icon" style={{ background: alertData.severities.includes('high') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
                {alertData.types[0] ? alertTypes.find(at => at.id === alertData.types[0])?.icon : '🔔'}
              </div>
              <div className="np-content">
                <span className="np-title">Alert: {alertData.name || 'New alert'}</span>
                <span className="np-context">
                  {alertData.types.includes('accident') ? 'Accident detected' :
                   alertData.types.includes('traffic') ? 'Heavy traffic reported' :
                   alertData.types.includes('roadworks') ? 'Roadworks in progress' :
                   alertData.types.includes('danger') ? 'Danger reported' :
                   alertData.types.includes('ai') ? 'AI Prediction' : 'Incident detected'} in your area
                </span>
              </div>
              <span className="np-time">Just now</span>
            </div>
          </div>

          {/* Mini Map Preview */}
          <div className="preview-section">
            <span className="preview-label">Monitored Area</span>
            <div className="map-preview">
              <div className="map-bg">🗺️</div>
              {alertData.zoneType === 'location' && (
                <div className="zone-circle" style={{ width: `${Math.min(alertData.zoneRadius * 3, 80)}%`, height: `${Math.min(alertData.zoneRadius * 3, 80)}%` }}>
                  <span className="zone-pin">📍</span>
                </div>
              )}
              {alertData.zoneType === 'wilaya' && alertData.zoneWilaya && (
                <div className="zone-region">
                  <span>{alertData.zoneWilaya}</span>
                </div>
              )}
              {alertData.zoneType === 'road' && alertData.zoneRoad && (
                <div className="zone-road-line"></div>
              )}
            </div>
          </div>

          {/* Why Explanation */}
          <div className="preview-section why-section">
            <span className="preview-label">Why you will be notified</span>
            <p className="why-text">
              {alertData.types.length > 0 && alertData.zoneType ? (
                <>
                  You will receive a notification when an incident of type{' '}
                  <strong>{alertData.types.map(t => alertTypes.find(at => at.id === t)?.label.toLowerCase()).join(' or ')}</strong>
                  {' '}is detected{' '}
                  {alertData.zoneType === 'location' && <><strong>within a {alertData.zoneRadius} km radius</strong> around you</>}
                  {alertData.zoneType === 'wilaya' && alertData.zoneWilaya && <>in <strong>{alertData.zoneWilaya}</strong></>}
                  {alertData.zoneType === 'road' && alertData.zoneRoad && <>on the <strong>{alertData.zoneRoad}</strong></>}
                  {alertData.zoneType === 'draw' && <>in your <strong>custom zone</strong></>}
                  {alertData.severities.length < 3 && <>, with a severity level of <strong>{alertData.severities.map(s => s === 'high' ? 'high' : s === 'medium' ? 'medium' : 'low').join(' or ')}</strong></>}
                  .
                </>
              ) : (
                'Complete the steps to see a personalized explanation.'
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
