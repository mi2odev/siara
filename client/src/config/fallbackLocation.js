// Fallback test location configuration.
//
// Exposed via Vite env vars so QA can point the fallback at a different
// city without rebuilding the bundle. If env values are missing or invalid,
// the defaults below (downtown Algiers) are used.
//
// IMPORTANT: a location whose `source !== 'gps'` MUST NOT be treated as a
// trusted GPS reading. Police uploads filter this out unless explicitly
// allowed via VITE_ALLOW_FALLBACK_LOCATION_UPLOAD=true.

const DEFAULT_FALLBACK_LAT = 36.7538
const DEFAULT_FALLBACK_LNG = 3.0588
const DEFAULT_FALLBACK_LABEL = 'Fallback test location - Algiers'

function parseFiniteNumber(value, fallback) {
  if (value == null || value === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function readEnv(key) {
  // import.meta.env is statically replaced by Vite, so this is safe at build time.
  try {
    return import.meta.env?.[key]
  } catch {
    return undefined
  }
}

export const FALLBACK_LAT = parseFiniteNumber(readEnv('VITE_FALLBACK_LAT'), DEFAULT_FALLBACK_LAT)
export const FALLBACK_LNG = parseFiniteNumber(readEnv('VITE_FALLBACK_LNG'), DEFAULT_FALLBACK_LNG)
export const FALLBACK_LABEL = String(
  readEnv('VITE_FALLBACK_LOCATION_LABEL') || DEFAULT_FALLBACK_LABEL,
)

export const ALLOW_FALLBACK_LOCATION_UPLOAD =
  String(readEnv('VITE_ALLOW_FALLBACK_LOCATION_UPLOAD') || '').toLowerCase() === 'true'

export function buildFallbackLocation(timestamp = Date.now()) {
  const iso = new Date(timestamp).toISOString()
  return {
    lat: FALLBACK_LAT,
    lng: FALLBACK_LNG,
    latitude: FALLBACK_LAT,
    longitude: FALLBACK_LNG,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    gpsHeading: null,
    speed: null,
    timestamp: iso,
    timestampMs: timestamp,
    source: 'fallback',
    isFallback: true,
    label: FALLBACK_LABEL,
  }
}
