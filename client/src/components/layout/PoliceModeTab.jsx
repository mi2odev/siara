import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { isPoliceOfficerUser } from '../../utils/roleUtils'

export default function PoliceModeTab({
  user,
  className = 'dash-tab dash-tab-police',
  policeLabel = 'Switch to Police Mode',
  basicLabel = 'Switch to Basic Mode',
  policePath = '/police',
  basicPath = '/dashboard',
}) {
  const navigate = useNavigate()
  const location = useLocation()

  if (!isPoliceOfficerUser(user)) {
    return null
  }

  const isPoliceMode = location.pathname === policePath || location.pathname.startsWith(`${policePath}/`)

  return (
    <button className={className} onClick={() => navigate(isPoliceMode ? basicPath : policePath)}>
      {isPoliceMode ? basicLabel : policeLabel}
    </button>
  )
}
