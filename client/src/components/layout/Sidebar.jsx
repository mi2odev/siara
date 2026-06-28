import React, { useContext } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../../contexts/AuthContext'
import { ADMIN_LANDING_PATH, isAdminUser } from '../../routes/routeAccess'

export default function Sidebar() {
  const { t } = useTranslation(['pages', 'common'])
  const { user } = useContext(AuthContext)

  const userLinks = [
    { to: '/dashboard', label: t('sidebar.links.dashboard') },
    { to: '/home', label: t('sidebar.links.home') },
    { to: '/news', label: t('sidebar.links.news') },
    { to: '/contact', label: t('sidebar.links.contact') },
    { to: '/about', label: t('sidebar.links.about') },
    { to: '/description', label: t('sidebar.links.description') },
  ]

  const adminLinks = [
    { to: ADMIN_LANDING_PATH, label: t('sidebar.links.overview') },
    { to: '/admin/incidents', label: t('sidebar.links.incidents') },
    { to: '/admin/alerts', label: t('sidebar.links.alerts') },
    { to: '/admin/services', label: t('sidebar.links.serviceControl') },
    { to: '/admin/system', label: t('sidebar.links.system') },
  ]

  const links = isAdminUser(user) ? adminLinks : userLinks

  return (
    <aside className="w-64 bg-transparent border-r border-white/6 min-h-screen p-4">
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {links.map((link, index) => (
          <React.Fragment key={link.to}>
            {index === 1 ? <hr style={{borderColor:'rgba(255,255,255,0.04)'}} /> : null}
            <NavLink to={link.to} style={{color:'var(--siara-accent)',textDecoration:'none'}}>{link.label}</NavLink>
          </React.Fragment>
        ))}
      </div>
    </aside>
  )
}
