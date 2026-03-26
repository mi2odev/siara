import React, { useContext } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'
import { getUserRoles } from '../utils/roleUtils'
import { buildVerifyEmailRedirect, getAuthenticatedRedirect } from './routeAccess'

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export default function ProtectedRoute({ children, roles, allowUnverified = false }) {
  const {
    user,
    isAuthenticated,
    isEmailVerified,
    hasCheckedSession,
  } = useContext(AuthContext)
  const normalizedUserRoles = getUserRoles(user)

  if (!hasCheckedSession) {
    return null
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowUnverified && !isEmailVerified) {
    return <Navigate to={buildVerifyEmailRedirect(user)} replace />
  }

  if (roles && !roles.some((role) => normalizedUserRoles.includes(normalizeRole(role)))) {
    return <Navigate to={getAuthenticatedRedirect(user, isEmailVerified)} replace />
  }

  return children ?? <Outlet />
}
