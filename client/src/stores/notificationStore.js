import { create } from 'zustand'

function isUnread(notification) {
  return !notification?.readAt && notification?.status !== 'read'
}

function normalizeNotification(notification) {
  if (!notification || typeof notification !== 'object') {
    return null
  }

  return {
    ...notification,
    data: notification.data && typeof notification.data === 'object' ? notification.data : {},
    priority: Number(notification.priority ?? 2),
    readAt: notification.readAt || null,
    read: !(!notification.readAt && notification.status !== 'read'),
  }
}

function sortNotifications(items) {
  return [...items].sort((left, right) => {
    const rightTime = new Date(right.createdAt || 0).getTime()
    const leftTime = new Date(left.createdAt || 0).getTime()

    if (rightTime !== leftTime) {
      return rightTime - leftTime
    }

    return String(right.id || '').localeCompare(String(left.id || ''))
  })
}

const initialState = {
  error: '',
  hasLoaded: false,
  isLoading: false,
  isPanelOpen: false,
  items: [],
  toastQueue: [],
  unreadCount: 0,
}

export const useNotificationStore = create((set) => ({
  ...initialState,

  reset() {
    set({ ...initialState })
  },

  setError(error) {
    set({ error: error || '' })
  },

  setLoading(isLoading) {
    set({ isLoading: Boolean(isLoading) })
  },

  setPanelOpen(isPanelOpen) {
    set({ isPanelOpen: Boolean(isPanelOpen) })
  },

  setUnreadCount(unreadCount) {
    set({ unreadCount: Math.max(0, Number(unreadCount || 0)) })
  },

  replaceNotifications(items) {
    const normalizedItems = Array.isArray(items)
      ? items.map(normalizeNotification).filter(Boolean)
      : []

    set({
      error: '',
      hasLoaded: true,
      items: sortNotifications(normalizedItems),
    })
  },

  upsertNotification(notification) {
    const normalizedNotification = normalizeNotification(notification)
    if (!normalizedNotification) {
      return { isNew: false, notification: null }
    }

    let wasInserted = false

    set((state) => {
      const existingIndex = state.items.findIndex((item) => item.id === normalizedNotification.id)
      const nextItems = [...state.items]
      let unreadCount = state.unreadCount

      if (existingIndex >= 0) {
        const previousItem = nextItems[existingIndex]
        const wasPreviouslyUnread = isUnread(previousItem)
        const isCurrentlyUnread = isUnread(normalizedNotification)
        nextItems[existingIndex] = normalizedNotification

        if (wasPreviouslyUnread && !isCurrentlyUnread) {
          unreadCount = Math.max(0, unreadCount - 1)
        } else if (!wasPreviouslyUnread && isCurrentlyUnread) {
          unreadCount += 1
        }
      } else {
        wasInserted = true
        nextItems.unshift(normalizedNotification)
        if (isUnread(normalizedNotification)) {
          unreadCount += 1
        }
      }

      return {
        error: '',
        hasLoaded: true,
        items: sortNotifications(nextItems),
        unreadCount,
      }
    })

    return {
      isNew: wasInserted,
      notification: normalizedNotification,
    }
  },

  applyReadAll(ids, readAt) {
    const idSet = new Set(Array.isArray(ids) ? ids : [])

    set((state) => ({
      items: state.items.map((item) => {
        if (!idSet.has(item.id)) {
          return item
        }

        return {
          ...item,
          deliveredAt: item.deliveredAt || readAt || item.createdAt,
          read: true,
          readAt: item.readAt || readAt || new Date().toISOString(),
          sentAt: item.sentAt || item.createdAt,
          status: 'read',
        }
      }),
      unreadCount: Math.max(0, state.unreadCount - idSet.size),
    }))
  },

  enqueueToast(notification) {
    const normalizedNotification = normalizeNotification(notification)
    if (!normalizedNotification) {
      return
    }

    set((state) => {
      if (state.toastQueue.some((item) => item.id === normalizedNotification.id)) {
        return state
      }

      return {
        toastQueue: [normalizedNotification, ...state.toastQueue].slice(0, 4),
      }
    })
  },

  dismissToast(notificationId) {
    set((state) => ({
      toastQueue: state.toastQueue.filter((item) => item.id !== notificationId),
    }))
  },
}))
