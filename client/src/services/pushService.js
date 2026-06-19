import { publicRequest, userRequest } from '../requestMethodes'

const PUSH_ENDPOINT = '/push'

function hasWindow() {
  return typeof window !== 'undefined'
}

function isServiceWorkerSupported() {
  return hasWindow() && 'serviceWorker' in navigator
}

export function isPushSupported() {
  return hasWindow()
    && isServiceWorkerSupported()
    && 'PushManager' in window
    && 'Notification' in window
  }

export function getPushPermissionState() {
  if (!hasWindow() || !('Notification' in window)) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function registerPushServiceWorker() {
  if (!isServiceWorkerSupported()) {
    return null
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration('/')
  if (existingRegistration) {
    return existingRegistration
  }

  return navigator.serviceWorker.register('/sw.js')
}

async function getPushRegistration() {
  if (!isPushSupported()) {
    return null
  }

  const registration = await registerPushServiceWorker()
  return registration || navigator.serviceWorker.ready
}

// Service-worker registration without requiring PushManager — enough to render
// a local system notification (used to mirror every in-app notification as a
// desktop/system one while the app is open).
async function getServiceWorkerRegistration() {
  if (!isServiceWorkerSupported()) {
    return null
  }

  const registration = await registerPushServiceWorker()
  return registration || navigator.serviceWorker.ready
}

function buildSystemNotificationUrl(notification) {
  const data = notification?.data || {}
  const reportId = notification?.reportId || data.reportId || null
  const base = data.reportUrl
    || data.mapUrl
    || (reportId ? `/incident/${reportId}` : '/notifications')

  try {
    const resolved = new URL(base, window.location.origin)
    if (notification?.id) {
      resolved.searchParams.set('notification', notification.id)
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch (_error) {
    return '/notifications'
  }
}

// Asks for browser notification permission once (no-op if already decided).
export async function ensureSystemNotificationPermission() {
  if (!hasWindow() || !('Notification' in window)) {
    return 'unsupported'
  }

  if (Notification.permission !== 'default') {
    return Notification.permission
  }

  try {
    return await Notification.requestPermission()
  } catch (_error) {
    return Notification.permission
  }
}

// Renders a system/desktop notification for a single in-app notification via
// the service worker. Safe to call for every live notification — it silently
// no-ops when unsupported or permission isn't granted.
export async function showSystemNotification(notification) {
  if (!notification || !hasWindow() || !('Notification' in window)) {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  const registration = await getServiceWorkerRegistration().catch(() => null)
  if (!registration || typeof registration.showNotification !== 'function') {
    return false
  }

  const data = notification.data || {}
  const priority = Number(notification.priority ?? 2)

  try {
    await registration.showNotification(notification.title || 'SIARA', {
      body: notification.body || '',
      icon: '/siara-push-icon.svg',
      badge: '/siara-push-badge.svg',
      tag: notification.id || `siara-${notification.createdAt || ''}`,
      renotify: false,
      requireInteraction: priority <= 1,
      data: {
        notificationId: notification.id || null,
        url: buildSystemNotificationUrl(notification),
        eventType: notification.eventType || null,
        reportId: notification.reportId || data.reportId || null,
        zoneName: data.zoneName || data.locationLabel || null,
      },
    })
    return true
  } catch (_error) {
    return false
  }
}

function urlBase64ToUint8Array(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const base64 = normalized + padding
  const rawData = window.atob(base64)
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}

function serializeSubscription(subscription) {
  if (!subscription) {
    return null
  }

  if (typeof subscription.toJSON === 'function') {
    return subscription.toJSON()
  }

  return subscription
}

export async function getExistingPushSubscription() {
  const registration = await getPushRegistration()
  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export async function fetchPushPublicKey() {
  const response = await publicRequest.get(`${PUSH_ENDPOINT}/public-key`)
  return response.data?.publicKey || ''
}

export async function fetchPushPreferences() {
  const response = await userRequest.get(`${PUSH_ENDPOINT}/preferences`)
  return response.data?.preferences || null
}

export async function updatePushPreferences(payload) {
  const response = await userRequest.patch(`${PUSH_ENDPOINT}/preferences`, payload)
  return response.data?.preferences || null
}

async function syncPushSubscription(subscription) {
  const response = await userRequest.post(`${PUSH_ENDPOINT}/subscribe`, serializeSubscription(subscription))
  return response.data?.subscription || null
}

export async function subscribeCurrentBrowserToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.')
  }

  const registration = await getPushRegistration()
  if (!registration) {
    throw new Error('Unable to register the SIARA service worker.')
  }

  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    await syncPushSubscription(existingSubscription)
    return {
      subscription: existingSubscription,
      permission: getPushPermissionState(),
    }
  }

  if (Notification.permission === 'denied') {
    throw new Error('Browser notifications are blocked for SIARA in this browser.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Browser notifications are blocked for SIARA in this browser.'
      : 'Browser notification permission was not granted.')
  }

  const publicKey = await fetchPushPublicKey()
  if (!publicKey) {
    throw new Error('Web Push public key is unavailable.')
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await syncPushSubscription(subscription)
  return {
    subscription,
    permission,
  }
}

export async function unsubscribeCurrentBrowserFromPush() {
  const subscription = await getExistingPushSubscription()
  if (!subscription) {
    return {
      endpoint: null,
      unsubscribed: false,
    }
  }

  const endpoint = subscription.endpoint
  await userRequest.delete(`${PUSH_ENDPOINT}/unsubscribe`, {
    data: { endpoint },
  })

  try {
    await subscription.unsubscribe()
  } catch (_error) {
  }

  return {
    endpoint,
    unsubscribed: true,
  }
}

export async function sendPushTest() {
  const response = await userRequest.post(`${PUSH_ENDPOINT}/test`)
  return {
    ok: Boolean(response.data?.ok),
    sentCount: Number(response.data?.sentCount || 0),
    deactivatedCount: Number(response.data?.deactivatedCount || 0),
    failureCount: Number(response.data?.failureCount || 0),
    reason: response.data?.reason || null,
  }
}

// ---------- Mobile device pairing (QR flow) ----------
//
// All four endpoints require an authenticated SIARA user. The pairing code
// is returned exactly once on creation and is one-time-use; the modal must
// not persist it beyond the lifetime of the open QR card.

export async function createMobilePairingSession({ meta = {} } = {}) {
  const response = await userRequest.post(
    `${PUSH_ENDPOINT}/mobile/pairing-sessions`,
    { meta },
  )
  return response.data || null
}

export async function fetchMobilePairingSession(sessionId) {
  if (!sessionId) throw new Error('sessionId is required')
  const response = await userRequest.get(
    `${PUSH_ENDPOINT}/mobile/pairing-sessions/${encodeURIComponent(sessionId)}`,
  )
  return response.data?.session || null
}

export async function cancelMobilePairingSession(sessionId) {
  if (!sessionId) throw new Error('sessionId is required')
  const response = await userRequest.delete(
    `${PUSH_ENDPOINT}/mobile/pairing-sessions/${encodeURIComponent(sessionId)}`,
  )
  return response.data || { ok: false, cancelled: false }
}
