import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/ReportIncidentPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function ReportIncidentPage() {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState(null)

  // Form state
  const [reportData, setReportData] = useState({
    type: '',
    locationType: '',
    locationCoords: null,
    locationAddress: '',
    locationAccuracy: null,
    title: '',
    description: '',
    severity: 'medium',
    timeOption: 'now',
    customTime: '',
    media: [],
    mediaPreview: []
  })

  const steps = [
    { id: 1, label: "Type d'incident", icon: '🎯' },
    { id: 2, label: 'Localisation', icon: '📍' },
    { id: 3, label: 'Détails', icon: '📝' },
    { id: 4, label: 'Médias', icon: '📷' },
    { id: 5, label: 'Vérification', icon: '✅' }
  ]

  const incidentTypes = [
    { id: 'accident', icon: '🚗', label: 'Accident', desc: 'Collision, accident de la route' },
    { id: 'traffic', icon: '🚦', label: 'Trafic', desc: 'Embouteillage, ralentissement' },
    { id: 'danger', icon: '🔥', label: 'Danger', desc: 'Obstacle, situation dangereuse' },
    { id: 'weather', icon: '🌧️', label: 'Météo', desc: 'Conditions météo dangereuses' },
    { id: 'roadworks', icon: '🚧', label: 'Travaux', desc: 'Chantier, fermeture de voie' },
    { id: 'other', icon: '❓', label: 'Autre', desc: 'Autre type d\'incident' }
  ]

  const severityLevels = [
    { id: 'high', label: 'Haute', color: '#DC2626', desc: 'Urgent, danger immédiat' },
    { id: 'medium', label: 'Moyenne', color: '#F59E0B', desc: 'Important, attention requise' },
    { id: 'low', label: 'Basse', color: '#10B981', desc: 'Mineur, information' }
  ]

  // Simulate getting current location
  const getCurrentLocation = () => {
    setReportData(prev => ({
      ...prev,
      locationType: 'gps',
      locationCoords: { lat: 36.7538, lng: 3.0588 },
      locationAddress: 'Rue Didouche Mourad, Alger Centre',
      locationAccuracy: 'GPS haute précision'
    }))
  }

  // Handle address search
  const searchAddress = (query) => {
    if (query.length > 3) {
      setReportData(prev => ({
        ...prev,
        locationType: 'search',
        locationCoords: { lat: 36.7538, lng: 3.0588 },
        locationAddress: query,
        locationAccuracy: 'Recherche manuelle'
      }))
    }
  }

  // Handle map click simulation
  const handleMapClick = () => {
    setReportData(prev => ({
      ...prev,
      locationType: 'map',
      locationCoords: { lat: 36.7600, lng: 3.0500 },
      locationAddress: 'Position sélectionnée sur la carte',
      locationAccuracy: 'Sélection sur carte'
    }))
  }

  // Handle media upload
  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files)
    const newMedia = files.map(file => ({
      file,
      name: file.name,
      type: file.type.startsWith('image') ? 'image' : 'video',
      preview: URL.createObjectURL(file)
    }))
    setReportData(prev => ({
      ...prev,
      media: [...prev.media, ...newMedia].slice(0, 5),
      mediaPreview: [...prev.mediaPreview, ...newMedia.map(m => m.preview)].slice(0, 5)
    }))
  }

  const removeMedia = (index) => {
    setReportData(prev => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
      mediaPreview: prev.mediaPreview.filter((_, i) => i !== index)
    }))
  }

  // Validation
  const canProceed = () => {
    switch (currentStep) {
      case 1: return reportData.type !== ''
      case 2: return reportData.locationCoords !== null
      case 3: return reportData.title.trim().length >= 5
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

  const submitReport = () => {
    setIsSubmitting(true)
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      setSubmittedId('INC-' + Math.random().toString(36).substr(2, 9).toUpperCase())
    }, 2000)
  }

  // Get type info
  const getTypeInfo = () => incidentTypes.find(t => t.id === reportData.type)

  // Generate preview title
  const getPreviewTitle = () => {
    if (reportData.title) return reportData.title
    const typeInfo = getTypeInfo()
    return typeInfo ? `${typeInfo.label} signalé` : 'Nouvel incident'
  }

  // Success screen
  if (isSubmitted) {
    return (
      <div className="report-page">
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
                <button className="dash-tab" onClick={() => navigate('/admin/dashboard')}>Dashboard</button>
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
              </div>
            </div>
          </div>
        </header>

        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">✅</div>
            <h1>Signalement envoyé !</h1>
            <p className="success-id">Référence: <strong>{submittedId}</strong></p>
            
            <div className="success-status">
              <div className="status-badge pending">
                <span className="status-dot"></span>
                En attente de vérification
              </div>
            </div>

            <div className="success-next">
              <h3>Que se passe-t-il ensuite ?</h3>
              <div className="next-steps">
                <div className="next-step">
                  <span className="step-num">1</span>
                  <div className="step-info">
                    <span className="step-title">Revue automatique</span>
                    <span className="step-desc">Notre IA analyse votre signalement</span>
                  </div>
                  <span className="step-icon">🤖</span>
                </div>
                <div className="next-step">
                  <span className="step-num">2</span>
                  <div className="step-info">
                    <span className="step-title">Confirmation communautaire</span>
                    <span className="step-desc">D'autres utilisateurs peuvent confirmer</span>
                  </div>
                  <span className="step-icon">👥</span>
                </div>
                <div className="next-step">
                  <span className="step-num">3</span>
                  <div className="step-info">
                    <span className="step-title">Validation officielle</span>
                    <span className="step-desc">Vérification par les autorités si nécessaire</span>
                  </div>
                  <span className="step-icon">🏛️</span>
                </div>
              </div>
            </div>

            <div className="success-actions">
              <button className="action-btn primary" onClick={() => navigate(`/incident/${submittedId}`)}>
                👁️ Voir mon signalement
              </button>
              <button className="action-btn secondary" onClick={() => navigate('/alerts/create', { state: { fromIncident: reportData } })}>
                🔔 Créer une alerte pour cet incident
              </button>
              <button className="action-btn tertiary" onClick={() => navigate('/news')}>
                ← Retour au feed
              </button>
            </div>

            <div className="success-trust">
              <p>🔒 Vos données personnelles sont protégées. Les signalements sont modérés pour garantir la qualité.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="report-page">
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
              <button className="dash-tab" onClick={() => navigate('/admin/dashboard')}>Dashboard</button>
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
                  <button className="dropdown-item" onClick={() => navigate('/profile')}>👤 Mon profil</button>
                  <button className="dropdown-item">⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => navigate('/notifications')}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="report-grid">
        {/* LEFT - STEPPER */}
        <aside className="report-left">
          <div className="stepper-header">
            <span className="stepper-icon">📢</span>
            <h2>Signaler un incident</h2>
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
              <strong>Signalement sécurisé</strong>
              <p>Vos données sont protégées. Les faux signalements peuvent être supprimés.</p>
            </div>
          </div>

          <button className="cancel-btn" onClick={() => navigate(-1)}>
            ✕ Annuler
          </button>
        </aside>

        {/* CENTER - FORM */}
        <main className="report-center">
          {/* STEP 1 - Incident Type */}
          {currentStep === 1 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Quel type d'incident souhaitez-vous signaler ?</h1>
                <p>Sélectionnez la catégorie qui correspond le mieux.</p>
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
                <p className="step-hint">⚠️ Sélectionnez un type d'incident pour continuer.</p>
              )}
            </div>
          )}

          {/* STEP 2 - Location */}
          {currentStep === 2 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Où se situe l'incident ?</h1>
                <p>Indiquez la localisation exacte pour aider les autres usagers.</p>
              </div>
              <div className="location-options">
                <button 
                  className={`location-btn ${reportData.locationType === 'gps' ? 'selected' : ''}`}
                  onClick={getCurrentLocation}
                >
                  <span className="loc-icon">📍</span>
                  <div className="loc-info">
                    <span className="loc-label">Utiliser ma position actuelle</span>
                    <span className="loc-desc">GPS haute précision</span>
                  </div>
                  {reportData.locationType === 'gps' && <span className="loc-check">✓</span>}
                </button>

                <div className="location-search">
                  <label>Ou rechercher une adresse</label>
                  <div className="search-input-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Ex: Rue Didouche Mourad, Alger..."
                      value={reportData.locationType === 'search' ? reportData.locationAddress : ''}
                      onChange={(e) => searchAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="map-section">
                  <label>Ou sélectionner sur la carte</label>
                  <div className="map-interactive" onClick={handleMapClick}>
                    <div className="map-bg">
                      🗺️
                      {reportData.locationCoords && (
                        <div className="map-marker">📍</div>
                      )}
                    </div>
                    <p className="map-hint">Cliquez pour placer le marqueur</p>
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

          {/* STEP 3 - Details */}
          {currentStep === 3 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Décrivez l'incident</h1>
                <p>Donnez des détails pour aider à comprendre la situation.</p>
              </div>
              <div className="details-form">
                <div className="form-group">
                  <label>Titre du signalement <span className="required">*</span></label>
                  <input
                    type="text"
                    className="title-input"
                    placeholder="Ex: Accident entre deux véhicules"
                    value={reportData.title}
                    onChange={(e) => setReportData(prev => ({ ...prev, title: e.target.value.slice(0, 100) }))}
                    maxLength={100}
                  />
                  <div className="input-meta">
                    <span className="char-count">{reportData.title.length}/100</span>
                    {reportData.title.length < 5 && reportData.title.length > 0 && (
                      <span className="input-error">Minimum 5 caractères</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Description <span className="optional">(facultatif)</span></label>
                  <textarea
                    className="desc-input"
                    placeholder="Décrivez ce que vous avez observé. Restez factuel et objectif."
                    value={reportData.description}
                    onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                    maxLength={500}
                    rows={4}
                  />
                  <div className="input-meta">
                    <span className="char-count">{reportData.description.length}/500</span>
                  </div>
                  <div className="writing-tips">
                    <span className="tips-title">💡 Conseils</span>
                    <ul>
                      <li>Décrivez les faits, pas vos émotions</li>
                      <li>Mentionnez le nombre de véhicules/personnes si pertinent</li>
                      <li>Indiquez si des secours sont présents</li>
                    </ul>
                  </div>
                </div>

                <div className="form-group">
                  <label>Niveau de gravité</label>
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
                  <label>Quand cela s'est-il produit ?</label>
                  <div className="time-selector">
                    <button
                      className={`time-btn ${reportData.timeOption === 'now' ? 'selected' : ''}`}
                      onClick={() => setReportData(prev => ({ ...prev, timeOption: 'now' }))}
                    >
                      <span className="time-icon">⏱️</span>
                      <span>Maintenant</span>
                    </button>
                    <button
                      className={`time-btn ${reportData.timeOption === 'earlier' ? 'selected' : ''}`}
                      onClick={() => setReportData(prev => ({ ...prev, timeOption: 'earlier' }))}
                    >
                      <span className="time-icon">🕐</span>
                      <span>Plus tôt</span>
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

          {/* STEP 4 - Media */}
          {currentStep === 4 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Ajouter des médias</h1>
                <p>Photos ou vidéos pour illustrer l'incident (facultatif).</p>
              </div>
              <div className="media-section">
                <div className="media-upload">
                  <input
                    type="file"
                    id="media-input"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaUpload}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="media-input" className="upload-zone">
                    <span className="upload-icon">📷</span>
                    <span className="upload-title">Ajouter photos ou vidéos</span>
                    <span className="upload-desc">Glissez-déposez ou cliquez pour sélectionner</span>
                    <span className="upload-limit">Maximum 5 fichiers • 10 MB chacun</span>
                  </label>
                </div>

                {reportData.media.length > 0 && (
                  <div className="media-preview-grid">
                    {reportData.media.map((media, index) => (
                      <div key={index} className="media-preview-item">
                        {media.type === 'image' ? (
                          <img src={media.preview} alt={`Preview ${index + 1}`} />
                        ) : (
                          <div className="video-preview">
                            <span className="video-icon">🎬</span>
                            <span>{media.name}</span>
                          </div>
                        )}
                        <button className="remove-media" onClick={() => removeMedia(index)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="media-notice">
                  <span className="notice-icon">🔒</span>
                  <div className="notice-text">
                    <strong>Confidentialité</strong>
                    <p>Les médias sont modérés avant publication. Les données personnelles visibles (visages, plaques) peuvent être floutées.</p>
                  </div>
                </div>

                <div className="skip-media">
                  <p>Pas de médias à ajouter ?</p>
                  <button className="skip-btn" onClick={nextStep}>Passer cette étape →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 - Review */}
          {currentStep === 5 && (
            <div className="step-panel">
              <div className="step-header">
                <h1>Vérifiez votre signalement</h1>
                <p>Relisez les informations avant d'envoyer.</p>
              </div>
              <div className="review-content">
                <div className="review-section">
                  <div className="review-row">
                    <span className="review-label">Type d'incident</span>
                    <span className="review-value">
                      {getTypeInfo()?.icon} {getTypeInfo()?.label}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(1)}>✏️</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Localisation</span>
                    <span className="review-value">📍 {reportData.locationAddress}</span>
                    <button className="review-edit" onClick={() => setCurrentStep(2)}>✏️</button>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Titre</span>
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
                    <span className="review-label">Gravité</span>
                    <span className="review-value">
                      <span className="sev-indicator" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                      {severityLevels.find(s => s.id === reportData.severity)?.label}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Moment</span>
                    <span className="review-value">
                      {reportData.timeOption === 'now' ? '⏱️ Maintenant' : `🕐 ${reportData.customTime}`}
                    </span>
                  </div>
                  <div className="review-row">
                    <span className="review-label">Médias</span>
                    <span className="review-value">
                      {reportData.media.length > 0 
                        ? `📷 ${reportData.media.length} fichier(s)` 
                        : 'Aucun média'}
                    </span>
                    <button className="review-edit" onClick={() => setCurrentStep(4)}>✏️</button>
                  </div>
                </div>

                <div className="review-agreement">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>Je confirme que ces informations sont exactes et véridiques.</span>
                  </label>
                </div>

                <div className="review-notice">
                  <span className="notice-icon">ℹ️</span>
                  <p>Votre signalement sera vérifié par notre système automatique puis rendu visible aux autres usagers. Les faux signalements peuvent entraîner une suspension de compte.</p>
                </div>
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
              <button className="nav-btn primary" onClick={nextStep} disabled={!canProceed()}>
                Continuer →
              </button>
            ) : (
              <button className="nav-btn submit" onClick={submitReport} disabled={isSubmitting}>
                {isSubmitting ? '⏳ Envoi en cours...' : '📤 Envoyer le signalement'}
              </button>
            )}
          </div>
        </main>

        {/* RIGHT - PREVIEW */}
        <aside className="report-right">
          <div className="preview-header">
            <span className="preview-icon">👁️</span>
            <h3>Aperçu du signalement</h3>
          </div>

          {/* Incident Card Preview */}
          <div className="preview-section">
            <span className="preview-label">Comment il apparaîtra</span>
            <div className="incident-preview-card">
              <div className="ipc-header">
                <span className="ipc-icon" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}20` }}>
                  {getTypeInfo()?.icon || '📢'}
                </span>
                <div className="ipc-info">
                  <span className="ipc-title">{getPreviewTitle()}</span>
                  <span className="ipc-meta">
                    {reportData.locationAddress || 'Localisation...'}
                  </span>
                </div>
              </div>
              <div className="ipc-body">
                {reportData.description ? (
                  <p className="ipc-desc">{reportData.description.slice(0, 100)}{reportData.description.length > 100 ? '...' : ''}</p>
                ) : (
                  <p className="ipc-desc placeholder">Description de l'incident...</p>
                )}
              </div>
              <div className="ipc-footer">
                <span className="ipc-sev" style={{ background: `${severityLevels.find(s => s.id === reportData.severity)?.color}15`, color: severityLevels.find(s => s.id === reportData.severity)?.color }}>
                  <span className="sev-dot-sm" style={{ background: severityLevels.find(s => s.id === reportData.severity)?.color }}></span>
                  {severityLevels.find(s => s.id === reportData.severity)?.label}
                </span>
                <span className="ipc-time">À l'instant</span>
                <span className="ipc-status">⏳ En attente</span>
              </div>
            </div>
          </div>

          {/* Mini Map */}
          <div className="preview-section">
            <span className="preview-label">Localisation</span>
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
                <p className="map-placeholder-text">Sélectionnez une localisation</p>
              )}
            </div>
          </div>

          {/* Verification Status */}
          <div className="preview-section">
            <span className="preview-label">Statut de vérification</span>
            <div className="verification-preview">
              <div className="verif-step">
                <span className="verif-icon pending">⏳</span>
                <div className="verif-info">
                  <span className="verif-title">En attente</span>
                  <span className="verif-desc">Sera vérifié après envoi</span>
                </div>
              </div>
              <div className="verif-timeline">
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">Revue IA</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">Communauté</span>
                </div>
                <div className="timeline-step">
                  <span className="tl-dot"></span>
                  <span className="tl-label">Publication</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust & Safety */}
          <div className="preview-section trust-preview">
            <span className="preview-label">Confiance & Sécurité</span>
            <ul className="trust-list">
              <li>✅ Signalements vérifiés</li>
              <li>🛡️ Données protégées</li>
              <li>👁️ Médias modérés</li>
              <li>⚖️ Faux signalements supprimés</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
