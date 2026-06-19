import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined'

import { AuthContext } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { useNotificationStore } from '../../stores/notificationStore'
import { respondToInfoRequest } from '../../services/reportsService'
import NotificationBell from '../../components/notifications/NotificationBell'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import PoliceShell from '../../components/layout/PoliceShell'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles, isAnyPoliceUser } from '../../utils/roleUtils'
import { useUiModeStore } from '../../stores/uiModeStore'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/DashboardPage.css'
import '../../styles/NewsPage.css'
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

// Operational-alert notifications append the admin-authored description onto the
// body sentence. Split it back out so the card can surface it as its own line
// (and avoid showing the same text twice).
function splitOperationalAlertBody(notification) {
  const body = notification.body || ''
  const description = (notification.data?.description || '').trim()
  if (description && body.endsWith(description)) {
    return { lead: body.slice(0, body.length - description.length).trim(), description }
  }
  return { lead: body, description: description || null }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedNotificationId = searchParams.get('notification')
  const handledRequestRef = useRef(null)
  const { isAuthenticated, logout, user } = useContext(AuthContext)
  const { loadNotifications, markAllNotificationsRead, markNotificationRead } = useNotifications()
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')

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
  // Inline "respond to admin info request" state — keyed by reportId so each
  // notification keeps its own draft / status independently.
  const [infoReplyText, setInfoReplyText] = useState({})
  const [infoReplyStatus, setInfoReplyStatus] = useState({}) // reportId -> { state, error }
  const [contactTrigger, setContactTrigger] = useState(0)
  const displayName = user?.name || user?.email || 'SIARA User'
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleClass = primaryRole === 'admin' ? 'role-admin' : primaryRole === 'police' ? 'role-police' : 'role-citoyen'
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const profileInitials = getInitialsFromName(displayName)

  // Police users who reached this page from police mode keep the police shell
  // instead of dropping back into the citizen layout.
  const uiMode = useUiModeStore((state) => state.mode)
  const showPoliceShell = isAnyPoliceUser(user) && uiMode !== 'normal'

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

  // When arriving from the header bell (or a deep link) with ?notification=<id>,
  // open that notification's detail once it has loaded. Applied once per id so a
  // live socket update can't yank the selection back from a manual choice.
  useEffect(() => {
    if (!requestedNotificationId || handledRequestRef.current === requestedNotificationId) {
      return
    }

    if (notifications.some((notification) => notification.id === requestedNotificationId)) {
      handledRequestRef.current = requestedNotificationId
      setSelectedNotificationId(requestedNotificationId)
    }
  }, [requestedNotificationId, notifications])

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

  async function handleSubmitInfoReply(notification) {
    const reportId = notification?.data?.reportId
    const draft = (infoReplyText[reportId] || '').trim()
    if (!reportId || !draft) return

    setInfoReplyStatus((prev) => ({ ...prev, [reportId]: { state: 'sending' } }))
    try {
      await respondToInfoRequest(reportId, draft)
      setInfoReplyStatus((prev) => ({ ...prev, [reportId]: { state: 'sent' } }))
      setInfoReplyText((prev) => ({ ...prev, [reportId]: '' }))
      if (!notification.readAt) {
        try { await markNotificationRead(notification.id) } catch (_error) {}
      }
    } catch (error) {
      // 409 "already been answered" means the reporter responded in another
      // tab / session. Render it as success — the answer is on file, the
      // form should collapse, no scary error needed.
      const message = error?.message || ''
      if (/already been answered|no pending info request/i.test(message)) {
        setInfoReplyStatus((prev) => ({ ...prev, [reportId]: { state: 'sent' } }))
        setInfoReplyText((prev) => ({ ...prev, [reportId]: '' }))
        return
      }
      setInfoReplyStatus((prev) => ({
        ...prev,
        [reportId]: { state: 'error', error: message || 'Failed to send response' },
      }))
    }
  }

  function renderNotificationItem(notification) {
    const priorityColor = getPriorityColor(notification.priority)
    const priorityKey = notification.priority <= 1 ? 'high' : notification.priority === 2 ? 'medium' : 'neutral'
    const priorityLetter = notification.priority <= 1 ? 'H' : notification.priority === 2 ? 'M' : 'N'

    // Info-request notifications get an inline reply field on the card itself.
    // The reporter never has to navigate away — type, send, done.
    const isInfoRequest = notification.eventType === 'REPORT_INFO_REQUESTED'
      && Boolean(notification.data?.reportId)
    const reportId = isInfoRequest ? notification.data.reportId : null
    const draft = reportId ? (infoReplyText[reportId] || '') : ''
    const replyStatus = reportId ? (infoReplyStatus[reportId] || { state: 'idle' }) : { state: 'idle' }
    const replySending = replyStatus.state === 'sending'
    // Sent if THIS session just sent it OR the backend stamped responseSent=true
    // on the notification's data (persists across page reloads / new sessions).
    const replySent = replyStatus.state === 'sent' || Boolean(notification.data?.responseSent)

    // Support-reply notifications: an admin replied to a contact-form message.
    // We render the full reply text on the card so the user doesn't have to
    // navigate to read it.
    const isSupportReply = notification.eventType === 'SUPPORT_MESSAGE_REPLY'

    // Operational alerts carry an admin-authored description we surface as a
    // distinct line beneath the auto-built summary sentence.
    const { lead: bodyLead, description: alertDescription } = splitOperationalAlertBody(notification)

    return (
      <div
        key={notification.id}
        className={[
          'notif-item',
          !notification.readAt ? 'unread' : '',
          selectedNotification?.id === notification.id ? 'selected' : '',
          `priority-${priorityKey}`,
        ].filter(Boolean).join(' ')}
        onClick={() => { void handleSelectNotification(notification) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            // Don't hijack Enter while the reporter is typing in the textarea.
            const tag = event.target?.tagName
            if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'BUTTON') return
            event.preventDefault()
            void handleSelectNotification(notification)
          }
        }}
        role="button"
        tabIndex={0}
        style={isInfoRequest ? { flexWrap: 'wrap' } : undefined}
      >
        <div
          className="notif-avatar"
          style={{ background: `${priorityColor}14`, color: priorityColor }}
        >
          {priorityLetter}
        </div>
        <div className="notif-body">
          <div className="notif-item-title">
            {notification.title}
            {isInfoRequest && !replySent ? (
              <span
                style={{
                  marginLeft: 8, padding: '1px 8px', borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.18)',
                  color: '#92400E', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  verticalAlign: 'middle',
                }}
              >
                Action needed
              </span>
            ) : null}
          </div>
          <div className="notif-item-body">{bodyLead}</div>
          {alertDescription ? (
            <div className="notif-item-desc">{alertDescription}</div>
          ) : null}
          {(notification.data?.zoneName || notification.data?.locationLabel) ? (
            <span className="notif-item-zone">
              {notification.data?.zoneName || notification.data?.locationLabel}
            </span>
          ) : null}
        </div>
        <div className="notif-item-meta">
          <span className="notif-item-time">{formatRelativeTime(notification.createdAt)}</span>
          {!notification.readAt ? <span className="notif-unread-dot" aria-label="Unread" /> : null}
        </div>

        {/* Inline reply form, only on REPORT_INFO_REQUESTED cards. */}
        {isInfoRequest ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              flexBasis: '100%',
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: replySent ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.07)',
              border: replySent
                ? '1px solid rgba(16, 185, 129, 0.30)'
                : '1px solid rgba(245, 158, 11, 0.30)',
            }}
          >
            {/* Incident snapshot — keeps the reporter anchored to which report
                this question is about without having to navigate away. */}
            {(notification.data?.incidentTitle
              || notification.data?.incidentLocation
              || notification.data?.incidentType) && !replySent ? (
              <div
                style={{
                  marginBottom: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#fff',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                  About this report
                </div>
                {notification.data.incidentTitle ? (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                    {notification.data.incidentTitle}
                  </div>
                ) : null}
                <div style={{ fontSize: 11.5, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {notification.data.incidentType ? (
                    <span style={{ textTransform: 'capitalize' }}>{notification.data.incidentType}</span>
                  ) : null}
                  {notification.data.incidentSeverity ? (
                    <span style={{ textTransform: 'capitalize', color: notification.data.incidentSeverity === 'high' ? '#DC2626' : notification.data.incidentSeverity === 'medium' ? '#D97706' : '#16A34A' }}>
                      · {notification.data.incidentSeverity} severity
                    </span>
                  ) : null}
                  {notification.data.incidentLocation ? (
                    <span>· {notification.data.incidentLocation}</span>
                  ) : null}
                  {notification.data.incidentOccurredAt ? (
                    <span>· {new Date(notification.data.incidentOccurredAt).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {notification.data?.requestMessage && !replySent ? (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#92400E',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                Moderator's question
              </div>
            ) : null}
            {notification.data?.requestMessage && !replySent ? (
              <div
                style={{
                  fontSize: 12.5,
                  color: '#78350F',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 8,
                  fontStyle: 'italic',
                }}
              >
                "{notification.data.requestMessage}"
              </div>
            ) : null}

            {replySent ? (
              <div style={{ fontSize: 12.5, color: '#065F46' }}>
                <strong>Response sent.</strong> The moderator was notified — they'll follow up on your report.
              </div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(event) => setInfoReplyText((prev) => ({
                    ...prev,
                    [reportId]: event.target.value,
                  }))}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Type your reply to the moderator…"
                  rows={3}
                  maxLength={2000}
                  disabled={replySending}
                  style={{
                    width: '100%',
                    padding: 9,
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: 72,
                    background: '#fff',
                  }}
                />
                {replyStatus.state === 'error' ? (
                  <div style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 6 }}>
                    {replyStatus.error}
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleSubmitInfoReply(notification)
                    }}
                    disabled={!draft.trim() || replySending}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 6,
                      border: 'none',
                      background: !draft.trim() || replySending ? '#94A3B8' : '#2563EB',
                      color: '#fff',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: !draft.trim() || replySending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {replySending ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Inline reply display for SUPPORT_MESSAGE_REPLY notifications —
            shows the original message you sent + the admin's full reply,
            so you don't need to navigate anywhere to read it. */}
        {isSupportReply ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              flexBasis: '100%',
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            {notification.data?.originalMessage ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}>
                  Your original message
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--admin-text-secondary, #475569)',
                  whiteSpace: 'pre-wrap',
                  fontStyle: 'italic',
                  padding: 8,
                  borderRadius: 6,
                  background: 'rgba(100, 116, 139, 0.08)',
                  maxHeight: 80,
                  overflow: 'auto',
                }}>
                  {notification.data.originalMessage}
                </div>
              </div>
            ) : null}
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#065F46',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 4,
            }}>
              {notification.data?.repliedBy
                ? `${notification.data.repliedBy} replied`
                : 'SIARA team replied'}
            </div>
            <div style={{
              fontSize: 13,
              color: '#0F172A',
              whiteSpace: 'pre-wrap',
              padding: 8,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid rgba(16, 185, 129, 0.20)',
            }}>
              {notification.data?.reply || notification.body}
            </div>
          </div>
        ) : null}
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

  const headerBlock = (
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search notifications, incidents, zones..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown((current) => !current)}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
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
  )

  // Filters + summary. Shown in the citizen left sidebar, or tucked under the
  // police navigation (sidebarExtra) when in police mode.
  const filterPanel = (
    <>
      {/* Notification filters card */}
      <div className="card notif-filters-card">
        <div className="card-header">
          <h3 className="card-title">Filters</h3>
          <span className="notif-filter-count-pill">{filteredNotifications.length}</span>
        </div>

        <div className="filter-section">
          <label className="filter-label">Status</label>
          <div className="notif-filter-pill-row">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'read', label: 'Read' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`notif-pill-btn${statusFilter === item.key ? ' active' : ''}`}
                onClick={() => setStatusFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="filter-label">Priority</label>
          <div className="notif-filter-pill-row">
            {[
              { key: 'all', label: 'All' },
              { key: 'high', label: 'High' },
              { key: 'medium', label: 'Med' },
              { key: 'normal', label: 'Low' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`notif-pill-btn${priorityFilter === item.key ? ' active' : ''}`}
                onClick={() => setPriorityFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="filter-label">Time</label>
          <div className="notif-filter-pill-row">
            {[
              { key: 'all', label: 'All time' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: '7 days' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`notif-pill-btn${timeFilter === item.key ? ' active' : ''}`}
                onClick={() => setTimeFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats card */}
      <div className="card notif-stats-card">
        <h3 className="card-title">Summary</h3>
        <div className="notif-stat-row">
          <span className="notif-stat-label">Unread</span>
          <span className="notif-stat-value">{unreadCount}</span>
        </div>
        <div className="notif-stat-row">
          <span className="notif-stat-label">Visible</span>
          <span className="notif-stat-value">{filteredNotifications.length}</span>
        </div>
        <div className="notif-stat-row">
          <span className="notif-stat-label">Total</span>
          <span className="notif-stat-value">{notifications.length}</span>
        </div>
      </div>
    </>
  )

  const gridBlock = (
      <div className={`notif-grid${showPoliceShell ? ' notif-grid--embedded' : ''}`}>

        {/* ── LEFT SIDEBAR — citizen layout only. In police mode the filters
            move under the police nav (see sidebarExtra below). ── */}
        {!showPoliceShell && (
        <aside className="sidebar-left notif-sidebar-left">

          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img
                src={profileAvatarUrl}
                alt={displayName}
                className="profile-avatar-large"
                loading="lazy"
                onError={(e) => { if (e.currentTarget.src !== profileAvatar) e.currentTarget.src = profileAvatar }}
              />            </div>
            <div className="profile-info">
              <p className="profile-name">{displayName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* Shared nav — same as feed page, with "notifications" active */}
          <FeedSidebarNav activeKey="notifications" triggerPanel={contactTrigger} />

          {filterPanel}

        </aside>
        )}

        {/* ── CENTER ── */}
        <main className="notif-center">
          <div className="notif-topbar">
            <div className="notif-topbar-left">
              <h1>Notifications</h1>
              {unreadCount > 0 ? (
                <span className="notif-unread-badge">{unreadCount} unread</span>
              ) : null}
            </div>
            <button
              type="button"
              className="notif-mark-all-btn"
              onClick={() => { void handleMarkAllRead() }}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>

          {error ? <div className="notif-banner-error">{error}</div> : null}

          <div className="notif-list">
            {isLoading ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon"><HourglassEmptyOutlinedIcon fontSize="inherit" /></div>
                <h3>Loading…</h3>
                <p>Your latest alerts are on the way.</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <div className="notif-empty-icon"><NotificationsOutlinedIcon fontSize="inherit" /></div>
                <h3>No notifications</h3>
                <p>Create an alert to start receiving live incident updates.</p>
                <div className="notif-empty-actions">
                  <button type="button" className="notif-btn-primary" onClick={() => navigate('/alerts/create')}>
                    Create an alert
                  </button>
                  <button type="button" className="notif-btn-secondary" onClick={() => navigate('/map')}>
                    Explore map
                  </button>
                </div>
              </div>
            ) : (
              <>
                {groupedNotifications.today.length > 0 ? (
                  <div className="notif-group">
                    <div className="notif-group-label">Today</div>
                    {groupedNotifications.today.map(renderNotificationItem)}
                  </div>
                ) : null}
                {groupedNotifications.yesterday.length > 0 ? (
                  <div className="notif-group">
                    <div className="notif-group-label">Yesterday</div>
                    {groupedNotifications.yesterday.map(renderNotificationItem)}
                  </div>
                ) : null}
                {groupedNotifications.older.length > 0 ? (
                  <div className="notif-group">
                    <div className="notif-group-label">Older</div>
                    {groupedNotifications.older.map(renderNotificationItem)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="sidebar-right notif-sidebar-right">
          {selectedNotification ? (() => {
            const sev = selectedNotification.data?.severity || selectedNotification.data?.incidentSeverity || ''
            const dangerScore = selectedNotification.data?.dangerScore
            const priorityKey = selectedNotification.priority <= 1 ? 'high' : selectedNotification.priority === 2 ? 'medium' : 'normal'
            const priorityColor = getPriorityColor(selectedNotification.priority)

            const isSupportReply = selectedNotification.eventType === 'SUPPORT_MESSAGE_REPLY'
            const { lead: headerLead, description: headerDescription } = splitOperationalAlertBody(selectedNotification)

            return (
              <>
                {/* ── Card 1: Notification header ── */}
                <div className="card nd-header-card">
                  <div className="nd-priority-row">
                    <span className={`nd-priority-badge nd-priority-badge--${priorityKey}`}>
                      <FiberManualRecordIcon fontSize="inherit" className={`icon-severity-${priorityKey === 'high' ? 'high' : priorityKey === 'medium' ? 'medium' : 'info'}`} />
                      {' '}{getPriorityLabel(selectedNotification.priority)} Priority
                    </span>
                    {!selectedNotification.readAt ? (
                      <span className="nd-unread-tag"><FiberManualRecordIcon fontSize="inherit" /> Unread</span>
                    ) : (
                      <span className="nd-read-tag"><CheckRoundedIcon fontSize="inherit" /> Read</span>
                    )}
                  </div>
                  <h2 className="nd-title">{selectedNotification.title}</h2>
                  <p className="nd-timestamp" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AccessTimeOutlinedIcon fontSize="inherit" /> {formatDateTime(selectedNotification.createdAt)}
                  </p>
                  <p className="nd-body">{headerLead}</p>
                  {headerDescription ? (
                    <div className="nd-alert-desc">
                      <span className="nd-alert-desc-label">Description</span>
                      <p className="nd-alert-desc-text">{headerDescription}</p>
                    </div>
                  ) : null}
                </div>

                {/* ── Card 2: Support reply thread OR incident details ── */}
                {isSupportReply ? (
                  <div className="card nd-details-card">
                    <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ForumOutlinedIcon fontSize="inherit" /> Conversation
                    </h3>

                    {selectedNotification.data?.originalSubject ? (
                      <div className="nd-info-row" style={{ marginBottom: 10 }}>
                        <span className="nd-info-key">Subject</span>
                        <span className="nd-info-val" style={{ fontWeight: 600 }}>
                          {selectedNotification.data.originalSubject}
                        </span>
                      </div>
                    ) : null}

                    {selectedNotification.data?.originalMessage ? (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: '#64748B',
                          textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
                        }}>
                          Your message
                        </div>
                        <div style={{
                          fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap',
                          padding: '10px 12px', borderRadius: 8,
                          background: 'rgba(100, 116, 139, 0.07)',
                          border: '1px solid rgba(100, 116, 139, 0.18)',
                          maxHeight: 160, overflowY: 'auto',
                        }}>
                          {selectedNotification.data.originalMessage}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: '#065F46',
                        textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <MarkEmailReadOutlinedIcon fontSize="inherit" />
                        {selectedNotification.data?.repliedBy
                          ? `${selectedNotification.data.repliedBy} replied`
                          : 'SIARA team replied'}
                      </div>
                      <div style={{
                        fontSize: 13, color: '#0F172A', whiteSpace: 'pre-wrap',
                        padding: '10px 12px', borderRadius: 8,
                        background: '#F0FDF4',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        maxHeight: 240, overflowY: 'auto',
                        lineHeight: 1.6,
                      }}>
                        {selectedNotification.data?.reply || selectedNotification.body}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card nd-details-card">
                    <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AssignmentOutlinedIcon fontSize="inherit" /> Incident Details</h3>

                    {(sev || selectedNotification.data?.incidentType) ? (
                      <div className="nd-detail-highlights">
                        {sev ? (
                          <div className={`nd-sev-chip nd-sev-chip--${sev}`}>
                            <span className="nd-sev-dot" />
                            <span>{sev.charAt(0).toUpperCase() + sev.slice(1)} Severity</span>
                          </div>
                        ) : null}
                        {selectedNotification.data?.incidentType ? (
                          <div className="nd-type-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <TrafficOutlinedIcon fontSize="inherit" /> {selectedNotification.data.incidentType.charAt(0).toUpperCase() + selectedNotification.data.incidentType.slice(1)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="nd-info-list">
                      {selectedNotification.data?.incidentTitle ? (
                        <div className="nd-info-row">
                          <span className="nd-info-key">Report</span>
                          <span className="nd-info-val" style={{ fontWeight: 600 }}>
                            {selectedNotification.data.incidentTitle}
                          </span>
                        </div>
                      ) : null}
                      {selectedNotification.data?.zoneName ? (
                        <div className="nd-info-row">
                          <span className="nd-info-key">Zone</span>
                          <span className="nd-info-val" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LocationOnOutlinedIcon fontSize="inherit" /> {selectedNotification.data.zoneName}</span>
                        </div>
                      ) : null}
                      {(selectedNotification.data?.locationLabel || selectedNotification.data?.incidentLocation) ? (
                        <div className="nd-info-row">
                          <span className="nd-info-key">Location</span>
                          <span className="nd-info-val nd-info-val--loc">
                            {selectedNotification.data.locationLabel || selectedNotification.data.incidentLocation}
                          </span>
                        </div>
                      ) : null}
                      {selectedNotification.data?.incidentOccurredAt ? (
                        <div className="nd-info-row">
                          <span className="nd-info-key">Occurred</span>
                          <span className="nd-info-val">
                            {new Date(selectedNotification.data.incidentOccurredAt).toLocaleString()}
                          </span>
                        </div>
                      ) : null}
                      {selectedNotification.eventType ? (
                        <div className="nd-info-row">
                          <span className="nd-info-key">Event</span>
                          <code className="nd-info-code">{selectedNotification.eventType}</code>
                        </div>
                      ) : null}
                    </div>

                    {dangerScore != null ? (
                      <div className="nd-danger-section">
                        <div className="nd-danger-header">
                          <span className="nd-danger-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" /> Danger Score</span>
                          <span className="nd-danger-value" style={{ color: dangerScore >= 70 ? '#dc2626' : dangerScore >= 40 ? '#d97706' : '#16a34a' }}>
                            {dangerScore}%
                          </span>
                        </div>
                        <div className="nd-danger-track">
                          <div
                            className="nd-danger-fill"
                            style={{
                              width: `${dangerScore}%`,
                              background: dangerScore >= 70
                                ? 'linear-gradient(90deg, #f97316, #dc2626)'
                                : dangerScore >= 40
                                  ? 'linear-gradient(90deg, #22c55e, #f59e0b)'
                                  : 'linear-gradient(90deg, #22c55e, #16a34a)',
                            }}
                          />
                        </div>
                        <div className="nd-danger-scale">
                          <span>Low</span><span>Medium</span><span>High</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* ── Card 3: Actions ── */}
                {isSupportReply ? (
                  <div className="card nd-actions-card">
                    <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <BoltOutlinedIcon fontSize="inherit" /> Quick Actions
                    </h3>
                    <button
                      type="button"
                      className="nd-btn-outline"
                      onClick={() => setContactTrigger((n) => n + 1)}
                    >
                      <OpenInNewRoundedIcon fontSize="inherit" /> Send another message
                    </button>
                    {!selectedNotification.readAt ? (
                      <button
                        type="button"
                        className="nd-btn-ghost"
                        onClick={() => { void handleMarkSingleRead(selectedNotification.id) }}
                      >
                        <CheckRoundedIcon fontSize="inherit" className="icon-success" /> Mark as Read
                      </button>
                    ) : null}
                  </div>
                ) : selectedNotification.eventType === 'REPORT_INFO_REQUESTED' && selectedNotification.data?.reportId ? (
                  (() => {
                    const reportId = selectedNotification.data.reportId
                    const draft = infoReplyText[reportId] || ''
                    const status = infoReplyStatus[reportId] || { state: 'idle' }
                    const sending = status.state === 'sending'
                    const sent = status.state === 'sent'
                    return (
                      <div className="card nd-actions-card">
                        <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <BoltOutlinedIcon fontSize="inherit" /> Respond to moderator
                        </h3>
                        {selectedNotification.data?.requestMessage ? (
                          <div
                            style={{
                              padding: '10px 12px', borderRadius: 8,
                              background: 'rgba(245, 158, 11, 0.10)',
                              border: '1px solid rgba(245, 158, 11, 0.30)',
                              fontSize: 12.5, color: '#78350F', whiteSpace: 'pre-wrap',
                              marginBottom: 10,
                            }}
                          >
                            "{selectedNotification.data.requestMessage}"
                          </div>
                        ) : null}
                        {sent ? (
                          <div
                            style={{
                              padding: '10px 12px', borderRadius: 8,
                              background: 'rgba(16, 185, 129, 0.10)',
                              border: '1px solid rgba(16, 185, 129, 0.30)',
                              fontSize: 12.5, color: '#065F46',
                            }}
                          >
                            <strong>Response sent.</strong> The moderator has been notified — they'll follow up on this report.
                          </div>
                        ) : (
                          <>
                            <textarea
                              value={draft}
                              onChange={(event) => setInfoReplyText((prev) => ({ ...prev, [reportId]: event.target.value }))}
                              placeholder="Type the extra info the moderator asked for…"
                              rows={5}
                              maxLength={2000}
                              disabled={sending}
                              style={{
                                width: '100%', padding: 10, border: '1px solid #E2E8F0', borderRadius: 8,
                                fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 100,
                                marginBottom: 8,
                              }}
                            />
                            {status.state === 'error' ? (
                              <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 8 }}>
                                {status.error}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              className="nd-btn-primary"
                              onClick={() => { void handleSubmitInfoReply(selectedNotification) }}
                              disabled={!draft.trim() || sending}
                            >
                              {sending ? 'Sending…' : 'Send response'}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="nd-btn-outline"
                          onClick={() => navigate(`/incident/${reportId}`)}
                        >
                          <OpenInNewRoundedIcon fontSize="inherit" /> Open Related Incident
                        </button>
                        {!selectedNotification.readAt ? (
                          <button
                            type="button"
                            className="nd-btn-ghost"
                            onClick={() => { void handleMarkSingleRead(selectedNotification.id) }}
                          >
                            <CheckRoundedIcon fontSize="inherit" className="icon-success" /> Mark as Read
                          </button>
                        ) : null}
                      </div>
                    )
                  })()
                ) : (
                  <div className="card nd-actions-card">
                    <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BoltOutlinedIcon fontSize="inherit" /> Quick Actions</h3>
                    <button
                      type="button"
                      className="nd-btn-primary"
                      onClick={() => navigate(getNotificationTarget(selectedNotification))}
                    >
                      <OpenInNewRoundedIcon fontSize="inherit" /> Open Related Incident
                    </button>
                    <button
                      type="button"
                      className="nd-btn-outline"
                      onClick={() => navigate('/map')}
                    >
                      <MapOutlinedIcon fontSize="inherit" /> View on Map
                    </button>
                    {!selectedNotification.readAt ? (
                      <button
                        type="button"
                        className="nd-btn-ghost"
                        onClick={() => { void handleMarkSingleRead(selectedNotification.id) }}
                      >
                        <CheckRoundedIcon fontSize="inherit" className="icon-success" /> Mark as Read
                      </button>
                    ) : null}
                  </div>
                )}

                {/* ── Card 4: All recent notifications summary ── */}
                <div className="card nd-recent-card">
                  <h3 className="widget-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NotificationsOutlinedIcon fontSize="inherit" /> Recent Alerts</h3>
                  <div className="nd-recent-list">
                    {filteredNotifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className={`nd-recent-item${n.id === selectedNotification.id ? ' nd-recent-item--active' : ''}`}
                        onClick={() => { void handleSelectNotification(n) }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSelectNotification(n) }}
                      >
                        <span
                          className="nd-recent-dot"
                          style={{ background: getPriorityColor(n.priority) }}
                        />
                        <div className="nd-recent-body">
                          <span className="nd-recent-title">{n.title}</span>
                          <span className="nd-recent-time">{formatRelativeTime(n.createdAt)}</span>
                        </div>
                        {!n.readAt ? <span className="nd-recent-unread" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })() : (
            <div className="card nd-empty-card">
              <div className="nd-empty-icon"><NotificationsOutlinedIcon fontSize="inherit" /></div>
              <h3 className="nd-empty-title">No notification selected</h3>
              <p className="nd-empty-body">Click any notification in the list to see its full details here.</p>
              <div className="nd-empty-stats">
                <div className="nd-empty-stat">
                  <strong>{unreadCount}</strong>
                  <span>Unread</span>
                </div>
                <div className="nd-empty-stat">
                  <strong>{notifications.length}</strong>
                  <span>Total</span>
                </div>
              </div>
            </div>
          )}
        </aside>

      </div>
  )

  if (showPoliceShell) {
    return (
      <PoliceShell
        activeKey={null}
        forceMode={uiMode}
        rightPanelCollapsed
        sidebarExtra={(
          <div className="police-sidebar-filters">
            {filterPanel}
          </div>
        )}
      >
        {gridBlock}
      </PoliceShell>
    )
  }

  return (
    <div className="notifications-page">
      {headerBlock}
      {gridBlock}
    </div>
  )
}
