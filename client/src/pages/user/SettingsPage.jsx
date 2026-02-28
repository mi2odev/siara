/**
 * @file SettingsPage.jsx
 * @description Multi-section user settings page with a 2-column layout:
 *   Left  — Vertical navigation list (Profile, Account, Security, Notifications, Privacy, Data)
 *   Right — Content panel that renders one section at a time via conditional rendering.
 *
 * Features:
 *   - Inline editing with save feedback animation ("Saved ✓" badge)
 *   - Toggle switches for notification preferences
 *   - Radio-button groups for privacy controls
 *   - 2FA enable/disable toggle
 *   - Expandable "Delete Account" confirmation with typed-input safeguard
 *
 * All state is local (no backend calls); this serves as a UI prototype.
 *
 * Dependencies: react-router-dom
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/DashboardPage.css'
import '../../styles/SettingsPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

/** Sidebar navigation items — each key maps to a conditionally rendered <section> below */
const sections = [
  { key: 'profile', label: 'Profile' },
  { key: 'account', label: 'Account' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'data', label: 'Data' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')   // currently visible settings section
  const [showDropdown, setShowDropdown] = useState(false)          // header user-menu dropdown

  /* ---- Inline edit state ---- */
  /** profileData holds the editable user fields displayed in Profile & Account sections */
  const [profileData, setProfileData] = useState({
    name: 'Sofiane Ahmed',
    bio: 'Contributeur actif pour une route plus sûre en Algérie 🇩🇿',
    location: 'Alger, Algérie',
    email: 'sofiane.ahmed@email.com',
    phone: '+213 555 123 456',
    language: 'Français',
  })
  const [editing, setEditing] = useState(null)  // field key currently being edited (or null)
  const [saved, setSaved] = useState(null)       // field key that just saved (shows "Saved ✓" badge briefly)

  /** Enter inline-edit mode for a given profile field */
  const handleEdit = (field) => setEditing(field)
  /** Commit an inline edit, persist to state, and trigger the "Saved" animation */
  const handleSave = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
    setEditing(null)
    setSaved(field)
    setTimeout(() => setSaved(null), 1800)
  }

  /* ---- Notification toggle state ---- */
  /** Boolean map of notification preference toggles */
  const [notifs, setNotifs] = useState({
    emailNearby: true,       // incidents near the user
    emailSevere: false,      // high-severity only emails
    emailDigest: true,       // weekly summary email
    pushRealtime: true,      // real-time push alerts
    pushPredictions: false,  // AI prediction push alerts
  })
  /** Flip one notification toggle by key */
  const toggleNotif = (key) => setNotifs(prev => ({ ...prev, [key]: !prev[key] }))

  /* ---- Privacy radio-button state ---- */
  /** Controls for three independent privacy dimensions */
  const [privacy, setPrivacy] = useState({
    visibility: 'public',    // profile visibility: 'public' | 'private'
    identity: 'show',        // report identity: 'show' | 'anonymous'
    location: 'reporting',   // location sharing: 'always' | 'reporting' | 'never'
  })

  /* ---- Security state ---- */
  const [twoFA, setTwoFA] = useState(true)  // whether 2FA is currently enabled

  /* ---- Delete-account confirmation ---- */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)  // expandable danger zone

  return (
    <div className="settings-root">
      {/* ═══ HEADER — shared dashboard header (same as other pages) ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
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
            <input type="search" className="dash-search" placeholder="Rechercher un incident, une route, une wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 Mon profil</button>
                  <button className="dropdown-item active" onClick={() => setShowDropdown(false)}>⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ SETTINGS LAYOUT — 2-column (sidebar nav + content panel) ═══ */}
      <div className="settings-layout">

        {/* ═══ LEFT NAV — vertical section list ═══ */}
        <nav className="settings-nav">
          <h2 className="settings-nav-title">Settings</h2>
          {sections.map(s => (
            <button
              key={s.key}
              className={`settings-nav-item${activeSection === s.key ? ' active' : ''}`}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ═══ RIGHT CONTENT PANEL — conditionally renders one section at a time ═══ */}
        <main className="settings-panel">

          {/* ═══════ PROFILE SECTION ═══════ */}
          {/* Editable rows for name, bio, location + profile photo placeholder */}
          {activeSection === 'profile' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Profile</h3>

              {/* Photo row */}
              <div className="settings-row">
                <span className="settings-label">Profile Photo</span>
                <span className="settings-value">
                  <span className="settings-avatar">SA</span>
                </span>
                <button className="settings-action">Change</button>
              </div>

              {/* Editable rows */}
              {[
                { key: 'name', label: 'Name' },
                { key: 'bio', label: 'Bio' },
                { key: 'location', label: 'Location' },
              ].map(({ key, label }) => (
                <div className="settings-row" key={key}>
                  <span className="settings-label">{label}</span>
                  {editing === key ? (
                    <input
                      className="settings-inline-input"
                      autoFocus
                      defaultValue={profileData[key]}
                      onBlur={(e) => handleSave(key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(key, e.target.value)}
                    />
                  ) : (
                    <span className="settings-value">{profileData[key]}</span>
                  )}
                  {saved === key ? (
                    <span className="settings-saved">Saved ✓</span>
                  ) : editing !== key ? (
                    <button className="settings-action" onClick={() => handleEdit(key)}>Edit</button>
                  ) : null}
                </div>
              ))}
            </section>
          )}

          {/* ═══════ ACCOUNT SECTION ═══════ */}
          {/* Editable rows for email, phone, language + read-only member-since */}
          {activeSection === 'account' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Account</h3>

              {[
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'language', label: 'Language' },
              ].map(({ key, label }) => (
                <div className="settings-row" key={key}>
                  <span className="settings-label">{label}</span>
                  {editing === key ? (
                    <input
                      className="settings-inline-input"
                      autoFocus
                      defaultValue={profileData[key]}
                      onBlur={(e) => handleSave(key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(key, e.target.value)}
                    />
                  ) : (
                    <span className="settings-value">{profileData[key]}</span>
                  )}
                  {saved === key ? (
                    <span className="settings-saved">Saved ✓</span>
                  ) : editing !== key ? (
                    <button className="settings-action" onClick={() => handleEdit(key)}>Edit</button>
                  ) : null}
                </div>
              ))}

              <div className="settings-row">
                <span className="settings-label">Member since</span>
                <span className="settings-value settings-muted">January 2025</span>
              </div>
            </section>
          )}

          {/* ═══════ SECURITY SECTION ═══════ */}
          {/* Password change, 2FA toggle, active sessions */}
          {activeSection === 'security' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Security</h3>

              <div className="settings-row">
                <span className="settings-label">Password</span>
                <span className="settings-value settings-muted">Last changed 2 months ago</span>
                <button className="settings-action">Change</button>
              </div>

              <div className="settings-row">
                <span className="settings-label">Two-Factor Authentication</span>
                <span className="settings-value">
                  <span className={`settings-status ${twoFA ? 'on' : 'off'}`}>{twoFA ? 'Enabled' : 'Disabled'}</span>
                </span>
                <button className="settings-action" onClick={() => setTwoFA(!twoFA)}>{twoFA ? 'Disable' : 'Enable'}</button>
              </div>

              <div className="settings-row">
                <span className="settings-label">Active Sessions</span>
                <span className="settings-value settings-muted">3 devices</span>
                <button className="settings-action">View</button>
              </div>
            </section>
          )}

          {/* ═══════ NOTIFICATIONS SECTION ═══════ */}
          {/* Toggle switches grouped by channel: email & push notifications */}
          {activeSection === 'notifications' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Notifications</h3>

              <div className="settings-group">
                <h4 className="settings-group-label">Email Notifications</h4>
                {[
                  { key: 'emailNearby', label: 'Incident nearby' },
                  { key: 'emailSevere', label: 'High severity only' },
                  { key: 'emailDigest', label: 'Weekly digest' },
                ].map(({ key, label }) => (
                  <label className="settings-toggle-row" key={key}>
                    <span className="settings-toggle-label">{label}</span>
                    <button
                      className={`settings-toggle ${notifs[key] ? 'on' : 'off'}`}
                      onClick={() => toggleNotif(key)}
                      role="switch"
                      aria-checked={notifs[key]}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Push Notifications</h4>
                {[
                  { key: 'pushRealtime', label: 'Real-time alerts' },
                  { key: 'pushPredictions', label: 'AI predictions' },
                ].map(({ key, label }) => (
                  <label className="settings-toggle-row" key={key}>
                    <span className="settings-toggle-label">{label}</span>
                    <button
                      className={`settings-toggle ${notifs[key] ? 'on' : 'off'}`}
                      onClick={() => toggleNotif(key)}
                      role="switch"
                      aria-checked={notifs[key]}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ PRIVACY SECTION ═══════ */}
          {/* Radio-button groups for profile visibility, report identity, location sharing */}
          {activeSection === 'privacy' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Privacy</h3>

              <div className="settings-group">
                <h4 className="settings-group-label">Profile Visibility</h4>
                {['public', 'private'].map(v => (
                  <label className="settings-radio-row" key={v}>
                    <input
                      type="radio"
                      name="visibility"
                      checked={privacy.visibility === v}
                      onChange={() => setPrivacy(p => ({ ...p, visibility: v }))}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{v === 'public' ? 'Public' : 'Private'}</span>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Report Identity</h4>
                {[
                  { value: 'show', label: 'Show name' },
                  { value: 'anonymous', label: 'Anonymous' },
                ].map(({ value, label }) => (
                  <label className="settings-radio-row" key={value}>
                    <input
                      type="radio"
                      name="identity"
                      checked={privacy.identity === value}
                      onChange={() => setPrivacy(p => ({ ...p, identity: value }))}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{label}</span>
                  </label>
                ))}
              </div>

              <div className="settings-group">
                <h4 className="settings-group-label">Location Sharing</h4>
                <p className="settings-group-hint">Control when your location is shared with the platform.</p>
                {[
                  { value: 'always', label: 'Always' },
                  { value: 'reporting', label: 'Only when reporting' },
                  { value: 'never', label: 'Never' },
                ].map(({ value, label }) => (
                  <label className="settings-radio-row" key={value}>
                    <input
                      type="radio"
                      name="location"
                      checked={privacy.location === value}
                      onChange={() => setPrivacy(p => ({ ...p, location: value }))}
                      className="settings-radio"
                    />
                    <span className="settings-radio-label">{label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ═══════ DATA MANAGEMENT SECTION ═══════ */}
          {/* Export data, clear history, and expandable delete-account danger zone */}
          {activeSection === 'data' && (
            <section className="settings-section">
              <h3 className="settings-section-title">Data</h3>

              <div className="settings-row">
                <span className="settings-label">Export My Data</span>
                <span className="settings-value settings-muted">Download all your data as JSON</span>
                <button className="settings-action">Export</button>
              </div>

              <div className="settings-row">
                <span className="settings-label">Clear History</span>
                <span className="settings-value settings-muted">Remove all search & browsing history</span>
                <button className="settings-action settings-action-warn">Clear</button>
              </div>

              {/* DELETE ACCOUNT — expandable danger zone with typed confirmation */}
              <div className="settings-danger-zone">
                <h4 className="settings-danger-title">Delete Account</h4>
                <p className="settings-danger-text">This action is permanent. All your data, reports, and contributions will be removed and cannot be recovered.</p>
                {!showDeleteConfirm ? (
                  <button className="settings-btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
                ) : (
                  <div className="settings-confirm-block">
                    <p className="settings-confirm-text">Are you sure? Type <strong>DELETE</strong> to confirm.</p>
                    <div className="settings-confirm-actions">
                      <input className="settings-confirm-input" placeholder="Type DELETE" />
                      <button className="settings-btn-danger">Confirm Delete</button>
                      <button className="settings-btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

        </main>
      </div>
    </div>
  )
}
