import React, { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'

const routeNames = {
  '/admin/overview': 'System Overview',
  '/admin/incidents': 'Incident Management',
  '/admin/alerts': 'Alert Operations',
  '/admin/zones': 'Risk & Zones',
  '/admin/ai': 'AI Supervision',
  '/admin/users': 'User Governance',
  '/admin/analytics': 'Analytics',
  '/admin/system': 'Configuration',
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'A'
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
  return (first + last).toUpperCase() || 'A'
}

function primaryRoleLabel(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'Admin'
  const normalized = roles.map((role) => String(role).toLowerCase())
  if (normalized.includes('admin') || normalized.includes('super_admin') || normalized.includes('super admin')) {
    return 'Super Admin'
  }
  if (normalized.includes('supervisor')) return 'Supervisor'
  if (normalized.some((r) => r.startsWith('police'))) return 'Police'
  return roles[0]
}

export default function AdminHeader({ mobileNavOpen = false, onToggleMobileNav }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useContext(AuthContext)

  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/')
  const pageName = routeNames[basePath] || 'Admin'
  const isDetailPage = location.pathname.split('/').length > 3

  const profileName = user?.name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.email
    || 'Admin'
  const profileInitials = initialsFromName(profileName)
  const profileRole = primaryRoleLabel(user?.roles)

  return (
    <header className="admin-header" role="banner">
      {/* Keyboard-only skip link — first focusable on the page; jumps past
          the chrome straight to the routed page content. */}
      <a href="#admin-main" className="admin-skip-link">Skip to content</a>
      <div className="admin-header-left">
        {/* Hamburger — only rendered on ≤ 1024 px via CSS (display: none above). */}
        <button
          type="button"
          className={`admin-header-burger${mobileNavOpen ? ' is-open' : ''}`}
          onClick={onToggleMobileNav}
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-sidebar"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav className="admin-breadcrumb" aria-label="Breadcrumb">
          <span style={{ opacity: 0.5 }}>SIARA</span>
          <span style={{ opacity: 0.2 }}>/</span>
          <span>{pageName}</span>
          {isDetailPage && (
            <>
              <span style={{ opacity: 0.2 }}>/</span>
              <span style={{ color: 'var(--admin-text)' }}>Detail</span>
            </>
          )}
        </nav>
      </div>

      <div className="admin-header-right">
        {/* System status — compact dot indicators, hidden on narrow screens. */}
        <div className="admin-header-status" aria-label="System status">
          <span className="admin-header-status-env">
            <span className="admin-header-status-env-dot" />
            Production
          </span>
          <span className="admin-header-status-divider" aria-hidden="true" />
          <span className="admin-header-status-item" title="System Operational">
            <span className="admin-header-status-dot green" />
            <strong>System</strong>
            <span className="admin-header-status-meta">Operational</span>
          </span>
          <span className="admin-header-status-item" title="AI Model v0.3 online">
            <span className="admin-header-status-dot green" />
            <strong>AI</strong>
            <span className="admin-header-status-meta">v0.3 online</span>
          </span>
        </div>

        {/* Profile card */}
        <div className="admin-header-profile" title={`${profileName} · ${profileRole}`}>
          <div className="admin-header-profile-avatar" aria-hidden="true">{profileInitials}</div>
          <div className="admin-header-profile-body">
            <span className="admin-header-profile-name">{profileName}</span>
            <span className="admin-header-profile-role">{profileRole}</span>
          </div>
        </div>

        <button
          className="admin-header-logout"
          title="Log out"
          onClick={() => {
            Promise.resolve(logout()).finally(() => navigate('/login'))
          }}
        >
          Deconnexion
        </button>
      </div>
    </header>
  )
}
