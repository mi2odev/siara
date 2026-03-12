import { create } from 'zustand'
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '../services/authService'
import {
  clearPersistedSession,
  normalizeAuthUser,
  persistSession,
  readPersistedSession,
} from './authStorage'

function buildLoggedOutState() {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isAuthLoading: false,
    isAdmin: false,
  }
}

function setAuthenticatedState(set, { user, token, persistMode }) {
  const normalizedUser = persistSession({ user, token, persistMode })

  set({
    user: normalizedUser,
    token,
    isAuthenticated: Boolean(normalizedUser && token),
    isAuthLoading: false,
    isAdmin: normalizedUser?.role === 'admin',
  })

  return normalizedUser
}

export const useAuthStore = create((set, get) => ({
  ...buildLoggedOutState(),

  async login(identifier, password, remember = false) {
    set({ isAuthLoading: true })

    try {
      const response = await loginRequest(identifier, password)

      if (!response?.user || !response?.token) {
        throw new Error('Authentication failed')
      }

      return setAuthenticatedState(set, {
        user: normalizeAuthUser(response.user, remember ? 'local' : 'session'),
        token: response.token,
        persistMode: remember ? 'local' : 'session',
      })
    } catch (error) {
      clearPersistedSession()
      set(buildLoggedOutState())
      throw error
    }
  },

  async logout() {
    set({ isAuthLoading: true })

    try {
      await logoutRequest()
    } finally {
      clearPersistedSession()
      set(buildLoggedOutState())
    }
  },

  async restoreSession() {
    if (get().isAuthLoading) {
      return get().user
    }

    const persistedSession = readPersistedSession()
    if (!persistedSession?.token) {
      clearPersistedSession()
      set(buildLoggedOutState())
      return null
    }

    set({ isAuthLoading: true })

    try {
      const currentUser = await getCurrentUser()

      if (!currentUser) {
        throw new Error('Session could not be restored')
      }

      return setAuthenticatedState(set, {
        user: currentUser,
        token: persistedSession.token,
        persistMode: persistedSession.persistMode,
      })
    } catch (_error) {
      clearPersistedSession()
      set(buildLoggedOutState())
      return null
    }
  },
}))
