/**
 * @file NewsPage.jsx
 * @description Social-feed page for browsing and publishing road incident reports.
 *
 * Layout — 3-column design:
 *   Left   : user profile summary, main/tool/settings navigation, smart filters, saved filters
 *   Center : real-time indicator, incident composer widget, sticky feed tabs,
 *            and post cards with reactions / comments / shares
 *   Right  : live Google Maps sidebar with severity-coloured markers, trending incidents,
 *            priority alerts, and quick-action buttons
 *
 * Features:
 *   • Google Maps API integration via @react-google-maps/api (severity-coloured circle markers)
 *   • DrivingQuiz pop-up accessible from the left sidebar
 *   • Composer widget with category presets, media tools, and auto-draft indicator
 *   • Post cards with emoji reactions, share/view counts, and inline comment previews
 *   • Trending incidents list and priority weather/alert widgets in right sidebar
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ═══ MOCK MAP MARKERS ═══ */
/** Nearby incidents rendered as coloured circles on the Google Map sidebar */
const nearbyIncidents = [
  { id: 1, lat: 36.7525, lng: 3.04197, severity: 'high', label: 'Accident' },
  { id: 2, lat: 36.7580, lng: 3.05000, severity: 'medium', label: 'Danger' },
  { id: 3, lat: 36.7460, lng: 3.03500, severity: 'low', label: 'Normal' },
]

/**
 * Build a severity-coloured Google Maps circle marker icon.
 * Requires window.google.maps to be loaded (guarded by useLoadScript).
 */
function getMarkerIcon(severity) {
  const color = severity === 'high' ? '#ff3b30' : severity === 'medium' ? '#ff9500' : '#34c759'
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    scale: 7,
    strokeWeight: 2,
    strokeColor: '#ffffff',
  }
}

export default function NewsPage() {
  const navigate = useNavigate()

  /* ═══ LOCAL UI STATE ═══ */
  const [showDropdown, setShowDropdown] = useState(false)   // header avatar dropdown
  const [filtersOpen, setFiltersOpen] = useState(true)       // left sidebar filter panel collapse
  const [showQuiz, setShowQuiz] = useState(false)            // DrivingQuiz modal visibility

  /** Load the Google Maps JS API using the env-provided key */
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY,
  })

  /** Called when the driving quiz finishes — logs result and closes modal */
  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  return (
    <div className="siara-news-root">
      {/* ═══ DRIVING QUIZ POPUP ═══ */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══ FLOATING HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab dash-tab-active">Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher un incident, une route, une wilaya…" aria-label="Search feed" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
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

      {/* ═══ MAIN LAYOUT - 3 Columns ═══ */}
      <div className="siara-news-layout">

        {/* ═══ LEFT SIDEBAR ═══ */}
        <aside className="sidebar-left">
          {/* Profile Summary — avatar, name, role, short bio */}
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">Sofiane Ahmed</p>
              <span className="role-badge role-citoyen">Citoyen</span>
              <p className="profile-bio">Contributeur actif pour une route plus sûre en Algérie 🇩🇿</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* Navigation — main pages, tools, and settings links */}
          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/home')}><span className="nav-accent"></span><span className="nav-icon">🏠</span><span className="nav-label">Accueil</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">Fil d'actualité</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">📄</span><span className="nav-label">Mes signalements</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Carte des incidents</span></button>
            
            <div className="nav-section-label">OUTILS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Quiz Conducteur</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Statistiques</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alertes</span></button>
            
            <div className="nav-section-label">PARAMÈTRES</div>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Paramètres</span></button>
          </nav>

          {/* Smart Filters — collapsible panel: date range, severity, type, wilaya */}
          <div className="card smart-filters">
            <div className="card-header"><h3 className="card-title">Filtres intelligents</h3><button className="collapse-btn" onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? '▾' : '▸'}</button></div>
            {filtersOpen && (
              <>
                <div className="filter-section"><label className="filter-label">Date range</label><select className="filter-select"><option>Aujourd'hui</option><option>Cette semaine</option></select></div>
                <div className="filter-section"><label className="filter-label">Gravité</label><div className="filter-pills"><button className="severity-pill severity-low">Low</button><button className="severity-pill severity-medium">Medium</button><button className="severity-pill severity-high">High</button></div></div>
                <div className="filter-section"><label className="filter-label">Type</label><select className="filter-select"><option>Tout</option><option>Collision</option><option>Danger</option></select></div>
                <div className="filter-section"><label className="filter-label">Wilaya</label><select className="filter-select"><option>Toutes</option><option>Alger</option><option>Oran</option></select></div>
              </>
            )}
          </div>

          {/* Saved Filters — quick presets the user has bookmarked */}
          <div className="card saved-filters">
            <h3 className="card-title">Filtres enregistrés</h3>
            <div className="saved-filter-item">Heures de pointe Alger</div>
            <div className="saved-filter-item">Zones scolaires</div>
            <div className="saved-filter-item">Pluie + visibilité faible</div>
          </div>
        </aside>

        {/* ═══ CENTER FEED ═══ */}
        <main className="feed-center">
          {/* Real-time Indicator — clickable banner showing new reports count */}
          <button className="realtime-indicator">3 nouveaux signalements — Cliquez pour afficher</button>

          {/* Composer — quick-post widget with category presets, media tools, and auto-draft */}
          <div className="card composer">
            <div className="composer-categories">
              <button className="category-preset" onClick={() => navigate('/report')}>🚗 Accident</button>
              <button className="category-preset" onClick={() => navigate('/report')}>🔥 Danger</button>
              <button className="category-preset" onClick={() => navigate('/report')}>🌧️ Pluie</button>
              <button className="category-preset" onClick={() => navigate('/report')}>👮 Contrôle routier</button>
            </div>
            <div className="composer-top"><div className="composer-avatar">SA</div><button className="composer-input-fake" onClick={() => navigate('/report')}>Accident léger, ralentissement sur l'autoroute Est-Ouest...</button></div>
            <textarea className="composer-textarea" placeholder="Décrivez l’incident en détail : lieu exact, conditions, niveau de gravité..."></textarea>
            <div className="composer-actions">
              <div className="composer-tools">
                <button className="composer-tool">📸 Photo</button>
                <button className="composer-tool">🎥 Vidéo</button>
                <button className="composer-tool">📍 Localisation</button>
                <button className="composer-tool">🛈 Gravité</button>
                <button className="composer-tool"># Tags</button>
              </div>
              <button className="btn-publier" onClick={() => navigate('/report')}>Publier</button>
            </div>
            <div className="composer-draft-indicator">✔ Brouillon enregistré automatiquement</div>
          </div>

          {/* Sticky Feed Tabs — filter feed view + sort selector */}
          <div className="feed-tabs-sticky">
            <div className="feed-tabs">
              <button className="feed-tab feed-tab-active">Derniers</button>
              <button className="feed-tab">À proximité</button>
              <button className="feed-tab">Vérifiés</button>
              <button className="feed-tab">Abonnements</button>
            </div>
            <div className="feed-sort"><label>Trier par:</label><select className="feed-sort-select"><option>Les + récents</option><option>Gravité</option></select></div>
          </div>

          {/* ═══ POST CARDS ═══ */}
          {/* Each post card: author header, severity badge, body text with tags/media,
              reaction bar, stats footer, and optional inline comment preview */}
          <article className="card post-card severity-high-indicator">
            <header className="post-header">
              <div className="post-header-left">
                <div className="post-avatar">AZ</div>
                <div>
                  <div className="post-author-row">
                    <span className="post-author hoverable-name">Amina Zerrouki</span>
                    <span className="badge badge-verified">✔️ Vérifié</span>
                    <span className="badge badge-police">Police</span>
                  </div>
                  <div className="post-meta-row"><span className="post-time">Il y a 10 min</span><span className="post-dot">•</span><span className="post-location">📍 Alger — Bab Ezzouar</span></div>
                </div>
              </div>
              <div className="post-header-right">
                <span className="severity-pill severity-high small">Gravité élevée</span>
                <button className="post-options-btn">•••</button>
              </div>
            </header>
            <div className="post-body">
              <p className="post-text clamp-lines">Carambolage impliquant 3 véhicules sur l'autoroute est, juste avant la sortie vers Bab Ezzouar. Fort ralentissement dans les deux sens, visibilité réduite à cause de la pluie.</p>
              <button className="post-see-more">Voir plus</button>
              <div className="post-tags"><span className="post-tag">#collision</span><span className="post-tag">#pluie</span><span className="post-tag">#trafic</span></div>
              <div className="post-media-grid grid-3"><div className="media-item"></div><div className="media-item"></div><div className="media-item media-more">+3</div></div>
              <button className="post-map-preview">🗺 Voir sur la carte</button>
            </div>
            <footer className="post-footer">
              <div className="post-reactions">
                <button className="reaction-btn">🚨 <span>12</span></button>
                <button className="reaction-btn">❤️ <span>45</span></button>
                <button className="reaction-btn">👁️ <span>8</span></button>
                <button className="reaction-btn">⚠️ <span>23</span></button>
              </div>
              <div className="post-stats">
                <button className="post-stat-btn">💬 18</button>
                <button className="post-stat-btn">↗️ Partager</button>
                <button className="post-stat-btn">👁️ 2,3k vues</button>
              </div>
            </footer>
            <div className="post-comments-preview"><div className="comment-box"><strong>R. B.</strong> Merci pour l'info, je prends un autre itinéraire.</div></div>
          </article>

          <article className="card post-card">
            <header className="post-header">
              <div className="post-header-left">
                <div className="post-avatar">HM</div>
                <div>
                  <div className="post-author-row"><span className="post-author hoverable-name">Hakim Meziane</span><span className="badge badge-citoyen">Citoyen</span></div>
                  <div className="post-meta-row"><span className="post-time">Il y a 45 min</span><span className="post-dot">•</span><span className="post-location">📍 Oran — Es-Sénia</span></div>
                </div>
              </div>
              <div className="post-header-right">
                <span className="severity-pill severity-medium small">Gravité moyenne</span>
                <button className="post-options-btn">•••</button>
              </div>
            </header>
            <div className="post-body">
              <p className="post-text">Feu tricolore en panne au grand carrefour, circulation très désorganisée.</p>
              <div className="post-tags"><span className="post-tag">#feu</span><span className="post-tag">#danger</span></div>
              <button className="post-map-preview">🗺 Voir sur la carte</button>
            </div>
            <footer className="post-footer">
              <div className="post-reactions">
                <button className="reaction-btn">🚨 <span>5</span></button>
                <button className="reaction-btn">❤️ <span>18</span></button>
                <button className="reaction-btn">👁️ <span>12</span></button>
                <button className="reaction-btn">⚠️ <span>9</span></button>
              </div>
              <div className="post-stats">
                <button className="post-stat-btn">💬 7</button>
                <button className="post-stat-btn">↗️ Partager</button>
                <button className="post-stat-btn">👁️ 780 vues</button>
              </div>
            </footer>
          </article>
        </main>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <aside className="sidebar-right">
          {/* Mini Map Widget — Google Map with severity-coloured markers + legend */}
          <div className="card widget-map">
            <div className="map-widget-header">
              <h3 className="widget-title">Incidents autour de vous</h3>
              <div className="map-legends">
                <span className="map-legend"><span className="legend-dot danger"></span>Danger</span>
                <span className="map-legend"><span className="legend-dot accident"></span>Accident</span>
                <span className="map-legend"><span className="legend-dot normal"></span>Normal</span>
              </div>
            </div>
            <div className="map-widget-container" style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden' }}>
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: 36.7525, lng: 3.04197 }}
                  zoom={13}
                  options={{ disableDefaultUI: true }}
                >
                  {nearbyIncidents.map((m) => (
                    <Marker
                      key={m.id}
                      position={{ lat: m.lat, lng: m.lng }}
                      icon={getMarkerIcon(m.severity)}
                    />
                  ))}
                </GoogleMap>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f0f0f0' }}>Chargement de la carte…</div>
              )}
            </div>
            <button className="btn-open-map" onClick={() => navigate('/map')}>Ouvrir la carte complète</button>
          </div>

          {/* Trending Incidents — top 3 most-discussed incidents with severity pills */}
          <div className="card widget-trending">
            <h3 className="widget-title">Incidents en tendance</h3>
            <div className="trending-item">
              <span className="severity-pill severity-high small">Élevée</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">Boulevard Zirout Youcef</p>
                  <span className="trending-icon">🚗</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">Il y a 15 min</span>
              </div>
            </div>
            <div className="trending-item">
              <span className="severity-pill severity-medium small">Moyenne</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">RN11 – Zone industrielle</p>
                  <span className="trending-icon">⚠️</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">Il y a 40 min</span>
              </div>
            </div>
            <div className="trending-item">
              <span className="severity-pill severity-low small">Faible</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">Quartier universitaire</p>
                  <span className="trending-icon">🚧</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">Il y a 1 h</span>
              </div>
            </div>
            <button className="widget-see-more">Voir plus</button>
          </div>

          {/* Priority Alerts — weather and safety warnings */}
          <div className="card widget-alerts">
            <h3 className="widget-title">Alertes prioritaires</h3>
            <div className="alert-item">• Pluie forte attendue dans le centre</div>
            <div className="alert-item">• Brouillard matinal Est-Ouest</div>
            <div className="alert-item">• Travaux nocturnes Wilaya 16</div>
            <button className="btn-activate-alerts">Activer les alertes</button>
          </div>

          {/* Quick Actions — shortcut buttons for common tasks */}
          <div className="card widget-quick-actions">
            <h3 className="widget-title">Actions rapides</h3>
            <button className="quick-action-btn">➕ Ajouter un signalement</button>
            <button className="quick-action-btn">📤 Exporter données</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
