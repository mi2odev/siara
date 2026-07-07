import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../../stores/authStore'
import { SESSION_EXPIRED_EVENT } from '../../requestMethodes'

// Pages where a "session expired" redirect would be pointless or looping.
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/verify-email']

/**
 * Listens for the decoupled `siara:session-expired` event emitted by the axios
 * interceptor when the API rejects an expired/invalidated token. Clears the
 * local auth state and routes the user to /login with a friendly notice — but
 * only if they believed they were signed in, so anonymous visitors browsing
 * public pages are never yanked away. Must be rendered inside the router.
 */
export default function SessionExpiryHandler() {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth'])

  useEffect(() => {
    let handling = false

    async function onSessionExpired() {
      if (handling) {
        return
      }

      const state = useAuthStore.getState()
      if (!state.isAuthenticated) {
        return
      }

      handling = true
      try {
        await state.logout()
      } catch {
        // logout is best-effort — clearing local state is what matters.
      }

      const path = window.location.pathname
      if (!AUTH_PATHS.some((authPath) => path.startsWith(authPath))) {
        navigate('/login', {
          replace: true,
          state: {
            message: t('loginPage.errors.sessionExpired', {
              defaultValue: 'Your session has expired. Please sign in again.',
            }),
          },
        })
      }

      handling = false
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [navigate, t])

  return null
}
