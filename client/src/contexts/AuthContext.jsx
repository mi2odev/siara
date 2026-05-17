import React, { createContext, useEffect, useMemo, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import i18n, { normalizeLanguage } from '../i18n'
import { getMyPreferences } from '../services/preferencesService'
import BanBanner from '../components/common/BanBanner'
import WarningBanner from '../components/common/WarningBanner'

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

  // Re-fetch the session whenever the tab becomes visible again. This makes
  // moderation actions (warning issued, ban applied/lifted) appear in the user
  // UI without a manual page refresh.
  useEffect(() => {
    if (!isAuthenticated) return undefined
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        restoreSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [isAuthenticated, restoreSession])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    let cancelled = false
    getMyPreferences()
      .then((prefs) => {
        if (cancelled || !prefs?.language) return
        const next = normalizeLanguage(prefs.language)
        if (next !== normalizeLanguage(i18n.language)) {
          i18n.changeLanguage(next).catch(() => {})
        }
      })
      .catch(() => {
        // Preferences endpoint may be unavailable; the locally persisted
        // language still applies.
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

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
      {isAuthenticated && <BanBanner user={user} />}
      {isAuthenticated && <WarningBanner user={user} />}
      {children}
    </AuthContext.Provider>
  )
}
