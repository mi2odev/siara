import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getGoogleClientId, loadGoogleIdentityScript } from '../../services/googleAuthService'

const MISSING_CLIENT_ID_MESSAGE = 'Missing VITE_GOOGLE_CLIENT_ID'

function buildError(message) {
  return message instanceof Error ? message : new Error(String(message || 'Google sign-in is unavailable.'))
}

export default function GoogleAuthButton({
  disabled = false,
  onCredential,
  onError,
}) {
  const { t } = useTranslation(['auth', 'common'])
  const containerRef = useRef(null)
  const isInitializedRef = useRef(false)
  const promptAvailableRef = useRef(false)

  const clientId = useMemo(() => getGoogleClientId(), [])
  const [officialRendered, setOfficialRendered] = useState(false)
  const [fallbackReason, setFallbackReason] = useState(clientId ? '' : MISSING_CLIENT_ID_MESSAGE)

  useEffect(() => {
    let active = true

    if (!containerRef.current) {
      console.warn('[google-auth] Missing render container for Google button')
      setOfficialRendered(false)
      setFallbackReason(t('googleAuthButton.errorContainerMissing'))
      return undefined
    }

    if (!clientId) {
      console.warn('[google-auth] Missing VITE_GOOGLE_CLIENT_ID')
      setOfficialRendered(false)
      setFallbackReason(MISSING_CLIENT_ID_MESSAGE)
      return undefined
    }

    console.info('[google-auth] Loading GIS script for button mount')

    loadGoogleIdentityScript()
      .then((google) => {
        if (!active || !containerRef.current) {
          return
        }

        const googleId = google?.accounts?.id || window.google?.accounts?.id
        if (!googleId) {
          console.error('[google-auth] GIS script loaded but google.accounts.id is unavailable')
          setOfficialRendered(false)
          setFallbackReason(t('googleAuthButton.errorGisUnavailable'))
          return
        }

        try {
          console.info('[google-auth] Initializing GIS button', { clientIdPresent: Boolean(clientId) })
          googleId.initialize({
            client_id: clientId,
            callback: ({ credential }) => {
              console.info('[google-auth] GIS credential callback fired')
              const idToken = typeof credential === 'string' ? credential.trim() : ''

              if (!idToken) {
                const error = buildError(t('googleAuthButton.errorEmptyCredential'))
                console.error('[google-auth] Empty GIS credential received')
                onError?.(error)
                return
              }

              onCredential?.(idToken)
            },
            cancel_on_tap_outside: true,
            ux_mode: 'popup',
            context: 'signin',
          })

          isInitializedRef.current = true
          promptAvailableRef.current = true
          containerRef.current.innerHTML = ''

          const width = Math.max(280, Math.round(containerRef.current.getBoundingClientRect().width || 320))
          console.info('[google-auth] Calling renderButton', { width })
          googleId.renderButton(containerRef.current, {
            type: 'standard',
            theme: 'outline',
            text: 'continue_with',
            shape: 'pill',
            size: 'large',
            width,
            logo_alignment: 'left',
          })

          window.requestAnimationFrame(() => {
            if (!active || !containerRef.current) {
              return
            }

            const renderedNode = containerRef.current.querySelector('iframe, div[role="button"]')
            if (renderedNode) {
              console.info('[google-auth] Official GIS button rendered successfully')
              setOfficialRendered(true)
              setFallbackReason('')

              if (disabled) {
                renderedNode.setAttribute('aria-disabled', 'true')
                renderedNode.style.pointerEvents = 'none'
                renderedNode.style.opacity = '0.6'
              }
            } else {
              console.error('[google-auth] renderButton completed but no visible GIS button was inserted')
              setOfficialRendered(false)
              setFallbackReason(t('googleAuthButton.errorButtonNotRendered'))
            }
          })
        } catch (error) {
          console.error('[google-auth] renderButton failed', error)
          setOfficialRendered(false)
          setFallbackReason(error?.message || t('googleAuthButton.errorRenderFailed'))
          onError?.(buildError(error))
        }
      })
      .catch((error) => {
        console.error('[google-auth] GIS script load failed', error)
        if (!active) {
          return
        }
        setOfficialRendered(false)
        setFallbackReason(error?.message || t('googleAuthButton.errorScriptLoadFailed'))
        onError?.(buildError(error))
      })

    return () => {
      active = false
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [clientId, disabled, onCredential, onError])

  function handleFallbackClick() {
    if (disabled) {
      return
    }

    if (!clientId) {
      const error = buildError(MISSING_CLIENT_ID_MESSAGE)
      console.error('[google-auth] Fallback click blocked because client ID is missing')
      onError?.(error)
      return
    }

    if (!window.google?.accounts?.id || !isInitializedRef.current || !promptAvailableRef.current) {
      const error = buildError(t('googleAuthButton.errorGisNotReady'))
      console.error('[google-auth] Fallback click failed because GIS is not initialized')
      onError?.(error)
      return
    }

    try {
      console.info('[google-auth] Fallback button clicked; triggering GIS prompt')
      window.google.accounts.id.prompt((notification) => {
        if (notification?.isNotDisplayed?.()) {
          console.warn('[google-auth] GIS prompt not displayed', notification.getNotDisplayedReason?.())
        } else if (notification?.isSkippedMoment?.()) {
          console.warn('[google-auth] GIS prompt skipped', notification.getSkippedReason?.())
        } else if (notification?.isDismissedMoment?.()) {
          console.warn('[google-auth] GIS prompt dismissed', notification.getDismissedReason?.())
        }
      })
    } catch (error) {
      console.error('[google-auth] Fallback GIS prompt failed', error)
      onError?.(buildError(error))
    }
  }

  return (
    <div className="siara-google-auth">
      <div className="siara-google-auth-shell">
        <div
          ref={containerRef}
          className={`siara-google-auth-official ${officialRendered ? 'is-visible' : ''}`}
          aria-hidden={officialRendered ? 'false' : 'true'}
        />

        {!officialRendered ? (
          <button
            type="button"
            className={`siara-google-fallback ${disabled || !clientId ? 'is-disabled' : ''}`}
            onClick={handleFallbackClick}
            disabled={disabled || !clientId}
            aria-disabled={disabled || !clientId}
          >
            <span className="siara-google-fallback__icon" aria-hidden="true">
              G
            </span>
            <span>{t('googleAuthButton.continueWithGoogle')}</span>
          </button>
        ) : null}
      </div>

      {fallbackReason ? (
        <div className="siara-google-auth-note" role="status">
          {fallbackReason === MISSING_CLIENT_ID_MESSAGE
            ? t('googleAuthButton.errorNotConfigured')
            : fallbackReason}
        </div>
      ) : null}
    </div>
  )
}
