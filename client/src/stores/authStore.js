import { create } from 'zustand'
import {
  confirmVerificationCode,
  getSession,
  login as loginRequest,
  loginWithGoogle as loginWithGoogleRequest,
  logout as logoutRequest,
  registerAccount,
} from '../services/authService'

function normalizeAuthUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') {
    return null
  }

  const roles = Array.isArray(rawUser.roles)
    ? rawUser.roles
    : rawUser.role
      ? [rawUser.role]
      : []
  const role = roles.includes('admin') ? 'admin' : roles[0] || rawUser.role || 'citizen'
  const name = rawUser.name
    || [rawUser.first_name, rawUser.last_name].filter(Boolean).join(' ')
    || rawUser.email
    || rawUser.phone
    || 'User'

  return {
    ...rawUser,
    roles,
    role,
    name,
  }
}

function buildLoggedOutState() {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isAuthLoading: false,
    isAdmin: false,
    isEmailVerified: false,
    hasCheckedSession: true,
  }
}

function setAuthenticatedState(set, response) {
  const normalizedUser = normalizeAuthUser(response?.user)
  const token = response?.token || null

  set({
    user: normalizedUser,
    token,
    isAuthenticated: Boolean(normalizedUser),
    isAuthLoading: false,
    isAdmin: normalizedUser?.role === 'admin',
    isEmailVerified: Boolean(normalizedUser?.email_verified ?? true),
    hasCheckedSession: true,
  })

  return normalizedUser
}

export const useAuthStore = create((set, get) => ({
  ...buildLoggedOutState(),
  hasCheckedSession: false,

  async register(payload) {
    set({ isAuthLoading: true })

    try {
      const response = await registerAccount(payload)
      set({ isAuthLoading: false, hasCheckedSession: true })
      return response
    } catch (error) {
      set({ isAuthLoading: false, hasCheckedSession: true })
      throw error
    }
  },

  async login(email, password, rememberMe = false) {
    set({ isAuthLoading: true })

    try {
      const response = await loginRequest({ email, password, rememberMe })
      setAuthenticatedState(set, response)
      return normalizeAuthUser(response.user)
    } catch (error) {
      set({
        ...buildLoggedOutState(),
        hasCheckedSession: true,
      })
      throw error
    }
  },

  async loginWithGoogle(idToken, rememberMe = false) {
    set({ isAuthLoading: true })

    try {
      const response = await loginWithGoogleRequest({ idToken, rememberMe })
      setAuthenticatedState(set, response)
      return normalizeAuthUser(response.user)
    } catch (error) {
      set({
        ...buildLoggedOutState(),
        hasCheckedSession: true,
      })
      throw error
    }
  },

  async completeEmailVerification({ email, code, rememberMe = false }) {
    set({ isAuthLoading: true })

    try {
      const response = await confirmVerificationCode({ email, code, rememberMe })
      setAuthenticatedState(set, response)
      return normalizeAuthUser(response.user)
    } catch (error) {
      set({ isAuthLoading: false, hasCheckedSession: true })
      throw error
    }
  },

  async logout() {
    set({ isAuthLoading: true })

    try {
      await logoutRequest()
    } finally {
      set(buildLoggedOutState())
    }
  },

  async restoreSession() {
    if (get().isAuthLoading) {
      return get().user
    }

    set({ isAuthLoading: true })

    try {
      const session = await getSession()

      if (!session?.authenticated || !session?.user) {
        set({
          ...buildLoggedOutState(),
          hasCheckedSession: true,
        })
        return null
      }

      return setAuthenticatedState(set, session)
    } catch {
      set({
        ...buildLoggedOutState(),
        hasCheckedSession: true,
      })
      return null
    }
  },

  setUser(nextUser) {
    const normalizedUser = normalizeAuthUser(nextUser)

    set((state) => ({
      ...state,
      user: normalizedUser,
      isAuthenticated: Boolean(normalizedUser),
      isAdmin: normalizedUser?.role === 'admin',
      isEmailVerified: Boolean(normalizedUser?.email_verified ?? true),
    }))

    return normalizedUser
  },
}))
