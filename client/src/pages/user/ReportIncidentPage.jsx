/**
 * @file ReportIncidentPage.jsx
 * @description 5-step wizard for reporting road incidents, plus a post-submission success screen.
 *
 * Wizard steps: Type → Location → Details → Media → Verification
 *
 * Layout: 3-column grid
 *   - Left:   vertical stepper + trust notice + cancel button
 *   - Center: step-specific form panels
 *   - Right:  live preview sidebar (incident card preview, mini-map, verification status)
 *
 * Features:
 *   - 3 location input methods: GPS auto-detect, address search, map click
 *   - Media upload with image preview (max 5 files, 5 MB each)
 *   - Severity level selector (high / medium / low)
 *   - Simulated API submit with random tracking ID
 *   - Success screen with next-steps explainer and quick-action buttons
 */
import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createReport, uploadReportMedia } from '../../services/reportsService'
import '../../styles/ReportIncidentPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const MAX_REPORT_MEDIA_FILES = 5
const MAX_REPORT_MEDIA_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_REPORT_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/* Fix default Leaflet marker icon paths (broken by bundlers) */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Inner component that listens for map clicks and calls the parent handler.
 */
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

export default function ReportIncidentPage() {
  /* ═══ ROUTING ═══ */
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)

  /* ═══ UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false)   // Header avatar dropdown
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [currentStep, setCurrentStep] = useState(1)         // Active wizard step (1-5)
  const [isSubmitting, setIsSubmitting] = useState(false)   // Loading spinner during submit
  const [isSubmitted, setIsSubmitted] = useState(false)     // Switches to success screen
  const [submittedId, setSubmittedId] = useState(null)      // Generated tracking reference
  const [submitError, setSubmitError] = useState('')        // Submission error banner
  const [submitWarning, setSubmitWarning] = useState('')    // Non-blocking warning after report creation
  const [mediaError, setMediaError] = useState('')          // Media validation banner

  /* ═══ FORM STATE ═══ */
  // All report fields consolidated in a single state object
  const [reportData, setReportData] = useState({
    type: '',                  // Selected incident type id
    locationType: '',          // 'gps' | 'search' | 'map'
    locationCoords: null,      // { lat, lng } or null
    locationAddress: '',       // Human-readable address string
    locationAccuracy: null,    // Accuracy label (e.g. 'High-precision GPS')
    title: '',                 // Incident title (min 5 chars)
    description: '',           // Optional free-text description (max 500 chars)
    severity: 'medium',        // 'high' | 'medium' | 'low'
    timeOption: 'now',         // 'now' | 'earlier'
    customTime: '',            // ISO datetime string when timeOption === 'earlier'
    media: [],                 // Array of { file, name, type, preview } objects
  })

  /* ═══ WIZARD STEP DEFINITIONS ═══ */
  const steps = [
    { id: 1, label: 'Incident Type', icon: '🎯' },
    { id: 2, label: 'Location', icon: '📍' },
    { id: 3, label: 'Details', icon: '📝' },
    { id: 4, label: 'Media', icon: '📷' },
    { id: 5, label: 'Verification', icon: '✅' }
  ]

  /* ═══ STATIC DATA — incident types & severity levels ═══ */
  const incidentTypes = [
    { id: 'accident', icon: '🚗', label: 'Accident', desc: 'Collision, road accident' },
    { id: 'traffic', icon: '🚦', label: 'Traffic', desc: 'Traffic jam, slowdown' },
    { id: 'danger', icon: '🔥', label: 'Danger', desc: 'Obstacle, dangerous situation' },
    { id: 'weather', icon: '🌧️', label: 'Weather', desc: 'Dangerous weather conditions' },
    { id: 'roadworks', icon: '🚧', label: 'Roadworks', desc: 'Construction, lane closure' },
    { id: 'other', icon: '❓', label: 'Other', desc: 'Other type of incident' }
  ]

  const severityLevels = [
    { id: 'high', label: 'High', color: '#DC2626', desc: 'Urgent, immediate danger' },
    { id: 'medium', label: 'Medium', color: '#F59E0B', desc: 'Important, attention required' },
    { id: 'low', label: 'Low', color: '#10B981', desc: 'Minor, informational' }
  ]

  const releaseMediaPreviews = (mediaItems) => {
    mediaItems.forEach((mediaItem) => {
      if (mediaItem?.preview) {
        URL.revokeObjectURL(mediaItem.preview)
      }
    })
  }

  /* ═══ LOCATION HANDLERS ═══ */
  // Simulate getting current GPS location (hardcoded Algiers coordinates)
  const getCurrentLocation = () => {
    setReportData(prev => ({
      ...prev,
      locationType: 'gps',
      locationCoords: { lat: 36.7538, lng: 3.0588 },
      locationAddress: 'Rue Didouche Mourad, Alger Centre',
      locationAccuracy: 'High-precision GPS'
    }))
  }

  // Simulate address geocoding — accepts query after 3+ characters
  const searchAddress = (query) => {
    if (query.length > 3) {
      setReportData(prev => ({
        ...prev,
        locationType: 'search',
        locationCoords: { lat: 36.7538, lng: 3.0588 },
        locationAddress: query,
        locationAccuracy: 'Manual search'
      }))
    }
  }

  /**
   * Handle a real click on the Leaflet map — store the selected coords.
   * @param {L.LatLng} latlng - The coordinates from the map click event.
   */
  const handleMapClick = (latlng) => {
    setReportData(prev => ({
      ...prev,
      locationType: 'map',
      locationCoords: { lat: latlng.lat, lng: latlng.lng },
      // TODO: replace this fallback with reverse geocoding when a shared address lookup is available.
      locationAddress: 'Position selected on map',
      locationAccuracy: 'Map selection'
    }))
  }

  /* ═══ MEDIA HANDLERS ═══ */
  // Process file input: validate images and create object-URLs for previews
  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files || [])
    const remainingSlots = Math.max(0, MAX_REPORT_MEDIA_FILES - reportData.media.length)

    setMediaError('')

    if (!files.length) {
      return
    }

    if (remainingSlots === 0) {
      setMediaError('You can upload up to 5 images per report.')
      e.target.value = ''
      return
    }

    const acceptedMedia = []
    let nextError = ''

    for (const file of files) {
      if (!ALLOWED_REPORT_MEDIA_MIME_TYPES.has(file.type)) {
        nextError = 'Only JPEG, PNG, and WebP images are allowed.'
        continue
      }

      if (file.size > MAX_REPORT_MEDIA_FILE_SIZE_BYTES) {
        nextError = 'Each image must be 5 MB or smaller.'
        continue
      }

      if (acceptedMedia.length >= remainingSlots) {
        nextError = 'You can upload up to 5 images per report.'
        continue
      }

      acceptedMedia.push({
        file,
        name: file.name,
        type: 'image',
        preview: URL.createObjectURL(file)
      })
    }

    if (!acceptedMedia.length) {
      setMediaError(nextError || 'No valid images were selected.')
      e.target.value = ''
      return
    }

    setReportData(prev => ({
      ...prev,
      media: [...prev.media, ...acceptedMedia]
    }))

    if (nextError) {
      setMediaError(nextError)
    }

    e.target.value = ''
  }

  // Remove a media item by index
  const removeMedia = (index) => {
    setReportData((prev) => {
      const mediaToRemove = prev.media[index]
      if (mediaToRemove?.preview) {
        URL.revokeObjectURL(mediaToRemove.preview)
      }

      return {
        ...prev,
        media: prev.media.filter((_, i) => i !== index),
      }
    })
    setMediaError('')
  }

  /* ═══ STEP VALIDATION & NAVIGATION ═══ */
  // Per-step validation: returns true if the step’s required fields are filled
  const canProceed = () => {
    switch (currentStep) {
      case 1: return reportData.type !== ''
      case 2: return reportData.locationCoords !== null
      case 3: return reportData.title.trim().length >= 2
      case 4: return true // Media is optional
      case 5: return true
      default: return false
    }
  }

  const nextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  /* ═══ SUBMIT HANDLER ═══ */
  const buildCreatePayload = () => ({
    incidentType: reportData.type,
    title: reportData.title.trim(),
    description: reportData.description.trim(),
    severity: reportData.severity,
    occurredAt: reportData.timeOption === 'earlier' && reportData.customTime
      ? new Date(reportData.customTime).toISOString()
      : new Date().toISOString(),
    location: {
      lat: reportData.locationCoords?.lat,
      lng: reportData.locationCoords?.lng,
      label: reportData.locationAddress.trim(),
    },
  })

  const submitReport = async () => {
    if (isSubmitting) {
      return
    }

    setSubmitError('')
    setSubmitWarning('')
    setIsSubmitting(true)

    try {
      const createdReport = await createReport(buildCreatePayload())

      if (createdReport?.id && reportData.media.length > 0) {
        try {
          await uploadReportMedia(createdReport.id, reportData.media.map((mediaItem) => mediaItem.file))
        } catch (error) {
          setSubmitWarning(error.message || 'Your report was created, but the images could not be uploaded.')
        }
      }

      releaseMediaPreviews(reportData.media)
      setIsSubmitting(false)
      setIsSubmitted(true)
      setSubmittedId(createdReport?.id || null)
    } catch (error) {
      setIsSubmitting(false)
      setSubmitError(error.message || 'Failed to submit report.')
    }
  }

  /* ═══ DERIVED HELPERS ═══ */
  // Get type info
  const getTypeInfo = () => incidentTypes.find(t => t.id === reportData.type)

  // Generate preview title
  const getPreviewTitle = () => {
    if (reportData.title) return reportData.title
    const typeInfo = getTypeInfo()
    return typeInfo ? `${typeInfo.label} reported` : 'New incident'
  }

  /* ═══ SUCCESS SCREEN (shown after submission) ═══ */
  // Success screen
  if (isSubmitted) {
    return (
      <div className="report-page">
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
              <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
                🔔<span className="notification-badge"></span>
              </button>
              <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
              <div className="dash-avatar-wrapper">
                <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}</button>
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

        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">✅</div>
            <h1>Report submitted!</h1>
            <p className="success-id">Reference: <strong>{submittedId}</strong></p>
            
            <div className="success-status">
              <div className="status-badge pending">
                <span className="status-dot"></span>
                Awaiting verification
              </div>
            </div>

            {submitWarning && (
              <p className="step-hint">{submitWarning}</p>
            )}

            <div className="success-next">
              <h3>What happens next?</h3>
              <div className="next-steps">
                <div className="next-step">
                  <span className="step-num">1</span>
                  <div className="step-info">
                    <span className="step-title">Automatic review</span>
                    <span className="step-desc">Our AI analyzes your report</span>
                  </div>
                  <span className="step-icon">🤖</span>
                </div>
                <div className="next-step">
                  <span className="step-num">2</span>
                  <div className="step-info">
                    <span className="step-title">Community confirmation</span>
                    <span className="step-desc">Other users can confirm</span>
                  </div>
                  <span className="step-icon">👥</span>
                </div>
                <div className="next-step">
                  <span className="step-num">3</span>
                  <div className="step-info">
                    <span className="step-title">Official validation</span>
                    <span className="step-desc">Verification by authorities if needed</span>
                  </div>
                  <span className="step-icon">🏛️</span>
                </div>
              </div>
            </div>

            <div className="success-actions">
              <button className="action-btn primary" onClick={() => navigate(`/incident/${submittedId}`)}>
                👁️ View my report
              </button>
              <button className="action-btn secondary" onClick={() => navigate('/alerts/create', { state: { fromIncident: reportData } })}>
                🔔 Create an alert for this incident
              </button>
              <button className="action-btn tertiary" onClick={() => navigate('/report', { state: { newReport: reportData.title || getPreviewTitle() } })}>
                ← Back to my reports
              </button>
            </div>

            <div className="success-trust">
              <p>🔒 Your personal data is protected. Reports are moderated to ensure quality.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ═══ MAIN RENDER (wizard form) ═══ */
  return (
    <div className="report-page">
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
              <button className="dash-tab dash-tab-active" onClick={() => navigate('/report')}>Report</button>
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
              placeholder="Search for an incident, a road, a wilaya…"
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
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}</button>
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

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <div className="report-grid">
        {/* ═══ LEFT COLUMN — VERTICAL STEPPER ═══ */}
        <aside className="report-left">
          <div className="stepper-header">
            <span className="stepper-icon">📢</span>
            <h2>Report an incident</h2>
          </div>
          <div className="stepper">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${currentStep < step.id ? 'disabled' : ''}`}
                onClick={() => currentStep > step.id && setCurrentStep(step.id)}
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

          <div className="trust-notice">
            <span className="trust-icon">🛡️</span>
            <div className="trust-text">
              <strong>Secure reporting</strong>
              <p>Your data is protected. False reports may be removed.</p>
            </div>
          </div>

          <button className="cancel-btn" onClick={() => navigate('/report')}>
            ✕ Cancel
          </button>
        </aside>

        {/* ═══ CENTER COLUMN — STEP FORM PANELS ═══ */}
        <main className="report-center">
          {/* STEP 1 — Incident Type Selection (single-select cards) */}
          {currentStep === 1 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>What type of incident do you want to report?</h1>
                <p>Select the category that best matches.</p>
              </div>
              <div className="type-grid">
                {incidentTypes.map(type => (
                  <div
                    key={type.id}
                    className={`type-card ${reportData.type === type.id ? 'selected' : ''}`}
                    onClick={() => setReportData(prev => ({ ...prev, type: type.id }))}
                  >
                    <div className="type-check">{reportData.type === type.id ? '✓' : ''}</div>
                    <span className="type-icon">{type.icon}</span>
                    <span className="type-label">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </div>
                ))}
              </div>
              {reportData.type === '' && (
                <p className="step-hint">⚠️ Select an incident type to continue.</p>
              )}
            </div>
          )}

          {/* STEP 2 — Location (GPS / search / map click) */}
          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Where is the incident located?</h1>
                <p>Provide the exact location to help other users.</p>
              </div>
              <div className="location-options">
                <button 
                  className={`location-btn ${reportData.locationType === 'gps' ? 'selected' : ''}`}
                  onClick={getCurrentLocation}
                >
                  <span className="loc-icon">📍</span>
                  <div className="loc-info">
                    <span className="loc-label">Use my current location</span>
                    <span className="loc-desc">High-precision GPS</span>
                  </div>
                  {reportData.locationType === 'gps' && <span className="loc-check">✓</span>}
                </button>

                <div className="location-search">
                  <label>Or search for an address</label>
                  <div className="search-input-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="E.g.: Rue Didouche Mourad, Algiers..."
                      value={reportData.locationType === 'search' ? reportData.locationAddress : ''}
                      onChange={(e) => searchAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="map-section">
                  <label>Or select on the map</label>
                  <div className="map-interactive-leaflet">
                    <MapContainer
                      center={reportData.locationCoords
                        ? [reportData.locationCoords.lat, reportData.locationCoords.lng]
                        : [28.0339, 1.6596]}
                      zoom={reportData.locationCoords ? 13 : 5}
                      style={{ width: '100%', height: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <MapClickHandler onClick={handleMapClick} />
                      {reportData.locationCoords && (
                        <Marker position={[reportData.locationCoords.lat, reportData.locationCoords.lng]} />
                      )}
                    </MapContainer>
                    {!reportData.locationCoords && (
                      <p className="map-hint">Click to place the marker</p>
                    )}
                  </div>
                </div>

                {reportData.locationCoords && (
                  <div className="location-confirm">
                    <div className="confirm-icon">✅</div>
                    <div className="confirm-info">
                      <span className="confirm-address">{reportData.locationAddress}</span>
                      <span className="confirm-accuracy">
                        <span className="accuracy-dot"></span>
                        {reportData.locationAccuracy}
                      </span>
                    </div>
                    <button className="confirm-edit" onClick={() => setReportData(prev => ({ ...prev, locationCoords: null, locationAddress: '', locationType: '' }))}>
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — Details (title, description, severity, time) */}
          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Describe the incident</h1>
                <p>Provide details to help understand the situation.</p>
              </div>
              <div className="details-form">
                <div className="form-group">
                  <label>Report title <span className="required">*</span></label>
                  <input
                    type="text"
                    className="title-input"
                    placeholder="E.g.: Accident between two vehicles"
                    value={reportData.title}
                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value.slice(0, 100) }))}
                    maxLength={100}
                  />
                  <div className="input-meta">
                    <span className="char-count">{reportData.title.length}/100</span>
                    {reportData.title.length < 2 && reportData.title.length > 0 && (
                      <span className="input-error">Minimum 2 characters</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Description <span className="optional">(optional)</span></label>
                  <textarea
                    className="desc-input"
                    placeholder="Describe what you observed. Stay factual and objective."
                    value={reportData.description}
                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                    maxLength={500}
                    rows={4}
                  />
                  <div className="input-meta">
                    <span className="char-count">{reportData.description.length}/500</span>
                  </div>
                  <div className="writing-tips">
                    <span className="tips-title">💡 Tips</span>
                    <ul>
                      <li>Describe the facts, not your emotions</li>
                      <li>Mention the number of vehicles/people if relevant</li>
                      <li>Indicate if emergency services are present</li>
                    </ul>
                  </div>
                </div>

                <div className="form-group">
                  <label>Severity level</label>
                  <div className="severity-selector">
                    {severityLevels.map(sev => (
                      <button
                        key={sev.id}
                        className={`sev-btn ${reportData.severity === sev.id ? 'selected' : ''}`}
                        onClick={() => setReportData(prev => ({ ...prev, severity: sev.id }))}
                        style={{ '--sev-color': sev.color }}
                      >
                        <span className="sev-dot" style={{ background: sev.color }}></span>
                        <div className="sev-info">
                          <span className="sev-label">{sev.label}</span>
                          <span className="sev-desc">{sev.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>When did this happen?</label>
                  <div className="time-selector">
                    <button
                      className={`time-btn ${reportData.timeOption === 'now' ? 'selected' : ''}`}
                      onClick={() => setReportData(prev => ({ ...prev, timeOption: 'now' }))}
                    >
                      <span className="time-icon">⏱️</span>
                      <span>Now</span>
                    </button>
                    <button
                      className={`time-btn ${reportData.timeOption === 'earlier' ? 'selected' : ''}`}
                      onClick={() => setReportData(prev => ({ ...prev, timeOption: 'earlier' }))}
                    >
                      <span className="time-icon">🕐</span>
                      <span>Earlier</span>
                    </button>
                  </div>
                  {reportData.timeOption === 'earlier' && (
                    <div className="custom-time-input">
                      <input
                        type="datetime-local"
                        value={reportData.customTime}
                        onChange={(e) => setReportData(prev => ({ ...prev, customTime: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Media Upload (photos, optional) */}
          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Add media</h1>
                <p>Add up to 5 photos to document the incident (optional).</p>
              </div>
              <div className="media-section">
                <div className="media-upload">
                  <input
                    type="file"
                    id="media-input"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleMediaUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="media-input" className="upload-zone">
                    <span className="upload-icon">📷</span>
                    <span className="upload-title">Add photos</span>
                    <span className="upload-desc">Click to select JPEG, PNG, or WebP images</span>
                    <span className="upload-limit">Maximum 5 files • 5 MB each</span>
                  </label>
                </div>

                {mediaError && (
                  <p className="input-error">{mediaError}</p>
                )}

                {reportData.media.length > 0 && (
                  <div className="media-preview-grid">
                    {reportData.media.map((media, index) => (
                      <div key={index} className="media-preview-item">
                        <img src={media.preview} alt={`Preview ${index + 1}`} />
                        <button className="remove-media" onClick={() => removeMedia(index)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                  <div className="media-notice">
                    <span className="notice-icon">🔒</span>
                    <div className="notice-text">
                      <strong>Privacy</strong>
                      <p>Media is moderated before publication. Visible personal data (faces, license plates) may be blurred.</p>
                  </div>
                </div>

                <div className="skip-media">
                  <p>No media to add?</p>
                  <button className="skip-btn" onClick={nextStep}>Skip this step →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — Review & Submit */}
          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Review your report</h1>
                <p>Review the information before submitting.</p>
              </div>
              <div className="review-content">
                <div className="review-section">
                  <div className="review-row">
                    <span className="review-label">Incident type</span>
                    <span className="review-value">
                      {getTypeInfo()?.icon} {getTypeInfo()?.label}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(1)}>✏️</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Location</span>
                    <span className="review-value">📍 {reportData.locationAddress}</span>
                    <button className="review-edit" onClick={() => setCurrentStep(2)}>✏️</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Title</span>
                    <span className="review-value">{reportData.title}</span>
                    <button className="review-edit" onClick={() => setCurrentStep(3)}>✏️</button>
                  </div>
                  {reportData.description && (
                    <div className="review-row">
                      <span className="review-label">Description</span>
                      <span className="review-value desc">{reportData.description}</span>
                    </div>
                  )}
                  <div className="review-row">
                    <span className="review-label">Severity</span>
                    <span className="review-value">
                      <span className="sev-indicator" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                      {severityLevels.find(s => s.id === reportData.severity)?.label}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Time</span>
                    <span className="review-value">
                      {reportData.timeOption === 'now' ? '⏱️ Now' : `🕐 ${reportData.customTime}`}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Media</span>
                    <span className="review-value">
                      {reportData.media.length > 0 
                        ? `📷 ${reportData.media.length} image(s)` 
                        : 'No media'}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(4)}>✏️</button>
                  </div>
                </div>

                <div className="review-agreement">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>I confirm that this information is accurate and truthful.</span>
                  </label>
                </div>

                <div className="review-notice">
                  <span className="notice-icon">ℹ️</span>
                  <p>Your report will be verified by our automated system and then made visible to other users. False reports may result in account suspension.</p>
                </div>

                {!user && (
                  <div className="review-notice">
                    <span className="notice-icon">🔐</span>
                    <p>You need to be logged in to submit this report.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ BOTTOM NAVIGATION (Back / Continue / Submit) ═══ */}
          {submitError && (
            <div className="review-notice">
              <span className="notice-icon">⚠️</span>
              <p>{submitError}</p>
            </div>
          )}
          <div className="step-nav">
            {currentStep > 1 && (
              <button className="nav-btn secondary" onClick={prevStep}>
                ← Back
              </button>
            )}
            <div className="nav-spacer"></div>
            {currentStep < 5 ? (
              <button className="nav-btn primary" onClick={nextStep} disabled={!canProceed()}>
                Continue →
              </button>
            ) : (
              <button className="nav-btn submit" onClick={submitReport} disabled={isSubmitting || !user}>
                {isSubmitting ? '⏳ Submitting...' : '📤 Submit report'}
              </button>
            )}
          </div>
        </main>

        {/* ═══ RIGHT COLUMN — LIVE PREVIEW SIDEBAR ═══ */}
        <aside className="report-right">
          <div className="preview-header">
            <span className="preview-icon">👁️</span>
            <h3>Report preview</h3>
          </div>

          {/* Incident Card Preview */}
          <div className="preview-section">
            <span className="preview-label">How it will appear</span>
            <div className="incident-preview-card">
              <div className="ipc-header">
                <span className="ipc-icon" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}20` }}>
                  {getTypeInfo()?.icon || '📢'}
                </span>
                <div className="ipc-info">
                  <span className="ipc-title">{getPreviewTitle()}</span>
                  <span className="ipc-meta">
                    {reportData.locationAddress || 'Location...'}
                  </span>
                </div>
              </div>
              <div className="ipc-body">
                {reportData.description ? (
                  <p className="ipc-desc">{reportData.description.slice(0, 100)}{reportData.description.length > 100 ? '...' : ''}</p>
                ) : (
                  <p className="ipc-desc placeholder">Incident description...</p>
                )}
              </div>
              <div className="ipc-footer">
                <span className="ipc-sev" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}15`, color: severityLevels.find(s => s.id === reportData.severity)?.color }}>
                  <span className="sev-dot-sm" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                  {severityLevels.find(s => s.id === reportData.severity)?.label}
                </span>
                <span className="ipc-time">Just now</span>
                <span className="ipc-status">⏳ Pending</span>
              </div>
            </div>
          </div>

          {/* Mini Map */}
          <div className="preview-section">
            <span className="preview-label">Location</span>
            <div className="map-preview">
              <div className="map-bg-mini">🗺️</div>
              {reportData.locationCoords && (
                <div className="marker-preview">
                  <span className="marker-icon" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}>
                    {getTypeInfo()?.icon || '📍'}
                  </span>
                </div>
              )}
              {!reportData.locationCoords && (
                <p className="map-placeholder-text">Select a location</p>
              )}
            </div>
          </div>

          {/* Verification Status */}
          <div className="preview-section">
            <span className="preview-label">Verification status</span>
            <div className="verification-preview">
              <div className="verif-step">
                <span className="verif-icon pending">⏳</span>
                <div className="verif-info">
                  <span className="verif-title">Pending</span>
                  <span className="verif-desc">Will be verified after submission</span>
                </div>
              </div>
              <div className="verif-timeline">
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">AI Review</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">Community</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">Published</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust & Safety */}
          <div className="preview-section trust-preview">
            <span className="preview-label">Trust & Safety</span>
            <ul className="trust-list">
              <li>✅ Verified reports</li>
              <li>🛡️ Protected data</li>
              <li>👁️ Moderated media</li>
              <li>⚖️ False reports removed</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
