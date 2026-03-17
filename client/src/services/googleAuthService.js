let googleScriptPromise = null

export function getGoogleClientId() {
  return (import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID || '').trim()
}

export function isGoogleLoginAvailable() {
  return Boolean(getGoogleClientId())
}

export async function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') {
    throw new Error('Google login is only available in the browser.')
  }

  if (window.google?.accounts?.id) {
    return window.google
  }

  if (googleScriptPromise) {
    return googleScriptPromise
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-siara-google-auth="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Google login.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.siaraGoogleAuth = 'true'
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('Unable to load Google login.'))
    document.head.appendChild(script)
  })

  return googleScriptPromise
}
