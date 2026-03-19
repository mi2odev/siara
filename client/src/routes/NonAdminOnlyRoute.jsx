import React, { useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { getAuthenticatedRedirect, isAdminUser } from './routeAccess'

export default function NonAdminOnlyRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isAuthLoading,
    isEmailVerified,
    hasCheckedSession,
  } = useContext(AuthContext)

  if (isAuthLoading || !hasCheckedSession) {
    return null
  }

  if (isAuthenticated && user && isAdminUser(user)) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return children ?? <Outlet />
}
