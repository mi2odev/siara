import React, { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from './PoliceModeTab'
import 'leaflet/dist/leaflet.css'
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

export default function PoliceShell({ activeKey, children, rightPanel, notificationCount = 0, emergencyMode = false }) {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)

  const menuGroups = useMemo(() => [
    {
      title: 'OPERATIONS',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '🏛️', path: '/police' },
        { key: 'active-incidents', label: 'Active Incidents', icon: '🔴', path: '/police?view=active' },
        { key: 'verification-queue', label: 'Verification Queue', icon: '🟡', path: '/police/verification' },
      ],
    },
    {
      title: 'CONTROL',
      items: [
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { key: 'analytics', label: 'AI Insights', icon: '🧠', path: '/police?view=insights' },
      ],
    },
  ], [])

  const visibleMenuGroups = useMemo(
    () => menuGroups.filter((group) => Array.isArray(group.items) && group.items.length > 0),
    [menuGroups],
  )

  const profileInitials = getUserInitials(user?.name)

  return (
    <div className={`police-root ${emergencyMode ? 'police-root-emergency' : ''}`}>
      <header className="police-header">
        <div className="police-header-left" onClick={() => navigate('/police')} role="button" tabIndex={0}>
          <img src={siaraLogo} alt="SIARA" className="police-header-logo" />
          <div className="police-header-brand-copy">
            <span className="police-header-kicker">SIARA Command Center</span>
            <strong>Police Operations Dashboard</strong>
          </div>
        </div>

        <div className="police-header-center">
          <PoliceModeTab
            user={user}
            className="police-mode-toggle"
            policeLabel="Switch to Police Mode"
            basicLabel="Police Mode Active · Switch to Basic Mode"
            basicPath="/dashboard"
          />
        </div>

        <div className="police-header-right">
          <div className="police-live-status" aria-label="Live Status">
            <span className="police-live-dot">●</span>
            <span>System Active</span>
            <strong>{notificationCount} Critical incidents</strong>
          </div>
          <button className="police-header-notif" aria-label="Notifications" onClick={() => navigate('/notifications')}>
            🔔
            {notificationCount > 0 ? <span className="police-header-notif-badge">{notificationCount}</span> : null}
          </button>
          <div className="police-header-avatar-wrapper">
            <button className="police-header-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{profileInitials}</button>
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
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <main className="police-center">
          <div className="police-topbar">
            <input className="police-search" placeholder="Search incidents..." aria-label="Search incidents" />
            <button className="police-icon-btn" onClick={() => navigate('/notifications')}>
              🔔 Alerts
            </button>
            <button className="police-icon-btn" onClick={() => navigate('/profile')}>
              👮 {user?.name || 'Officer'}
            </button>
            <div className="police-quick-wrap">
              <button
                className="police-quick-btn"
                onClick={() => setShowQuickActions((prev) => !prev)}
                aria-expanded={showQuickActions}
                aria-haspopup="menu"
              >
                + Quick Action
              </button>
              {showQuickActions ? (
                <div className="police-quick-menu" role="menu" aria-label="Quick actions">
                  <button role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/police') }}>Create Alert</button>
                  <button role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/police/verification') }}>Assign Patrol</button>
                  <button role="menuitem" onClick={() => { setShowQuickActions(false); navigate('/police') }}>View Critical Zones</button>
                </div>
              ) : null}
            </div>
          </div>
          {children}
        </main>

        <aside className="police-right">
          {rightPanel}
        </aside>
      </div>
    </div>
  )
}
