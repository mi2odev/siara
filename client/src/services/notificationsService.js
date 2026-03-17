import { userRequest } from '../requestMethodes'

const NOTIFICATIONS_ENDPOINT = '/notifications'

export async function fetchNotifications({ limit = 20, offset = 0 } = {}) {
  const response = await userRequest.get(NOTIFICATIONS_ENDPOINT, {
    params: { limit, offset },
  })

  return response.data?.items || []
}

export async function fetchUnreadNotificationCount() {
  const response = await userRequest.get(`${NOTIFICATIONS_ENDPOINT}/unread-count`)
  return Number(response.data?.count || 0)
}

export async function markNotificationRead(notificationId) {
  const response = await userRequest.patch(`${NOTIFICATIONS_ENDPOINT}/${notificationId}/read`)
  return response.data?.notification || null
}

export async function markAllNotificationsRead() {
  const response = await userRequest.patch(`${NOTIFICATIONS_ENDPOINT}/read-all`)

  return {
    ids: response.data?.ids || [],
    readAt: response.data?.readAt || null,
    updatedCount: Number(response.data?.updatedCount || 0),
  }
}
