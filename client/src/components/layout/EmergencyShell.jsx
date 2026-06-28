import React, { useContext, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'

import { AuthContext } from '../../contexts/AuthContext'
import siaraLogo from '../../assets/logos/siara-logo.png'

import '../../styles/EmergencyMode.css'

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
  const { t } = useTranslation(['emergency', 'common'])
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useContext(AuthContext) || {}

  const resolvedBase = basePath
    ?? (location.pathname.startsWith('/preview/emergency') ? '/preview/emergency' : '/emergency')

  const groups = useMemo(() => [
    {
      title: t('emergencyShell.nav.groupMain'),
      items: [
        { key: 'dashboard', label: t('emergencyShell.nav.dashboard'),         icon: <DashboardOutlinedIcon fontSize="inherit" />,           path: resolvedBase },
        { key: 'assigned',  label: t('emergencyShell.nav.assignedOperations'), icon: <AssignmentTurnedInOutlinedIcon fontSize="inherit" />,  path: `${resolvedBase}/assigned`, badge: 2 },
        { key: 'map',       label: t('emergencyShell.nav.emergencyMap'),       icon: <MapOutlinedIcon fontSize="inherit" />,                 path: `${resolvedBase}/map` },
      ],
    },
    {
      title: t('emergencyShell.nav.groupMonitoring'),
      items: [
        { key: 'alerts', label: t('emergencyShell.nav.emergencyAlerts'), icon: <WarningAmberRoundedIcon fontSize="inherit" />, path: `${resolvedBase}/alerts`, badge: 3 },
      ],
    },
  ], [resolvedBase, t])

  const statusCopy = {
    available:  t('emergencyShell.status.available'),
    responding: t('emergencyShell.status.responding'),
    busy:       t('emergencyShell.status.onScene'),
    offline:    t('emergencyShell.status.offline'),
  }

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
          <span className="emergency-brand-role">{t('emergencyShell.brandRole')}</span>
        </div>

        <div className="emergency-unit-pill" aria-label={t('emergencyShell.ariaUnitStatus')}>
          <span className="emergency-unit-meta">
            <span className="em-unit-id">{unitId}</span>
            <span className="em-unit-sep" aria-hidden="true" />
            <span><span className="em-mission-count">{activeMissions}</span> <span className="em-unit-label">{t('emergencyShell.activeLabel')}</span></span>
          </span>
          <span className={`emergency-status-chip status-${unitStatus}`}>
            {statusCopy[unitStatus] || t('emergencyShell.status.offline')}
          </span>
        </div>

        <div className="emergency-live" aria-label={t('emergencyShell.ariaLiveTime')}>
          <span className="emergency-pulse-dot" aria-hidden="true" />
          <span className="emergency-clock">{clock}</span>
          <span style={{ color: 'var(--em-text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>{t('emergencyShell.liveLabel')}</span>
        </div>
      </header>

      <div className="emergency-layout">
        <aside className="emergency-sidebar" aria-label={t('emergencyShell.ariaEmergencyNav')}>
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
              <span className="emergency-menu-label">{t('common:nav.logout')}</span>
            </button>
          </section>
        </aside>

        <main className="emergency-center">{children}</main>
      </div>
    </div>
  )
}
