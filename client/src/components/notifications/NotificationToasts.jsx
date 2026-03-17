import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../../contexts/NotificationContext'
import { useNotificationStore } from '../../stores/notificationStore'

function getPriorityLabel(priority) {
  if (priority <= 1) {
    return 'High'
  }
  if (priority === 2) {
    return 'Medium'
  }
  return 'Info'
}

function ToastItem({ notification }) {
  const navigate = useNavigate()
  const dismissToast = useNotificationStore((state) => state.dismissToast)
  const { markNotificationRead } = useNotifications()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      dismissToast(notification.id)
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [dismissToast, notification.id])

  async function handleView() {
    dismissToast(notification.id)

    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
      } catch (_error) {
      }
    }

    navigate(notification.data?.reportUrl || notification.data?.mapUrl || '/notifications')
  }

  return (
    <div
      className={`notif-toast-card priority-${notification.priority <= 1 ? 'high' : notification.priority === 2 ? 'medium' : 'neutral'}`}
      onClick={() => { void handleView() }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void handleView()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="notif-toast-copy">
        <span className="notif-toast-kicker">{getPriorityLabel(notification.priority)} priority</span>
        <span className="notif-toast-title">{notification.title}</span>
        <span className="notif-toast-body">{notification.body}</span>
      </div>
      <div className="notif-toast-actions">
        <button
          type="button"
          className="notif-toast-link"
          onClick={(event) => {
            event.stopPropagation()
            void handleView()
          }}
        >
          View
        </button>
        <button
          type="button"
          className="notif-toast-close"
          onClick={(event) => {
            event.stopPropagation()
            dismissToast(notification.id)
          }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default function NotificationToasts() {
  const toastQueue = useNotificationStore((state) => state.toastQueue)

  if (toastQueue.length === 0) {
    return null
  }

  return (
    <div className="notif-toast-stack" aria-live="polite">
      {toastQueue.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}
