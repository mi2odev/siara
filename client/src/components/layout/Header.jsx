import React, { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../contexts/AuthContext'
import {
  ADMIN_LANDING_PATH,
  USER_LANDING_PATH,
  isAdminUser,
} from '../../routes/routeAccess'
import logo from '../../assets/logos/siara-logo.png'

const userNavLinks = [
  { to: '/home', labelKey: 'common:nav.home' },
  { to: '/map', labelKey: 'common:nav.map' },
  { to: '/predictions', labelKey: 'common:nav.predictions' },
  { to: USER_LANDING_PATH, labelKey: 'header.nav.dashboard' },
  { to: '/contact', labelKey: 'header.nav.contact' },
]

const adminNavLinks = [
  { to: ADMIN_LANDING_PATH, labelKey: 'header.nav.overview' },
  { to: '/admin/incidents', labelKey: 'header.nav.incidents' },
  { to: '/admin/alerts', labelKey: 'common:nav.alerts' },
  { to: '/admin/zones', labelKey: 'header.nav.zones' },
  { to: '/admin/system', labelKey: 'header.nav.system' },
]

export default function Header() {
  const { t } = useTranslation(['pages', 'common'])
  const location = useLocation()
  const { user, isAuthenticated } = useContext(AuthContext)
  const isAdmin = isAdminUser(user)
  const isHome = !isAdmin && location.pathname === '/home'
  const homePath = isAdmin ? ADMIN_LANDING_PATH : '/home'
  const navLinks = isAdmin ? adminNavLinks : userNavLinks
  const dashboardPath = isAdmin ? ADMIN_LANDING_PATH : USER_LANDING_PATH

  function scrollTo(id){
    const el = document.getElementById(id)
    if(el){ el.scrollIntoView({behavior:'smooth',block:'start'}) }
  }

  return (
    <header className="siara-header">
      <div className="siara-header-inner">
        <div className="brand-group">
          <Link to={homePath} className="logo-link" aria-label={isAdmin ? t('header.logoAdmin') : t('header.logoHome')}>
            <img src={logo} alt="SIARA" className="logo-img" loading="lazy" />
            <span className="logo-text">SIARA</span>
          </Link>
        </div>

        <nav className="main-nav" aria-label={t('header.mainNav')}>
          {navLinks.map((link) => (
            link.to === '/home' && isHome ? (
              <button key={link.to} onClick={() => scrollTo('hero')} className="nav-link">{t(link.labelKey)}</button>
            ) : (
              <Link key={link.to} to={link.to} className="nav-link">{t(link.labelKey)}</Link>
            )
          ))}
        </nav>

        <div className="header-cta">
          {isAuthenticated ? (
            <Link to={dashboardPath} className="btn-cta" aria-label={isAdmin ? t('header.ctaAdmin') : t('header.ctaDashboard')}>
              {isAdmin ? t('header.adminLabel') : t('header.dashboardLabel')}
            </Link>
          ) : (
            <Link to="/login" className="btn-cta" aria-label={t('common:nav.login')}>{t('common:nav.login')}</Link>
          )}
        </div>
      </div>
    </header>
  )
}
