import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildFallbackLocation } from '../config/fallbackLocation'
import {
  LOCATION_PREFERENCE_DEFAULT,
  LOCATION_PREFERENCE_EVENT,
  getLocationPreference,
} from '../config/locationPreference'
import { pingUserLocation } from '../services/notificationSettingsService'

// Throttle for the server-side last-known-location ping. watchPosition can fire
// several times per second; we only need a coarse "where is this user roughly"
// for orchestrator nearby-incident matching.
const LOCATION_PING_MIN_INTERVAL_MS = 30 * 1000
const LOCATION_PING_MIN_DISTANCE_M = 50

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 10000,
}

const MIN_MOVEMENT_FOR_BEARING_M = 3

function toFiniteNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeHeading(value) {
  const heading = toFiniteNumber(value)
  if (heading == null) return null
  return ((heading % 360) + 360) % 360
}

function isValidGpsHeading(value) {
  const heading = normalizeHeading(value)
  return heading != null && heading >= 0 && heading < 360
}

function distanceMeters(from, to) {
  if (!from || !to) return 0
  const lat = Number(to.lat)
  const lng = Number(to.lng)
  const prevLat = Number(from.lat)
  const prevLng = Number(from.lng)
  if (![lat, lng, prevLat, prevLng].every(Number.isFinite)) return 0

  const x = (lng - prevLng) * 111320 * Math.cos((lat * Math.PI) / 180)
  const y = (lat - prevLat) * 111320
  return Math.hypot(x, y)
}

function bearingDegrees(from, to) {
  if (!from || !to) return null
  const lat1 = Number(from.lat)
  const lng1 = Number(from.lng)
  const lat2 = Number(to.lat)
  const lng2 = Number(to.lng)
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null

  const toRad = (degrees) => (degrees * Math.PI) / 180
  const toDeg = (radians) => (radians * 180) / Math.PI
  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaLambda = toRad(lng2 - lng1)
  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  return normalizeHeading(toDeg(Math.atan2(y, x)))
}

function normalizeGpsPosition(position) {
  if (!position?.coords) return null
  const lat = toFiniteNumber(position.coords.latitude)
  const lng = toFiniteNumber(position.coords.longitude)
  if (lat == null || lng == null) return null

  const timestampMs = Number.isFinite(position.timestamp) ? position.timestamp : Date.now()
  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    accuracy: toFiniteNumber(position.coords.accuracy),
    altitude: toFiniteNumber(position.coords.altitude),
    altitudeAccuracy: toFiniteNumber(position.coords.altitudeAccuracy),
    gpsHeading: isValidGpsHeading(position.coords.heading)
      ? normalizeHeading(position.coords.heading)
      : null,
    speed: toFiniteNumber(position.coords.speed),
    timestamp: new Date(timestampMs).toISOString(),
    timestampMs,
    source: 'gps',
    isFallback: false,
  }
}

function getDeviceOrientationHeading(event) {
  const webkitHeading = normalizeHeading(event?.webkitCompassHeading)
  if (webkitHeading != null) return webkitHeading

  if (event?.absolute) {
    const alpha = normalizeHeading(event.alpha)
    if (alpha != null) return normalizeHeading(360 - alpha)
  }

  return null
}

function mapGeolocationStatus(error) {
  if (!error) return 'idle'
  if (error.code === error.PERMISSION_DENIED) return 'denied'
  if (error.code === error.POSITION_UNAVAILABLE) return 'unavailable'
  if (error.code === error.TIMEOUT) return 'timeout'
  return 'error'
}

function mapPermissionState(status) {
  if (status === 'denied') return 'denied'
  if (status === 'watching' || status === 'requesting') return 'granted'
  return 'prompt'
}

function buildErrorMessage(error, status) {
  if (status === 'unsupported') return 'Geolocation is not supported by this browser.'
  if (status === 'insecure') return 'Geolocation requires HTTPS, except on localhost.'
  if (!error) {
    if (status === 'timeout') return 'Location request timed out.'
    if (status === 'unavailable') return 'Location is unavailable on this device right now.'
    return ''
  }
  if (error.code === 1) return 'Location permission denied.'
  if (error.code === 2) return 'Location is unavailable on this device right now.'
  if (error.code === 3) return 'Location request timed out.'
  return error.message || 'Unable to get your position.'
}

let fallbackWarningLogged = false

function logFallbackWarning(reason) {
  if (fallbackWarningLogged) return
  fallbackWarningLogged = true
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const detail = reason ? ` (${reason})` : ''
    console.warn(`[location] GPS unavailable, using fallback test location${detail}`)
  }
}

/**
 * Tracks live browser location with `navigator.geolocation.watchPosition()`.
 *
 * Adds a deterministic fallback test location when the browser refuses or
 * cannot deliver a GPS fix, so the rest of the map/navigation UI keeps
 * working in development and QA. Fallback values are tagged with
 * `source: 'fallback'` and `isFallback: true` so downstream code can refuse
 * to treat them as a trusted GPS reading (see policeService).
 *
 * Options:
 * - autoStart (default true) — start a watcher on mount.
 * - enableFallback (default true) — substitute the fallback location when
 *   GPS fails. Set false for screens that must hide the map entirely if
 *   real GPS is unavailable.
 */
export default function useLiveLocation(opts = {}) {
  const {
    autoStart = true,
    enableFallback = true,
    enableHighAccuracy = GEOLOCATION_OPTIONS.enableHighAccuracy,
    maximumAge = GEOLOCATION_OPTIONS.maximumAge,
    timeout = GEOLOCATION_OPTIONS.timeout,
    routeBearing = null,
    fallbackHeading = 0,
  } = opts

  const [gpsLocation, setGpsLocation] = useState(null)
  const [fallbackActive, setFallbackActive] = useState(false)
  const [error, setError] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [deviceHeading, setDeviceHeading] = useState(null)
  const [movementHeading, setMovementHeading] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [permissionState, setPermissionState] = useState('prompt')

  const watchIdRef = useRef(null)
  const gpsLocationRef = useRef(null)
  const previousLocationRef = useRef(null)
  const orientationListeningRef = useRef(false)
  const permissionStatusRef = useRef(null)
  // Mirrors the forced-fallback flag for the watcher entry points so
  // startWatching / retryLocation can short-circuit without becoming
  // dependent on a state value (which would re-create every callback).
  const forceFallbackRef = useRef(false)
  // Throttle state for the server-side last-known-location ping.
  const lastPingedAtRef = useRef(0)
  const lastPingedLocationRef = useRef(null)

  const handleOrientation = useCallback((event) => {
    const heading = getDeviceOrientationHeading(event)
    if (heading != null) setDeviceHeading(heading)
  }, [])

  const stopOrientation = useCallback(() => {
    if (!orientationListeningRef.current || typeof window === 'undefined') return
    window.removeEventListener('deviceorientationabsolute', handleOrientation)
    window.removeEventListener('deviceorientation', handleOrientation)
    orientationListeningRef.current = false
  }, [handleOrientation])

  const clearWatcher = useCallback(() => {
    if (watchIdRef.current != null && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
  }, [])

  const stopWatching = useCallback(() => {
    clearWatcher()
    stopOrientation()
    setStatus((current) => (current === 'watching' || current === 'requesting' ? 'idle' : current))
    setIsLoading(false)
  }, [clearWatcher, stopOrientation])

  const startOrientation = useCallback(async () => {
    if (typeof window === 'undefined' || orientationListeningRef.current) return
    if (!('DeviceOrientationEvent' in window)) return

    const OrientationEvent = window.DeviceOrientationEvent
    try {
      if (typeof OrientationEvent?.requestPermission === 'function') {
        const result = await OrientationEvent.requestPermission()
        if (result !== 'granted') return
      }
    } catch {
      return
    }

    window.addEventListener('deviceorientationabsolute', handleOrientation)
    window.addEventListener('deviceorientation', handleOrientation)
    orientationListeningRef.current = true
  }, [handleOrientation])

  const applyFallback = useCallback(
    (reason) => {
      if (!enableFallback) return
      setFallbackActive(true)
      setLastUpdatedAt(Date.now())
      logFallbackWarning(reason)
    },
    [enableFallback],
  )

  const handlePositionSuccess = useCallback((position) => {
    const nextLocation = normalizeGpsPosition(position)
    if (!nextLocation) return

    const previousLocation = previousLocationRef.current
    if (
      previousLocation &&
      distanceMeters(previousLocation, nextLocation) >= MIN_MOVEMENT_FOR_BEARING_M
    ) {
      const nextBearing = bearingDegrees(previousLocation, nextLocation)
      if (nextBearing != null) setMovementHeading(nextBearing)
    }

    previousLocationRef.current = nextLocation
    gpsLocationRef.current = nextLocation
    setGpsLocation(nextLocation)
    setFallbackActive(false)
    setLastUpdatedAt(Date.now())
    setStatus('watching')
    setError(null)
    setLastError(null)
    setIsLoading(false)
    setPermissionState('granted')

    // Throttled server ping so the orchestrator can fan out 5 km nearby
    // notifications based on a roughly-current location. Failures are
    // swallowed — losing one ping is not a UX-visible problem.
    const now = Date.now()
    const lastPinged = lastPingedLocationRef.current
    const enoughTime = now - lastPingedAtRef.current >= LOCATION_PING_MIN_INTERVAL_MS
    const enoughMovement = !lastPinged || distanceMeters(lastPinged, nextLocation) >= LOCATION_PING_MIN_DISTANCE_M
    if (enoughTime && enoughMovement) {
      lastPingedAtRef.current = now
      lastPingedLocationRef.current = nextLocation
      pingUserLocation({
        lat: nextLocation.lat,
        lng: nextLocation.lng,
        accuracyMeters: nextLocation.accuracy,
        source: 'browser_watch',
      }).catch(() => {})
    }
  }, [])

  const handlePositionError = useCallback(
    (nextError) => {
      const nextStatus = mapGeolocationStatus(nextError)
      setLastError(nextError)
      setIsLoading(false)

      // Transient failures while we already hold a fix — keep watching.
      if (
        gpsLocationRef.current &&
        (nextStatus === 'timeout' || nextStatus === 'unavailable')
      ) {
        setStatus('watching')
        setError(null)
        return
      }

      setError(nextError)
      setStatus(nextStatus)
      setPermissionState(mapPermissionState(nextStatus))
      // Switch to fallback so the UI keeps working. We do NOT restart the
      // watcher here — that would create an infinite retry loop. The user
      // must press "Retry GPS".
      applyFallback(nextStatus)
    },
    [applyFallback],
  )

  const startWatching = useCallback(() => {
    // Respect the Settings-page "default location" toggle. The Retry GPS
    // button (or any caller that wires My Location to startWatching) must
    // not silently override the user's explicit choice.
    if (forceFallbackRef.current) {
      applyFallback('user_preference_default_location')
      return
    }
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (window.isSecureContext === false && !isLocalhost) {
        setStatus('insecure')
        setError({ code: -1, message: 'Geolocation requires HTTPS, except on localhost.' })
        setIsLoading(false)
        applyFallback('insecure')
        return
      }
    }

    if (!navigator?.geolocation?.watchPosition) {
      setStatus('unsupported')
      setError({ code: -2, message: 'Geolocation is not supported by this browser.' })
      setIsLoading(false)
      applyFallback('unsupported')
      return
    }

    if (watchIdRef.current != null) {
      // Already watching — do not start a second listener.
      setStatus(gpsLocationRef.current ? 'watching' : 'requesting')
      setError(null)
      startOrientation()
      return
    }

    setStatus('requesting')
    setError(null)
    setIsLoading(true)
    startOrientation()

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      { enableHighAccuracy, maximumAge, timeout },
    )
  }, [
    applyFallback,
    enableHighAccuracy,
    handlePositionError,
    handlePositionSuccess,
    maximumAge,
    startOrientation,
    timeout,
  ])

  const retryLocation = useCallback(() => {
    if (forceFallbackRef.current) {
      // User is in "default location" mode — clear any stale error but keep
      // the fallback in place. They have to switch Settings back to live GPS
      // to retry.
      applyFallback('user_preference_default_location')
      setError(null)
      return
    }
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (window.isSecureContext === false && !isLocalhost) {
        setStatus('insecure')
        setError({ code: -1, message: 'Geolocation requires HTTPS, except on localhost.' })
        applyFallback('insecure')
        return
      }
    }

    if (!navigator?.geolocation?.getCurrentPosition) {
      setStatus('unsupported')
      setError({ code: -2, message: 'Geolocation is not supported by this browser.' })
      applyFallback('unsupported')
      return
    }

    setError(null)
    setStatus('requesting')
    setIsLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionSuccess(position)
        // After a successful one-shot fix, restart the watcher so updates
        // keep flowing — but only if a watcher is not already running.
        if (watchIdRef.current == null) {
          startWatching()
        }
      },
      (nextError) => {
        handlePositionError(nextError)
      },
      { enableHighAccuracy, maximumAge: 0, timeout },
    )
  }, [
    applyFallback,
    enableHighAccuracy,
    handlePositionError,
    handlePositionSuccess,
    startWatching,
    timeout,
  ])

  // User-controlled toggle: when the Settings page picks "default location"
  // we skip the GPS watcher entirely and serve the static fallback. The hook
  // re-reads this on every CustomEvent from setLocationPreference() so the
  // map updates immediately, without a page reload.
  const [preference, setPreference] = useState(() => getLocationPreference())
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = (event) => {
      const next = event?.detail?.value || getLocationPreference()
      setPreference(next)
    }
    window.addEventListener(LOCATION_PREFERENCE_EVENT, handler)
    return () => window.removeEventListener(LOCATION_PREFERENCE_EVENT, handler)
  }, [])

  const forceFallback = preference === LOCATION_PREFERENCE_DEFAULT
  forceFallbackRef.current = forceFallback

  useEffect(() => {
    // Forced-fallback mode: stop any live watcher and freeze the static
    // fallback location. No retries, no auto-updates — that's the whole
    // point of the toggle.
    if (forceFallback) {
      clearWatcher()
      stopOrientation()
      setGpsLocation(null)
      gpsLocationRef.current = null
      setFallbackActive(true)
      setIsLoading(false)
      setStatus('idle')
      setError(null)
      setLastError(null)
      return () => {
        // No-op cleanup; switching back to GPS is handled by the next effect run.
      }
    }
    // Live-GPS mode (default for new users): start the watcher exactly as
    // before. Cleanup tears the watcher down on preference change too.
    if (autoStart) startWatching()
    return () => {
      clearWatcher()
      stopOrientation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, forceFallback])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return undefined
    }

    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permissionStatus) => {
        if (cancelled) return
        permissionStatusRef.current = permissionStatus
        setPermissionState(permissionStatus.state)
        permissionStatus.onchange = () => {
          setPermissionState(permissionStatus.state)
        }
      })
      .catch(() => {
        // Browser without permissions API support — leave permissionState as-is.
      })

    return () => {
      cancelled = true
      if (permissionStatusRef.current) {
        permissionStatusRef.current.onchange = null
        permissionStatusRef.current = null
      }
    }
  }, [])

  const fallbackLocation = useMemo(() => buildFallbackLocation(), [])

  const activeLocation = useMemo(() => {
    if (gpsLocation) return gpsLocation
    if (fallbackActive && enableFallback) return fallbackLocation
    return null
  }, [enableFallback, fallbackActive, fallbackLocation, gpsLocation])

  const headingData = useMemo(() => {
    if (gpsLocation?.gpsHeading != null) {
      return { heading: gpsLocation.gpsHeading, headingSource: 'gps' }
    }
    if (deviceHeading != null) {
      return { heading: deviceHeading, headingSource: 'device-orientation' }
    }
    if (movementHeading != null) {
      return { heading: movementHeading, headingSource: 'movement-bearing' }
    }
    const normalizedRouteBearing = normalizeHeading(routeBearing)
    if (normalizedRouteBearing != null) {
      return { heading: normalizedRouteBearing, headingSource: 'route-bearing' }
    }
    return {
      heading: normalizeHeading(fallbackHeading) ?? 0,
      headingSource: 'fallback',
    }
  }, [deviceHeading, fallbackHeading, gpsLocation?.gpsHeading, movementHeading, routeBearing])

  const location = useMemo(() => {
    if (!activeLocation) return null
    return {
      ...activeLocation,
      heading: headingData.heading,
      headingSource: headingData.headingSource,
    }
  }, [activeLocation, headingData.heading, headingData.headingSource])

  const errorMessage = useMemo(() => buildErrorMessage(error, status), [error, status])

  const source = location?.source || 'none'
  const isFallback = Boolean(location?.isFallback)
  const isWatching = status === 'watching' || status === 'requesting'

  return {
    // Primary state.
    location,
    position: location,
    latitude: location?.lat ?? null,
    longitude: location?.lng ?? null,
    accuracy: location?.accuracy ?? null,
    heading: headingData.heading,
    speed: location?.speed ?? null,
    headingSource: headingData.headingSource,
    source,
    isFallback,
    isLoading,
    isWatching,
    isTracking: isWatching,
    error,
    errorMessage,
    lastError,
    status,
    permissionState,
    lastUpdatedAt,
    fallbackLocation,
    // User Settings → "Location source" toggle. `forceFallback` is true when
    // the user explicitly chose default location, so callers can show
    // different copy (e.g. "Switch in Settings" vs "Retry GPS").
    locationPreference: preference,
    forceFallback,
    // Control surface.
    retryLocation,
    startWatching,
    stopWatching,
    // Backwards-compatible aliases used by existing callers.
    startTracking: startWatching,
    stopTracking: stopWatching,
    requestStart: startWatching,
    stop: stopWatching,
  }
}
