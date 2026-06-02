import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../../contexts/NotificationContext'
import { useNotificationStore } from '../../stores/notificationStore'

function formatRelativeTime(value) {
  if (!value) {
    return 'Now'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Now'
  }

  const diffMs = Date.now() - date.getTime()
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) {
    return 'Now'
  }
  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)}m`
  }
  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h`
  }

  return `${Math.floor(diffMs / dayMs)}d`
}

function getPriorityTone(priority) {
  if (priority <= 1) {
    return 'high'
  }
  if (priority === 2) {
    return 'medium'
  }
  return 'neutral'
}

function BellIcon() {
  return (
    <svg
      className="notif-bell-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const shellRef = useRef(null)

  // Panel open-state is local so multiple mounted bells (e.g. the responsive
  // mobile + desktop headers on the report page) never share or fight over it.
  const [isPanelOpen, setPanelOpen] = useState(false)

  const items = useNotificationStore((state) => state.items)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const { loadNotifications, markAllNotificationsRead, markNotificationRead } = useNotifications()

  const latestNotifications = items.slice(0, 6)

  // Close the panel when the user clicks outside of it or presses Escape.
  useEffect(() => {
    if (!isPanelOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (shellRef.current?.contains(event.target)) {
        return
      }
      setPanelOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPanelOpen, setPanelOpen])

  async function handleTogglePanel() {
    const nextOpenState = !isPanelOpen
    setPanelOpen(nextOpenState)

    if (nextOpenState) {
      try {
        await loadNotifications({ limit: 20, offset: 0 })
      } catch {
        // Keep the header control responsive if a refresh request fails.
      }
    }
  }

  async function handleOpenNotification(notification) {
    setPanelOpen(false)

    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
      } catch {
        // Navigation should still continue even if the read receipt fails.
      }
    }

    // Always open the notifications page with this notification selected, rather
    // than following an event-specific deep link (e.g. a police map URL). The
    // detail panel itself exposes the relevant "view incident / map" actions.
    navigate(`/notifications?notification=${encodeURIComponent(notification.id)}`)
  }

  async function handleMarkAllRead(event) {
    event.stopPropagation()

    try {
      await markAllNotificationsRead()
    } catch {
      // The notification panel remains usable if the bulk update fails.
    }
  }

  async function handleMarkOneRead(event, notificationId) {
    event.stopPropagation()

    try {
      await markNotificationRead(notificationId)
    } catch {
      // Avoid blocking the rest of the notification interactions.
    }
  }

  return (
    <div className={`notif-bell ${isPanelOpen ? 'is-open' : ''}`} ref={shellRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isPanelOpen}
        onClick={() => { void handleTogglePanel() }}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="notif-bell-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isPanelOpen ? (
        <div className="notif-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell-panel-head">
            <div className="notif-bell-heading">
              <span className="notif-bell-kicker">Notifications</span>
              <h3 className="notif-bell-title">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </h3>
            </div>
            <button
              type="button"
              className="notif-bell-markall"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="notif-bell-list">
            {isLoading && latestNotifications.length === 0 ? (
              <div className="notif-bell-empty">Loading notifications…</div>
            ) : latestNotifications.length === 0 ? (
              <div className="notif-bell-empty">
                <span className="notif-bell-empty-icon"><BellIcon /></span>
                You have no notifications yet.
              </div>
            ) : (
              latestNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notif-bell-item tone-${getPriorityTone(notification.priority)} ${notification.readAt ? '' : 'is-unread'}`}
                  onClick={() => { void handleOpenNotification(notification) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void handleOpenNotification(notification)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="notif-bell-item-rail" aria-hidden="true" />
                  <div className="notif-bell-item-main">
                    <div className="notif-bell-item-top">
                      <span className="notif-bell-item-title">{notification.title}</span>
                      <span className="notif-bell-item-time">{formatRelativeTime(notification.createdAt)}</span>
                    </div>
                    <span className="notif-bell-item-body">{notification.body}</span>
                    <div className="notif-bell-item-foot">
                      <span className="notif-bell-item-zone">
                        {notification.data?.zoneName || notification.data?.locationLabel || 'Monitored area'}
                      </span>
                      {!notification.readAt ? (
                        <button
                          type="button"
                          className="notif-bell-read"
                          onClick={(event) => { void handleMarkOneRead(event, notification.id) }}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="notif-bell-foot">
            <button
              type="button"
              className="notif-bell-viewall"
              onClick={() => {
                setPanelOpen(false)
                navigate('/notifications')
              }}
            >
              See all notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
