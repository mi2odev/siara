import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
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

function normalizeLocation(position) {
  if (!position?.coords) return null
  const lat = toFiniteNumber(position.coords.latitude)
  const lng = toFiniteNumber(position.coords.longitude)
  if (lat == null || lng == null) return null

  return {
    lat,
    lng,
    accuracy: toFiniteNumber(position.coords.accuracy),
    altitude: toFiniteNumber(position.coords.altitude),
    altitudeAccuracy: toFiniteNumber(position.coords.altitudeAccuracy),
    gpsHeading: isValidGpsHeading(position.coords.heading)
      ? normalizeHeading(position.coords.heading)
      : null,
    speed: toFiniteNumber(position.coords.speed),
    timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
  }
}

function getDeviceOrientationHeading(event) {
  const webkitHeading = normalizeHeading(event?.webkitCompassHeading)
  if (webkitHeading != null) return webkitHeading

  // On browsers that expose alpha, it is commonly clockwise from north when
  // absolute orientation is available. Many desktop browsers do not expose a
  // true compass sensor at all, so this path intentionally remains best-effort.
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

/**
 * Tracks live browser location with navigator.geolocation.watchPosition().
 *
 * Browser reality check: GPS heading is only available on some mobile devices
 * while moving. DeviceOrientation is also sensor-dependent and usually absent
 * on desktop/laptop hardware, so the hook falls back to movement bearing and
 * finally to optional route/map bearings supplied by the caller.
 */
export default function useLiveLocation(opts = {}) {
  const {
    autoStart = true,
    enableHighAccuracy = GEOLOCATION_OPTIONS.enableHighAccuracy,
    maximumAge = GEOLOCATION_OPTIONS.maximumAge,
    timeout = GEOLOCATION_OPTIONS.timeout,
    routeBearing = null,
    fallbackHeading = 0,
  } = opts

  const [rawLocation, setRawLocation] = useState(null)
  const [error, setError] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [deviceHeading, setDeviceHeading] = useState(null)
  const [movementHeading, setMovementHeading] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const watchIdRef = useRef(null)
  const rawLocationRef = useRef(null)
  const previousLocationRef = useRef(null)
  const orientationListeningRef = useRef(false)

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

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    stopOrientation()
    setStatus((current) => (current === 'watching' || current === 'requesting' ? 'idle' : current))
  }, [stopOrientation])

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

  const startTracking = useCallback(() => {
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (window.isSecureContext === false && !isLocalhost) {
        setStatus('insecure')
        setError({ code: -1, message: 'Geolocation requires HTTPS, except on localhost.' })
        return
      }
    }

    if (!navigator?.geolocation?.watchPosition) {
      setStatus('unsupported')
      setError({ code: -2, message: 'Geolocation is not supported by this browser.' })
      return
    }

    if (watchIdRef.current != null) {
      setStatus(rawLocationRef.current ? 'watching' : 'requesting')
      setError(null)
      startOrientation()
      return
    }

    setStatus('requesting')
    setError(null)
    startOrientation()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = normalizeLocation(position)
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
        rawLocationRef.current = nextLocation
        setRawLocation(nextLocation)
        setLastUpdatedAt(Date.now())
        setStatus('watching')
        setError(null)
        setLastError(null)
      },
      (nextError) => {
        const nextStatus = mapGeolocationStatus(nextError)
        setLastError(nextError)
        if (
          rawLocationRef.current &&
          (nextStatus === 'timeout' || nextStatus === 'unavailable')
        ) {
          setStatus('watching')
          setError(null)
          return
        }
        setError(nextError)
        setStatus(nextStatus)
      },
      { enableHighAccuracy, maximumAge, timeout },
    )
  }, [enableHighAccuracy, maximumAge, startOrientation, timeout])

  useEffect(() => {
    if (autoStart) startTracking()
    return stopTracking
  }, [autoStart, startTracking, stopTracking])

  const headingData = useMemo(() => {
    if (rawLocation?.gpsHeading != null) {
      return { heading: rawLocation.gpsHeading, headingSource: 'gps' }
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
  }, [deviceHeading, fallbackHeading, movementHeading, rawLocation?.gpsHeading, routeBearing])

  const location = useMemo(() => {
    if (!rawLocation) return null
    return {
      ...rawLocation,
      heading: headingData.heading,
      headingSource: headingData.headingSource,
    }
  }, [headingData.heading, headingData.headingSource, rawLocation])

  return {
    location,
    position: location,
    error,
    lastError,
    status,
    isTracking: status === 'requesting' || status === 'watching',
    heading: headingData.heading,
    headingSource: headingData.headingSource,
    accuracy: rawLocation?.accuracy ?? null,
    lastUpdatedAt,
    startTracking,
    stopTracking,
    requestStart: startTracking,
    stop: stopTracking,
  }
}
