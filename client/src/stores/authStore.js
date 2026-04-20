import { create } from 'zustand'
import {
  confirmVerificationCode,
  getSession,
  login as loginRequest,
  loginWithGoogle as loginWithGoogleRequest,
  logout as logoutRequest,
  registerAccount,
} from '../services/authService'
import { API_ORIGIN } from '../requestMethodes'

function normalizeAvatarUrl(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  if (/^https?:\/\//i.test(normalized) || /^data:/i.test(normalized) || /^blob:/i.test(normalized)) {
    return normalized
  }

  if (normalized.startsWith('//')) {
    return `https:${normalized}`
  }

  const normalizedPath = normalized.replace(/\\/g, '/')
  if (normalizedPath.startsWith('/uploads/')) {
    return `${API_ORIGIN}${normalizedPath}`
  }
  if (normalizedPath.startsWith('uploads/')) {
    return `${API_ORIGIN}/${normalizedPath}`
  }

  return normalizedPath
}

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
  const avatarUrl = normalizeAvatarUrl(
    rawUser.avatarUrl
    || rawUser.avatar_url
    || rawUser.avatar
    || rawUser.photoUrl
    || rawUser.photo_url,
  )

  return {
    ...rawUser,
    roles,
    role,
    name,
    avatarUrl,
    avatar_url: avatarUrl,
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
