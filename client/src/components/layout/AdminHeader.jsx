import React, { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../contexts/AuthContext'

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

function primaryRoleLabel(roles, t) {
  if (!Array.isArray(roles) || roles.length === 0) return t('adminHeader.roles.admin')
  const normalized = roles.map((role) => String(role).toLowerCase())
  if (normalized.includes('admin') || normalized.includes('super_admin') || normalized.includes('super admin')) {
    return t('adminHeader.roles.admin')
  }
  if (normalized.includes('supervisor')) return t('adminHeader.roles.supervisor')
  if (normalized.some((r) => r.startsWith('police'))) return t('adminHeader.roles.police')
  return roles[0]
}

export default function AdminHeader({ mobileNavOpen = false, onToggleMobileNav }) {
  const { t } = useTranslation(['admin', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useContext(AuthContext)

  const routeNames = {
    '/admin/overview': t('adminHeader.routes.overview'),
    '/admin/incidents': t('adminHeader.routes.incidents'),
    '/admin/alerts': t('adminHeader.routes.alerts'),
    '/admin/zones': t('adminHeader.routes.zones'),
    '/admin/ai': t('adminHeader.routes.ai'),
    '/admin/users': t('adminHeader.routes.users'),
    '/admin/analytics': t('adminHeader.routes.analytics'),
    '/admin/system': t('adminHeader.routes.system'),
    '/admin/inbox': t('adminHeader.routes.inbox'),
  }

  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/')
  const pageName = routeNames[basePath] || t('adminHeader.roles.admin')
  const isDetailPage = location.pathname.split('/').length > 3

  const profileName = user?.name
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.email
    || t('adminHeader.roles.admin')
  const profileInitials = initialsFromName(profileName)
  const profileRole = primaryRoleLabel(user?.roles, t)

  return (
    <header className="admin-header" role="banner">
      {/* Keyboard-only skip link — first focusable on the page; jumps past
          the chrome straight to the routed page content. */}
      <a href="#admin-main" className="admin-skip-link">{t('adminHeader.skipToContent')}</a>
      <div className="admin-header-left">
        {/* Hamburger — only rendered on ≤ 1024 px via CSS (display: none above). */}
        <button
          type="button"
          className={`admin-header-burger${mobileNavOpen ? ' is-open' : ''}`}
          onClick={onToggleMobileNav}
          aria-label={mobileNavOpen ? t('adminHeader.nav.close') : t('adminHeader.nav.open')}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-sidebar"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav className="admin-breadcrumb" aria-label={t('adminHeader.breadcrumb.label')}>
          <span style={{ opacity: 0.5 }}>SIARA</span>
          <span style={{ opacity: 0.2 }}>/</span>
          <span>{pageName}</span>
          {isDetailPage && (
            <>
              <span style={{ opacity: 0.2 }}>/</span>
              <span style={{ color: 'var(--admin-text)' }}>{t('adminHeader.breadcrumb.detail')}</span>
            </>
          )}
        </nav>
      </div>

      <div className="admin-header-right">
        {/* System status — compact dot indicators, hidden on narrow screens. */}
        <div className="admin-header-status" aria-label={t('adminHeader.status.label')}>
          <span className="admin-header-status-env">
            <span className="admin-header-status-env-dot" />
            {t('adminHeader.status.production')}
          </span>
          <span className="admin-header-status-divider" aria-hidden="true" />
          <span className="admin-header-status-item" title={t('adminHeader.status.systemOperationalTitle')}>
            <span className="admin-header-status-dot green" />
            <strong>{t('adminHeader.status.system')}</strong>
            <span className="admin-header-status-meta">{t('adminHeader.status.operational')}</span>
          </span>
          <span className="admin-header-status-item" title={t('adminHeader.status.aiOnlineTitle')}>
            <span className="admin-header-status-dot green" />
            <strong>{t('adminHeader.status.ai')}</strong>
            <span className="admin-header-status-meta">{t('adminHeader.status.aiVersion')}</span>
          </span>
        </div>

        {/* Profile card */}
        <div className="admin-header-profile" title={t('adminHeader.profile.title', { name: profileName, role: profileRole })}>
          <div className="admin-header-profile-avatar" aria-hidden="true">{profileInitials}</div>
          <div className="admin-header-profile-body">
            <span className="admin-header-profile-name">{profileName}</span>
            <span className="admin-header-profile-role">{profileRole}</span>
          </div>
        </div>

        <button
          className="admin-header-logout"
          title={t('common:nav.logout')}
          onClick={() => {
            Promise.resolve(logout()).finally(() => navigate('/login'))
          }}
        >
          {t('common:nav.logout')}
        </button>
      </div>
    </header>
  )
}
