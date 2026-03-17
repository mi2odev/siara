import React, { useEffect, useRef, useState } from 'react'

import { getGoogleClientId, isGoogleLoginAvailable, loadGoogleIdentityScript } from '../../services/googleAuthService'

export default function GoogleAuthButton({ disabled = false, onCredential, onError }) {
  const containerRef = useRef(null)
  const [available, setAvailable] = useState(isGoogleLoginAvailable())

  useEffect(() => {
    let active = true

    if (!available || !containerRef.current) {
      return undefined
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (!active || !containerRef.current || !window.google?.accounts?.id) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: getGoogleClientId(),
          callback: ({ credential }) => {
            if (!credential) {
              onError?.(new Error('Google login did not return a credential.'))
              return
            }

            onCredential?.(credential)
          },
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
        })

        containerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          text: 'continue_with',
          shape: 'pill',
          size: 'large',
          width: 320,
          logo_alignment: 'left',
        })

        const button = containerRef.current.querySelector('div[role="button"]')
        if (button && disabled) {
          button.setAttribute('aria-disabled', 'true')
          button.style.pointerEvents = 'none'
          button.style.opacity = '0.6'
        }
      })
      .catch((error) => {
        if (active) {
          setAvailable(false)
          onError?.(error)
        }
      })

    return () => {
      active = false
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [available, disabled, onCredential, onError])

  if (!available) {
    return null
  }

  return (
    <div className="siara-google-auth">
      <div ref={containerRef} />
    </div>
  )
}
