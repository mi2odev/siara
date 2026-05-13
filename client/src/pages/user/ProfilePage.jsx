import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined'
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
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
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getCurrentUser, getUserPrivacyVisibility, getUserSettings } from '../../services/authService'
import { listReports } from '../../services/reportsService'
import { fetchAlerts, fetchAlertsForUser } from '../../services/alertService'
import {
  getMyDriverQuizHistory,
  getMyDriverQuizProfile,
} from '../../services/driverQuizService'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import '../../styles/NewsPage.css'
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
  const [driverQuizProfile, setDriverQuizProfile] = useState(null)
  const [driverQuizHistory, setDriverQuizHistory] = useState([])
  const [driverQuizLoading, setDriverQuizLoading] = useState(false)
  const [driverQuizError, setDriverQuizError] = useState('')
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizReloadKey, setQuizReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState('alerts')       // Currently selected activity tab
  const [showDropdown, setShowDropdown] = useState(false)   // Header avatar dropdown
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
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
  const openAvatarPreview = () => setIsAvatarPreviewOpen(true)
  const closeAvatarPreview = () => setIsAvatarPreviewOpen(false)

  useEffect(() => {
    let cancelled = false
    if (!isViewingOwnProfile || !authUser) {
      setDriverQuizProfile(null)
      setDriverQuizHistory([])
      return () => {}
    }
    setDriverQuizLoading(true)
    setDriverQuizError('')
    Promise.all([getMyDriverQuizProfile(), getMyDriverQuizHistory({ limit: 10 })])
      .then(([profile, history]) => {
        if (cancelled) return
        setDriverQuizProfile(profile)
        setDriverQuizHistory(Array.isArray(history?.attempts) ? history.attempts : [])
      })
      .catch((error) => {
        if (cancelled) return
        setDriverQuizError(error?.message || 'Failed to load driver quiz profile')
      })
      .finally(() => {
        if (!cancelled) setDriverQuizLoading(false)
      })
    return () => { cancelled = true }
  }, [authUser, isViewingOwnProfile, quizReloadKey])

  useEffect(() => {
    if (!isAvatarPreviewOpen) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAvatarPreview()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAvatarPreviewOpen])

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
              name: privacy.name || next.name || '',
              avatarUrl: privacy.avatarUrl || privacy.avatar_url || next.avatarUrl || next.avatar_url || '',
              avatar_url: privacy.avatar_url || privacy.avatarUrl || next.avatar_url || next.avatarUrl || '',
              bio: privacy.bio || next.bio || '',
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
  const profileAvatarUrl = getUserAvatarUrl(currentUser) || headerAvatarUrl || ''
  const profileInitials = getInitialsFromName(displayName) || '?'
  const bio = String(currentUser.bio || '').trim() || 'No bio added yet.'
  // For own profile, always prefer the fresh AuthContext user.location which is kept
  // up-to-date by saveSettings in SettingsPage. profileUser may be stale after an update.
  const locationLabel = (isViewingOwnProfile ? (user?.location || user?.city) : null)
    || currentUser.city
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

  useEffect(() => { setAvatarFailed(false) }, [profileAvatarUrl])

  const tabs = useMemo(
    () => (isExternalProfileView ? ['alerts', 'reports'] : ['alerts', 'reports', 'history', 'timeline']),
    [isExternalProfileView],
  )

  const tabLabels = {
    alerts: <><NotificationsOutlinedIcon fontSize="inherit" /> Alerts</>,
    reports: <><NotificationsActiveOutlinedIcon fontSize="inherit" /> Reports</>,
    history: <><BarChartOutlinedIcon fontSize="inherit" /> History</>,
    timeline: <><TimerOutlinedIcon fontSize="inherit" /> Timeline</>,
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
      return severity === 'high'
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

  const handleQuizComplete = () => {
    setShowQuiz(false)
    setQuizReloadKey((prev) => prev + 1)
  }

  /* ═══ RENDER ═══ */
  return (
    <div className="siara-profile-root">
      {/* DRIVING QUIZ POPUP */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══ FLOATING HEADER ═══ */}
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
              placeholder="Search for an incident, a road, a wilaya…"
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn dash-icon-btn-notification" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <NotificationsOutlinedIcon fontSize="small" />
              <span className="notification-badge"></span>
            </button>
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
            <button
              type="button"
              className="user-card-avatar profile-avatar-trigger"
              onClick={openAvatarPreview}
              aria-label={`Open ${displayName} profile photo`}
            >
              {profileAvatarUrl && !avatarFailed
                ? <img src={profileAvatarUrl} alt={displayName} loading="lazy" onError={() => setAvatarFailed(true)} />
                : <span className="profile-avatar-initials">{profileInitials}</span>
              }
            </button>
            <h2 className="user-card-name">{displayName}</h2>
            <p className="user-bio">{bio}</p>
            {isViewingOwnProfile && (
              <button
                className="btn-edit-profile"
                onClick={() => navigate('/settings', { state: { openSection: 'profile' } })}
              >
                <EditRoundedIcon fontSize="inherit" /> Edit Profile
              </button>
            )}
          </div>

          <FeedSidebarNav activeKey="profile" />
        </aside>

        {/* ═══ MIDDLE COLUMN ═══ */}
        <main className="profile-main">

          {/* ── Profile Header Card ── */}
          <section className="pm-card pm-profile">
            <div className="pm-profile-banner" aria-hidden="true" />

            <div className="pm-profile-body">
              <button
                type="button"
                className="pm-profile-avatar"
                onClick={openAvatarPreview}
                aria-label={`View ${displayName} profile photo`}
              >
                {profileAvatarUrl && !avatarFailed
                  ? <img src={profileAvatarUrl} alt={displayName} loading="lazy" onError={() => setAvatarFailed(true)} />
                  : <span className="pm-profile-avatar-initials">{profileInitials}</span>
                }
              </button>

              <div className="pm-profile-info">
                <h1 className="pm-profile-name">{displayName}</h1>
                <p className="pm-profile-bio">{bio}</p>
                <div className="pm-profile-meta">
                  <span className="pm-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Zm0 2.75a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" fill="currentColor"/>
                    </svg>
                    {locationLabel}
                  </span>
                  <span className="pm-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M5 1.5V4M11 1.5V4M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Joined {joinLabel}
                  </span>
                  <span className="pm-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1.5 6l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    {contactLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="pm-profile-stats">
              <div className="pm-stat">
                <strong>{effectiveAlertsCount}</strong>
                <span>Alerts</span>
              </div>
              <div className="pm-stat">
                <strong>{effectiveReportsCount}</strong>
                <span>Reports</span>
              </div>
              <div className="pm-stat">
                <strong>{displayVerificationRate}%</strong>
                <span>Verified</span>
              </div>
            </div>
          </section>

          {/* ── Driver Quiz Card (own profile only) ── */}
          {isViewingOwnProfile && (
            <section className="pm-card pm-quiz">
              <div className="pm-quiz-head">
                <div className="pm-quiz-head-text">
                  <h2 className="pm-quiz-title">Driver Behavior Profile</h2>
                  <p className="pm-quiz-subtitle">Personalized driving risk assessment</p>
                </div>
                <button
                  type="button"
                  className="pm-btn-primary"
                  onClick={() => setShowQuiz(true)}
                >
                  {driverQuizProfile ? 'Retake quiz' : 'Take quiz'}
                </button>
              </div>

              {driverQuizLoading && (
                <p className="pm-quiz-state">Loading your latest result…</p>
              )}
              {driverQuizError && !driverQuizLoading && (
                <p className="pm-quiz-state pm-quiz-state--error">{driverQuizError}</p>
              )}
              {!driverQuizLoading && !driverQuizError && !driverQuizProfile && (
                <p className="pm-quiz-state">
                  You haven&apos;t completed the SIARA driver quiz yet. Take it to receive a personalized driving profile.
                </p>
              )}
              {!driverQuizLoading && !driverQuizError && driverQuizProfile && (
                <div className="pm-quiz-result">
                  <div className="pm-quiz-score">
                    <span className="pm-quiz-score-num">
                      {driverQuizProfile.latestRiskScore == null ? '--' : Math.round(Number(driverQuizProfile.latestRiskScore))}
                    </span>
                    <span className="pm-quiz-score-max">/100</span>
                    <span className="pm-quiz-score-label">Risk</span>
                  </div>
                  <div className="pm-quiz-detail">
                    <h3 className="pm-quiz-detail-title">{driverQuizProfile.latestResultTitle || 'Driver profile'}</h3>
                    {driverQuizProfile.latestResultDescription && (
                      <p className="pm-quiz-detail-desc">{driverQuizProfile.latestResultDescription}</p>
                    )}
                    {driverQuizProfile.latestRecommendationDescription && (
                      <p className="pm-quiz-detail-reco">{driverQuizProfile.latestRecommendationDescription}</p>
                    )}
                    {driverQuizProfile.lastCompletedAt && (
                      <span className="pm-quiz-detail-meta">
                        Last completed {new Date(driverQuizProfile.lastCompletedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Activity Card ── */}
          <section className="pm-card pm-activity">
            <div className="pm-activity-tabs" role="tablist" ref={tabsRef}>
              {tabs.map((tabKey, tabIndex) => (
                <button
                  key={tabKey}
                  className={`pm-tab${activeTab === tabKey ? ' pm-tab--active' : ''}`}
                  onClick={() => setActiveTab(tabKey)}
                  onKeyDown={(event) => handleKeyDown(event, tabIndex)}
                  role="tab"
                  aria-selected={activeTab === tabKey}
                  tabIndex={activeTab === tabKey ? 0 : -1}
                >
                  {{ alerts: 'Alerts', reports: 'Reports', history: 'History', timeline: 'Timeline' }[tabKey]}
                </button>
              ))}
            </div>

            <div className="pm-activity-body">

              {/* Alerts tab */}
              {activeTab === 'alerts' && (
                shouldHideActivityForViewer ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128274;</span>
                    <p className="pm-empty-title">Activity is private</p>
                    <p className="pm-empty-sub">This account is private. Alerts are hidden from other users.</p>
                  </div>
                ) : alertsLoading ? (
                  <div className="pm-empty"><p className="pm-empty-title">Loading alerts…</p></div>
                ) : alertsError ? (
                  <div className="pm-empty"><p className="pm-empty-title pm-empty-title--error">{alertsError}</p></div>
                ) : myAlerts.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128276;</span>
                    <p className="pm-empty-title">No saved alerts yet</p>
                    <p className="pm-empty-sub">Create a new alert to monitor your important zones.</p>
                    <button className="pm-btn-primary" onClick={() => navigate('/alerts/create')}>Create Alert</button>
                  </div>
                ) : (
                  <ul className="pm-list">
                    {myAlerts.map((alert) => {
                      const status = String(alert.status || 'paused').toLowerCase()
                      const chipClass = status === 'active' ? 'pm-chip--green'
                        : status === 'paused' ? 'pm-chip--amber'
                        : 'pm-chip--gray'
                      const subParts = [
                        alert.area?.name || alert.zone?.displayName || 'Monitored area',
                        alert.area?.wilaya,
                      ].filter(Boolean)
                      return (
                        <li
                          key={alert.id}
                          className="pm-row"
                          onClick={() => navigate('/alerts')}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && navigate('/alerts')}
                        >
                          <span className="pm-row-icon pm-row-icon--alert" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="none">
                              <path d="M10 2a6 6 0 0 1 6 6v2.586l1.707 1.707A1 1 0 0 1 17 14H3a1 1 0 0 1-.707-1.707L4 10.586V8a6 6 0 0 1 6-6Zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" fill="currentColor"/>
                            </svg>
                          </span>
                          <div className="pm-row-main">
                            <span className="pm-row-title">{alert.name || 'Saved alert'}</span>
                            <span className="pm-row-sub">{subParts.join(' · ')}</span>
                          </div>
                          <div className="pm-row-right">
                            <span className={`pm-chip ${chipClass}`}>{toTitleCase(alert.status || 'Paused')}</span>
                            <span className="pm-row-time">{formatAlertTime(alert.lastTriggered || alert.last_triggered)}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              )}

              {/* Reports tab */}
              {activeTab === 'reports' && (
                shouldHideActivityForViewer ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128274;</span>
                    <p className="pm-empty-title">Reports are private</p>
                    <p className="pm-empty-sub">This account is private. Report history is hidden from other users.</p>
                  </div>
                ) : reportsLoading ? (
                  <div className="pm-empty"><p className="pm-empty-title">Loading reports…</p></div>
                ) : reportsError ? (
                  <div className="pm-empty"><p className="pm-empty-title pm-empty-title--error">{reportsError}</p></div>
                ) : myReports.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128221;</span>
                    <p className="pm-empty-title">No reports found yet</p>
                    <p className="pm-empty-sub">Create your first incident report to see it here.</p>
                    <button className="pm-btn-primary" onClick={() => navigate('/report')}>Create Report</button>
                  </div>
                ) : (
                  <ul className="pm-list">
                    {myReports.map((report) => {
                      const status = String(report.status || 'pending').toLowerCase()
                      const chipClass = (status === 'verified' || status === 'resolved') ? 'pm-chip--green'
                        : status === 'paused' ? 'pm-chip--amber'
                        : 'pm-chip--gray'
                      const subParts = [
                        toTitleCase(report.incidentType || report.incident_type || 'incident'),
                        report.locationLabel || report.location?.label || 'Location not set',
                      ].filter(Boolean)
                      return (
                        <li
                          key={report.id}
                          className="pm-row"
                          onClick={() => navigate(`/incident/${report.id}`)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && navigate(`/incident/${report.id}`)}
                        >
                          <span className="pm-row-icon pm-row-icon--report" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="none">
                              <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 4v5m0 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                          </span>
                          <div className="pm-row-main">
                            <span className="pm-row-title">{report.title || 'Untitled report'}</span>
                            <span className="pm-row-sub">{subParts.join(' · ')}</span>
                          </div>
                          <div className="pm-row-right">
                            <span className={`pm-chip ${chipClass}`}>{toTitleCase(report.status || 'Pending')}</span>
                            <span className="pm-row-time">{formatReportTime(report.createdAt || report.created_at || report.occurredAt || report.occurred_at)}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )
              )}

              {/* History tab */}
              {activeTab === 'history' && (
                <div className="pm-empty">
                  <span className="pm-empty-icon" aria-hidden="true">&#128202;</span>
                  <p className="pm-empty-title">History coming soon</p>
                  <p className="pm-empty-sub">Your full activity history will appear here.</p>
                </div>
              )}

              {/* Timeline tab */}
              {activeTab === 'timeline' && (
                <div className="pm-timeline">
                  {[
                    { icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />, title: 'New report created', description: 'Multi-vehicle collision on East-West Highway', time: '2 hours ago', color: '#EF4444' },
                    { icon: <SmartToyOutlinedIcon fontSize="inherit" />, title: 'AI Validation',       description: 'Your report has been verified and confirmed by AI', time: '3 hours ago', color: '#10B981' },
                    { icon: <NotificationsOutlinedIcon fontSize="inherit" />, title: 'Alert Triggered',     description: '2,340 users were notified of your report', time: '1 day ago', color: '#8B5CF6' },
                    { icon: <ThumbUpOutlinedIcon fontSize="inherit" />, title: 'Reaction Received',   description: '15 users found your report helpful', time: '2 days ago', color: '#3B82F6' },
                    { icon: <DirectionsCarOutlinedIcon fontSize="inherit" />, title: 'Report Submitted',    description: 'Slowdown on Rue Didouche Mourad', time: '3 days ago', color: '#EF4444' },
                    { icon: <EditRoundedIcon fontSize="inherit" />, title: 'Profile Updated',     description: 'Profile photo and bio updated', time: '5 days ago', color: '#64748B' },
                    { icon: <CheckRoundedIcon fontSize="inherit" />,  title: 'Report Verified',     description: 'Accuracy rate: 95%', time: '1 week ago', color: '#10B981' },
                  ].map((event, i) => (
                    <div key={i} className="pm-timeline-event">
                      <div className="pm-timeline-dot" style={{ background: event.color }}>
                        <span>{event.icon}</span>
                      </div>
                      <div className="pm-timeline-content">
                        <div className="pm-timeline-header">
                          <h4 className="pm-timeline-title">{event.title}</h4>
                          <span className="pm-timeline-time">{event.time}</span>
                        </div>
                        <p className="pm-timeline-desc">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </section>

        </main>

        {/* ═══ RIGHT COLUMN ═══ */}
        <aside className="profile-sidebar-right">
          {/* ── Trust Score ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">Trust Score</p>
            <div className="prf-gauge-wrap">
              <svg className="prf-gauge-svg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="url(#prfGrad)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="314" strokeDashoffset={trustScoreDashOffset} transform="rotate(-90 60 60)"/>
                <defs>
                  <linearGradient id="prfGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f46e5"/>
                    <stop offset="100%" stopColor="#a855f7"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="prf-gauge-center">
                <span className="prf-gauge-num">{trustScoreLabel}</span>
                <span className="prf-gauge-sub">/ 100</span>
              </div>
            </div>
            <ul className="prf-factors">
              <li><span className="prf-factor-dot prf-factor-dot--ok" />{legitReportsCount} reports confirmed legit</li>
              <li><span className="prf-factor-dot prf-factor-dot--warn" />{spamReportsCount} reports confirmed spam</li>
              <li><span className="prf-factor-dot prf-factor-dot--ok" />{reviewedReportsCount} reports reviewed</li>
              <li><span className="prf-factor-dot prf-factor-dot--info" />{trustGeneratedLabel}</li>
            </ul>
          </div>

          {/* ── Contribution Impact ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">Contribution Impact</p>
            <div className="prf-impact-grid">
              <div className="prf-impact-cell">
                <strong>{alertMetrics.triggered.toLocaleString()}</strong>
                <span>alert matches</span>
              </div>
              <div className="prf-impact-cell">
                <strong>{reportMetrics.aiRate}%</strong>
                <span>AI validated</span>
              </div>
              <div className="prf-impact-zone">
                <span className="prf-impact-zone-val">{topActiveZone}</span>
                <span className="prf-impact-zone-lbl">most active zone</span>
              </div>
            </div>
          </div>

          {/* ── Recent Alerts ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">Recent Triggered Alerts</p>
            <ul className="prf-alert-list">
              {recentTriggeredAlerts.length > 0 ? recentTriggeredAlerts.map((alert) => (
                <li key={alert.id} className="prf-alert-row">
                  <span className={`prf-alert-dot prf-alert-dot--${alert.severity || 'low'}`} />
                  <div className="prf-alert-info">
                    <span className="prf-alert-loc">{alert.location}</span>
                    <span className="prf-alert-sub">{alert.subtitle || 'Recently triggered'}</span>
                  </div>
                </li>
              )) : (
                <li className="prf-alert-row prf-alert-row--empty">No recent triggers yet</li>
              )}
            </ul>
          </div>

          {/* ── Account Health ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">Account Health</p>
            <ul className="prf-health-list">
              {[
                { ok: isEmailVerified,   label: 'Email verified' },
                { ok: hasPhoneVerified,  label: 'Phone verified' },
                { ok: hasLocationSet,    label: 'Location set' },
                { ok: profileVisibility !== 'private', label: `Visibility: ${profileVisibility}` },
              ].map(({ ok, label }) => (
                <li key={label} className={`prf-health-item${ok ? '' : ' prf-health-item--warn'}`}>
                  <span className="prf-health-icon">{ok
                    ? <CheckRoundedIcon fontSize="inherit" className="icon-success" />
                    : <PriorityHighRoundedIcon fontSize="inherit" className="icon-warning" />}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {isAvatarPreviewOpen && (
        <div className="profile-avatar-preview-overlay" role="dialog" aria-modal="true" aria-label="Profile photo preview" onClick={closeAvatarPreview}>
          <button type="button" className="profile-avatar-preview-close" onClick={closeAvatarPreview} aria-label="Close profile photo preview">×</button>
          <div className="profile-avatar-preview-modal" onClick={(event) => event.stopPropagation()}>
            {profileAvatarUrl && !avatarFailed
              ? <img src={profileAvatarUrl} alt={`${displayName} profile`} className="profile-avatar-preview-image" loading="lazy" onError={() => setAvatarFailed(true)} />
              : <span className="profile-avatar-initials profile-avatar-initials--preview">{profileInitials}</span>
            }
          </div>
        </div>
      )}
    </div>
  )
}
