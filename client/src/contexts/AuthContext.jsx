import React, { createContext, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAuthLoading = useAuthStore((state) => state.isAuthLoading)
  const isAdmin = useAuthStore((state) => state.isAdmin)
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (hasRestoredRef.current) {
      return
    }

    hasRestoredRef.current = true
    restoreSession()
  }, [restoreSession])

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    isAuthLoading,
    isAdmin,
    login,
    logout,
    restoreSession,
    setUser: () => {},
  }), [
    isAdmin,
    isAuthenticated,
    isAuthLoading,
    login,
    logout,
    restoreSession,
    token,
    user,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
