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
    inAppCreated: Boolean(response.data?.inAppCreated),
    inAppNotificationId: response.data?.inAppNotificationId || null,
  }
}
