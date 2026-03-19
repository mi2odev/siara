import React, { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import {
  ADMIN_LANDING_PATH,
  USER_LANDING_PATH,
  isAdminUser,
} from '../../routes/routeAccess'
import logo from '../../assets/logos/siara-logo.png'

const userNavLinks = [
  { to: '/home', label: 'Home' },
  { to: '/map', label: 'Map' },
  { to: '/predictions', label: 'Predictions' },
  { to: USER_LANDING_PATH, label: 'Dashboard' },
  { to: '/contact', label: 'Contact' },
]

const adminNavLinks = [
  { to: ADMIN_LANDING_PATH, label: 'Overview' },
  { to: '/admin/incidents', label: 'Incidents' },
  { to: '/admin/alerts', label: 'Alerts' },
  { to: '/admin/zones', label: 'Zones' },
  { to: '/admin/system', label: 'System' },
]

export default function Header() {
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
          <Link to={homePath} className="logo-link" aria-label={isAdmin ? 'Admin SIARA' : 'Home SIARA'}>
            <img src={logo} alt="SIARA" className="logo-img" loading="lazy" />
            <span className="logo-text">SIARA</span>
          </Link>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {navLinks.map((link) => (
            link.to === '/home' && isHome ? (
              <button key={link.to} onClick={() => scrollTo('hero')} className="nav-link">{link.label}</button>
            ) : (
              <Link key={link.to} to={link.to} className="nav-link">{link.label}</Link>
            )
          ))}
        </nav>

        <div className="header-cta">
          {isAuthenticated ? (
            <Link to={dashboardPath} className="btn-cta" aria-label={isAdmin ? 'Open admin' : 'Open dashboard'}>
              {isAdmin ? 'Admin' : 'Dashboard'}
            </Link>
          ) : (
            <Link to="/login" className="btn-cta" aria-label="Log in">Log in</Link>
          )}
        </div>
      </div>
    </header>
  )
}
