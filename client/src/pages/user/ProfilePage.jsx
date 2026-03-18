/**
 * @file ProfilePage.jsx
 * @description User profile page with a 3-column layout.
 *
 * Layout:
 *   - Left:   user card with avatar, role badge, edit button;
 *              profile completion indicator (progress bar + task checklist);
 *              sidebar navigation links
 *   - Center: cover photo + profile overview with stats;
 *              tabbed activity section (posts / reports / badges / history / timeline)
 *              with full keyboard navigation (ArrowLeft/Right/Home/End);
 *              saved locations grid
 *   - Right:  safety score gauge (SVG donut), contribution impact stats,
 *             recent triggered alerts, account health checklist
 *
 * Features:
 *   - Accessible tab navigation using ARIA roles and roving tabIndex
 *   - Auto-scroll to focused tab button on keyboard navigation
 *   - All data is mock/static for prototype purposes
 */
import React, { useEffect, useRef, useState, useContext } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import { getCurrentUser } from '../../services/authService'
import { listReports } from '../../services/reportsService'
import { fetchAlerts } from '../../services/alertService'
import '../../styles/ProfilePage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png' // Using logo as placeholder avatar

function toTitleCase(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'User'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatJoinDate(value) {
  if (!value) return 'Recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  return date.toLocaleDateString([], { month: 'short', year: 'numeric' })
}

function getUserInitials(name) {
  const normalized = String(name || 'User').trim()
  if (!normalized) return 'U'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function formatReportTime(value) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOwnedByUser(report, userIdentity) {
  if (!report || !userIdentity) {
    return false
  }

  const reportOwnerIds = [
    report?.reportedBy?.id,
    report?.reported_by?.id,
    report?.userId,
    report?.user_id,
    report?.createdBy,
    report?.created_by,
    report?.authorId,
  ].filter(Boolean)

  const reportOwnerEmails = [
    report?.reportedBy?.email,
    report?.reported_by?.email,
    report?.email,
    report?.createdByEmail,
    report?.created_by_email,
  ].filter(Boolean)

  if (userIdentity.id && reportOwnerIds.some((id) => String(id) === String(userIdentity.id))) {
    return true
  }

  if (userIdentity.email) {
    const emailNeedle = String(userIdentity.email).toLowerCase()
    if (reportOwnerEmails.some((email) => String(email).toLowerCase() === emailNeedle)) {
      return true
    }
  }

  if (userIdentity.name) {
    const ownerName = report?.reportedBy?.name || report?.reported_by?.name || report?.authorName
    if (ownerName && String(ownerName).trim().toLowerCase() === String(userIdentity.name).trim().toLowerCase()) {
      return true
    }
  }

  return false
}

function formatAlertTime(value) {
  if (!value) return 'Never triggered'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameUser(leftUser, rightUser) {
  if (!leftUser || !rightUser) {
    return false
  }

  const leftId = leftUser.id ?? leftUser.userId ?? leftUser.user_id
  const rightId = rightUser.id ?? rightUser.userId ?? rightUser.user_id

  if (leftId != null && rightId != null && String(leftId) === String(rightId)) {
    return true
  }

  const leftEmail = String(leftUser.email || '').trim().toLowerCase()
  const rightEmail = String(rightUser.email || '').trim().toLowerCase()
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    return true
  }

  const leftName = String(leftUser.name || '').trim().toLowerCase()
  const rightName = String(rightUser.name || '').trim().toLowerCase()
  if (leftName && rightName && leftName === rightName) {
    return true
  }

  return false
}

export default function ProfilePage(){
  /* ═══ STATE ═══ */
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const [profileUser, setProfileUser] = useState(location.state?.profileUser || null)
  const [myReports, setMyReports] = useState([])
  const [myAlerts, setMyAlerts] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState('')
  const [activeTab, setActiveTab] = useState('alerts')       // Currently selected activity tab
  const [showDropdown, setShowDropdown] = useState(false)   // Header avatar dropdown
  const tabsRef = useRef(null)                              // Ref to the tab-list container for scroll/focus
  const viewedUserFromFeed = location.state?.profileUser || null
  const authUser = user || null
  const isViewingOwnProfile = viewedUserFromFeed ? isSameUser(viewedUserFromFeed, authUser) : true

  useEffect(() => {
    setProfileUser(viewedUserFromFeed || null)
    if (viewedUserFromFeed) {
      setActiveTab('reports')
    }
  }, [viewedUserFromFeed])

  const isExternalProfileView = Boolean(viewedUserFromFeed) && !isViewingOwnProfile

  useEffect(() => {
    if (isExternalProfileView) {
      return
    }

    let ignore = false

    ;(async () => {
      try {
        const freshUser = await getCurrentUser()
        if (!ignore && freshUser) {
          setProfileUser(freshUser)
        }
      } catch {
        // Keep auth-context data if live profile fetch fails.
      }
    })()

    return () => {
      ignore = true
    }
  }, [isExternalProfileView])

  const currentUser = profileUser || user || {}
  const displayName = currentUser.name
    || [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')
    || currentUser.email
    || currentUser.phone
    || 'SIARA User'
  const initials = getUserInitials(displayName)
  const roleLabel = toTitleCase(currentUser.role || (Array.isArray(currentUser.roles) ? currentUser.roles[0] : '') || 'citizen')
  const bio = currentUser.bio || 'Active contributor helping make roads safer.'
  const locationLabel = currentUser.city
    || currentUser.location
    || currentUser.address
    || 'Location not set'
  const joinLabel = formatJoinDate(currentUser.createdAt || currentUser.created_at)
  const contactLabel = currentUser.email || currentUser.phone || 'No contact info'
  const reportsCount = currentUser.reportCount ?? currentUser.reports_count
  const alertsCount = currentUser.alertsCount ?? currentUser.alerts_count
  const verificationRate = currentUser.verificationRate ?? currentUser.verification_rate ?? 92
  const badgesCount = currentUser.badgesCount ?? currentUser.badges_count ?? 18
  const effectiveReportsCount = Number.isFinite(Number(reportsCount)) ? Number(reportsCount) : myReports.length
  const effectiveAlertsCount = Number.isFinite(Number(alertsCount)) ? Number(alertsCount) : myAlerts.length

  useEffect(() => {
    const userIdentity = {
      id: currentUser?.id,
      email: currentUser?.email,
      name: displayName,
    }

    if (!userIdentity.id && !userIdentity.email && !userIdentity.name) {
      return
    }

    let ignore = false

    ;(async () => {
      setReportsLoading(true)
      setReportsError('')

      try {
        const response = await listReports({ limit: 100, offset: 0, sort: 'recent' })
        if (ignore) return

        const ownedReports = (response?.reports || []).filter((report) => isOwnedByUser(report, userIdentity))
        setMyReports(ownedReports)
      } catch {
        if (!ignore) {
          setReportsError('Unable to load your reports right now.')
          setMyReports([])
        }
      } finally {
        if (!ignore) {
          setReportsLoading(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [currentUser?.email, currentUser?.id, displayName])

  useEffect(() => {
    if (isExternalProfileView) {
      setMyAlerts([])
      setAlertsLoading(false)
      setAlertsError('')
      return
    }

    let ignore = false

    ;(async () => {
      setAlertsLoading(true)
      setAlertsError('')

      try {
        const items = await fetchAlerts()
        if (!ignore) {
          setMyAlerts(Array.isArray(items) ? items : [])
        }
      } catch {
        if (!ignore) {
          setAlertsError('Unable to load your alerts right now.')
          setMyAlerts([])
        }
      } finally {
        if (!ignore) {
          setAlertsLoading(false)
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [isExternalProfileView])

  // Ordered list of tab identifiers (matches button order)
  const tabs = ['alerts', 'reports', 'badges', 'history', 'timeline']

  /* ═══ KEYBOARD NAVIGATION FOR TABS ═══ */
  // Implements WAI-ARIA roving tabIndex pattern:
  //   ArrowRight/Left → cycle through tabs
  //   Home / End       → jump to first / last tab
  const handleKeyDown = (e, currentIndex) => {
    let newIndex = currentIndex
    
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      newIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      newIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newIndex = tabs.length - 1
    } else {
      return
    }

    // Update active tab and auto-scroll + focus the target button
    const newTab = tabs[newIndex]
    setActiveTab(newTab)
    
    // Auto-scroll to reveal focused tab
    setTimeout(() => {
      const tabButtons = tabsRef.current?.querySelectorAll('.activity-tab')
      if (tabButtons && tabButtons[newIndex]) {
        tabButtons[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        tabButtons[newIndex].focus()
      }
    }, 0)
  }

  /* ═══ RENDER ═══ */
  return (
    <div className="siara-profile-root">
      {/* ═══ FLOATING HEADER ═══ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
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
            <input type="search" className="dash-search" placeholder="Search for an incident, a road, a wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{initials}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
      <div className="profile-layout">
        {/* ═══ LEFT COLUMN — User Card + Completion + Nav ═══ */}
        <aside className="profile-sidebar-left">
          <div className="user-card">
            <div className="user-card-avatar">
              <img src={profileAvatar} alt={displayName} />
              <span className="verified-badge">✓</span>
            </div>
            <h2 className="user-card-name">{displayName}</h2>
            <span className="user-role-badge citoyen">{roleLabel}</span>
            <p className="user-bio">{bio}</p>
            <button className="btn-edit-profile">✏️ Edit Profile</button>
          </div>

          {/* Profile Completion Indicator — progress bar + task checklist (65%) */}
          <div className="profile-completion-card">
            <div className="completion-header">
              <h3 className="completion-title">Complete Your Profile</h3>
              <span className="completion-percentage">65%</span>
            </div>
            <div className="completion-progress-bar">
              <div className="completion-progress-fill" style={{width: '65%'}}></div>
            </div>
            <div className="completion-tasks">
              <div className="completion-task completed">
                <div className="task-icon completed">✓</div>
                <span className="task-label">Profile Photo</span>
              </div>
              <div className="completion-task">
                <div className="task-icon">📍</div>
                <span className="task-label">Add Your Location</span>
              </div>
              <div className="completion-task completed">
                <div className="task-icon completed">✓</div>
                <span className="task-label">Verify Phone</span>
              </div>
              <div className="completion-task">
                <div className="task-icon">🌍</div>
                <span className="task-label">Enable Geolocation</span>
              </div>
              <div className="completion-task">
                <div className="task-icon">🆘</div>
                <span className="task-label">Emergency Contact</span>
              </div>
            </div>
          </div>

          <nav className="profile-nav">
            <button className="profile-nav-item active">
              <span className="nav-icon">👤</span>
              <span className="nav-label">My Profile</span>
            </button>
            <button className="profile-nav-item">
              <span className="nav-icon">📝</span>
              <span className="nav-label">My Reports</span>
            </button>
            <button className="profile-nav-item">
              <span className="nav-icon">📍</span>
              <span className="nav-label">Saved Locations</span>
            </button>
            <button className="profile-nav-item">
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Account Settings</span>
            </button>
            <button className="profile-nav-item">
              <span className="nav-icon">🔒</span>
              <span className="nav-label">Privacy & Security</span>
            </button>
          </nav>
        </aside>

        {/* ═══ MIDDLE COLUMN — Profile Overview + Activities + Saved Locations ═══ */}
        <main className="profile-main">
          {/* Profile Overview */}
          <section className="profile-overview">
            <div className="profile-cover"></div>
            <div className="profile-header-content">
              <div className="profile-avatar-large">
                <img src={profileAvatar} alt={displayName} />
                <span className="verified-badge-large">✓</span>
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{displayName}</h1>
                <div className="profile-meta">
                  <span className="meta-item"><span className="meta-key">Location</span><span className="meta-value">{locationLabel}</span></span>
                  <span className="meta-item"><span className="meta-key">Member</span><span className="meta-value">{joinLabel}</span></span>
                  <span className="meta-item"><span className="meta-key">Contact</span><span className="meta-value">{contactLabel}</span></span>
                  <span className="verified-text">Verified Account</span>
                </div>
              </div>
            </div>
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{effectiveAlertsCount}</span>
                <span className="stat-label">Alerts</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{effectiveReportsCount}</span>
                <span className="stat-label">Reports</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{verificationRate}%</span>
                <span className="stat-label">Verification Rate</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{badgesCount}</span>
                <span className="stat-label">Badges</span>
              </div>
            </div>
          </section>

          {/* ═══ TABBED ACTIVITIES SECTION ═══ */}
          <section className="profile-activities">
            <div className="activity-tabs" role="tablist" ref={tabsRef}>
              <button 
                className={`activity-tab ${activeTab === 'alerts' ? 'active' : ''}`}
                onClick={() => setActiveTab('alerts')}
                onKeyDown={(e) => handleKeyDown(e, 0)}
                role="tab"
                aria-selected={activeTab === 'alerts'}
                tabIndex={activeTab === 'alerts' ? 0 : -1}
              >
                🔔 Alerts
              </button>
              <button 
                className={`activity-tab ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveTab('reports')}
                onKeyDown={(e) => handleKeyDown(e, 1)}
                role="tab"
                aria-selected={activeTab === 'reports'}
                tabIndex={activeTab === 'reports' ? 0 : -1}
              >
                🚨 Reports
              </button>
              <button 
                className={`activity-tab ${activeTab === 'badges' ? 'active' : ''}`}
                onClick={() => setActiveTab('badges')}
                onKeyDown={(e) => handleKeyDown(e, 2)}
                role="tab"
                aria-selected={activeTab === 'badges'}
                tabIndex={activeTab === 'badges' ? 0 : -1}
              >
                🏆 Badges
              </button>
              <button 
                className={`activity-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
                onKeyDown={(e) => handleKeyDown(e, 3)}
                role="tab"
                aria-selected={activeTab === 'history'}
                tabIndex={activeTab === 'history' ? 0 : -1}
              >
                📊 History
              </button>
              <button 
                className={`activity-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('timeline')}
                onKeyDown={(e) => handleKeyDown(e, 4)}
                role="tab"
                aria-selected={activeTab === 'timeline'}
                tabIndex={activeTab === 'timeline' ? 0 : -1}
              >
                ⏱️ Timeline
              </button>
            </div>

            {/* ═══ TAB CONTENT PANELS ═══ */}
            <div className="activity-content">
              {/* Alerts tab — user saved alerts */}
              {activeTab === 'alerts' && (
                <div className="activity-grid">
                  {isExternalProfileView ? (
                    <div className="activity-card">
                      <h3 className="activity-title">Alerts are private</h3>
                      <p className="activity-time">Only the account owner can view saved alerts.</p>
                    </div>
                  ) : alertsLoading ? (
                    <div className="activity-card">
                      <h3 className="activity-title">Loading your alerts...</h3>
                    </div>
                  ) : alertsError ? (
                    <div className="activity-card">
                      <h3 className="activity-title">{alertsError}</h3>
                    </div>
                  ) : myAlerts.length === 0 ? (
                    <div className="activity-card">
                      <h3 className="activity-title">No saved alerts yet</h3>
                      <p className="activity-time">Create a new alert to monitor your important zones.</p>
                      <button className="btn-edit-profile" onClick={() => navigate('/alerts/create')}>🔔 Create Alert</button>
                    </div>
                  ) : (
                    myAlerts.map((alert) => (
                      <div key={alert.id} className="activity-card" onClick={() => navigate('/alerts')}>
                        <div className="activity-header">
                          <span className="activity-type">🔔 {alert.name || 'Saved alert'}</span>
                          <span className={`severity-badge ${String(alert.severity || 'low').toLowerCase()}`}>
                            {toTitleCase(alert.severity || 'low')}
                          </span>
                        </div>
                        <h3 className="activity-title">{alert.area?.name || alert.zone?.displayName || 'Monitored area'}</h3>
                        <p className="activity-location">📍 {alert.area?.wilaya || 'Unknown wilaya'}</p>
                        <p className="activity-time">Last trigger: {formatAlertTime(alert.lastTriggered || alert.last_triggered)}</p>
                        <div className={`activity-status ${(alert.status || 'paused').toLowerCase() === 'active' ? 'verified' : 'pending'}`}>
                          {(alert.status || 'Paused')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Badges tab — unlocked/locked badge grid */}
              {activeTab === 'reports' && (
                <div className="activity-grid">
                  {reportsLoading ? (
                    <div className="activity-card">
                      <h3 className="activity-title">Loading your reports...</h3>
                    </div>
                  ) : reportsError ? (
                    <div className="activity-card">
                      <h3 className="activity-title">{reportsError}</h3>
                    </div>
                  ) : myReports.length === 0 ? (
                    <div className="activity-card">
                      <h3 className="activity-title">No reports found yet</h3>
                      <p className="activity-time">Create your first incident report to see it here.</p>
                      <button className="btn-edit-profile" onClick={() => navigate('/report')}>📝 Create Report</button>
                    </div>
                  ) : (
                    myReports.map((report) => (
                      <div key={report.id} className="activity-card" onClick={() => navigate(`/incident/${report.id}`)}>
                        <div className="activity-header">
                          <span className="activity-type">🚨 {toTitleCase(report.incidentType || report.incident_type || 'incident')}</span>
                          <span className={`severity-badge ${String(report.severity || 'low').toLowerCase()}`}>
                            {toTitleCase(report.severity || 'low')}
                          </span>
                        </div>
                        <h3 className="activity-title">{report.title || 'Untitled report'}</h3>
                        <p className="activity-location">📍 {report.locationLabel || report.location?.label || 'Location not set'}</p>
                        <p className="activity-time">{formatReportTime(report.createdAt || report.created_at || report.occurredAt || report.occurred_at)}</p>
                        <div className={`activity-status ${(report.status || 'pending').toLowerCase() === 'verified' ? 'verified' : 'pending'}`}>
                          {(report.status || 'Pending')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Badges tab — unlocked/locked badge grid */}
              {activeTab === 'badges' && (
                <div className="badges-grid">
                  {[
                    { icon: '🛡️', name: 'Verified Reporter', unlocked: true },
                    { icon: '🚨', name: 'Emergency Assistant', unlocked: true },
                    { icon: '🌧️', name: 'Weather Observer', unlocked: true },
                    { icon: '👁️', name: 'Neighborhood Watch', unlocked: true },
                    { icon: '⭐', name: 'Elite Contributor', unlocked: false },
                    { icon: '🔥', name: '30-Day Streak', unlocked: false }
                  ].map((badge, i) => (
                    <div key={i} className={`badge-card ${badge.unlocked ? 'unlocked' : 'locked'}`}>
                      <div className="badge-icon">{badge.icon}</div>
                      <div className="badge-name">{badge.name}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline tab — chronological event list with colored markers */}
              {activeTab === 'timeline' && (
                <div className="activity-timeline">
                  {[
                    {
                      type: 'report',
                      icon: '🚨',
                      title: 'New report created',
                      description: 'Multi-vehicle collision on East-West Highway',
                      time: '2 hours ago',
                      color: '#EF4444'
                    },
                    {
                      type: 'validation',
                      icon: '🤖',
                      title: 'AI Validation',
                      description: 'Your report has been verified and confirmed by AI',
                      time: '3 hours ago',
                      color: '#10B981'
                    },
                    {
                      type: 'badge',
                      icon: '🏆',
                      title: 'Badge Unlocked',
                      description: 'You earned the "Emergency Assistant" badge',
                      time: '1 day ago',
                      color: '#F59E0B'
                    },
                    {
                      type: 'alert',
                      icon: '🔔',
                      title: 'Alert Triggered',
                      description: '2,340 users were notified of your report',
                      time: '1 day ago',
                      color: '#8B5CF6'
                    },
                    {
                      type: 'reaction',
                      icon: '👍',
                      title: 'Reaction Received',
                      description: '15 users found your report helpful',
                      time: '2 days ago',
                      color: '#3B82F6'
                    },
                    {
                      type: 'report',
                      icon: '🚗',
                      title: 'Report Submitted',
                      description: 'Slowdown on Rue Didouche Mourad',
                      time: '3 days ago',
                      color: '#EF4444'
                    },
                    {
                      type: 'profile',
                      icon: '✏️',
                      title: 'Profile Updated',
                      description: 'Profile photo and bio updated',
                      time: '5 days ago',
                      color: '#64748B'
                    },
                    {
                      type: 'validation',
                      icon: '✓',
                      title: 'Report Verified',
                      description: 'Accuracy rate: 95%',
                      time: '1 week ago',
                      color: '#10B981'
                    },
                    {
                      type: 'badge',
                      icon: '🛡️',
                      title: 'Badge Unlocked',
                      description: '"Verified Reporter" badge earned',
                      time: '2 weeks ago',
                      color: '#F59E0B'
                    }
                  ].map((event, i) => (
                    <div key={i} className="timeline-event">
                      <div className="timeline-marker" style={{ borderColor: event.color }}>
                        <span className="timeline-icon" style={{ background: event.color }}>
                          {event.icon}
                        </span>
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <h4 className="timeline-title">{event.title}</h4>
                          <span className="timeline-time">{event.time}</span>
                        </div>
                        <p className="timeline-description">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ═══ SAVED LOCATIONS GRID ═══ */}
          <section className="saved-locations">
            <h2 className="section-title">📍 Saved Locations</h2>
            <div className="locations-grid">
              {[
                { name: 'Home', address: 'Bab Ezzouar, Algiers' },
                { name: 'Work', address: 'Hydra, Algiers' },
                { name: 'Preferred Route', address: 'East-West Highway' },
                { name: 'Dangerous Intersection', address: 'El Madania Intersection' }
              ].map((loc, i) => (
                <div key={i} className="location-card">
                  <div className="location-map-thumb"></div>
                  <h3 className="location-name">{loc.name}</h3>
                  <p className="location-address">{loc.address}</p>
                  <div className="location-actions">
                    <button className="btn-location-action">✏️</button>
                    <button className="btn-location-action">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* ═══ RIGHT COLUMN — Profile Insights (score, impact, alerts, health) ═══ */}
        <aside className="profile-sidebar-right">
          {/* Safety Score */}
          <div className="insight-card safety-score">
            <h3 className="insight-title">🛡️ Safety Score</h3>
            <div className="score-gauge">
              <svg className="gauge-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="10"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="url(#gradient)" strokeWidth="10" 
                  strokeDasharray="314" strokeDashoffset="78.5" transform="rotate(-90 60 60)"/>
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5A28FF"/>
                    <stop offset="100%" stopColor="#C04BFF"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="score-value">85</div>
            </div>
            <div className="score-factors">
              <div className="factor-item">✓ Verified reports</div>
              <div className="factor-item">✓ High accuracy rate</div>
              <div className="factor-item">✓ Active engagement</div>
            </div>
          </div>

          {/* Contribution Impact */}
          <div className="insight-card impact">
            <h3 className="insight-title">📊 Contribution Impact</h3>
            <div className="impact-stats">
              <div className="impact-item">
                <span className="impact-value">3,460</span>
                <span className="impact-label">users notified (30d)</span>
              </div>
              <div className="impact-item">
                <span className="impact-value">82%</span>
                <span className="impact-label">validated by AI</span>
              </div>
              <div className="impact-item">
                <span className="impact-value">Bab Ezzouar</span>
                <span className="impact-label">most active zone</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="insight-card recent-alerts">
            <h3 className="insight-title">🚨 Recent Triggered Alerts</h3>
            <div className="alerts-list">
              {[
                { severity: 'high', location: 'Autoroute Est', users: 2340 },
                { severity: 'medium', location: 'Rue Didouche', users: 890 },
                { severity: 'low', location: 'Place Audin', users: 230 }
              ].map((alert, i) => (
                <div key={i} className="alert-item">
                  <span className={`alert-severity ${alert.severity}`}></span>
                  <div className="alert-info">
                    <div className="alert-location">{alert.location}</div>
                    <div className="alert-users">{alert.users.toLocaleString()} affected users</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Health */}
          <div className="insight-card account-health">
            <h3 className="insight-title">✓ Account Health</h3>
            <div className="health-items">
              <div className="health-item ok">
                <span className="health-icon">✓</span>
                <span className="health-label">Email verified</span>
              </div>
              <div className="health-item ok">
                <span className="health-icon">✓</span>
                <span className="health-label">Phone verified</span>
              </div>
              <div className="health-item ok">
                <span className="health-icon">✓</span>
                <span className="health-label">Location enabled</span>
              </div>
              <div className="health-item warning">
                <span className="health-icon">⚠</span>
                <span className="health-label">Data sharing</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
