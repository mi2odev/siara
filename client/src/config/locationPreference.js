// User-controlled choice between real GPS and the fallback test location.
//
// Stored in localStorage so it survives reloads but is per-device — there is
// intentionally no server round-trip for this (privacy + the toggle should
// react instantly). The `siara:location-preference-changed` CustomEvent lets
// useLiveLocation pick up changes without a page reload.

const STORAGE_KEY = 'siara.location.preferredSource'
export const LOCATION_PREFERENCE_GPS = 'gps'
export const LOCATION_PREFERENCE_DEFAULT = 'default'
const DEFAULT_VALUE = LOCATION_PREFERENCE_GPS
export const LOCATION_PREFERENCE_EVENT = 'siara:location-preference-changed'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getLocationPreference() {
  if (!isBrowser()) return DEFAULT_VALUE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === LOCATION_PREFERENCE_GPS || raw === LOCATION_PREFERENCE_DEFAULT) {
      return raw
    }
  } catch {
    // Storage disabled (private mode, quota) — fall back to live GPS.
  }
  return DEFAULT_VALUE
}

export function setLocationPreference(value) {
  const next = value === LOCATION_PREFERENCE_DEFAULT
    ? LOCATION_PREFERENCE_DEFAULT
    : LOCATION_PREFERENCE_GPS
  if (!isBrowser()) return next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Best-effort: still emit the event so the current session reacts.
  }
  try {
    window.dispatchEvent(
      new CustomEvent(LOCATION_PREFERENCE_EVENT, { detail: { value: next } }),
    )
  } catch {
    // Older browsers without CustomEvent — UI will still update on reload.
  }
  return next
}

export function isFallbackPreferred() {
  return getLocationPreference() === LOCATION_PREFERENCE_DEFAULT
}
