import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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

  const fixedButtonStyle = {
    minWidth: '210px',
    height: '40px',
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

  return (
    <button className={className} style={{ ...fixedButtonStyle, ...(buttonStyle || {}) }} onClick={() => navigate(isPoliceMode ? basicPath : policePath)}>
      {isPoliceMode ? basicLabel : policeLabel}
    </button>
  )
}
