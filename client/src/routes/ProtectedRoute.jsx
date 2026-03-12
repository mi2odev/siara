import React from 'react'
import { Navigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthLoading } = useContext(AuthContext)
  const userRoles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : []

  if (isAuthLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.some((role) => userRoles.includes(role))) {
    return <Navigate to="/login" replace />
  }
  return children
}
