import React, { useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { getAuthenticatedRedirect, isAdminUser } from './routeAccess'

export default function NonAdminOnlyRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isEmailVerified,
    hasCheckedSession,
  } = useContext(AuthContext)

  // Only block render on the very first session check. A background
  // refresh (triggered by window focus / visibilitychange in AuthContext)
  // must NOT unmount the children — otherwise any page-level state is
  // wiped whenever the OS takes focus (e.g. native file picker, alert
  // dialog), which would, for instance, reset the report wizard to step 1
  // when the user picks an image from their device.
  if (!hasCheckedSession) {
    return null
  }

  if (isAuthenticated && user && isAdminUser(user)) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return children ?? <Outlet />
}
