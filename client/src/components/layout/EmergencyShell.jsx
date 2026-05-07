import React, { useContext, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'

import { AuthContext } from '../../contexts/AuthContext'
import siaraLogo from '../../assets/logos/siara-logo.png'

import '../../styles/EmergencyMode.css'

function buildNavGroups(basePath) {
  return [
    {
      title: 'MAIN',
      items: [
        { key: 'dashboard', label: 'Dashboard',           icon: <DashboardOutlinedIcon fontSize="inherit" />,           path: basePath },
        { key: 'assigned',  label: 'Assigned Operations', icon: <AssignmentTurnedInOutlinedIcon fontSize="inherit" />,  path: `${basePath}/assigned`, badge: 2 },
        { key: 'map',       label: 'Emergency Map',       icon: <MapOutlinedIcon fontSize="inherit" />,                 path: `${basePath}/map` },
      ],
    },
    {
      title: 'MONITORING',
      items: [
        { key: 'alerts', label: 'Emergency Alerts', icon: <WarningAmberRoundedIcon fontSize="inherit" />, path: `${basePath}/alerts`, badge: 3 },
      ],
    },
  ]
}

const STATUS_COPY = {
  available:  'AVAILABLE',
  responding: 'RESPONDING',
  busy:       'ON-SCENE',
  offline:    'OFFLINE',
}

function deriveActiveKey(pathname, basePath) {
  if (!pathname.startsWith(basePath)) return 'dashboard'
  const slug = pathname.slice(basePath.length).replace(/^\//, '').split('/')[0]
  if (!slug) return 'dashboard'
  if (slug === 'assigned') return 'assigned'
  if (slug === 'map')      return 'map'
  if (slug === 'alerts')   return 'alerts'
  if (slug === 'response') return 'assigned' // detail page belongs to operations
  return 'dashboard'
}

export default function EmergencyShell({
  unitId = 'AMB-A12',
  unitStatus = 'available',
  activeMissions = 0,
  basePath,
  children,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useContext(AuthContext) || {}

  const resolvedBase = basePath
    ?? (location.pathname.startsWith('/preview/emergency') ? '/preview/emergency' : '/emergency')

  const groups = useMemo(() => buildNavGroups(resolvedBase), [resolvedBase])
  const activeKey = useMemo(
    () => deriveActiveKey(location.pathname, resolvedBase),
    [location.pathname, resolvedBase],
  )

  const [now] = useState(() => new Date())
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const handleLogout = () => {
    if (logout) logout()
    navigate('/home')
  }

  return (
    <div className="emergency-root">
      <header className="emergency-topbar">
        <div className="emergency-topbar-brand" onClick={() => navigate(resolvedBase)} role="button" tabIndex={0}>
          <img src={siaraLogo} alt="SIARA" className="emergency-brand-logo" />
          <span className="emergency-brand-role">Emergency Service</span>
        </div>

        <div className="emergency-unit-pill" aria-label="Unit status">
          <span className="emergency-unit-meta">
            <span className="em-unit-id">{unitId}</span>
            <span className="em-unit-sep" aria-hidden="true" />
            <span><span className="em-mission-count">{activeMissions}</span> <span className="em-unit-label">active</span></span>
          </span>
          <span className={`emergency-status-chip status-${unitStatus}`}>
            {STATUS_COPY[unitStatus] || 'OFFLINE'}
          </span>
        </div>

        <div className="emergency-live" aria-label="Live time">
          <span className="emergency-pulse-dot" aria-hidden="true" />
          <span className="emergency-clock">{clock}</span>
          <span style={{ color: 'var(--em-text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>LIVE</span>
        </div>
      </header>

      <div className="emergency-layout">
        <aside className="emergency-sidebar" aria-label="Emergency navigation">
          {groups.map((group) => (
            <section key={group.title} className="emergency-menu-group">
              <h3 className="emergency-menu-group-title">{group.title}</h3>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`emergency-menu-btn ${activeKey === item.key ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="emergency-menu-icon">{item.icon}</span>
                  <span className="emergency-menu-label">{item.label}</span>
                  {item.badge ? <span className="em-menu-badge">{item.badge}</span> : null}
                </button>
              ))}
            </section>
          ))}

          <section className="emergency-menu-group" style={{ marginTop: 'auto' }}>
            <button type="button" className="emergency-menu-btn" onClick={handleLogout}>
              <span className="emergency-menu-icon"><LogoutRoundedIcon fontSize="inherit" /></span>
              <span className="emergency-menu-label">Sign Out</span>
            </button>
          </section>
        </aside>

        <main className="emergency-center">{children}</main>
      </div>
    </div>
  )
}
