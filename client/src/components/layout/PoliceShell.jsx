import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from './PoliceModeTab'
import 'leaflet/dist/leaflet.css'
import '../../styles/DashboardPage.css'
import '../../styles/PoliceMode.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

function getUserInitials(name) {
  const normalized = String(name || 'Officer').trim()
  if (!normalized) return 'O'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export default function PoliceShell({
  activeKey,
  children,
  rightPanel,
  notificationCount = 0,
  emergencyMode = false,
  verificationPendingCount = 0,
}) {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)

  const menuGroups = useMemo(() => [
    {
      title: 'OPERATIONS',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '🏛️', path: '/police' },
        { key: 'active-incidents', label: 'Active Incidents', icon: '🔴', path: '/police?view=active' },
        {
          key: 'verification-queue',
          label: 'Verification Queue',
          icon: '🟡',
          path: '/police/verification',
          badge: verificationPendingCount,
        },
        { key: 'my-incidents', label: 'My Incidents', icon: '👮', path: '/police?view=mine' },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { key: 'analytics', label: 'AI Insights', icon: '🧠', path: '/police/insights' },
      ],
    },
  ], [verificationPendingCount])

  const visibleMenuGroups = useMemo(
    () => menuGroups.filter((group) => Array.isArray(group.items) && group.items.length > 0),
    [menuGroups],
  )

  const profileInitials = getUserInitials(user?.name)

  return (
    <div className={`police-root ${emergencyMode ? 'police-root-emergency' : ''}`}>
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/police')} role="button" tabIndex={0}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs police-switch-anchor" aria-label="Police mode switch">
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Feed</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Map</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Alerts</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Report</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Dashboard</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Predictions</button>
              <PoliceModeTab user={user} basicLabel="Switch to Normal Mode" />
            </nav>
          </div>

          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Search for an incident, a road, a zone..."
              aria-label="Search"
            />
          </div>

          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              🔔
              {notificationCount > 0 ? <span className="notification-badge"></span> : null}
            </button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{profileInitials}</button>
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

      <div className="police-layout">
        <aside className="police-sidebar">
          <nav className="police-menu">
            {visibleMenuGroups.map((group) => (
              <section key={group.title} className="police-menu-group">
                <h3 className="police-menu-group-title">{group.title}</h3>
                <div className="police-menu-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      className={`police-menu-btn ${activeKey === item.key ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                    >
                      <span className="police-menu-icon" aria-hidden="true">{item.icon}</span>
                      <span className="police-menu-label">{item.label}</span>
                      {item.badge > 0 ? <span className="police-menu-badge">{item.badge}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <main className="police-center">
          {children}
        </main>

        <aside className="police-right">
          {rightPanel}
        </aside>
      </div>
    </div>
  )
}
