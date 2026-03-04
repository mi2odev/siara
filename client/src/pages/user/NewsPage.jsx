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
import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
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
  const { user, logout } = useContext(AuthContext)

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
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Search for an incident, a road, a wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
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
              <span className="role-badge role-citoyen">Citizen</span>
              <p className="profile-bio">Active contributor for safer roads in Algeria 🇩🇿</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* Navigation — main pages, tools, and settings links */}
          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/home')}><span className="nav-accent"></span><span className="nav-icon">🏠</span><span className="nav-label">Home</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">News Feed</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">📄</span><span className="nav-label">My Reports</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Incident Map</span></button>
            
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Driver Quiz</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Statistics</span></button>
            <button className="nav-item"><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alerts</span></button>
            
            <div className="nav-section-label">SETTINGS</div>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Settings</span></button>
          </nav>

          {/* Smart Filters — collapsible panel: date range, severity, type, wilaya */}
          <div className="card smart-filters">
            <div className="card-header"><h3 className="card-title">Smart Filters</h3><button className="collapse-btn" onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? '▾' : '▸'}</button></div>
            {filtersOpen && (
              <>
                <div className="filter-section"><label className="filter-label">Date range</label><select className="filter-select"><option>Today</option><option>This week</option></select></div>
                <div className="filter-section"><label className="filter-label">Severity</label><div className="filter-pills"><button className="severity-pill severity-low">Low</button><button className="severity-pill severity-medium">Medium</button><button className="severity-pill severity-high">High</button></div></div>
                <div className="filter-section"><label className="filter-label">Type</label><select className="filter-select"><option>All</option><option>Collision</option><option>Danger</option></select></div>
                <div className="filter-section"><label className="filter-label">Province</label><select className="filter-select"><option>All</option><option>Algiers</option><option>Oran</option></select></div>
              </>
            )}
          </div>

          {/* Saved Filters — quick presets the user has bookmarked */}
          <div className="card saved-filters">
            <h3 className="card-title">Saved Filters</h3>
            <div className="saved-filter-item">Algiers Rush Hours</div>
            <div className="saved-filter-item">School Zones</div>
            <div className="saved-filter-item">Rain + Low Visibility</div>
          </div>
        </aside>

        {/* ═══ CENTER FEED ═══ */}
        <main className="feed-center">
          {/* Real-time Indicator — clickable banner showing new reports count */}
          <button className="realtime-indicator">3 new reports — Click to show</button>

          {/* Composer — quick-post widget with category presets, media tools, and auto-draft */}
          <div className="card composer">
            <div className="composer-categories">
              <button className="category-preset" onClick={() => navigate('/report')}>🚗 Accident</button>
              <button className="category-preset" onClick={() => navigate('/report')}>🔥 Danger</button>
              <button className="category-preset" onClick={() => navigate('/report')}>🌧️ Rain</button>
              <button className="category-preset" onClick={() => navigate('/report')}>👮 Road Check</button>
            </div>
            <div className="composer-top"><div className="composer-avatar">SA</div><button className="composer-input-fake" onClick={() => navigate('/report')}>Minor accident, slowdown on the East-West highway...</button></div>
            <textarea className="composer-textarea" placeholder="Describe the incident in detail: exact location, conditions, severity level..."></textarea>
            <div className="composer-actions">
              <div className="composer-tools">
                <button className="composer-tool">📸 Photo</button>
                <button className="composer-tool">🎥 Video</button>
                <button className="composer-tool">📍 Location</button>
                <button className="composer-tool">🛈 Severity</button>
                <button className="composer-tool"># Tags</button>
              </div>
              <button className="btn-publier" onClick={() => navigate('/report')}>Publish</button>
            </div>
            <div className="composer-draft-indicator">✔ Draft saved automatically</div>
          </div>

          {/* Sticky Feed Tabs — filter feed view + sort selector */}
          <div className="feed-tabs-sticky">
            <div className="feed-tabs">
              <button className="feed-tab feed-tab-active">Latest</button>
              <button className="feed-tab">Nearby</button>
              <button className="feed-tab">Verified</button>
              <button className="feed-tab">Following</button>
            </div>
            <div className="feed-sort"><label>Sort by:</label><select className="feed-sort-select"><option>Most recent</option><option>Severity</option></select></div>
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
                    <span className="badge badge-verified">✔️ Verified</span>
                    <span className="badge badge-police">Police</span>
                  </div>
                  <div className="post-meta-row"><span className="post-time">10 min ago</span><span className="post-dot">•</span><span className="post-location">📍 Algiers — Bab Ezzouar</span></div>
                </div>
              </div>
              <div className="post-header-right">
                <span className="severity-pill severity-high small">High Severity</span>
                <button className="post-options-btn">•••</button>
              </div>
            </header>
            <div className="post-body">
              <p className="post-text clamp-lines">3-vehicle pileup on the eastern highway, just before the Bab Ezzouar exit. Major slowdown in both directions, reduced visibility due to rain.</p>
              <button className="post-see-more">See more</button>
              <div className="post-tags"><span className="post-tag">#collision</span><span className="post-tag">#rain</span><span className="post-tag">#traffic</span></div>
              <div className="post-media-grid grid-3"><div className="media-item"></div><div className="media-item"></div><div className="media-item media-more">+3</div></div>
              <button className="post-map-preview">🗺 View on map</button>
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
                <button className="post-stat-btn">↗️ Share</button>
                <button className="post-stat-btn">👁️ 2.3k views</button>
              </div>
            </footer>
            <div className="post-comments-preview"><div className="comment-box"><strong>R. B.</strong> Thanks for the info, taking another route.</div></div>
          </article>

          <article className="card post-card">
            <header className="post-header">
              <div className="post-header-left">
                <div className="post-avatar">HM</div>
                <div>
                  <div className="post-author-row"><span className="post-author hoverable-name">Hakim Meziane</span><span className="badge badge-citoyen">Citizen</span></div>
                  <div className="post-meta-row"><span className="post-time">45 min ago</span><span className="post-dot">•</span><span className="post-location">📍 Oran — Es-Sénia</span></div>
                </div>
              </div>
              <div className="post-header-right">
                <span className="severity-pill severity-medium small">Medium Severity</span>
                <button className="post-options-btn">•••</button>
              </div>
            </header>
            <div className="post-body">
              <p className="post-text">Traffic light out of order at the main intersection, traffic very disorganized.</p>
              <div className="post-tags"><span className="post-tag">#light</span><span className="post-tag">#danger</span></div>
              <button className="post-map-preview">🗺 View on map</button>
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
                <button className="post-stat-btn">↗️ Share</button>
                <button className="post-stat-btn">👁️ 780 views</button>
              </div>
            </footer>
          </article>
        </main>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <aside className="sidebar-right">
          {/* Mini Map Widget — Google Map with severity-coloured markers + legend */}
          <div className="card widget-map">
            <div className="map-widget-header">
              <h3 className="widget-title">Incidents Near You</h3>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f0f0f0' }}>Loading map…</div>
              )}
            </div>
            <button className="btn-open-map" onClick={() => navigate('/map')}>Open Full Map</button>
          </div>

          {/* Trending Incidents — top 3 most-discussed incidents with severity pills */}
          <div className="card widget-trending">
            <h3 className="widget-title">Trending Incidents</h3>
            <div className="trending-item">
              <span className="severity-pill severity-high small">High</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">Boulevard Zirout Youcef</p>
                  <span className="trending-icon">🚗</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">15 min ago</span>
              </div>
            </div>
            <div className="trending-item">
              <span className="severity-pill severity-medium small">Medium</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">RN11 – Industrial Zone</p>
                  <span className="trending-icon">⚠️</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">40 min ago</span>
              </div>
            </div>
            <div className="trending-item">
              <span className="severity-pill severity-low small">Low</span>
              <div className="trending-info">
                <div className="trending-header">
                  <p className="trending-location">University District</p>
                  <span className="trending-icon">🚧</span>
                </div>
                <div className="trending-bar"></div>
                <span className="trending-time">1 hour ago</span>
              </div>
            </div>
            <button className="widget-see-more">See more</button>
          </div>

          {/* Priority Alerts — weather and safety warnings */}
          <div className="card widget-alerts">
            <h3 className="widget-title">Priority Alerts</h3>
            <div className="alert-item">• Heavy rain expected in the center</div>
            <div className="alert-item">• Morning fog East-West</div>
            <div className="alert-item">• Night roadworks Province 16</div>
            <button className="btn-activate-alerts">Enable Alerts</button>
          </div>

          {/* Quick Actions — shortcut buttons for common tasks */}
          <div className="card widget-quick-actions">
            <h3 className="widget-title">Quick Actions</h3>
            <button className="quick-action-btn">➕ Add a Report</button>
            <button className="quick-action-btn">📤 Export Data</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
