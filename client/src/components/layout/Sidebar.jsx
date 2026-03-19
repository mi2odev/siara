import React, { useContext } from 'react'
import { NavLink } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import { ADMIN_LANDING_PATH, isAdminUser } from '../../routes/routeAccess'

const userLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/home', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/news', label: 'News' },
]

const adminLinks = [
  { to: ADMIN_LANDING_PATH, label: 'Overview' },
  { to: '/admin/incidents', label: 'Incidents' },
  { to: '/admin/alerts', label: 'Alerts' },
  { to: '/admin/services', label: 'Service Control' },
  { to: '/admin/system', label: 'System' },
]

export default function Sidebar() {
  const { user } = useContext(AuthContext)
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
