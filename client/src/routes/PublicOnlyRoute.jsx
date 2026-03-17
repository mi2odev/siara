import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthContext } from '../contexts/AuthContext'

function getAuthenticatedRedirect(user, isEmailVerified) {
  if (!isEmailVerified) {
    const params = new URLSearchParams()
    if (user?.email) {
      params.set('email', user.email)
    }

    const search = params.toString()
    return `/verify-email${search ? `?${search}` : ''}`
  }

  if (Array.isArray(user?.roles) && user.roles.includes('admin')) {
    return '/admin/overview'
  }

  return '/dashboard'
}

export default function PublicOnlyRoute({ children }) {
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

  return children
}
