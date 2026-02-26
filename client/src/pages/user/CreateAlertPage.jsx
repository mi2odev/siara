import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api'
import '../../styles/CreateAlertPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const ALGIERS = { lat: 36.753, lng: 3.0588 }

export default function CreateAlertPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const editAlert = location.state?.editAlert || null
  const isEditMode = !!editAlert
  const { isLoaded: mapReady } = useLoadScript({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '' })
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [mapCenter, setMapCenter] = useState(ALGIERS)
  const [drawPin, setDrawPin] = useState(ALGIERS)
  const [isCreating, setIsCreating] = useState(false)
  const [shakeNav, setShakeNav] = useState(false)

  // Derive zone type from stored alert data
  const deriveZoneType = (alert) => {
    if (!alert) return ''
    const areaName = alert.area?.name || ''
    if (areaName.startsWith('Rayon')) return 'location'
    if (areaName === 'Zone personnalisée') return 'draw'
    // Check if area name matches a known road
    if (areaName.includes('Autoroute') || areaName.startsWith('RN') || areaName.includes('Rocade')) return 'road'
    return 'wilaya'
  }

  const deriveTimeRange = (alert) => {
    if (!alert) return 'all'
    const tw = alert.timeWindow || '24/7'
    if (tw === '24/7') return 'all'
    if (tw === '06:00 - 22:00') return 'day'
    if (tw === '22:00 - 06:00') return 'night'
    return 'custom'
  }

  // Form state
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

  const steps = [
    { id: 1, label: "Type d'alerte", icon: '🎯' },
    { id: 2, label: 'Zone', icon: '📍' },
    { id: 3, label: 'Conditions', icon: '⚙️' },
    { id: 4, label: 'Fréquence', icon: '🔔' },
    { id: 5, label: 'Confirmation', icon: '✅' }
  ]

  const alertTypes = [
    { id: 'accident', icon: '🚗', label: 'Accident', desc: 'Collisions, accidents de la route' },
    { id: 'roadworks', icon: '🚧', label: 'Travaux', desc: 'Chantiers, fermetures de voies' },
    { id: 'traffic', icon: '🚦', label: 'Trafic dense', desc: 'Embouteillages, ralentissements' },
    { id: 'danger', icon: '🔥', label: 'Danger', desc: 'Obstacles, conditions dangereuses' },
    { id: 'ai', icon: '🤖', label: 'Prédiction IA', desc: 'Alertes basées sur nos modèles prédictifs' }
  ]

  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Boumerdès', 'Tizi Ouzou', 'Béjaïa']
  const roads = ['A1 - Autoroute Est-Ouest', 'RN1', 'RN5', 'RN11', 'RN12', 'Rocade Sud Alger']

  // Handlers
  const toggleType = (typeId) => {
    setAlertData(prev => ({
      ...prev,
      types: prev.types.includes(typeId)
        ? prev.types.filter(t => t !== typeId)
        : [...prev.types, typeId]
    }))
  }

  const toggleSeverity = (sev) => {
    setAlertData(prev => ({
      ...prev,
      severities: prev.severities.includes(sev)
        ? prev.severities.filter(s => s !== sev)
        : [...prev.severities, sev]
    }))
  }

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

  // Check if a given step is reachable (all previous steps valid)
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

  const createAlert = () => {
    setIsCreating(true)

    // Build alert object matching AlertsPage format
    const zoneNameMap = {
      location: `Rayon ${alertData.zoneRadius} km`,
      wilaya: alertData.zoneWilaya || 'Wilaya',
      road: alertData.zoneRoad || 'Route',
      draw: 'Zone personnalisée'
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
      name: alertData.name || 'Nouvelle alerte',
      status: isEditMode ? (editAlert.status || 'active') : 'active',
      severity: highestSeverity,
      area: {
        name: zoneNameMap[alertData.zoneType] || '—',
        wilaya: wilayaMap[alertData.zoneType] || 'Alger'
      },
      incidentTypes: alertData.types,
      timeWindow: timeWindowMap[alertData.timeRange] || '24/7',
      lastTriggered: isEditMode ? (editAlert.lastTriggered || 'Jamais') : 'Jamais',
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

  // Generate alert name suggestion (only in create mode)
  useEffect(() => {
    if (!isEditMode && alertData.types.length > 0 && alertData.zoneType && !alertData.name) {
      const typeLabels = alertData.types.map(t => alertTypes.find(at => at.id === t)?.label).join(' + ')
      const zoneName = alertData.zoneType === 'location' ? 'Ma position' :
                       alertData.zoneType === 'wilaya' ? alertData.zoneWilaya :
                       alertData.zoneType === 'road' ? alertData.zoneRoad : 'Zone personnalisée'
      setAlertData(prev => ({ ...prev, name: `${typeLabels} - ${zoneName}` }))
    }
  }, [alertData.types, alertData.zoneType, alertData.zoneWilaya, alertData.zoneRoad])

  // Estimate frequency
  const getEstimatedFrequency = () => {
    let base = alertData.types.length * 2
    if (alertData.severities.includes('low')) base += 3
    if (alertData.zoneType === 'wilaya') base += 2
    if (alertData.frequency === 'digest') base = Math.ceil(base / 3)
    return base < 3 ? '1-2 par semaine' : base < 7 ? '3-6 par semaine' : '1-2 par jour'
  }

  return (
    <div className="create-alert-page">
      {/* HEADER */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher..." aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              🔔<span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 Mon profil</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="create-grid">
        {/* LEFT - STEPPER */}
        <aside className="create-left">
          <div className="stepper-header">
            <span className="stepper-icon">{isEditMode ? '✏️' : '➕'}</span>
            <h2>{isEditMode ? 'Modifier l\'alerte' : 'Nouvelle alerte'}</h2>
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
            ✕ Annuler
          </button>
        </aside>

        {/* CENTER - FORM */}
        <main className="create-center">
          {/* STEP 1 - Alert Type */}
          {currentStep === 1 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Quel type d'incident souhaitez-vous surveiller ?</h1>
                <p>Sélectionnez un ou plusieurs types d'alertes.</p>
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
                <p className="step-hint">⚠️ Sélectionnez au moins un type pour continuer.</p>
              )}
            </div>
          )}

          {/* STEP 2 - Zone */}
          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Où souhaitez-vous être alerté ?</h1>
                <p>Définissez la zone géographique de surveillance.</p>
              </div>
              <div className="zone-options">
                <div
                  className={`zone-card ${alertData.zoneType === 'location' ? 'selected' : ''}`}
                  onClick={() => setAlertData(prev => ({ ...prev, zoneType: 'location' }))}
                >
                  <span className="zone-icon">📍</span>
                  <div className="zone-info">
                    <span className="zone-label">Autour de ma position</span>
                    <span className="zone-desc">Alertes dans un rayon autour de vous</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'location' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'location' && (
                  <div className="zone-config">
                    <label>Rayon de surveillance</label>
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
                        <p className="zone-map-hint">Cliquez pour déplacer le centre du rayon</p>
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
                    <span className="zone-label">Wilaya / Commune</span>
                    <span className="zone-desc">Alertes dans une région administrative</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'wilaya' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'wilaya' && (
                  <div className="zone-config">
                    <label>Sélectionnez une wilaya</label>
                    <select
                      value={alertData.zoneWilaya}
                      onChange={e => setAlertData(prev => ({ ...prev, zoneWilaya: e.target.value }))}
                    >
                      <option value="">Choisir...</option>
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
                    <span className="zone-label">Route spécifique</span>
                    <span className="zone-desc">Alertes sur un axe routier précis</span>
                  </div>
                  <div className="zone-check">{alertData.zoneType === 'road' ? '✓' : ''}</div>
                </div>

                {alertData.zoneType === 'road' && (
                  <div className="zone-config">
                    <label>Sélectionnez une route</label>
                    <select
                      value={alertData.zoneRoad}
                      onChange={e => setAlertData(prev => ({ ...prev, zoneRoad: e.target.value }))}
                    >
                      <option value="">Choisir...</option>
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
                    <span className="zone-label">Dessiner sur la carte</span>
                    <span className="zone-desc">Définir une zone personnalisée</span>
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
                        <p className="zone-map-hint">Cliquez sur la carte pour placer votre zone personnalisée</p>
                      </div>
                    ) : (
                      <div className="map-placeholder">
                        <span className="map-icon">🗺️</span>
                        <p>Chargement de la carte…</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 - Conditions */}
          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Affinez vos conditions d'alerte</h1>
                <p>Personnalisez quand vous souhaitez être notifié.</p>
              </div>
              <div className="conditions-sections">
                <div className="condition-section">
                  <h3>Niveau de gravité</h3>
                  <p className="condition-desc">Quels niveaux de gravité doivent déclencher une alerte ?</p>
                  <div className="severity-options">
                    {[
                      { id: 'high', label: 'Haute', color: '#DC2626', desc: 'Urgences, accidents graves' },
                      { id: 'medium', label: 'Moyenne', color: '#F59E0B', desc: 'Incidents modérés' },
                      { id: 'low', label: 'Basse', color: '#10B981', desc: 'Incidents mineurs, infos' }
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
                  <h3>Plage horaire</h3>
                  <p className="condition-desc">Quand souhaitez-vous recevoir des alertes ?</p>
                  <div className="time-options">
                    {[
                      { id: 'all', label: '24/7', desc: 'Toujours' },
                      { id: 'day', label: 'Journée', desc: '06:00 - 22:00' },
                      { id: 'night', label: 'Nuit', desc: '22:00 - 06:00' },
                      { id: 'custom', label: 'Personnalisé', desc: 'Définir...' }
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
                        <label>De</label>
                        <input
                          type="time"
                          value={alertData.timeStart}
                          onChange={e => setAlertData(prev => ({ ...prev, timeStart: e.target.value }))}
                        />
                      </div>
                      <div className="time-input">
                        <label>À</label>
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
                  <summary>Options avancées</summary>
                  <div className="advanced-content">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertData.weatherRelated}
                        onChange={e => setAlertData(prev => ({ ...prev, weatherRelated: e.target.checked }))}
                      />
                      <span>Inclure les alertes liées à la météo</span>
                    </label>
                    {alertData.types.includes('ai') && (
                      <div className="ai-threshold">
                        <label>Seuil de confiance IA minimum</label>
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
                        <p className="threshold-hint">Plus le seuil est élevé, moins d'alertes mais plus fiables.</p>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* STEP 4 - Frequency */}
          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Comment souhaitez-vous être notifié ?</h1>
                <p>Contrôlez la fréquence et les canaux de notification.</p>
              </div>
              <div className="frequency-sections">
                <div className="freq-section">
                  <h3>Fréquence des notifications</h3>
                  <div className="freq-options">
                    <div
                      className={`freq-card ${alertData.frequency === 'immediate' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'immediate' }))}
                    >
                      <span className="freq-icon">⚡</span>
                      <div className="freq-info">
                        <span className="freq-label">Immédiat</span>
                        <span className="freq-desc">Notification dès qu'un incident correspond</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'immediate' ? '✓' : ''}</div>
                    </div>
                    <div
                      className={`freq-card ${alertData.frequency === 'digest' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'digest' }))}
                    >
                      <span className="freq-icon">📋</span>
                      <div className="freq-info">
                        <span className="freq-label">Résumé</span>
                        <span className="freq-desc">Regrouper les alertes en un digest</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'digest' ? '✓' : ''}</div>
                    </div>
                    <div
                      className={`freq-card ${alertData.frequency === 'first' ? 'selected' : ''}`}
                      onClick={() => setAlertData(prev => ({ ...prev, frequency: 'first' }))}
                    >
                      <span className="freq-icon">1️⃣</span>
                      <div className="freq-info">
                        <span className="freq-label">Première occurrence</span>
                        <span className="freq-desc">Une seule notification par nouvel incident</span>
                      </div>
                      <div className="freq-check">{alertData.frequency === 'first' ? '✓' : ''}</div>
                    </div>
                  </div>

                  {alertData.frequency === 'digest' && (
                    <div className="digest-config">
                      <label>Intervalle du résumé</label>
                      <div className="digest-options">
                        {['hourly', 'daily', 'weekly'].map(int => (
                          <button
                            key={int}
                            className={`digest-btn ${alertData.digestInterval === int ? 'selected' : ''}`}
                            onClick={() => setAlertData(prev => ({ ...prev, digestInterval: int }))}
                          >
                            {int === 'hourly' ? 'Horaire' : int === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {alertData.frequency === 'immediate' && (
                    <div className="immediate-warning">
                      <span className="warning-icon">💡</span>
                      <p>Les alertes immédiates peuvent générer plus de notifications. Utilisez les filtres de gravité pour réduire le bruit.</p>
                    </div>
                  )}

                  <label className="checkbox-label mute-option">
                    <input
                      type="checkbox"
                      checked={alertData.muteduplicates}
                      onChange={e => setAlertData(prev => ({ ...prev, muteduplicates: e.target.checked }))}
                    />
                    <span>Ignorer les doublons (incidents similaires dans un court délai)</span>
                  </label>
                </div>

                <div className="freq-section">
                  <h3>Canaux de livraison</h3>
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
                        <span className="delivery-desc">Notifications dans SIARA</span>
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
                        <span className="delivery-desc">Recevoir par email</span>
                      </div>
                      <span className="coming-soon">Bientôt</span>
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
                        <span className="delivery-desc">Alertes critiques par SMS</span>
                      </div>
                      <span className="coming-soon">Bientôt</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 - Confirmation */}
          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Vérifiez et créez votre alerte</h1>
                <p>Revoyez les détails avant de confirmer.</p>
              </div>
              <div className="confirmation-content">
                <div className="confirm-section">
                  <label>Nom de l'alerte</label>
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
                    <span className="summary-label">Types d'incidents</span>
                    <span className="summary-value">
                      {alertData.types.map(t => alertTypes.find(at => at.id === t)?.icon).join(' ')}
                      {' '}
                      {alertData.types.map(t => alertTypes.find(at => at.id === t)?.label).join(', ')}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Zone</span>
                    <span className="summary-value">
                      {alertData.zoneType === 'location' && `📍 Rayon de ${alertData.zoneRadius} km`}
                      {alertData.zoneType === 'wilaya' && `🏙️ ${alertData.zoneWilaya}`}
                      {alertData.zoneType === 'road' && `🛣️ ${alertData.zoneRoad}`}
                      {alertData.zoneType === 'draw' && `✏️ Zone personnalisée`}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Gravité</span>
                    <span className="summary-value">
                      {alertData.severities.map(s => s === 'high' ? '🔴 Haute' : s === 'medium' ? '🟡 Moyenne' : '🟢 Basse').join(', ')}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Horaires</span>
                    <span className="summary-value">
                      {alertData.timeRange === 'all' ? '24/7' : alertData.timeRange === 'day' ? 'Journée' : alertData.timeRange === 'night' ? 'Nuit' : `${alertData.timeStart} - ${alertData.timeEnd}`}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Fréquence</span>
                    <span className="summary-value">
                      {alertData.frequency === 'immediate' ? '⚡ Immédiat' : alertData.frequency === 'digest' ? `📋 Résumé ${alertData.digestInterval === 'hourly' ? 'horaire' : alertData.digestInterval === 'daily' ? 'quotidien' : 'hebdomadaire'}` : '1️⃣ Première occurrence'}
                    </span>
                  </div>
                  <div className="summary-row highlight">
                    <span className="summary-label">Fréquence estimée</span>
                    <span className="summary-value">{getEstimatedFrequency()}</span>
                  </div>
                </div>

                {alertData.name.trim() === '' && (
                  <p className="step-hint">⚠️ Donnez un nom à votre alerte pour continuer.</p>
                )}
              </div>
            </div>
          )}

          {/* NAVIGATION */}
          <div className="step-nav">
            {currentStep > 1 && (
              <button className="nav-btn secondary" onClick={prevStep}>
                ← Retour
              </button>
            )}
            <div className="nav-spacer"></div>
            {currentStep < 5 ? (
              <button className={`nav-btn primary ${!canProceed() ? 'btn-disabled' : ''} ${shakeNav ? 'shake' : ''}`} onClick={nextStep}>
                Continuer →
              </button>
            ) : (
              <button className={`nav-btn create ${shakeNav ? 'shake' : ''}`} onClick={createAlert} disabled={!canProceed() || isCreating}>
                {isCreating ? '⏳ Enregistrement...' : isEditMode ? '✓ Enregistrer les modifications' : '✓ Créer l\'alerte'}
              </button>
            )}
          </div>
        </main>

        {/* RIGHT - PREVIEW */}
        <aside className="create-right">
          <div className="preview-header">
            <span className="preview-icon">👁️</span>
            <h3>Aperçu en direct</h3>
          </div>

          {/* Alert Card Preview */}
          <div className="preview-section">
            <span className="preview-label">Carte d'alerte</span>
            <div className="alert-preview-card">
              <div className="apc-header">
                <span className="apc-icons">
                  {alertData.types.length > 0 
                    ? alertData.types.map(t => alertTypes.find(at => at.id === t)?.icon).join(' ')
                    : '🔔'}
                </span>
                <span className="apc-name">{alertData.name || 'Nouvelle alerte'}</span>
                <span className="apc-status">● Actif</span>
              </div>
              <div className="apc-body">
                <div className="apc-row">
                  <span className="apc-label">Zone</span>
                  <span className="apc-value">
                    {alertData.zoneType === 'location' ? `${alertData.zoneRadius} km` :
                     alertData.zoneType === 'wilaya' ? alertData.zoneWilaya || 'Wilaya' :
                     alertData.zoneType === 'road' ? alertData.zoneRoad || 'Route' :
                     alertData.zoneType === 'draw' ? 'Personnalisée' : '—'}
                  </span>
                </div>
                <div className="apc-row">
                  <span className="apc-label">Horaires</span>
                  <span className="apc-value">
                    {alertData.timeRange === 'all' ? '24/7' : alertData.timeRange === 'day' ? 'Jour' : alertData.timeRange === 'night' ? 'Nuit' : 'Perso'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preview */}
          <div className="preview-section">
            <span className="preview-label">Exemple de notification</span>
            <div className="notif-preview">
              <div className="np-icon" style={{ background: alertData.severities.includes('high') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
                {alertData.types[0] ? alertTypes.find(at => at.id === alertData.types[0])?.icon : '🔔'}
              </div>
              <div className="np-content">
                <span className="np-title">Alerte: {alertData.name || 'Nouvelle alerte'}</span>
                <span className="np-context">
                  {alertData.types.includes('accident') ? 'Accident détecté' :
                   alertData.types.includes('traffic') ? 'Trafic dense signalé' :
                   alertData.types.includes('roadworks') ? 'Travaux en cours' :
                   alertData.types.includes('danger') ? 'Danger signalé' :
                   alertData.types.includes('ai') ? 'Prédiction IA' : 'Incident détecté'} dans votre zone
                </span>
              </div>
              <span className="np-time">À l'instant</span>
            </div>
          </div>

          {/* Mini Map Preview */}
          <div className="preview-section">
            <span className="preview-label">Zone surveillée</span>
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
            <span className="preview-label">Pourquoi vous serez notifié</span>
            <p className="why-text">
              {alertData.types.length > 0 && alertData.zoneType ? (
                <>
                  Vous recevrez une notification lorsqu'un incident de type{' '}
                  <strong>{alertData.types.map(t => alertTypes.find(at => at.id === t)?.label.toLowerCase()).join(' ou ')}</strong>
                  {' '}sera détecté{' '}
                  {alertData.zoneType === 'location' && <><strong>dans un rayon de {alertData.zoneRadius} km</strong> autour de vous</>}
                  {alertData.zoneType === 'wilaya' && alertData.zoneWilaya && <>à <strong>{alertData.zoneWilaya}</strong></>}
                  {alertData.zoneType === 'road' && alertData.zoneRoad && <>sur la <strong>{alertData.zoneRoad}</strong></>}
                  {alertData.zoneType === 'draw' && <>dans votre <strong>zone personnalisée</strong></>}
                  {alertData.severities.length < 3 && <>, avec un niveau de gravité <strong>{alertData.severities.map(s => s === 'high' ? 'élevé' : s === 'medium' ? 'moyen' : 'faible').join(' ou ')}</strong></>}
                  .
                </>
              ) : (
                'Complétez les étapes pour voir une explication personnalisée.'
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
