import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'

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
    const params = new URLSearchParams()
    if (user.email) {
      params.set('email', user.email)
    }

    const search = params.toString()
    return <Navigate to={`/verify-email${search ? `?${search}` : ''}`} replace />
  }

  if (roles && !roles.some((role) => userRoles.includes(role))) {
    return <Navigate to={userRoles.includes('admin') ? '/admin/overview' : '/dashboard'} replace />
  }

  return children
}
