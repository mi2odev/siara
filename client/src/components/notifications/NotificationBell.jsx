import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

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

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))}m`
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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a4 4 0 0 0-4 4v1.1A6.99 6.99 0 0 1 5 14v2h14v-2a6.99 6.99 0 0 1-3-5.9V7a4 4 0 0 0-4-4Zm0 18a3 3 0 0 0 2.83-2H9.17A3 3 0 0 0 12 21Z"
        fill="currentColor"
      />
    </svg>
  )
}

function useHeaderMountNode() {
  const location = useLocation()
  const [mountNode, setMountNode] = useState(null)

  useEffect(() => {
    let frameId = 0

    const resolveMountNode = () => {
      setMountNode(document.querySelector('.dash-header-right'))
    }

    resolveMountNode()
    frameId = window.requestAnimationFrame(resolveMountNode)

    const observer = new MutationObserver(resolveMountNode)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [location.pathname])

  return mountNode
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const mountNode = useHeaderMountNode()
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  const items = useNotificationStore((state) => state.items)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const isPanelOpen = useNotificationStore((state) => state.isPanelOpen)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const setPanelOpen = useNotificationStore((state) => state.setPanelOpen)
  const { loadNotifications, markAllNotificationsRead, markNotificationRead } = useNotifications()

  const latestNotifications = items.slice(0, 6)

  useEffect(() => {
    if (!isPanelOpen) {
      return undefined
    }

    function handleClickOutside(event) {
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) {
        return
      }

      setPanelOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPanelOpen, setPanelOpen])

  async function handleTogglePanel() {
    const nextOpenState = !isPanelOpen
    setPanelOpen(nextOpenState)

    if (nextOpenState) {
      try {
        await loadNotifications({ limit: 20, offset: 0 })
      } catch (_error) {
      }
    }
  }

  async function handleOpenNotification(notification) {
    setPanelOpen(false)

    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
      } catch (_error) {
      }
    }

    navigate(notification.data?.reportUrl || notification.data?.mapUrl || '/notifications')
  }

  async function handleMarkAllRead(event) {
    event.stopPropagation()

    try {
      await markAllNotificationsRead()
    } catch (_error) {
    }
  }

  async function handleMarkOneRead(event, notificationId) {
    event.stopPropagation()

    try {
      await markNotificationRead(notificationId)
    } catch (_error) {
    }
  }

  if (!mountNode) {
    return null
  }

  return createPortal(
    <div className="notif-header-shell">
      <button
        ref={buttonRef}
        type="button"
        className={`notif-header-button ${isPanelOpen ? 'open' : ''}`}
        aria-label="Open notifications"
        onClick={() => { void handleTogglePanel() }}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="notif-header-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>

      {isPanelOpen ? (
        <div ref={panelRef} className="notif-header-panel">
          <div className="notif-header-panel-head">
            <div>
              <p className="notif-header-kicker">Notifications</p>
              <h3>{unreadCount} unread</h3>
            </div>
            <button
              type="button"
              className="notif-header-link"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="notif-header-list">
            {isLoading ? (
              <div className="notif-header-empty">Loading notifications...</div>
            ) : latestNotifications.length === 0 ? (
              <div className="notif-header-empty">No notifications yet.</div>
            ) : (
              latestNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notif-header-item tone-${getPriorityTone(notification.priority)} ${notification.readAt ? '' : 'unread'}`}
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
                  <div className="notif-header-item-copy">
                    <div className="notif-header-item-topline">
                      <span className="notif-header-item-title">{notification.title}</span>
                      {!notification.readAt ? <span className="notif-header-unread-dot" /> : null}
                    </div>
                    <span className="notif-header-item-body">{notification.body}</span>
                    <div className="notif-header-item-meta">
                      <span>{notification.data?.zoneName || notification.data?.locationLabel || 'Monitored area'}</span>
                      <span>{formatRelativeTime(notification.createdAt)}</span>
                    </div>
                  </div>
                  {!notification.readAt ? (
                    <button
                      type="button"
                      className="notif-header-mark"
                      onClick={(event) => { void handleMarkOneRead(event, notification.id) }}
                    >
                      Read
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="notif-header-panel-foot">
            <button
              type="button"
              className="notif-header-view-all"
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
    </div>,
    mountNode,
  )
}
