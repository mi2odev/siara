import React, { useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { buildVerifyEmailRedirect, getAuthenticatedRedirect } from './routeAccess'

export default function ProtectedRoute({ children, roles, allowUnverified = false }) {
  const {
    user,
    isAuthLoading,
    isAuthenticated,
    isEmailVerified,
    hasCheckedSession,
  } = useContext(AuthContext)
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : []

  if (isAuthLoading || !hasCheckedSession) {
    return null
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowUnverified && !isEmailVerified) {
    return <Navigate to={buildVerifyEmailRedirect(user)} replace />
  }

  if (roles && !roles.some((role) => userRoles.includes(role))) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return children ?? <Outlet />
}
