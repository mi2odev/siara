import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { useNotificationStore } from '../../stores/notificationStore'
import '../../styles/DashboardPage.css'
import '../../styles/NotificationsPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

function formatRelativeTime(value) {
  if (!value) {
    return 'Just now'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Just now'
  }

  const diffMs = Date.now() - date.getTime()
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const weekMs = 7 * dayMs

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))} min ago`
  }
  if (diffMs < dayMs) {
    return `${Math.max(1, Math.floor(diffMs / hourMs))} h ago`
  }
  if (diffMs < weekMs) {
    return `${Math.max(1, Math.floor(diffMs / dayMs))} d ago`
  }

  return date.toLocaleDateString()
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  return date.toLocaleString()
}

function getPriorityLabel(priority) {
  if (priority <= 1) {
    return 'High'
  }
  if (priority === 2) {
    return 'Medium'
  }
  return 'Normal'
}

function getPriorityColor(priority) {
  if (priority <= 1) {
    return '#dc2626'
  }
  if (priority === 2) {
    return '#f59e0b'
  }
  return '#2563eb'
}

function groupNotificationsByDate(notifications) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  return notifications.reduce((groups, notification) => {
    const createdAt = new Date(notification.createdAt || 0)

    if (createdAt >= today) {
      groups.today.push(notification)
    } else if (createdAt >= yesterday) {
      groups.yesterday.push(notification)
    } else {
      groups.older.push(notification)
    }

    return groups
  }, { today: [], yesterday: [], older: [] })
}

function getNotificationTarget(notification) {
  return notification.data?.reportUrl || notification.data?.mapUrl || '/notifications'
}

function getUserInitial(name) {
  const normalized = String(name || '').trim()
  if (!normalized) return 'U'
  return normalized.charAt(0).toUpperCase()
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { isAuthenticated, logout, user } = useContext(AuthContext)
  const { loadNotifications, markAllNotificationsRead, markNotificationRead } = useNotifications()

  const error = useNotificationStore((state) => state.error)
  const hasLoaded = useNotificationStore((state) => state.hasLoaded)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const notifications = useNotificationStore((state) => state.items)
  const unreadCount = useNotificationStore((state) => state.unreadCount)

  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedNotificationId, setSelectedNotificationId] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const displayName = user?.name || user?.email || 'SIARA User'
  const roleLabel = Array.isArray(user?.roles) && user.roles.includes('admin') ? 'Admin' : 'Citizen'

  useEffect(() => {
    if (!isAuthenticated || hasLoaded) {
      return
    }

    loadNotifications({ limit: 50, offset: 0 }).catch(() => {})
  }, [hasLoaded, isAuthenticated, loadNotifications])

  const filteredNotifications = useMemo(() => notifications.filter((notification) => {
    if (statusFilter === 'unread' && notification.readAt) {
      return false
    }
    if (statusFilter === 'read' && !notification.readAt) {
      return false
    }

    if (priorityFilter === 'high' && notification.priority > 1) {
      return false
    }
    if (priorityFilter === 'medium' && notification.priority !== 2) {
      return false
    }
    if (priorityFilter === 'normal' && notification.priority < 3) {
      return false
    }

    if (timeFilter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(notification.createdAt || 0) < today) {
        return false
      }
    }

    if (timeFilter === 'week') {
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
      if (new Date(notification.createdAt || 0).getTime() < weekAgo) {
        return false
      }
    }

    return true
  }), [notifications, priorityFilter, statusFilter, timeFilter])

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications],
  )

  const selectedNotification = useMemo(
    () => filteredNotifications.find((notification) => notification.id === selectedNotificationId) || null,
    [filteredNotifications, selectedNotificationId],
  )

  useEffect(() => {
    if (filteredNotifications.length === 0) {
      setSelectedNotificationId(null)
      return
    }

    if (selectedNotificationId && filteredNotifications.some((notification) => notification.id === selectedNotificationId)) {
      return
    }

    setSelectedNotificationId(filteredNotifications[0].id)
  }, [filteredNotifications, selectedNotificationId])

  async function handleSelectNotification(notification) {
    setSelectedNotificationId(notification.id)

    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id)
      } catch (_error) {
      }
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
    } catch (_error) {
    }
  }

  async function handleMarkSingleRead(notificationId) {
    try {
      await markNotificationRead(notificationId)
    } catch (_error) {
    }
  }

  function renderNotificationItem(notification) {
    const priorityColor = getPriorityColor(notification.priority)

    return (
      <div
        key={notification.id}
        className={[
          'notif-item',
          !notification.readAt ? 'unread' : '',
          selectedNotification?.id === notification.id ? 'selected' : '',
          notification.priority <= 1 ? 'priority-high' : notification.priority === 2 ? 'priority-medium' : 'priority-neutral',
        ].filter(Boolean).join(' ')}
        onClick={() => { void handleSelectNotification(notification) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void handleSelectNotification(notification)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="notif-icon" style={{ background: `${priorityColor}12`, color: priorityColor }}>
          {notification.priority <= 1 ? 'H' : notification.priority === 2 ? 'M' : 'N'}
        </div>
        <div className="notif-content">
          <span className="notif-title">{notification.title}</span>
          <span className="notif-context">{notification.body}</span>
          <span className="notif-location">{notification.data?.zoneName || notification.data?.locationLabel || 'Monitored area'}</span>
        </div>
        <div className="notif-meta">
          <span className="notif-time">{formatRelativeTime(notification.createdAt)}</span>
          {!notification.readAt ? <span className="notif-dot"></span> : null}
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="notifications-page notifications-page-empty">
        <div className="notif-empty">
          <h3>Sign in to view your notifications</h3>
          <p>Live incident alerts appear here after you log in and create alert rules.</p>
          <button className="empty-btn primary" onClick={() => navigate('/login')}>
            Go to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Search notifications, incidents, zones..."
              aria-label="Search"
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown((current) => !current)}>
                {getUserInitial(user?.name || user?.email)}
              </button>
              {showDropdown ? (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/alerts') }}>Alerts</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="notif-grid">
        <aside className="notif-left">
          <div className="notif-profile-card">
            <div className="notif-profile-avatar-wrap">
              <img src={profileAvatar} alt={displayName} className="notif-profile-avatar" />
              <span className="notif-profile-badge">✓</span>
            </div>
            <h3 className="notif-profile-name">{displayName}</h3>
            <span className="notif-profile-role">{roleLabel}</span>
            <p className="notif-profile-copy">Track incident updates and manage your notification workflow.</p>
            <button className="notif-profile-btn" onClick={() => navigate('/profile')}>View Profile</button>
          </div>

          <div className="filter-section">
            <span className="filter-label">Status</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'read', label: 'Read' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`filter-btn ${statusFilter === item.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="filter-section">
            <span className="filter-label">Priority</span>
            {[
              { key: 'all', label: 'All priorities' },
              { key: 'high', label: 'High' },
              { key: 'medium', label: 'Medium' },
              { key: 'normal', label: 'Normal' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`filter-btn ${priorityFilter === item.key ? 'active' : ''}`}
                onClick={() => setPriorityFilter(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="filter-section">
            <span className="filter-label">Time</span>
            {[
              { key: 'all', label: 'All time' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Last 7 days' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`filter-btn ${timeFilter === item.key ? 'active' : ''}`}
                onClick={() => setTimeFilter(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="detail-section">
            <span className="section-label">Summary</span>
            <p className="notif-summary-copy">Unread alerts stay highlighted until you open them or mark them as read.</p>
            <div className="context-card">
              <div className="context-row">
                <span className="context-label">Unread</span>
                <span className="context-value">{unreadCount}</span>
              </div>
              <div className="context-row">
                <span className="context-label">Visible</span>
                <span className="context-value">{filteredNotifications.length}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="notif-center">
          <div className="notif-header">
            <div className="notif-header-left">
              <h1>Notifications</h1>
              <span className="notif-count">{unreadCount} unread</span>
            </div>
            <div className="notif-header-right">
              <button className="mark-all-btn" onClick={() => { void handleMarkAllRead() }} disabled={unreadCount === 0}>
                Mark all as read
              </button>
            </div>
          </div>

          {error ? <div className="notif-banner-error">{error}</div> : null}

          <div className="notif-list">
            {isLoading ? (
              <div className="notif-empty">
                <h3>Loading notifications...</h3>
                <p>Your latest in-app alerts are on the way.</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notif-empty">
                <h3>No notifications yet</h3>
                <p>Create an alert to start receiving live incident updates.</p>
                <div className="empty-actions">
                  <button className="empty-btn primary" onClick={() => navigate('/alerts/create')}>
                    Create an alert
                  </button>
                  <button className="empty-btn secondary" onClick={() => navigate('/map')}>
                    Explore the map
                  </button>
                </div>
              </div>
            ) : (
              <>
                {groupedNotifications.today.length > 0 ? (
                  <div className="notif-group">
                    <div className="group-header">Today</div>
                    {groupedNotifications.today.map(renderNotificationItem)}
                  </div>
                ) : null}
                {groupedNotifications.yesterday.length > 0 ? (
                  <div className="notif-group">
                    <div className="group-header">Yesterday</div>
                    {groupedNotifications.yesterday.map(renderNotificationItem)}
                  </div>
                ) : null}
                {groupedNotifications.older.length > 0 ? (
                  <div className="notif-group">
                    <div className="group-header">Older</div>
                    {groupedNotifications.older.map(renderNotificationItem)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>

        <aside className="notif-right">
          {selectedNotification ? (
            <>
              <div className="detail-header">
                <div
                  className="detail-icon"
                  style={{
                    background: `${getPriorityColor(selectedNotification.priority)}14`,
                    color: getPriorityColor(selectedNotification.priority),
                  }}
                >
                  {selectedNotification.priority <= 1 ? 'H' : selectedNotification.priority === 2 ? 'M' : 'N'}
                </div>
                <div className="detail-title-block">
                  <h2 className="detail-title">{selectedNotification.title}</h2>
                  <div className="detail-meta">
                    <span
                      className="detail-badge"
                      style={{
                        background: `${getPriorityColor(selectedNotification.priority)}14`,
                        color: getPriorityColor(selectedNotification.priority),
                      }}
                    >
                      {getPriorityLabel(selectedNotification.priority)}
                    </span>
                    <span className="detail-time">{formatDateTime(selectedNotification.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <span className="section-label">Message</span>
                <p className="explanation-text">{selectedNotification.body}</p>
              </div>

              <div className="detail-section">
                <span className="section-label">Context</span>
                <div className="context-card">
                  <div className="context-row">
                    <span className="context-label">Event</span>
                    <span className="context-value">{selectedNotification.eventType}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Zone</span>
                    <span className="context-value">{selectedNotification.data?.zoneName || 'Monitored area'}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Incident type</span>
                    <span className="context-value">{selectedNotification.data?.incidentType || 'Incident'}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Severity</span>
                    <span className="context-value">{selectedNotification.data?.severity || getPriorityLabel(selectedNotification.priority)}</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Danger score</span>
                    <span className="context-value">{selectedNotification.data?.dangerScore ?? '--'}%</span>
                  </div>
                  <div className="context-row">
                    <span className="context-label">Location</span>
                    <span className="context-value">{selectedNotification.data?.locationLabel || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section actions">
                <span className="section-label">Actions</span>
                <div className="action-buttons">
                  <button
                    type="button"
                    className="action-btn primary"
                    onClick={() => navigate(getNotificationTarget(selectedNotification))}
                  >
                    Open related page
                  </button>
                  {!selectedNotification.readAt ? (
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => { void handleMarkSingleRead(selectedNotification.id) }}
                    >
                      Mark as read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => navigate('/map')}
                  >
                    Open map
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="detail-empty">
              <div className="empty-illustration">N</div>
              <p>Select a notification to see the full detail.</p>
              <span className="empty-hint">Unread items are highlighted on the left.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
