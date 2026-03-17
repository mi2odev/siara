let googleScriptPromise = null

function logInfo(event, details) {
  if (import.meta.env.DEV) {
    console.info(`[google-auth] ${event}`, details || '')
  }
}

function logWarn(event, details) {
  console.warn(`[google-auth] ${event}`, details || '')
}

function logError(event, details) {
  console.error(`[google-auth] ${event}`, details || '')
}

export function getGoogleClientId() {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID
    || import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID
    || ''
  ).trim()
}

export function isGoogleLoginAvailable() {
  const available = Boolean(getGoogleClientId())

  if (!available) {
    logWarn('Missing VITE_GOOGLE_CLIENT_ID')
  }

  return available
}

export async function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') {
    throw new Error('Google login is only available in the browser.')
  }

  if (window.google?.accounts?.id) {
    logInfo('GIS already available on window')
    return window.google
  }

  if (googleScriptPromise) {
    logInfo('Reusing in-flight GIS script promise')
    return googleScriptPromise
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-siara-google-auth="true"]')
    if (existingScript) {
      logInfo('Found existing GIS script tag')
      existingScript.addEventListener('load', () => {
        logInfo('Existing GIS script loaded')
        resolve(window.google)
      }, { once: true })
      existingScript.addEventListener('error', () => {
        googleScriptPromise = null
        logError('Existing GIS script failed to load')
        reject(new Error('Unable to load Google login.'))
      }, { once: true })
      return
    }

    logInfo('Injecting GIS script')
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.siaraGoogleAuth = 'true'
    script.onload = () => {
      logInfo('GIS script loaded successfully')
      resolve(window.google)
    }
    script.onerror = () => {
      googleScriptPromise = null
      logError('GIS script failed to load')
      reject(new Error('Unable to load Google login.'))
    }
    document.head.appendChild(script)
  })

  return googleScriptPromise
}
