/**
 * @file IncidentDetailPage.jsx
 * @description Full-detail view for a single road incident.
 *
 * Layout  — 3-column design:
 *   Left   : sidebar navigation, user mini-card, related incidents list
 *   Center : incident header, severity/trust block, description, media gallery,
 *            chronological timeline, and community signals
 *   Right  : mini-map, safety recommendations with alternative routes,
 *            follow/alert actions, and incident metadata
 *
 * Features:
 *   • useParams to extract the incident ID from the URL
 *   • Mock incident object with timeline events, media, tags, coordinates
 *   • Severity & trust indicators (user verifications, authority confirmation, AI confidence)
 *   • Expandable description, photo gallery, community confirmation counter
 *   • Related incidents sidebar linking to other detail pages
 */
import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../../styles/IncidentDetailPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function IncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams() // incident ID extracted from route params

  /* ═══ LOCAL UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false)           // header user-menu toggle
  const [isFollowing, setIsFollowing] = useState(false)             // follow-incident toggle
  const [showFullDescription, setShowFullDescription] = useState(false) // expand/collapse long description

  /* ═══ MOCK INCIDENT DATA ═══ */
  // In production this would be fetched from the API using the `id` param.
  const incident = {
    id: id || '1',
    type: 'accident',
    typeLabel: 'Accident',
    typeIcon: '🚗',
    title: 'Multi-vehicle collision on A1 Highway',
    description: `A serious multi-vehicle collision occurred on the A1 Highway near the Bab Ezzouar exit. Initial reports indicate that at least 4 vehicles were involved, including a commercial truck.

Emergency services arrived on scene within 12 minutes of the first report. Traffic is currently being diverted through secondary routes. The incident appears to have been caused by reduced visibility due to morning fog.

Authorities advise all motorists to avoid this section of the highway until further notice. Alternative routes through Mohammadia and Hussein Dey are recommended.`,
    severity: 'high',
    location: {
      city: 'Alger',
      road: 'A1 Highway, KM 23',
      coordinates: { lat: 36.7538, lng: 3.0588 }
    },
    reportedAt: '2025-12-31T08:45:00',
    timeAgo: '23 min ago',
    verified: true,
    verificationCount: 12,
    authorityConfirmed: true,
    aiConfidence: 94,
    media: [
      { type: 'image', url: '/placeholder-1.jpg', caption: 'Scene from distance' },
      { type: 'image', url: '/placeholder-2.jpg', caption: 'Traffic backup' },
      { type: 'image', url: '/placeholder-3.jpg', caption: 'Emergency response' }
    ],
    timeline: [
      { time: '08:45', source: 'user', text: 'Initial report submitted by citizen' },
      { time: '08:52', source: 'system', text: 'Incident verified by 5+ users' },
      { time: '08:57', source: 'authority', text: 'Emergency services dispatched' },
      { time: '09:03', source: 'authority', text: 'Traffic diversion activated' },
      { time: '09:08', source: 'user', text: 'Ambulances arriving on scene' }
    ],
    confirmations: 47,
    comments: 12,
    estimatedDelay: '45-60 min',
    alternativeRoutes: ['Via Mohammadia', 'Via Hussein Dey', 'Via Les Eucalyptus'],
    tags: ['highway', 'multi-vehicle', 'traffic-blocked'],
    sourceCount: 23,
    lastUpdated: '09:08'
  }

  /* ═══ RELATED / NEARBY INCIDENTS ═══ */
  // Shown in the left sidebar to let the user jump between nearby events.
  const relatedIncidents = [
    { id: '2', title: 'Traffic jam near Rouiba', type: 'traffic', severity: 'medium' },
    { id: '3', title: 'Road works on N5', type: 'roadworks', severity: 'low' }
  ]

  /* ═══ HELPER FUNCTIONS ═══ */

  /** Map severity level → hex colour for badges, dots, borders */
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#DC2626'
      case 'medium': return '#F59E0B'
      case 'low': return '#10B981'
      default: return '#64748B'
    }
  }

  /** Map severity level → human-readable label */
  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'high': return 'High Severity'
      case 'medium': return 'Medium Severity'
      case 'low': return 'Low Severity'
      default: return 'Unknown'
    }
  }

  /** Map timeline event source → emoji icon */
  const getSourceIcon = (source) => {
    switch (source) {
      case 'user': return '👤'
      case 'authority': return '🏛️'
      case 'system': return '🤖'
      default: return '📍'
    }
  }

  return (
    <div className="incident-detail-page">
      {/* ========== GLOBAL HEADER ========== */}
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
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Rechercher un incident, une route, une wilaya…"
              aria-label="Search"
            />
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

      {/* ========== MAIN 3-COLUMN LAYOUT ========== */}
      <div className="incident-layout">
        
        {/* ========== LEFT COLUMN — NAVIGATION ========== */}
        <aside className="incident-sidebar-left">
          {/* User Mini Card */}
          <div className="user-mini-card">
            <div className="user-mini-avatar">SA</div>
            <div className="user-mini-info">
              <span className="user-mini-name">Sofiane A.</span>
              <span className="user-mini-role">Citoyen</span>
            </div>
          </div>

          {/* Back Navigation */}
          <div className="back-nav">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Retour
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="sidebar-nav">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/news')}>
              <span className="nav-icon">📰</span>
              <span className="nav-label">Feed</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/map')}>
              <span className="nav-icon">🗺️</span>
              <span className="nav-label">Carte</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/news')}>
              <span className="nav-icon">🚨</span>
              <span className="nav-label">Alertes</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/profile')}>
              <span className="nav-icon">👤</span>
              <span className="nav-label">Profil</span>
            </button>
          </nav>

          {/* Related Incidents */}
          <div className="related-incidents">
            <div className="nav-section-label">INCIDENTS PROCHES</div>
            {relatedIncidents.map(rel => (
              <button 
                key={rel.id} 
                className="related-item"
                onClick={() => navigate(`/incident/${rel.id}`)}
              >
                <span 
                  className="related-severity-dot" 
                  style={{ background: getSeverityColor(rel.severity) }}
                ></span>
                <span className="related-title">{rel.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ========== CENTER COLUMN — INCIDENT CORE ========== */}
        <main className="incident-main">
          {/* 1️⃣ Incident Header Block */}
          <div className="incident-header-block">
            <div className="incident-type-badge">
              <span className="type-icon">{incident.typeIcon}</span>
              <span className="type-label">{incident.typeLabel}</span>
            </div>
            <h1 className="incident-title">{incident.title}</h1>
            <div className="incident-meta-row">
              <span className="meta-time">🕐 {incident.timeAgo}</span>
              <span className="meta-separator">•</span>
              <span className="meta-location">📍 {incident.location.city}, {incident.location.road}</span>
              <span className="meta-separator">•</span>
              {incident.verified ? (
                <span className="meta-verified verified">✓ Vérifié</span>
              ) : (
                <span className="meta-verified pending">⏳ En attente</span>
              )}
            </div>
          </div>

          {/* ═══ SEVERITY & TRUST BLOCK ═══ */}
          {/* Visual severity indicator + trust signals (user count, authority, AI score) */}
          <div className="severity-trust-block">
            <div 
              className="severity-indicator"
              style={{ 
                background: `${getSeverityColor(incident.severity)}15`,
                borderColor: getSeverityColor(incident.severity)
              }}
            >
              <span 
                className="severity-dot" 
                style={{ background: getSeverityColor(incident.severity) }}
              ></span>
              <span 
                className="severity-label"
                style={{ color: getSeverityColor(incident.severity) }}
              >
                {getSeverityLabel(incident.severity)}
              </span>
            </div>
            
            <div className="trust-indicators">
              <div className="trust-item">
                <span className="trust-icon">👥</span>
                <span className="trust-text">Vérifié par {incident.verificationCount} utilisateurs</span>
              </div>
              {incident.authorityConfirmed && (
                <div className="trust-item authority">
                  <span className="trust-icon">🏛️</span>
                  <span className="trust-text">Confirmé par les autorités</span>
                </div>
              )}
              <div className="trust-item ai">
                <span className="trust-icon">🤖</span>
                <span className="trust-text">Confiance IA: {incident.aiConfidence}%</span>
              </div>
            </div>
          </div>

          {/* ═══ INCIDENT DESCRIPTION ═══ */}
          {/* Expandable multi-paragraph description with show more/less toggle */}
          <div className="incident-description">
            <h2 className="section-title">Description</h2>
            <div className={`description-text ${showFullDescription ? 'expanded' : ''}`}>
              {showFullDescription 
                ? incident.description 
                : incident.description.split('\n\n')[0]
              }
            </div>
            {incident.description.split('\n\n').length > 1 && (
              <button 
                className="show-more-btn"
                onClick={() => setShowFullDescription(!showFullDescription)}
              >
                {showFullDescription ? 'Voir moins' : 'Voir plus'}
              </button>
            )}
          </div>

          {/* ═══ MEDIA GALLERY ═══ */}
          {/* Conditionally rendered grid of photos/videos attached to the incident */}
          {incident.media && incident.media.length > 0 && (
            <div className="incident-media">
              <h2 className="section-title">Photos & Médias</h2>
              <div className="media-grid">
                {incident.media.map((media, index) => (
                  <div key={index} className="media-item">
                    <div className="media-placeholder">
                      <span>📷</span>
                      <span className="media-caption">{media.caption}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ TIMELINE / UPDATES ═══ */}
          {/* Chronological list of events: citizen reports, system verifications, authority dispatches */}
          <div className="incident-timeline">
            <h2 className="section-title">Chronologie</h2>
            <div className="timeline-list">
              {incident.timeline.map((event, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker">
                    <span className="timeline-icon">{getSourceIcon(event.source)}</span>
                    {index < incident.timeline.length - 1 && <div className="timeline-line"></div>}
                  </div>
                  <div className="timeline-content">
                    <span className="timeline-time">{event.time}</span>
                    <span className="timeline-text">{event.text}</span>
                    <span className={`timeline-source ${event.source}`}>
                      {event.source === 'user' ? 'Citoyen' : 
                       event.source === 'authority' ? 'Autorité' : 'Système'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ COMMUNITY SIGNALS ═══ */}
          {/* Aggregated citizen confirmations, comment count, and a confirm action button */}
          <div className="community-signals">
            <h2 className="section-title">Signaux communautaires</h2>
            <div className="signals-row">
              <div className="signal-item">
                <span className="signal-count">{incident.confirmations}</span>
                <span className="signal-label">Confirmations</span>
              </div>
              <div className="signal-item">
                <span className="signal-count">{incident.comments}</span>
                <span className="signal-label">Commentaires</span>
              </div>
              <button className="signal-action-btn">
                ✋ Je confirme
              </button>
            </div>
          </div>
        </main>

        {/* ========== RIGHT COLUMN — CONTEXT & ACTIONS ========== */}
        <aside className="incident-sidebar-right">
          {/* ═══ MINI MAP ═══ */}
          {/* Placeholder map with severity-coloured pin; links to the full map page */}
          <div className="context-card mini-map-card">
            <h3 className="context-title">Localisation</h3>
            <div className="mini-map-container">
              <div className="mini-map-placeholder">
                <span className="map-icon">🗺️</span>
                <span 
                  className="map-marker"
                  style={{ background: getSeverityColor(incident.severity) }}
                >📍</span>
              </div>
            </div>
            <div className="map-location-text">
              <span className="location-city">{incident.location.city}</span>
              <span className="location-road">{incident.location.road}</span>
            </div>
            <button className="open-map-btn" onClick={() => navigate('/map')}>
              Ouvrir la carte complète
            </button>
          </div>

          {/* ═══ SAFETY & RECOMMENDATIONS ═══ */}
          {/* Estimated delay, avoidance warning, and a list of alternative routes */}
          <div className="context-card safety-card">
            <h3 className="context-title">Recommandations</h3>
            <div className="safety-alert">
              <span className="safety-icon">⚠️</span>
              <span className="safety-text">Évitez cette zone</span>
            </div>
            <div className="delay-estimate">
              <span className="delay-icon">⏱️</span>
              <span className="delay-text">Retard estimé: <strong>{incident.estimatedDelay}</strong></span>
            </div>
            <div className="alternative-routes">
              <span className="alt-label">Routes alternatives:</span>
              <ul className="alt-list">
                {incident.alternativeRoutes.map((route, index) => (
                  <li key={index} className="alt-item">
                    <span className="alt-arrow">→</span>
                    {route}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ═══ ALERTS & FOLLOW ACTIONS ═══ */}
          {/* Follow toggle, zone-alert creation, and update-reporting buttons */}
          <div className="context-card actions-card">
            <h3 className="context-title">Actions</h3>
            <button 
              className={`action-btn follow-btn ${isFollowing ? 'following' : ''}`}
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? '✓ Suivi actif' : '🔔 Suivre cet incident'}
            </button>
            <button className="action-btn alert-btn">
              📍 Créer une alerte zone
            </button>
            <button className="action-btn report-btn">
              📝 Signaler une mise à jour
            </button>
          </div>

          {/* ═══ INCIDENT METADATA ═══ */}
          {/* Technical details: ID, source count, category tags, last update timestamp */}
          <div className="context-card metadata-card">
            <h3 className="context-title">Métadonnées</h3>
            <div className="metadata-list">
              <div className="metadata-item">
                <span className="metadata-label">ID Incident</span>
                <span className="metadata-value">#{incident.id}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Sources</span>
                <span className="metadata-value">{incident.sourceCount} rapports</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Catégories</span>
                <div className="metadata-tags">
                  {incident.tags.map((tag, index) => (
                    <span key={index} className="metadata-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Dernière MAJ</span>
                <span className="metadata-value">{incident.lastUpdated}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
