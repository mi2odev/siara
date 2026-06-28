import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
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
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getCurrentUser, getMyActivityTimeline, getUserPrivacyVisibility, getUserSettings } from '../../services/authService'
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
  if (!normalized) return i18n.t('settings:profilePage.defaults.user')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function formatJoinDate(value) {
  if (!value) return i18n.t('settings:profilePage.defaults.recently')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return i18n.t('settings:profilePage.defaults.recently')

  return date.toLocaleDateString([], { month: 'short', year: 'numeric' })
}

function formatReportTime(value) {
  if (!value) return i18n.t('settings:profilePage.defaults.unknownTime')

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return i18n.t('settings:profilePage.defaults.unknownTime')

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
  if (!value) return i18n.t('settings:profilePage.defaults.neverTriggered')

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

/* Maps an activity-timeline event kind to its dot color + icon. */
const TIMELINE_EVENT_STYLES = {
  report_created: { color: '#EF4444', icon: <DirectionsCarOutlinedIcon fontSize="inherit" /> },
  ai_validation: { color: '#10B981', icon: <SmartToyOutlinedIcon fontSize="inherit" /> },
  ai_flag: { color: '#F59E0B', icon: <SmartToyOutlinedIcon fontSize="inherit" /> },
  report_verified: { color: '#10B981', icon: <CheckRoundedIcon fontSize="inherit" /> },
  report_resolved: { color: '#3B82F6', icon: <CheckRoundedIcon fontSize="inherit" /> },
  report_rejected: { color: '#EF4444', icon: <NotificationsActiveOutlinedIcon fontSize="inherit" /> },
  alert_created: { color: '#8B5CF6', icon: <NotificationsOutlinedIcon fontSize="inherit" /> },
  alert_triggered: { color: '#8B5CF6', icon: <NotificationsActiveOutlinedIcon fontSize="inherit" /> },
  trip: { color: '#0EA5E9', icon: <RouteOutlinedIcon fontSize="inherit" /> },
}
const TIMELINE_EVENT_DEFAULT_STYLE = { color: '#64748B', icon: <EditRoundedIcon fontSize="inherit" /> }

const HISTORY_SORT_STORAGE_KEY = 'siara_profile_history_sort'

export default function ProfilePage(){
  /* ═══ STATE ═══ */
  const { t } = useTranslation(['settings', 'common'])
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
  const [timelineEvents, setTimelineEvents] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  // History sort direction, persisted so the user's choice is remembered.
  const [historySortDir, setHistorySortDir] = useState(() => {
    try {
      return localStorage.getItem(HISTORY_SORT_STORAGE_KEY) === 'asc' ? 'asc' : 'desc'
    } catch {
      return 'desc'
    }
  })
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
        setDriverQuizError(error?.message || t('profilePage.errors.quizLoad'))
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
    || t('profilePage.defaults.siaraUser')
  // Only fall back to the logged-in user's (header) avatar on your OWN profile.
  // When viewing someone else who has no picture, never substitute your avatar —
  // show their initials instead.
  const profileAvatarUrl = isExternalProfileView
    ? getUserAvatarUrl(currentUser)
    : getUserAvatarUrl(currentUser) || headerAvatarUrl || ''
  const profileInitials = getInitialsFromName(displayName) || '?'
  const bio = String(currentUser.bio || '').trim() || t('profilePage.defaults.noBio')
  // For own profile, always prefer the fresh AuthContext user.location which is kept
  // up-to-date by saveSettings in SettingsPage. profileUser may be stale after an update.
  const locationRaw = (isViewingOwnProfile ? (user?.location || user?.city) : null)
    || currentUser.city
    || currentUser.location
    || currentUser.address
    || ''
  const locationLabel = locationRaw || t('profilePage.defaults.locationNotSet')
  const joinLabel = formatJoinDate(currentUser.createdAt || currentUser.created_at)
  const contactLabel = currentUser.email || currentUser.phone || t('profilePage.defaults.noContactInfo')
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
    alerts: <><NotificationsOutlinedIcon fontSize="inherit" /> {t('profilePage.tabs.alerts')}</>,
    reports: <><NotificationsActiveOutlinedIcon fontSize="inherit" /> {t('profilePage.tabs.reports')}</>,
    history: <><BarChartOutlinedIcon fontSize="inherit" /> {t('profilePage.tabs.history')}</>,
    timeline: <><TimerOutlinedIcon fontSize="inherit" /> {t('profilePage.tabs.timeline')}</>,
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
    ? t('profilePage.trustScore.lastSynced', { time: formatAlertTime(trustScoreGeneratedAt) })
    : trustScoreSource === 'derived'
      ? t('profilePage.trustScore.derived')
      : reviewedReportsCount > 0
        ? t('profilePage.trustScore.reviewedFound')
        : t('profilePage.trustScore.noReviewed')
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
      return t('profilePage.defaults.noZone')
    }

    return [...zoneCounts.entries()].sort((left, right) => right[1] - left[1])[0][0]
  }, [myAlerts, myReports, t])

  const toggleHistorySort = () => {
    setHistorySortDir((prev) => {
      const next = prev === 'desc' ? 'asc' : 'desc'
      try {
        localStorage.setItem(HISTORY_SORT_STORAGE_KEY, next)
      } catch {
        /* localStorage unavailable — keep in-memory only */
      }
      return next
    })
  }

  // History reuses the activity feed, re-sorted by the saved direction.
  const historyEvents = useMemo(() => {
    const list = [...timelineEvents]
    list.sort((left, right) => {
      const leftTime = left.at ? new Date(left.at).getTime() : 0
      const rightTime = right.at ? new Date(right.at).getTime() : 0
      return historySortDir === 'asc' ? leftTime - rightTime : rightTime - leftTime
    })
    return list
  }, [timelineEvents, historySortDir])

  const recentTriggeredAlerts = useMemo(() => {
    const results = []

    myAlerts.forEach((alert, alertIndex) => {
      const location = alert?.area?.name || alert?.zone?.displayName || alert?.name || t('profilePage.defaults.monitoredArea')
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
  }, [myAlerts, t])

  const isEmailVerified = Boolean(currentUser?.email_verified || currentUser?.email_verified_at)
  const hasPhoneVerified = Boolean(String(currentUser?.phone || '').trim())
  const hasLocationSet = Boolean(locationRaw)

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
          setReportsError(t('profilePage.errors.reportsLoad'))
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
      setAlertsError(t('profilePage.errors.alertsResolve'))
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
          setAlertsError(t('profilePage.errors.alertsLoad'))
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

  /* ═══ ACTIVITY TIMELINE (own profile only) ═══ */
  useEffect(() => {
    if (isExternalProfileView || shouldHideActivityForViewer) {
      setTimelineEvents([])
      setTimelineLoading(false)
      setTimelineError('')
      return
    }

    let ignore = false
    setTimelineLoading(true)
    setTimelineError('')

    ;(async () => {
      try {
        const events = await getMyActivityTimeline(30)
        if (!ignore) setTimelineEvents(events)
      } catch {
        if (!ignore) {
          setTimelineError(t('profilePage.errors.timelineLoad'))
          setTimelineEvents([])
        }
      } finally {
        if (!ignore) setTimelineLoading(false)
      }
    })()

    return () => {
      ignore = true
    }
  }, [currentUser?.id, currentUser?.email, isExternalProfileView, shouldHideActivityForViewer, quizReloadKey])

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
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('profilePage.nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('profilePage.nav.report')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('profilePage.nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('profilePage.search.placeholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${headerAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('profilePage.header.userProfileAriaLabel')}>
                {headerAvatarUrl ? (
                  <img src={headerAvatarUrl} alt={t('profilePage.header.userAvatarAlt')} className="dash-avatar-image" loading="lazy" />
                ) : headerInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('profilePage.dropdown.myProfile')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>{t('common:nav.settings')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>{t('common:nav.notifications')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>{t('common:nav.logout')}</button>
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
              aria-label={t('profilePage.avatar.openAriaLabel', { name: displayName })}
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
                <EditRoundedIcon fontSize="inherit" /> {t('profilePage.editProfile')}
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
                aria-label={t('profilePage.avatar.viewAriaLabel', { name: displayName })}
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
                    {t('profilePage.meta.joined', { date: joinLabel })}
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
                <span>{t('common:nav.alerts')}</span>
              </div>
              <div className="pm-stat">
                <strong>{effectiveReportsCount}</strong>
                <span>{t('common:nav.reports')}</span>
              </div>
              <div className="pm-stat">
                <strong>{displayVerificationRate}%</strong>
                <span>{t('profilePage.stats.verified')}</span>
              </div>
            </div>
          </section>

          {/* ── Driver Quiz Card (own profile only) ── */}
          {isViewingOwnProfile && (
            <section className="pm-card pm-quiz">
              <div className="pm-quiz-head">
                <div className="pm-quiz-head-text">
                  <h2 className="pm-quiz-title">{t('profilePage.quiz.title')}</h2>
                  <p className="pm-quiz-subtitle">{t('profilePage.quiz.subtitle')}</p>
                </div>
                <button
                  type="button"
                  className="pm-btn-primary"
                  onClick={() => setShowQuiz(true)}
                >
                  {driverQuizProfile ? t('profilePage.quiz.retake') : t('profilePage.quiz.take')}
                </button>
              </div>

              {driverQuizLoading && (
                <p className="pm-quiz-state">{t('profilePage.quiz.loadingResult')}</p>
              )}
              {driverQuizError && !driverQuizLoading && (
                <p className="pm-quiz-state pm-quiz-state--error">{driverQuizError}</p>
              )}
              {!driverQuizLoading && !driverQuizError && !driverQuizProfile && (
                <p className="pm-quiz-state">
                  {t('profilePage.quiz.noQuizYet')}
                </p>
              )}
              {!driverQuizLoading && !driverQuizError && driverQuizProfile && (
                <div className="pm-quiz-result">
                  <div className="pm-quiz-score">
                    <span className="pm-quiz-score-num">
                      {driverQuizProfile.latestRiskScore == null ? '--' : Math.round(Number(driverQuizProfile.latestRiskScore))}
                    </span>
                    <span className="pm-quiz-score-max">/100</span>
                    <span className="pm-quiz-score-label">{t('profilePage.quiz.riskLabel')}</span>
                  </div>
                  <div className="pm-quiz-detail">
                    <h3 className="pm-quiz-detail-title">{driverQuizProfile.latestResultTitle || t('profilePage.quiz.driverProfile')}</h3>
                    {driverQuizProfile.latestResultDescription && (
                      <p className="pm-quiz-detail-desc">{driverQuizProfile.latestResultDescription}</p>
                    )}
                    {driverQuizProfile.latestRecommendationDescription && (
                      <p className="pm-quiz-detail-reco">{driverQuizProfile.latestRecommendationDescription}</p>
                    )}
                    {driverQuizProfile.lastCompletedAt && (
                      <span className="pm-quiz-detail-meta">
                        {t('profilePage.quiz.lastCompleted', { date: new Date(driverQuizProfile.lastCompletedAt).toLocaleDateString() })}
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
                  {{ alerts: t('profilePage.tabs.alerts'), reports: t('profilePage.tabs.reports'), history: t('profilePage.tabs.history'), timeline: t('profilePage.tabs.timeline') }[tabKey]}
                </button>
              ))}
            </div>

            <div className="pm-activity-body">

              {/* Alerts tab */}
              {activeTab === 'alerts' && (
                shouldHideActivityForViewer ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128274;</span>
                    <p className="pm-empty-title">{t('profilePage.activity.privateTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.activity.privateAlertsSubtitle')}</p>
                  </div>
                ) : alertsLoading ? (
                  <div className="pm-empty"><p className="pm-empty-title">{t('profilePage.activity.loadingAlerts')}</p></div>
                ) : alertsError ? (
                  <div className="pm-empty"><p className="pm-empty-title pm-empty-title--error">{alertsError}</p></div>
                ) : myAlerts.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128276;</span>
                    <p className="pm-empty-title">{t('profilePage.activity.noAlertsTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.activity.noAlertsSub')}</p>
                    <button className="pm-btn-primary" onClick={() => navigate('/alerts/create')}>{t('profilePage.activity.createAlert')}</button>
                  </div>
                ) : (
                  <ul className="pm-list">
                    {myAlerts.map((alert) => {
                      const status = String(alert.status || 'paused').toLowerCase()
                      const chipClass = status === 'active' ? 'pm-chip--green'
                        : status === 'paused' ? 'pm-chip--amber'
                        : 'pm-chip--gray'
                      const subParts = [
                        alert.area?.name || alert.zone?.displayName || t('profilePage.defaults.monitoredArea'),
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
                            <span className="pm-row-title">{alert.name || t('profilePage.activity.savedAlert')}</span>
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
                    <p className="pm-empty-title">{t('profilePage.activity.privateReportsTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.activity.privateReportsSub')}</p>
                  </div>
                ) : reportsLoading ? (
                  <div className="pm-empty"><p className="pm-empty-title">{t('profilePage.activity.loadingReports')}</p></div>
                ) : reportsError ? (
                  <div className="pm-empty"><p className="pm-empty-title pm-empty-title--error">{reportsError}</p></div>
                ) : myReports.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128221;</span>
                    <p className="pm-empty-title">{t('profilePage.activity.noReportsTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.activity.noReportsSub')}</p>
                    <button className="pm-btn-primary" onClick={() => navigate('/report')}>{t('profilePage.activity.createReport')}</button>
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
                        report.locationLabel || report.location?.label || t('profilePage.defaults.locationNotSet'),
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
                              <path d="M11 2.5H6.5A1.5 1.5 0 0 0 5 4v12a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 15 16V6.5L11 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M11 2.5V6a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M7.75 11h4.5M7.75 13.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </span>
                          <div className="pm-row-main">
                            <span className="pm-row-title">{report.title || t('profilePage.activity.untitledReport')}</span>
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
                timelineLoading ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#8987;</span>
                    <p className="pm-empty-title">{t('profilePage.history.loading')}</p>
                  </div>
                ) : timelineError ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#9888;</span>
                    <p className="pm-empty-title">{t('profilePage.history.errorTitle')}</p>
                    <p className="pm-empty-sub">{timelineError}</p>
                  </div>
                ) : historyEvents.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128202;</span>
                    <p className="pm-empty-title">{t('profilePage.history.emptyTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.history.emptySub')}</p>
                  </div>
                ) : (
                  <div className="pm-history">
                    <div className="pm-history-toolbar">
                      <span className="pm-history-count">{t('profilePage.history.eventCount', { count: historyEvents.length })}</span>
                      <button
                        type="button"
                        className="pm-history-sort"
                        onClick={toggleHistorySort}
                        title={t('profilePage.history.toggleSort')}
                      >
                        <SwapVertRoundedIcon fontSize="inherit" />
                        {historySortDir === 'desc' ? t('profilePage.history.newestFirst') : t('profilePage.history.oldestFirst')}
                      </button>
                    </div>

                    <ul className="pm-history-list">
                      {historyEvents.map((event, i) => {
                        const style = TIMELINE_EVENT_STYLES[event.kind] || TIMELINE_EVENT_DEFAULT_STYLE
                        return (
                          <li key={`${event.kind}-${event.at || i}`} className="pm-history-row">
                            <span className="pm-history-icon" style={{ background: style.color }}>
                              {style.icon}
                            </span>
                            <div className="pm-history-body">
                              <div className="pm-history-row-head">
                                <h4 className="pm-history-title">{event.title}</h4>
                                <span className="pm-history-time">{event.timeLabel}</span>
                              </div>
                              <p className="pm-history-desc">{event.description}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              )}

              {/* Timeline tab */}
              {activeTab === 'timeline' && (
                timelineLoading ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#8987;</span>
                    <p className="pm-empty-title">{t('profilePage.timeline.loading')}</p>
                  </div>
                ) : timelineError ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#9888;</span>
                    <p className="pm-empty-title">{t('profilePage.timeline.errorTitle')}</p>
                    <p className="pm-empty-sub">{timelineError}</p>
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div className="pm-empty">
                    <span className="pm-empty-icon" aria-hidden="true">&#128202;</span>
                    <p className="pm-empty-title">{t('profilePage.timeline.emptyTitle')}</p>
                    <p className="pm-empty-sub">{t('profilePage.timeline.emptySub')}</p>
                  </div>
                ) : (
                  <div className="pm-timeline">
                    {timelineEvents.map((event, i) => {
                      const style = TIMELINE_EVENT_STYLES[event.kind] || TIMELINE_EVENT_DEFAULT_STYLE
                      return (
                        <div key={`${event.kind}-${event.at || i}`} className="pm-timeline-event">
                          <div className="pm-timeline-dot" style={{ background: style.color }}>
                            <span>{style.icon}</span>
                          </div>
                          <div className="pm-timeline-content">
                            <div className="pm-timeline-header">
                              <h4 className="pm-timeline-title">{event.title}</h4>
                              <span className="pm-timeline-time">{event.timeLabel}</span>
                            </div>
                            <p className="pm-timeline-desc">{event.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}

            </div>
          </section>

        </main>

        {/* ═══ RIGHT COLUMN ═══ */}
        <aside className="profile-sidebar-right">
          {/* ── Trust Score ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">{t('profilePage.trustScore.label')}</p>
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
              <li><span className="prf-factor-dot prf-factor-dot--ok" />{t('profilePage.trustScore.legitReports', { count: legitReportsCount })}</li>
              <li><span className="prf-factor-dot prf-factor-dot--warn" />{t('profilePage.trustScore.spamReports', { count: spamReportsCount })}</li>
              <li><span className="prf-factor-dot prf-factor-dot--ok" />{t('profilePage.trustScore.reviewedReports', { count: reviewedReportsCount })}</li>
              <li><span className="prf-factor-dot prf-factor-dot--info" />{trustGeneratedLabel}</li>
            </ul>
          </div>

          {/* ── Contribution Impact ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">{t('profilePage.impact.label')}</p>
            <div className="prf-impact-grid">
              <div className="prf-impact-cell">
                <strong>{alertMetrics.triggered.toLocaleString()}</strong>
                <span>{t('profilePage.impact.alertMatches')}</span>
              </div>
              <div className="prf-impact-cell">
                <strong>{reportMetrics.aiRate}%</strong>
                <span>{t('profilePage.impact.aiValidated')}</span>
              </div>
              <div className="prf-impact-zone">
                <span className="prf-impact-zone-val">{topActiveZone}</span>
                <span className="prf-impact-zone-lbl">{t('profilePage.impact.mostActiveZone')}</span>
              </div>
            </div>
          </div>

          {/* ── Recent Alerts ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">{t('profilePage.recentAlerts.label')}</p>
            <ul className="prf-alert-list">
              {recentTriggeredAlerts.length > 0 ? recentTriggeredAlerts.map((alert) => (
                <li key={alert.id} className="prf-alert-row">
                  <span className={`prf-alert-dot prf-alert-dot--${alert.severity || 'low'}`} />
                  <div className="prf-alert-info">
                    <span className="prf-alert-loc">{alert.location}</span>
                    <span className="prf-alert-sub">{alert.subtitle || t('profilePage.recentAlerts.recentlyTriggered')}</span>
                  </div>
                </li>
              )) : (
                <li className="prf-alert-row prf-alert-row--empty">{t('profilePage.recentAlerts.noRecentTriggers')}</li>
              )}
            </ul>
          </div>

          {/* ── Account Health ── */}
          <div className="prf-r-card">
            <p className="prf-r-label">{t('profilePage.accountHealth.label')}</p>
            <ul className="prf-health-list">
              {[
                { ok: isEmailVerified,   label: t('profilePage.accountHealth.emailVerified') },
                { ok: hasPhoneVerified,  label: t('profilePage.accountHealth.phoneVerified') },
                { ok: hasLocationSet,    label: t('profilePage.accountHealth.locationSet') },
                { ok: profileVisibility !== 'private', label: t('profilePage.accountHealth.visibility', { value: profileVisibility }) },
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
        <div className="profile-avatar-preview-overlay" role="dialog" aria-modal="true" aria-label={t('profilePage.avatar.previewAriaLabel')} onClick={closeAvatarPreview}>
          <button type="button" className="profile-avatar-preview-close" onClick={closeAvatarPreview} aria-label={t('profilePage.avatar.closePreviewAriaLabel')}>×</button>
          <div className="profile-avatar-preview-modal" onClick={(event) => event.stopPropagation()}>
            {profileAvatarUrl && !avatarFailed
              ? <img src={profileAvatarUrl} alt={t('profilePage.avatar.profileAlt', { name: displayName })} className="profile-avatar-preview-image" loading="lazy" onError={() => setAvatarFailed(true)} />
              : <span className="profile-avatar-initials profile-avatar-initials--preview">{profileInitials}</span>
            }
          </div>
        </div>
      )}
    </div>
  )
}
