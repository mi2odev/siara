import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'

import { isAnyPoliceUser } from '../../utils/roleUtils'
import { useUiModeStore } from '../../stores/uiModeStore'

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
  const setUiMode = useUiModeStore((state) => state.setMode)
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

  if (!isAnyPoliceUser(user)) {
    return null
  }

  const isPoliceMode = location.pathname === policePath || location.pathname.startsWith(`${policePath}/`)

  const modeSwitchButton = (
    <button
      className={`${className} dash-police-mode-btn ${isPoliceMode ? 'dash-police-mode-active' : 'dash-police-mode-inactive'}`}
      style={{ ...fixedButtonStyle, ...(buttonStyle || {}) }}
      onClick={() => {
        // Leaving police mode -> remember the citizen UI so shared pages (e.g.
        // notifications) don't snap back to police chrome. Entering police mode
        // is recorded by PoliceShell on mount.
        if (isPoliceMode) {
          setUiMode('normal')
        }
        navigate(isPoliceMode ? basicPath : policePath)
      }}
    >
      {isPoliceMode ? basicLabel : policeLabel}
    </button>
  )

  if (portalTarget) {
    return createPortal(modeSwitchButton, portalTarget)
  }

  return modeSwitchButton
}
