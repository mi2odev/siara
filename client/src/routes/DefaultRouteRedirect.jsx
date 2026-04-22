import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { getAuthenticatedRedirect } from './routeAccess'

export default function DefaultRouteRedirect({ defaultPath = '/home' }) {
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

  if (isAuthenticated && user) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return <Navigate to={defaultPath} replace />
}
