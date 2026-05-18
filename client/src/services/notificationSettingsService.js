// Client wrapper for the orchestrator notification-settings surface.
//
// Endpoints (Node API):
//   GET  /api/account/notification-settings
//   PUT  /api/account/notification-settings   body: { account, categories }
//   POST /api/notifications/test
//   DELETE /api/notifications/devices/:id
//   PUT  /api/users/me/location               body: { lat, lng, accuracyMeters?, source? }

import { userRequest } from '../requestMethodes'

const ACCOUNT_PATH = '/account/notification-settings'
const NOTIFICATIONS_PATH = '/notifications'
const LOCATION_PATH = '/users/me/location'

export const NOTIFICATION_CATEGORIES = Object.freeze([
  'incident_nearby',
  'user_alert_match',
  'police_assignment',
  'police_status_update',
  'police_work_zone_incident',
  'police_backup',
  'operational_alert',
  'system',
])

export async function fetchNotificationSettings() {
  const response = await userRequest.get(ACCOUNT_PATH)
  return response.data || { account: null, categories: {}, devices: { web: [], mobile: [] } }
}

export async function updateNotificationSettings(payload) {
  const response = await userRequest.put(ACCOUNT_PATH, payload || {})
  return response.data || { account: null, categories: {} }
}

export async function sendNotificationTest() {
  const response = await userRequest.post(`${NOTIFICATIONS_PATH}/test`)
  return response.data || { ok: false }
}

export async function deactivateNotificationDevice(deviceId) {
  if (!deviceId) {
    throw new Error('deviceId is required')
  }
  const response = await userRequest.delete(`${NOTIFICATIONS_PATH}/devices/${encodeURIComponent(deviceId)}`)
  return response.data || { ok: false }
}

// Best-effort: caller should swallow errors (network blip, no auth, etc.) —
// nearby-incident fan-out continues to work for users whose location IS known.
export async function pingUserLocation({ lat, lng, accuracyMeters = null, source = 'browser' }) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    throw new Error('lat and lng must be finite numbers')
  }
  const payload = {
    lat: Number(lat),
    lng: Number(lng),
    accuracyMeters: Number.isFinite(Number(accuracyMeters)) ? Number(accuracyMeters) : null,
    source,
  }
  const response = await userRequest.put(LOCATION_PATH, payload)
  return response.data || { ok: false }
}
