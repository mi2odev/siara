import React, { createContext, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle)
  const completeEmailVerification = useAuthStore((state) => state.completeEmailVerification)
  const logout = useAuthStore((state) => state.logout)
  const setUser = useAuthStore((state) => state.setUser)
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isAuthLoading = useAuthStore((state) => state.isAuthLoading)
  const isAdmin = useAuthStore((state) => state.isAdmin)
  const isEmailVerified = useAuthStore((state) => state.isEmailVerified)
  const hasCheckedSession = useAuthStore((state) => state.hasCheckedSession)
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
    isEmailVerified,
    hasCheckedSession,
    login,
    register,
    loginWithGoogle,
    completeEmailVerification,
    logout,
    restoreSession,
    setUser,
  }), [
    completeEmailVerification,
    hasCheckedSession,
    isAdmin,
    isAuthenticated,
    isAuthLoading,
    isEmailVerified,
    login,
    loginWithGoogle,
    logout,
    register,
    restoreSession,
    setUser,
    token,
    user,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
