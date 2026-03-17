import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import NotificationBell from '../components/notifications/NotificationBell'
import NotificationToasts from '../components/notifications/NotificationToasts'
import { createNotificationSocket } from '../services/notificationSocket'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead as markAllNotificationsReadRequest,
  markNotificationRead as markNotificationReadRequest,
} from '../services/notificationsService'
import { useNotificationStore } from '../stores/notificationStore'
import { AuthContext } from './AuthContext'
import '../styles/NotificationCenter.css'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAdmin, isAuthenticated, isAuthLoading, token } = useContext(AuthContext)
  const location = useLocation()
  const socketRef = useRef(null)
  const toastHistoryRef = useRef(new Set())
  const handledNotificationIdsRef = useRef(new Set())

  const reset = useNotificationStore((state) => state.reset)
  const replaceNotifications = useNotificationStore((state) => state.replaceNotifications)
  const setError = useNotificationStore((state) => state.setError)
  const setLoading = useNotificationStore((state) => state.setLoading)
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const upsertNotification = useNotificationStore((state) => state.upsertNotification)
  const applyReadAll = useNotificationStore((state) => state.applyReadAll)
  const enqueueToast = useNotificationStore((state) => state.enqueueToast)
  const dismissToast = useNotificationStore((state) => state.dismissToast)

  useEffect(() => {
    const enableBell = isAuthenticated && !isAdmin
    document.body.classList.toggle('siara-notification-header-enabled', enableBell)

    return () => {
      document.body.classList.remove('siara-notification-header-enabled')
    }
  }, [isAdmin, isAuthenticated])

  useEffect(() => {
    if (isAuthLoading) {
      return undefined
    }

    if (!isAuthenticated || isAdmin) {
      toastHistoryRef.current.clear()
      handledNotificationIdsRef.current.clear()

      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }

      reset()
      return undefined
    }

    let cancelled = false

    setLoading(true)
    setError('')

    Promise.all([
      fetchNotifications({ limit: 20, offset: 0 }),
      fetchUnreadNotificationCount(),
    ])
      .then(([items, count]) => {
        if (cancelled) {
          return
        }

        replaceNotifications(items)
        setUnreadCount(count)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setError(error.response?.data?.message || 'Unable to load notifications.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    const socket = createNotificationSocket(token)
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('notification:subscribe', {})
    })

    socket.on('notification:created', (notification) => {
      const result = upsertNotification(notification)
      const liveNotification = result.notification

      if (liveNotification?.id && result.isNew && !toastHistoryRef.current.has(liveNotification.id)) {
        toastHistoryRef.current.add(liveNotification.id)
        enqueueToast(liveNotification)
      }

      if (liveNotification?.id) {
        socket.emit('notification:delivered', { notificationId: liveNotification.id })
      }
    })

    socket.on('notification:updated', (notification) => {
      upsertNotification(notification)
    })

    socket.on('notification:allRead', (payload) => {
      applyReadAll(payload?.ids || [], payload?.readAt || new Date().toISOString())
    })

    socket.connect()

    return () => {
      cancelled = true
      socket.removeAllListeners()
      socket.disconnect()

      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [
    applyReadAll,
    enqueueToast,
    isAdmin,
    isAuthenticated,
    isAuthLoading,
    replaceNotifications,
    reset,
    setError,
    setLoading,
    setUnreadCount,
    token,
    upsertNotification,
  ])

  useEffect(() => {
    if (!isAuthenticated || isAdmin) {
      return
    }

    const notificationId = new URLSearchParams(location.search).get('notification')
    if (!notificationId || handledNotificationIdsRef.current.has(notificationId)) {
      return
    }

    handledNotificationIdsRef.current.add(notificationId)
    markNotificationReadRequest(notificationId)
      .then((notification) => {
        if (notification) {
          upsertNotification(notification)
        }
      })
      .catch(() => {
        handledNotificationIdsRef.current.delete(notificationId)
      })
  }, [isAdmin, isAuthenticated, location.search, upsertNotification])

  const value = useMemo(() => ({
    async loadNotifications({ limit = 20, offset = 0 } = {}) {
      setLoading(true)
      setError('')

      try {
        const items = await fetchNotifications({ limit, offset })
        replaceNotifications(items)
        return items
      } catch (error) {
        const message = error.response?.data?.message || 'Unable to load notifications.'
        setError(message)
        throw error
      } finally {
        setLoading(false)
      }
    },

    async refreshUnreadCount() {
      const count = await fetchUnreadNotificationCount()
      setUnreadCount(count)
      return count
    },

    async markAllNotificationsRead() {
      const result = await markAllNotificationsReadRequest()
      applyReadAll(result.ids, result.readAt || new Date().toISOString())
      return result
    },

    async markNotificationRead(notificationId) {
      if (!notificationId) {
        return null
      }

      const notification = await markNotificationReadRequest(notificationId)
      if (notification) {
        upsertNotification(notification)
      }

      return notification
    },

    dismissToast,
  }), [
    applyReadAll,
    dismissToast,
    replaceNotifications,
    setError,
    setLoading,
    setUnreadCount,
    upsertNotification,
  ])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {isAuthenticated && !isAdmin ? <NotificationBell /> : null}
      {isAuthenticated && !isAdmin ? <NotificationToasts /> : null}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used inside NotificationProvider')
  }

  return context
}
