import React, { useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { getAuthenticatedRedirect } from './routeAccess'

export default function PublicOnlyRoute({ children }) {
  const {
    user,
    isAuthenticated,
    isEmailVerified,
    hasCheckedSession,
  } = useContext(AuthContext)

  if (!hasCheckedSession) {
    return null
  }

  if (isAuthenticated && user) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return children ?? <Outlet />
}
