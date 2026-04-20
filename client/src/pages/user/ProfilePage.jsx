/**
 * @file ProfilePage.jsx
 * @description User profile page with a 3-column layout.
 *
 * Layout:
 *   - Left:   user card with avatar and edit button;
 *              profile completion indicator (progress bar + task checklist);
 *              sidebar navigation links
 *   - Center: cover photo + profile overview with stats;
 *              tabbed activity section (posts / reports / history / timeline)
 *              with full keyboard navigation (ArrowLeft/Right/Home/End);
 *   - Right:  safety score gauge (SVG donut), contribution impact stats,
 *             recent triggered alerts, account health checklist
 *
 * Features:
 *   - Accessible tab navigation using ARIA roles and roving tabIndex
 *   - Auto-scroll to focused tab button on keyboard navigation
 *   - All data is mock/static for prototype purposes
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import LeftQuickInfoLinks from '../../components/layout/LeftQuickInfoLinks'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getCurrentUser, getUserPrivacyVisibility, getUserSettings } from '../../services/authService'
import { listReports } from '../../services/reportsService'
import { fetchAlerts, fetchAlertsForUser } from '../../services/alertService'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
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
  const [profileVisibility, setProfileVisibility] = useState('public')
  const [activeTab, setActiveTab] = useState('alerts')       // Currently selected activity tab
  const [showDropdown, setShowDropdown] = useState(false)   // Header avatar dropdown
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const tabsRef = useRef(null)                              // Ref to the tab-list container for scroll/focus
  const viewedUserFromFeed = location.state?.profileUser || null
  const authUser = user || null
  const isViewingOwnProfile = viewedUserFromFeed ? isSameUser(viewedUserFromFeed, authUser) : true
  const headerDisplayName = authUser?.name
    || [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ')
    || authUser?.email
    || authUser?.phone
    || 'User'
  const headerAvatarUrl = getUserAvatarUrl(authUser)
  const headerInitials = getInitialsFromName(headerDisplayName)

  useEffect(() => {
    setProfileUser(viewedUserFromFeed || null)
    if (viewedUserFromFeed) {
      setActiveTab('reports')
    }
  }, [viewedUserFromFeed])

  const isExternalProfileView = Boolean(viewedUserFromFeed) && !isViewingOwnProfile
  const shouldHideActivityForViewer = isExternalProfileView && profileVisibility === 'private'

  useEffect(() => {
    if (!isExternalProfileView) {
      setProfileVisibility('public')
      return
    }

    const targetUserId = viewedUserFromFeed?.id ?? viewedUserFromFeed?.userId ?? viewedUserFromFeed?.user_id
    if (!targetUserId) {
      setProfileVisibility('public')
      return
    }

    let ignore = false

    ;(async () => {
      try {
        const privacy = await getUserPrivacyVisibility(targetUserId)
        if (!ignore) {
          setProfileVisibility(privacy.visibility === 'private' ? 'private' : 'public')
          setProfileUser((previous) => {
            const next = previous || viewedUserFromFeed || {}
            return {
              ...next,
              trustScore: privacy.trustScore ?? next.trustScore ?? next.trust_score ?? null,
              trustSignals: privacy.trustSignals || next.trustSignals || null,
              trustScoreGeneratedAt: privacy.trustScoreGeneratedAt || next.trustScoreGeneratedAt || null,
              trustScoreSource: privacy.trustScoreSource || next.trustScoreSource || next.trust_score_source || null,
            }
          })
        }
      } catch {
        if (!ignore) {
          setProfileVisibility('public')
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [isExternalProfileView, viewedUserFromFeed])

  useEffect(() => {
    if (isExternalProfileView) {
      return
    }

    let ignore = false

    ;(async () => {
      try {
        const [freshUser, settings] = await Promise.all([
          getCurrentUser(),
          getUserSettings(),
        ])

        const profileSettings = settings?.profile || null
        if (!ignore && freshUser) {
          setProfileUser({
            ...freshUser,
            bio: profileSettings?.bio ?? freshUser.bio ?? '',
            location: profileSettings?.location ?? freshUser.location ?? '',
            trustScore: profileSettings?.trustScore ?? freshUser.trustScore ?? freshUser.trust_score ?? null,
            trustSignals: profileSettings?.trustSignals ?? freshUser.trustSignals ?? null,
            trustScoreGeneratedAt:
              profileSettings?.trustScoreGeneratedAt
              ?? freshUser.trustScoreGeneratedAt
              ?? freshUser.trust_score_generated_at
              ?? null,
            trustScoreSource:
              profileSettings?.trustScoreSource
              ?? freshUser.trustScoreSource
              ?? freshUser.trust_score_source
              ?? null,
          })
          setProfileVisibility(settings?.privacy?.visibility === 'private' ? 'private' : 'public')
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
  const profileAvatarUrl = getUserAvatarUrl(currentUser) || headerAvatarUrl || profileAvatar
  const bio = String(currentUser.bio || '').trim() || 'No bio added yet.'
  const locationLabel = currentUser.city
    || currentUser.location
    || currentUser.address
    || 'Location not set'
  const joinLabel = formatJoinDate(currentUser.createdAt || currentUser.created_at)
  const contactLabel = currentUser.email || currentUser.phone || 'No contact info'
  const reportsCount = currentUser.reportCount ?? currentUser.reports_count
  const alertsCount = currentUser.alertsCount ?? currentUser.alerts_count
  const verificationRateRaw = Number(currentUser.verificationRate ?? currentUser.verification_rate)
  const verificationRate = Number.isFinite(verificationRateRaw)
    ? Math.max(0, Math.min(100, Math.round(verificationRateRaw)))
    : null
  const effectiveReportsCount = shouldHideActivityForViewer
    ? 0
    : (Number.isFinite(Number(reportsCount)) ? Number(reportsCount) : myReports.length)
  const effectiveAlertsCount = shouldHideActivityForViewer
    ? 0
    : (Number.isFinite(Number(alertsCount)) ? Number(alertsCount) : myAlerts.length)

  const tabs = useMemo(
    () => (isExternalProfileView ? ['alerts', 'reports'] : ['alerts', 'reports', 'history', 'timeline']),
    [isExternalProfileView],
  )

  const tabLabels = {
    alerts: '🔔 Alerts',
    reports: '🚨 Reports',
    history: '📊 History',
    timeline: '⏱️ Timeline',
  }

  const reportMetrics = useMemo(() => {
    const reports = Array.isArray(myReports) ? myReports : []
    const total = reports.length
    const verified = reports.filter((report) => {
      const status = String(report?.status || '').toLowerCase()
      return status === 'verified' || status === 'resolved'
    }).length
    const pending = reports.filter((report) => String(report?.status || '').toLowerCase() === 'pending').length
    const highSeverity = reports.filter((report) => {
      const severity = String(report?.severity || '').toLowerCase()
      return severity === 'high' || severity === 'critical'
    }).length
    const aiValidated = reports.filter((report) => {
      const status = String(report?.spamAnalysis?.status || '').toLowerCase()
      return Boolean(report?.spamAnalysis?.classifiedAt) || (status && status !== 'pending')
    }).length

    return {
      total,
      verified,
      pending,
      highSeverity,
      aiValidated,
      verifiedRate: total > 0 ? Math.round((verified / total) * 100) : 0,
      aiRate: total > 0 ? Math.round((aiValidated / total) * 100) : 0,
    }
  }, [myReports])

  const alertMetrics = useMemo(() => {
    const alerts = Array.isArray(myAlerts) ? myAlerts : []
    const total = alerts.length
    const active = alerts.filter((alert) => String(alert?.status || '').toLowerCase() === 'active').length
    const triggered = alerts.reduce((sum, alert) => sum + (Number(alert?.triggerCount) || 0), 0)

    return {
      total,
      active,
      triggered,
    }
  }, [myAlerts])

  const displayVerificationRate = verificationRate ?? reportMetrics.verifiedRate
  const trustScoreRaw = Number(currentUser.trustScore ?? currentUser.trust_score)
  const hasRealTrustScore = Number.isFinite(trustScoreRaw)
  const trustScore = hasRealTrustScore
    ? Math.max(0, Math.min(100, Number(trustScoreRaw.toFixed(2))))
    : 0
  const trustScoreLabel = hasRealTrustScore
    ? Number(trustScore.toFixed(1)).toString()
    : '—'
  const trustSignals = currentUser?.trustSignals && typeof currentUser.trustSignals === 'object'
    ? currentUser.trustSignals
    : {}
  const legitReportsCountRaw = Number(trustSignals.legitReports ?? trustSignals.legit_count ?? 0)
  const spamReportsCountRaw = Number(trustSignals.spamReports ?? trustSignals.spam_count ?? 0)
  const reviewedReportsCountRaw = Number(trustSignals.reviewedReports ?? trustSignals.reviewed_count)
  const legitReportsCount = Number.isFinite(legitReportsCountRaw) ? Math.max(0, legitReportsCountRaw) : 0
  const spamReportsCount = Number.isFinite(spamReportsCountRaw) ? Math.max(0, spamReportsCountRaw) : 0
  const reviewedReportsCount = Number.isFinite(reviewedReportsCountRaw)
    ? Math.max(0, reviewedReportsCountRaw)
    : (legitReportsCount + spamReportsCount)
  const trustScoreGeneratedAt = currentUser.trustScoreGeneratedAt || currentUser.trust_score_generated_at || null
  const trustScoreSource = currentUser.trustScoreSource || currentUser.trust_score_source || null
  const trustGeneratedLabel = trustScoreGeneratedAt
    ? `Last synced ${formatAlertTime(trustScoreGeneratedAt)}`
    : trustScoreSource === 'derived'
      ? 'Derived from reviewed reports (sync pending)'
      : reviewedReportsCount > 0
        ? 'Reviewed reports found'
        : 'No reviewed reports yet'
  const trustScoreDashOffset = 314 - (314 * trustScore) / 100

  const topActiveZone = useMemo(() => {
    const zoneCounts = new Map()

    myReports.forEach((report) => {
      const label = String(report?.locationLabel || report?.location?.label || '').trim()
      if (!label) return
      zoneCounts.set(label, (zoneCounts.get(label) || 0) + 1)
    })

    myAlerts.forEach((alert) => {
      const label = String(alert?.area?.name || alert?.zone?.displayName || '').trim()
      if (!label) return
      zoneCounts.set(label, (zoneCounts.get(label) || 0) + 1)
    })

    if (zoneCounts.size === 0) {
      return 'No zone yet'
    }

    return [...zoneCounts.entries()].sort((left, right) => right[1] - left[1])[0][0]
  }, [myAlerts, myReports])

  const recentTriggeredAlerts = useMemo(() => {
    const results = []

    myAlerts.forEach((alert, alertIndex) => {
      const location = alert?.area?.name || alert?.zone?.displayName || alert?.name || 'Monitored area'
      const fallbackSeverity = String(
        alert?.severity
          || (Array.isArray(alert?.severityLevels) ? alert.severityLevels[0] : 'medium')
          || 'medium',
      ).toLowerCase()

      const recentTriggers = Array.isArray(alert?.recentTriggers) ? alert.recentTriggers : []
      if (recentTriggers.length > 0) {
        recentTriggers.forEach((trigger, triggerIndex) => {
          const matchedAt = trigger?.matchedAt ? new Date(trigger.matchedAt).getTime() : 0
          results.push({
            id: `${alert?.id || alertIndex}-${trigger?.id || triggerIndex}`,
            severity: String(trigger?.severity || fallbackSeverity || 'medium').toLowerCase(),
            location,
            subtitle: trigger?.time || formatAlertTime(trigger?.matchedAt),
            matchedAt,
          })
        })
        return
      }

      if (alert?.lastTriggeredAt || alert?.lastTriggered) {
        const matchedAt = alert?.lastTriggeredAt ? new Date(alert.lastTriggeredAt).getTime() : 0
        results.push({
          id: `${alert?.id || alertIndex}-last`,
          severity: fallbackSeverity,
          location,
          subtitle: alert?.lastTriggered || formatAlertTime(alert?.lastTriggeredAt),
          matchedAt,
        })
      }
    })

    return results
      .sort((left, right) => (right.matchedAt || 0) - (left.matchedAt || 0))
      .slice(0, 3)
  }, [myAlerts])

  const isEmailVerified = Boolean(currentUser?.email_verified || currentUser?.email_verified_at)
  const hasPhoneVerified = Boolean(String(currentUser?.phone || '').trim())
  const hasLocationSet = locationLabel !== 'Location not set'

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0])
    }
  }, [activeTab, tabs])

  useEffect(() => {
    if (shouldHideActivityForViewer) {
      setMyReports([])
      setReportsError('')
      setReportsLoading(false)
      return
    }

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
  }, [currentUser?.email, currentUser?.id, displayName, shouldHideActivityForViewer])

  useEffect(() => {
    if (shouldHideActivityForViewer) {
      setMyAlerts([])
      setAlertsLoading(false)
      setAlertsError('')
      return
    }

    const targetUserId = currentUser?.id ?? currentUser?.userId ?? currentUser?.user_id
    if (isExternalProfileView && !targetUserId) {
      setMyAlerts([])
      setAlertsLoading(false)
      setAlertsError('Unable to resolve profile alerts.')
      return
    }

    let ignore = false

    ;(async () => {
      setAlertsLoading(true)
      setAlertsError('')

      try {
        const items = isExternalProfileView
          ? await fetchAlertsForUser(targetUserId)
          : await fetchAlerts()
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
  }, [currentUser?.id, currentUser?.userId, currentUser?.user_id, isExternalProfileView, shouldHideActivityForViewer])

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
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya…"
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}><span className="notification-badge"></span></button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${headerAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {headerAvatarUrl ? (
                  <img src={headerAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : headerInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>Log Out</button>
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
              <img src={profileAvatarUrl} alt={displayName} loading="lazy" />
            </div>
            <h2 className="user-card-name">{displayName}</h2>
            <p className="user-bio">{bio}</p>
            {isViewingOwnProfile && (
              <button
                className="btn-edit-profile"
                onClick={() => navigate('/settings', { state: { openSection: 'profile' } })}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>

          <nav className="profile-nav">
            <button className="profile-nav-item active" onClick={() => navigate('/profile')}>
              <span className="nav-icon">👤</span>
              <span className="nav-label">My Profile</span>
            </button>
            <button className="profile-nav-item" onClick={() => navigate('/reports')}>
              <span className="nav-icon">📝</span>
              <span className="nav-label">My Reports</span>
            </button>
            <button className="profile-nav-item" onClick={() => navigate('/settings', { state: { openSection: 'account' } })}>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Account Settings</span>
            </button>
            <button className="profile-nav-item" onClick={() => navigate('/settings', { state: { openSection: 'privacy' } })}>
              <span className="nav-icon">🔒</span>
              <span className="nav-label">Privacy & Security</span>
            </button>
          </nav>

          <LeftQuickInfoLinks />
        </aside>

        {/* ═══ MIDDLE COLUMN — Profile Overview + Activities ═══ */}
        <main className="profile-main">
          {/* Profile Overview */}
          <section className="profile-overview">
            <div className="profile-cover"></div>
            <div className="profile-header-content">
              <div className="profile-avatar-large">
                <img src={profileAvatarUrl} alt={displayName} loading="lazy" />
              </div>
              <div className="profile-info">
                <h1 className="profile-name">{displayName}</h1>
                <p className="profile-bio-main">{bio}</p>
                <div className="profile-meta">
                  <span className="meta-item"><span className="meta-key">Location</span><span className="meta-value">{locationLabel}</span></span>
                  <span className="meta-item"><span className="meta-key">Member</span><span className="meta-value">{joinLabel}</span></span>
                  <span className="meta-item"><span className="meta-key">Contact</span><span className="meta-value">{contactLabel}</span></span>
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
                <span className="stat-value">{displayVerificationRate}%</span>
                <span className="stat-label">Verification Rate</span>
              </div>
            </div>
          </section>

          {/* ═══ TABBED ACTIVITIES SECTION ═══ */}
          <section className="profile-activities">
            <div className="activity-tabs" role="tablist" ref={tabsRef}>
              {tabs.map((tabKey, tabIndex) => (
                <button
                  key={tabKey}
                  className={`activity-tab ${activeTab === tabKey ? 'active' : ''}`}
                  onClick={() => setActiveTab(tabKey)}
                  onKeyDown={(event) => handleKeyDown(event, tabIndex)}
                  role="tab"
                  aria-selected={activeTab === tabKey}
                  tabIndex={activeTab === tabKey ? 0 : -1}
                >
                  {tabLabels[tabKey]}
                </button>
              ))}
            </div>

            {/* ═══ TAB CONTENT PANELS ═══ */}
            <div className="activity-content">
              {/* Alerts tab — user saved alerts */}
              {activeTab === 'alerts' && (
                <div className="activity-grid">
                  {shouldHideActivityForViewer ? (
                    <div className="activity-card">
                      <h3 className="activity-title">Activity is private</h3>
                      <p className="activity-time">This account is private. Alerts are hidden from other users.</p>
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

              {/* Reports tab */}
              {activeTab === 'reports' && (
                <div className="activity-grid">
                  {shouldHideActivityForViewer ? (
                    <div className="activity-card">
                      <h3 className="activity-title">Reports are private</h3>
                      <p className="activity-time">This account is private. Report history is hidden from other users.</p>
                    </div>
                  ) : reportsLoading ? (
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

        </main>

        {/* ═══ RIGHT COLUMN — Profile Insights (score, impact, alerts, health) ═══ */}
        <aside className="profile-sidebar-right">
          {/* Trust Score */}
          <div className="insight-card safety-score">
            <h3 className="insight-title">🛡️ Trust Score</h3>
            <div className="score-gauge">
              <svg className="gauge-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="10"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="url(#gradient)" strokeWidth="10" 
                  strokeDasharray="314" strokeDashoffset={trustScoreDashOffset} transform="rotate(-90 60 60)"/>
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5A28FF"/>
                    <stop offset="100%" stopColor="#C04BFF"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="score-value">{trustScoreLabel}</div>
            </div>
            <div className="score-factors">
              <div className="factor-item">✓ {legitReportsCount} reports confirmed legit</div>
              <div className="factor-item">✓ {spamReportsCount} reports confirmed spam</div>
              <div className="factor-item">✓ {reviewedReportsCount} reports reviewed</div>
              <div className="factor-item">✓ {trustGeneratedLabel}</div>
            </div>
          </div>

          {/* Contribution Impact */}
          <div className="insight-card impact">
            <h3 className="insight-title">📊 Contribution Impact</h3>
            <div className="impact-stats">
              <div className="impact-item">
                <span className="impact-value">{alertMetrics.triggered.toLocaleString()}</span>
                <span className="impact-label">alert matches (all time)</span>
              </div>
              <div className="impact-item">
                <span className="impact-value">{reportMetrics.aiRate}%</span>
                <span className="impact-label">reports validated by AI</span>
              </div>
              <div className="impact-item">
                <span className="impact-value">{topActiveZone}</span>
                <span className="impact-label">most active zone</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="insight-card recent-alerts">
            <h3 className="insight-title">🚨 Recent Triggered Alerts</h3>
            <div className="alerts-list">
              {recentTriggeredAlerts.length > 0 ? (
                recentTriggeredAlerts.map((alert) => (
                  <div key={alert.id} className="alert-item">
                    <span className={`alert-severity ${alert.severity}`}></span>
                    <div className="alert-info">
                      <div className="alert-location">{alert.location}</div>
                      <div className="alert-users">{alert.subtitle || 'Recently triggered'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert-item">
                  <span className="alert-severity low"></span>
                  <div className="alert-info">
                    <div className="alert-location">No recent triggers yet</div>
                    <div className="alert-users">New triggers will appear here.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Health */}
          <div className="insight-card account-health">
            <h3 className="insight-title">✓ Account Health</h3>
            <div className="health-items">
              <div className={`health-item ${isEmailVerified ? 'ok' : 'warning'}`}>
                <span className="health-icon">{isEmailVerified ? '✓' : '⚠'}</span>
                <span className="health-label">Email verified</span>
              </div>
              <div className={`health-item ${hasPhoneVerified ? 'ok' : 'warning'}`}>
                <span className="health-icon">{hasPhoneVerified ? '✓' : '⚠'}</span>
                <span className="health-label">Phone verified</span>
              </div>
              <div className={`health-item ${hasLocationSet ? 'ok' : 'warning'}`}>
                <span className="health-icon">{hasLocationSet ? '✓' : '⚠'}</span>
                <span className="health-label">Location set</span>
              </div>
              <div className={`health-item ${profileVisibility === 'private' ? 'warning' : 'ok'}`}>
                <span className="health-icon">{profileVisibility === 'private' ? '⚠' : '✓'}</span>
                <span className="health-label">Visibility: {profileVisibility}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
