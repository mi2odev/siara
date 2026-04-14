import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'

import { isPoliceOfficerUser } from '../../utils/roleUtils'

export default function PoliceModeTab({
  user,
  className = 'dash-tab dash-tab-police',
  policeLabel = 'Switch to Police Mode',
  basicLabel = 'Switch to Normal Mode',
  policePath = '/police',
  basicPath = '/dashboard',
  buttonStyle,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [portalTarget, setPortalTarget] = React.useState(null)

  React.useEffect(() => {
    if (typeof document === 'undefined') return

    const headerRight = document.querySelector('.siara-dashboard-header .dash-header-right')
    setPortalTarget(headerRight)
  }, [location.pathname])

  const fixedButtonStyle = {
    minWidth: '172px',
    height: '38px',
    padding: '0 14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }

  if (!isPoliceOfficerUser(user)) {
    return null
  }

  const isPoliceMode = location.pathname === policePath || location.pathname.startsWith(`${policePath}/`)

  const modeSwitchButton = (
    <button
      className={`${className} dash-police-mode-btn ${isPoliceMode ? 'dash-police-mode-active' : 'dash-police-mode-inactive'}`}
      style={{ ...fixedButtonStyle, ...(buttonStyle || {}) }}
      onClick={() => navigate(isPoliceMode ? basicPath : policePath)}
    >
      {isPoliceMode ? basicLabel : policeLabel}
    </button>
  )

  if (portalTarget) {
    return createPortal(modeSwitchButton, portalTarget)
  }

  return modeSwitchButton
}
