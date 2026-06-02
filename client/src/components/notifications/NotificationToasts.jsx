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

    // Open the notifications page with this item selected instead of following an
    // event-specific deep link (e.g. a police map URL). Keeps parity with the bell.
    navigate(`/notifications?notification=${encodeURIComponent(notification.id)}`)
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
      <span className="notif-toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>

      <div className="notif-toast-copy">
        <span className="notif-toast-kicker">{getPriorityLabel(notification.priority)} priority</span>
        <span className="notif-toast-title">{notification.title}</span>
        <span className="notif-toast-body">{notification.body}</span>
        <button
          type="button"
          className="notif-toast-link"
          onClick={(event) => {
            event.stopPropagation()
            void handleView()
          }}
        >
          View details
        </button>
      </div>

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
