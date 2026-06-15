import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FancySelect from '../../components/ui/FancySelect'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { createPortal } from 'react-dom'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import {
  getUserRoles,
  isPoliceOfficerUser,
  isPoliceSupervisorUser,
  isEmergencyServiceUser,
} from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import {
  addReportComment,
  deleteReportComment,
  getReportComments,
  listReports,
  removeReportReaction,
  toggleReportReaction,
} from '../../services/reportsService'
import { computeReportCredibility } from '../../utils/reportCredibility'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import '../../styles/NewsPage.css'
import '../../styles/Lightbox.css'
import '../../styles/DashboardPage.css'

const PAGE_SIZE = 10
const DEFAULT_RADIUS_KM = 25
const FALLBACK_MAP_CENTER = { lat: 36.7525, lng: 3.04197 }
const FEED_TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'verified', label: 'Verified' },
  { id: 'following', label: 'Following' },
]
const SORT_OPTIONS = [
  { id: 'recent', label: 'Most recent' },
  { id: 'severity', label: 'Severity' },
]

function getMarkerColor(severity) {
  return severity === 'high' ? '#ff3b30' : severity === 'medium' ? '#ff9500' : '#34c759'
}

function getSeverityClass(severity) {
  if (severity === 'high') return 'severity-high'
  if (severity === 'medium') return 'severity-medium'
  return 'severity-low'
}

function getSeverityLabel(severity) {
  if (severity === 'high') return 'High Severity'
  if (severity === 'medium') return 'Medium Severity'
  if (severity === 'low') return 'Low Severity'
  return 'Severity Unknown'
}

function getAuthorInitials(name) {
  return getInitialsFromName(name || 'Citizen', 'CT')
}

function formatRelativeTime(value) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

const QUALITY_BADGE_FALLBACKS = {
  officer_verified: { code: 'officer_verified', label: 'Verified by officer', style: 'positive_strong', icon: 'shield_check' },
  ai_verified: { code: 'ai_verified', label: 'AI verified', style: 'positive', icon: 'check_circle' },
  needs_review: { code: 'needs_review', label: 'Needs review', style: 'warning', icon: 'alert_triangle' },
  probably_spam: { code: 'probably_spam', label: 'Probably spam', style: 'danger', icon: 'alert_octagon' },
  out_of_context: { code: 'out_of_context', label: 'Out of SIARA context', style: 'muted_warning', icon: 'info' },
  invalid_location: { code: 'invalid_location', label: 'Suspicious location', style: 'warning', icon: 'map_pin_alert' },
  checking: { code: 'checking', label: 'Checking report', style: 'neutral', icon: 'loader' },
  unverified: { code: 'unverified', label: 'Unverified', style: 'neutral', icon: 'clock' },
}

const QUALITY_BADGE_ICONS = {
  shield_check: <ShieldOutlinedIcon fontSize="inherit" className="icon-security" />,
  check_circle: <CheckCircleOutlineRoundedIcon fontSize="inherit" className="icon-success" />,
  alert_triangle: <WarningAmberOutlinedIcon fontSize="inherit" className="icon-warning" />,
  alert_octagon: <BlockOutlinedIcon fontSize="inherit" className="icon-danger" />,
  info: <InfoOutlinedIcon fontSize="inherit" className="icon-info" />,
  map_pin_alert: <LocationOnOutlinedIcon fontSize="inherit" className="icon-warning" />,
  loader: <HourglassEmptyOutlinedIcon fontSize="inherit" className="icon-muted" />,
  clock: <AccessTimeOutlinedIcon fontSize="inherit" className="icon-muted" />,
  help: <HelpOutlineOutlinedIcon fontSize="inherit" className="icon-muted" />,
}

function deriveQualityBadge(report) {
  if (report?.qualityBadge && typeof report.qualityBadge === 'object') {
    return report.qualityBadge
  }
  if (report?.verifiedByOfficerId) {
    return QUALITY_BADGE_FALLBACKS.officer_verified
  }
  const label = String(report?.spamAnalysis?.predictedLabel || '').toLowerCase()
  const spamRaw = Number(report?.spamAnalysis?.spamScore)
  // spamAnalysis.spamScore is already a percentage (0..100). Convert to 0..1 for the rules.
  const spamScore = Number.isFinite(spamRaw) ? spamRaw / 100 : null
  const status = String(report?.spamAnalysis?.status || '').toLowerCase()
  if (label === 'real' && spamScore != null && spamScore < 0.35) return QUALITY_BADGE_FALLBACKS.ai_verified
  if (label === 'suspicious') return QUALITY_BADGE_FALLBACKS.needs_review
  if (label === 'spam' || (spamScore != null && spamScore >= 0.65)) return QUALITY_BADGE_FALLBACKS.probably_spam
  if (label === 'out_of_context') return QUALITY_BADGE_FALLBACKS.out_of_context
  if (label === 'invalid_location') return QUALITY_BADGE_FALLBACKS.invalid_location
  if (status === 'pending' || status === 'processing') return QUALITY_BADGE_FALLBACKS.checking
  return QUALITY_BADGE_FALLBACKS.unverified
}

function formatSpamPercent(value) {
  if (value == null) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  // spamAnalysis.spamScore / confidence are already 0..100 (normalised in
  // reports.js). Just clamp + round — re-scaling here inflated low values
  // (e.g. a genuine 0.5% score was shown as 50%).
  const percent = Math.max(0, Math.min(100, numeric))
  return Math.round(percent)
}

function getReportAuthorProfile(report) {
  const author = report?.reportedBy || report?.reported_by || {}
  const authorRoles = Array.isArray(author?.roles)
    ? author.roles
    : Array.isArray(report?.reportedBy?.roles)
      ? report.reportedBy.roles
      : Array.isArray(report?.reported_by?.roles)
        ? report.reported_by.roles
        : []

  return {
    id: author?.id
      ?? report?.reportedById
      ?? report?.reported_by_id
      ?? report?.userId
      ?? report?.user_id
      ?? report?.createdBy
      ?? report?.created_by
      ?? null,
    name: author?.name || report?.authorName || 'Citizen',
    email: author?.email || report?.createdByEmail || report?.created_by_email || '',
    avatarUrl:
      author?.avatarUrl
      || author?.avatar_url
      || report?.authorAvatarUrl
      || report?.author_avatar_url
      || '',
    avatar_url:
      author?.avatar_url
      || author?.avatarUrl
      || report?.author_avatar_url
      || report?.authorAvatarUrl
      || '',
    role: author?.role || report?.authorRole || 'citizen',
    roles: authorRoles,
    city: author?.city || author?.location || '',
    createdAt: author?.createdAt || author?.created_at || null,
    reportCount: author?.reportCount ?? author?.reports_count,
    verificationRate: author?.verificationRate ?? author?.verification_rate,
  }
}

function getAuthorRoleBadge(profile) {
  const normalizedRoles = getUserRoles(profile)

  if (normalizedRoles.includes('admin')) {
    return { className: 'badge-admin', label: 'Admin' }
  }

  if (isPoliceSupervisorUser(profile)) {
    return { className: 'badge-police', label: 'Police Supervisor' }
  }

  if (isPoliceOfficerUser(profile)) {
    return { className: 'badge-police', label: 'Police' }
  }

  if (isEmergencyServiceUser(profile)) {
    return { className: 'badge-police', label: 'Emergency' }
  }

  return { className: 'badge-citoyen', label: 'Citizen' }
}

// Police, supervisors, admins and emergency services are institutional sources,
// so the citizen "trust ladder" (New/normal → Trusted, with a 0–100 score)
// doesn't apply to them. Show a clean "Official reporter" badge instead.
function getReporterTrustBadge(profile, baseTier) {
  const normalizedRoles = getUserRoles(profile)
  const isOfficial =
    normalizedRoles.includes('admin') ||
    isPoliceOfficerUser(profile) ||
    isPoliceSupervisorUser(profile) ||
    isEmergencyServiceUser(profile)

  if (isOfficial) {
    return { tier: { label: 'Official reporter', style: 'positive' }, official: true }
  }

  return { tier: baseTier, official: false }
}

function mergeReports(previousReports, nextReports) {
  const reportMap = new Map()

  previousReports.forEach((report) => {
    reportMap.set(report.id, report)
  })

  nextReports.forEach((report) => {
    reportMap.set(report.id, report)
  })

  return Array.from(reportMap.values())
}

function ReportCard({ report, navigate, onOpenAuthorProfile, onReportUpdated, currentUser }) {
  const authorProfile = getReportAuthorProfile(report)
  const authorName = authorProfile.name
  const authorAvatarUrl = getUserAvatarUrl(authorProfile)
  const authorRoleBadge = getAuthorRoleBadge(authorProfile)
  const severityLabel = getSeverityLabel(report?.severity)
  const qualityBadge = deriveQualityBadge(report)
  const spamPercent = formatSpamPercent(report?.spamAnalysis?.spamScore)
  const confidencePercent = formatSpamPercent(report?.spamAnalysis?.confidence)
  const reporterTrustScore = Number(report?.reportedBy?.trustScore)
  const { tier: reporterTrustTier, official: reporterIsOfficial } = getReporterTrustBadge(
    authorProfile,
    report?.reportedBy?.trustTier || null,
  )
  const media = Array.isArray(report?.media) ? report.media : []
  const description = report?.description || ''
  const shouldShowSeeMore = description.length > 180
  const occurredAt = report?.occurredAt || report?.createdAt
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hiddenMediaKeys, setHiddenMediaKeys] = useState(() => new Set())
  const [commentDraft, setCommentDraft] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [reactionBusy, setReactionBusy] = useState(false)
  const [loadedMediaKeys, setLoadedMediaKeys] = useState(() => new Set())
  const [shareCopied, setShareCopied] = useState(false)
  const [allComments, setAllComments] = useState(null)
  const [allCommentsLoading, setAllCommentsLoading] = useState(false)
  const [allCommentsError, setAllCommentsError] = useState('')
  const [discussionMode, setDiscussionMode] = useState('closed') // 'closed' | 'compose' | 'all'
  const discussionOpen = discussionMode !== 'closed'
  const showCommentList = discussionMode === 'all'
  const dragRef = useRef(null)
  const stageRef = useRef(null)
  const activeMedia = selectedMediaIndex == null ? null : media[selectedMediaIndex]
  const likesCount = Number(report?.likesCount || 0)
  const sawItTooCount = Number(report?.sawItTooCount || 0)
  const commentsCount = Number(report?.commentsCount || 0)
  const viewerHasLiked = Boolean(report?.viewerHasLiked)
  const viewerSawItToo = Boolean(report?.viewerSawItToo)
  const commentsPreview = Array.isArray(report?.commentsPreview) ? report.commentsPreview : []
  const visibleComments = allComments || commentsPreview
  const currentUserId = currentUser?.id || currentUser?.userId || null
  const isAdmin = Array.isArray(currentUser?.roles) && currentUser.roles.includes('admin')

  const handleToggleReaction = async (reactionType) => {
    if (!currentUserId) {
      navigate('/login')
      return
    }
    if (reactionBusy) return

    const wasActive =
      reactionType === 'like' ? viewerHasLiked : reactionType === 'saw_it_too' ? viewerSawItToo : false
    const countKey = reactionType === 'like' ? 'likesCount' : 'sawItTooCount'
    const flagKey = reactionType === 'like' ? 'viewerHasLiked' : 'viewerSawItToo'
    const currentCount = reactionType === 'like' ? likesCount : sawItTooCount

    setReactionBusy(true)
    onReportUpdated?.(report.id, {
      [flagKey]: !wasActive,
      [countKey]: Math.max(0, currentCount + (wasActive ? -1 : 1)),
    })

    try {
      const result = wasActive
        ? await removeReportReaction(report.id, reactionType)
        : await toggleReportReaction(report.id, reactionType)
      onReportUpdated?.(report.id, {
        viewerHasLiked: reactionType === 'like' ? !wasActive : viewerHasLiked,
        viewerSawItToo: reactionType === 'saw_it_too' ? !wasActive : viewerSawItToo,
        likesCount: Number(result?.likesCount ?? likesCount),
        sawItTooCount: Number(result?.sawItTooCount ?? sawItTooCount),
      })
    } catch (error) {
      console.error('reaction error:', error)
      onReportUpdated?.(report.id, {
        [flagKey]: wasActive,
        [countKey]: currentCount,
      })
    } finally {
      setReactionBusy(false)
    }
  }

  const handleSubmitComment = async (event) => {
    event.preventDefault()
    if (!currentUserId) {
      navigate('/login')
      return
    }
    const trimmed = commentDraft.trim()
    if (!trimmed || isSubmittingComment) return

    setIsSubmittingComment(true)
    setCommentError('')
    try {
      const newComment = await addReportComment(report.id, trimmed)
      setCommentDraft('')
      const nextPreview = [...commentsPreview, newComment].slice(-3)
      onReportUpdated?.(report.id, {
        commentsCount: commentsCount + 1,
        commentsPreview: nextPreview,
      })
      if (allComments) {
        setAllComments([newComment, ...allComments])
      }
    } catch (error) {
      setCommentError(error.message || 'Could not post comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleLoadAllComments = async () => {
    if (allCommentsLoading) return
    if (allComments) {
      setAllComments(null)
      return
    }
    setAllCommentsLoading(true)
    setAllCommentsError('')
    try {
      const { comments } = await getReportComments(report.id, { limit: 50, offset: 0 })
      setAllComments(comments)
    } catch (error) {
      setAllCommentsError(error.message || 'Could not load comments')
    } finally {
      setAllCommentsLoading(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteReportComment(report.id, commentId)
      const removeFromList = (list) => list.filter((entry) => entry.id !== commentId)
      onReportUpdated?.(report.id, {
        commentsCount: Math.max(0, commentsCount - 1),
        commentsPreview: removeFromList(commentsPreview),
      })
      if (allComments) {
        setAllComments(removeFromList(allComments))
      }
    } catch (error) {
      console.error('delete comment error:', error)
    }
  }
  const handleOpenProfile = () => {
    onOpenAuthorProfile(authorProfile)
  }

  const handleOpenProfileKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenProfile()
    }
  }

  const handleAvatarImageError = (event) => {
    // The avatar button uses the `pcx-av` classes — the old `pc-av` selector
    // never matched, so a broken avatar image was left in place (showing its
    // clipped alt text) instead of falling back to the initials.
    const avatarButton = event.currentTarget.closest('.pcx-av')
    if (!avatarButton) return
    avatarButton.classList.remove('pcx-av--img')
    event.currentTarget.remove()
  }

  useEffect(() => {
    if (selectedMediaIndex == null) return () => {}

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedMediaIndex(null)
      }

      if (event.key === 'ArrowRight' && media.length > 1) {
        setZoomScale(1)
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % media.length))
      }

      if (event.key === 'ArrowLeft' && media.length > 1) {
        setZoomScale(1)
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev - 1 + media.length) % media.length))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedMediaIndex, media.length])

  useEffect(() => {
    if (selectedMediaIndex == null) return () => {}

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedMediaIndex])

  useEffect(() => {
    if (selectedMediaIndex == null) setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
    setIsDragging(false)
    dragRef.current = null
  }, [selectedMediaIndex])

  useEffect(() => {
    if (zoomScale <= 1) {
      setPanOffset({ x: 0, y: 0 })
      setIsDragging(false)
      dragRef.current = null
    }
  }, [zoomScale])

  const clampScale = (value) => Math.min(4, Math.max(0.25, value))
  const zoomIn = () => setZoomScale((prev) => clampScale(prev + 0.15))
  const zoomOut = () => setZoomScale((prev) => clampScale(prev - 0.15))
  const zoomReset = () => setZoomScale(1)

  useEffect(() => {
    if (!activeMedia) return
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaY > 0 ? -0.12 : 0.12
      setZoomScale((prev) => clampScale(prev + delta))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => { stage.removeEventListener('wheel', onWheel) }
  }, [activeMedia])

  useEffect(() => {
    if (!activeMedia) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [activeMedia])

  const startPan = (clientX, clientY) => {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    }
    setIsDragging(true)
  }

  const movePan = (clientX, clientY) => {
    if (!dragRef.current) return
    setPanOffset({
      x: dragRef.current.originX + (clientX - dragRef.current.startX),
      y: dragRef.current.originY + (clientY - dragRef.current.startY),
    })
  }

  const stopPan = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setIsDragging(false)
  }

  const credibility = computeReportCredibility(report)
  const qualityTone = {
    positive_strong: 'positive',
    positive: 'positive',
    warning: 'warning',
    muted_warning: 'warning',
    danger: 'danger',
    neutral: 'neutral',
  }[qualityBadge?.style] || 'neutral'
  // Show every photo on the card. Keep the original index so the lightbox
  // (which reads media[selectedMediaIndex]) still lines up after filtering.
  const galleryItems = media
    .map((item, index) => ({ item, index, key: item.id || `${report.id}-${index}` }))
    .filter(({ key }) => !hiddenMediaKeys.has(key))
  const galleryCount = galleryItems.length
  const galleryVariant =
    galleryCount === 1 ? '1'
      : galleryCount === 2 ? '2'
        : galleryCount === 3 ? '3'
          : galleryCount === 4 ? '4'
            : 'many'
  // A lone photo is the visual focus — show it whole (no crop) over a blurred
  // fill, so big/wide/tall images are never cut off.
  const fullBleed = galleryVariant === '1'
  const markMediaLoaded = (key) =>
    setLoadedMediaKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  const handleShare = async () => {
    const url = `${window.location.origin}/incident/${report.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: report?.title || 'SIARA incident report', url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        window.setTimeout(() => setShareCopied(false), 1800)
      }
    } catch {
      /* share dismissed */
    }
  }

  return (
    <article className={`pcx pcx--${report?.severity || 'low'}`}>

      {/* ── HEADER ── */}
      <header className="pcx-head">
        <button
          type="button"
          className={`pcx-av${authorAvatarUrl ? ' pcx-av--img' : ''}`}
          onClick={handleOpenProfile}
          aria-label={`View ${authorName} profile`}
        >
          {authorAvatarUrl && (
            <img src={authorAvatarUrl} alt={authorName} className="pcx-av-img" loading="lazy" onError={handleAvatarImageError} />
          )}
          <span className="pcx-av-fb">{getAuthorInitials(authorName)}</span>
        </button>

        <div
          className="pcx-id"
          role="button"
          tabIndex={0}
          onClick={handleOpenProfile}
          onKeyDown={handleOpenProfileKeyDown}
          aria-label={`View ${authorName} profile`}
        >
          <div className="pcx-id-line pcx-id-name">
            <span className="pcx-name">{authorName}</span>
          </div>

          <div className="pcx-id-line pcx-id-meta">
            <span className={`pcx-role ${authorRoleBadge.className}`}>{authorRoleBadge.label}</span>
            {reporterTrustTier && (reporterIsOfficial || Number.isFinite(reporterTrustScore)) && (
              <>
                <span className="pcx-mid-dot" aria-hidden>•</span>
                <span
                  className={`pcx-trust pcx-trust--${reporterTrustTier.style || 'neutral'}`}
                  title={
                    reporterIsOfficial
                      ? 'Official reporter — institutional account'
                      : `Trust score ${Math.round(reporterTrustScore)}/100`
                  }
                >
                  <span className="pcx-trust-dot" aria-hidden />
                  {reporterTrustTier.label}
                  {!reporterIsOfficial && Number.isFinite(reporterTrustScore)
                    ? ` · ${Math.round(reporterTrustScore)}`
                    : ''}
                </span>
              </>
            )}
          </div>

          <div className="pcx-id-line pcx-id-sub">
            <svg className="pcx-loc-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden>
              <path fill="currentColor" d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.2 4.5 8 4.5 8s4.5-4.8 4.5-8A4.5 4.5 0 0 0 8 1.5Zm0 6.2A1.7 1.7 0 1 1 8 4.3a1.7 1.7 0 0 1 0 3.4Z"/>
            </svg>
            <span className="pcx-loc">{report?.locationLabel || 'Reported location'}</span>
            <span className="pcx-mid-dot" aria-hidden>•</span>
            <span className="pcx-time">{formatRelativeTime(report?.createdAt || occurredAt)}</span>
          </div>
        </div>

        {/* Status pills — sit beside the identity meta on desktop and drop to
            their own row on mobile (placement handled by .pcx-head grid areas). */}
        <div className="pcx-status">
          {qualityBadge && (
            <span
              className={`pcx-pill pcx-pill--q-${qualityTone}`}
              title={spamPercent != null ? `Spam ${spamPercent}% · Confidence ${confidencePercent ?? '—'}%` : qualityBadge.label}
            >
              <span className="pcx-pill-ico" aria-hidden>{QUALITY_BADGE_ICONS[qualityBadge.icon] || ''}</span>
              {qualityBadge.label}
              {/* Positive AI badge shows the model's confidence; the spam score is
                  only meaningful (and only shown) on the negative/warning badges. */}
              {qualityBadge.code === 'ai_verified' && confidencePercent != null && (
                <span className="pcx-pill-meta">{confidencePercent}%</span>
              )}
              {['probably_spam', 'needs_review', 'out_of_context', 'invalid_location'].includes(qualityBadge.code)
                && spamPercent != null && (
                <span className="pcx-pill-meta pcx-pill-meta--danger">{spamPercent}%</span>
              )}
            </span>
          )}
          {credibility && credibility.level !== 'unknown' && Number.isFinite(credibility.score) && (
            <span className="pcx-cred">
              <span
                className={`pcx-pill pcx-pill--cred-${credibility.level}`}
                tabIndex={0}
                aria-describedby={`cred-tip-${report.id}`}
              >
                <span className="pcx-pill-dot" aria-hidden />
                {credibility.score} Credibility
                {credibility.isSpam && <span className="pcx-pill-meta pcx-pill-meta--danger">Spam</span>}
              </span>
              <span className="pcx-cred-tip" id={`cred-tip-${report.id}`} role="tooltip">
                <span className="pcx-cred-tip__title">Why this score?</span>
                <span className="pcx-cred-tip__score">
                  {credibility.score}/100 · {credibility.level} credibility
                </span>
                {credibility.reasons && credibility.reasons.length > 0 ? (
                  <ul className="pcx-cred-tip__list">
                    {credibility.reasons.map((reason, i) => (
                      <li key={i} className={`pcx-cred-tip__item is-${reason.kind}`}>
                        {reason.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="pcx-cred-tip__empty">
                    Based on the overall signals of this report.
                  </span>
                )}
              </span>
            </span>
          )}
          <span className={`pcx-pill pcx-pill--sev-${report?.severity || 'low'}`}>
            <span className="pcx-pill-dot" aria-hidden />
            {severityLabel}
          </span>
        </div>

        <button className="pcx-menu" onClick={() => navigate(`/incident/${report.id}`)} title="View details" aria-label="View details">
          <svg width="3.5" height="16" viewBox="0 0 3 15" fill="currentColor" aria-hidden>
            <circle cx="1.5" cy="1.5" r="1.5"/><circle cx="1.5" cy="7.5" r="1.5"/><circle cx="1.5" cy="13.5" r="1.5"/>
          </svg>
        </button>
      </header>

      {/* ── CONTENT ── */}
      <div className="pcx-content">
        <h2 className="pcx-title">{report?.title || 'Untitled report'}</h2>
        <p className={`pcx-desc${shouldShowSeeMore ? ' is-clamped' : ''}`}>
          {description || 'No description provided for this report.'}
        </p>
        {shouldShowSeeMore && (
          <button className="pcx-readmore" onClick={() => navigate(`/incident/${report.id}`)}>
            <span>Read more</span>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── MEDIA GALLERY (shows every photo) ── */}
      {galleryCount > 0 && (
        <div className={`pcx-gallery pcx-gallery--${galleryVariant}`}>
          {galleryItems.map(({ item, index, key }) => {
            const loaded = loadedMediaKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                className={`pcx-tile${fullBleed ? ' pcx-tile--contain' : ''}`}
                onClick={() => { setSelectedMediaIndex(index); setZoomScale(1) }}
                aria-label={`Open photo ${index + 1} of ${media.length}`}
              >
                {fullBleed && (
                  <img className="pcx-tile-bg" src={item.url} alt="" aria-hidden loading="lazy" />
                )}
                {!loaded && <span className="pcx-skeleton" aria-hidden />}
                <img
                  className={`pcx-tile-img${loaded ? ' is-loaded' : ''}`}
                  src={item.url}
                  alt={report?.title || 'Report photo'}
                  loading="lazy"
                  onLoad={() => markMediaLoaded(key)}
                  onError={() => setHiddenMediaKeys((prev) => { const n = new Set(prev); n.add(key); return n })}
                />
                <span className="pcx-tile-overlay" aria-hidden />
                <span className="pcx-tile-zoom" aria-hidden>
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4" strokeLinecap="round"/>
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="pcx-actions">
        <button
          type="button"
          className={`pcx-act pcx-act--like${viewerHasLiked ? ' on' : ''}`}
          onClick={() => handleToggleReaction('like')}
          disabled={reactionBusy}
          aria-pressed={viewerHasLiked}
        >
          <svg viewBox="0 0 20 20" fill={viewerHasLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
          </svg>
          <span>{likesCount > 0 ? likesCount : 'Like'}</span>
        </button>

        <button
          type="button"
          className={`pcx-act pcx-act--saw${viewerSawItToo ? ' on' : ''}`}
          onClick={() => handleToggleReaction('saw_it_too')}
          disabled={reactionBusy}
          aria-pressed={viewerSawItToo}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <ellipse cx="10" cy="10" rx="8.5" ry="5.5"/>
            <circle cx="10" cy="10" r="2.5" fill={viewerSawItToo ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>{sawItTooCount > 0 ? sawItTooCount : 'Saw it'}</span>
        </button>

        <button
          type="button"
          className={`pcx-act pcx-act--cmt${discussionOpen ? ' on' : ''}`}
          onClick={() => {
            setDiscussionMode((prev) => {
              const next = prev === 'closed' ? 'compose' : prev === 'compose' ? 'all' : 'closed'
              if (next === 'all' && !allComments && commentsCount > commentsPreview.length && !allCommentsLoading) {
                handleLoadAllComments()
              }
              return next
            })
          }}
          aria-expanded={discussionOpen}
          aria-controls={`pc-discuss-${report.id}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H7l-4 4V14H4a2 2 0 01-2-2V5z"/>
          </svg>
          <span>{commentsCount > 0 ? commentsCount : 'Comment'}</span>
        </button>

        <button
          type="button"
          className={`pcx-act pcx-act--share${shareCopied ? ' on' : ''}`}
          onClick={handleShare}
          aria-label="Share report"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/>
            <path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" strokeLinecap="round"/>
          </svg>
          <span>{shareCopied ? 'Copied' : 'Share'}</span>
        </button>
      </div>

      {/* ── DISCUSSION ── */}
      <div
        id={`pc-discuss-${report.id}`}
        className={`pc-discuss-wrap${discussionOpen ? ' is-open' : ''}`}
        aria-hidden={!discussionOpen}
      >
       <div className="pc-discuss-inner">
        <div className="pc-discuss">
        {showCommentList && (commentsCount > 0 || visibleComments.length > 0) && (
          <div className="pc-discuss-heading">
            <span>{commentsCount > 0 ? `${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}` : 'Comments'}</span>
            {allCommentsLoading && <span className="pc-discuss-spinner" aria-hidden />}
          </div>
        )}

        {showCommentList && visibleComments.length > 0 && (
          <ul className="pc-cmt-list">
            {visibleComments.map((comment, idx) => {
              const canDelete = isAdmin || (currentUserId && comment.author?.id === currentUserId)
              const authorName = comment.author?.name || 'Anonymous'
              const authorAvatar = getUserAvatarUrl(comment.author)
              const authorInitials = getInitialsFromName(authorName, 'U')
              return (
                <li key={comment.id} className="pc-cmt" style={{ '--pc-i': idx }}>
                  <div className="pc-cmt-avatar" aria-hidden>
                    {authorAvatar
                      ? <img src={authorAvatar} alt="" loading="lazy" />
                      : <span>{authorInitials}</span>}
                  </div>
                  <div className="pc-cmt-bubble">
                    <div className="pc-cmt-hd">
                      <span className="pc-cmt-name">{authorName}</span>
                      <span className="pc-cmt-dot" aria-hidden>·</span>
                      <span className="pc-cmt-time">{formatRelativeTime(comment.createdAt)}</span>
                      {canDelete && (
                        <button
                          type="button"
                          className="pc-cmt-del"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                          aria-label="Delete comment"
                        >
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                            <path d="M3 5h10M6.5 5V3.5A1.5 1.5 0 018 2h0a1.5 1.5 0 011.5 1.5V5M4.5 5l.7 8.2A1.5 1.5 0 006.7 14.5h2.6a1.5 1.5 0 001.5-1.3L11.5 5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <p className="pc-cmt-body">{comment.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {showCommentList && commentsCount > visibleComments.length && !allComments && (
          <button
            type="button"
            className="pc-load-cmt"
            onClick={handleLoadAllComments}
            disabled={allCommentsLoading}
          >
            {allCommentsLoading ? 'Loading…' : `View all ${commentsCount} comments`}
          </button>
        )}
        {allCommentsError && <p className="pc-cmt-err">{allCommentsError}</p>}

        <form className="pc-cmt-form" onSubmit={handleSubmitComment}>
          <div className="pc-cmt-avatar pc-cmt-avatar--me" aria-hidden>
            {currentUser && getUserAvatarUrl(currentUser)
              ? <img src={getUserAvatarUrl(currentUser)} alt="" />
              : <span>{getInitialsFromName(currentUser?.name || currentUser?.username || 'You', 'YO')}</span>}
          </div>
          <div className={`pc-cmt-composer${isSubmittingComment ? ' is-submitting' : ''}${!currentUserId ? ' is-disabled' : ''}`}>
            <textarea
              className="pc-cmt-input"
              placeholder={currentUserId ? 'Write a comment…' : 'Sign in to comment'}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (commentDraft.trim() && !isSubmittingComment && currentUserId) {
                    handleSubmitComment(e)
                  }
                }
              }}
              rows={1}
              maxLength={500}
              disabled={!currentUserId || isSubmittingComment}
            />
            <div className="pc-cmt-composer-foot">
              <span
                className={`pc-cmt-counter${commentDraft.length >= 450 ? ' is-warn' : ''}`}
                aria-live="polite"
              >
                {commentDraft.length}/500
              </span>
              <button
                type="submit"
                className="pc-cmt-submit"
                disabled={!currentUserId || isSubmittingComment || !commentDraft.trim()}
                title="Post comment"
                aria-label="Post comment"
              >
                {isSubmittingComment ? (
                  <span className="pc-cmt-submit-spinner" aria-hidden />
                ) : (
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden>
                    <path d="M2.4 17.6 18 10 2.4 2.4l.1 5.9L13 10 2.5 11.7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
        {commentError && <p className="pc-cmt-err">{commentError}</p>}
        </div>
       </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="pcx-footer">
        <button type="button" className="pcx-open" onClick={() => navigate(`/incident/${report.id}`)}>
          <span className="pcx-open-label">Open Incident</span>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </button>
      </div>

      {/* ── LIGHTBOX ── */}
      {activeMedia && createPortal(
        <div className="post-media-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setSelectedMediaIndex(null)}>
          <div className="post-media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="post-media-lightbox-toolbar">
              <button type="button" className="post-media-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <button type="button" className="post-media-zoom-btn reset" onClick={zoomReset} aria-label="Reset zoom">{Math.round(zoomScale * 100)}%</button>
              <button type="button" className="post-media-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>
            <button type="button" className="post-media-lightbox-close" onClick={() => setSelectedMediaIndex(null)} aria-label="Close photo preview">×</button>

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  className="post-media-lightbox-nav post-media-lightbox-nav--prev"
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoomScale(1)
                    setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev - 1 + media.length) % media.length))
                  }}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="post-media-lightbox-nav post-media-lightbox-nav--next"
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoomScale(1)
                    setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % media.length))
                  }}
                  aria-label="Next photo"
                >
                  ›
                </button>
                <span className="post-media-lightbox-counter">
                  {selectedMediaIndex + 1} / {media.length}
                </span>
              </>
            )}

            <div
              ref={stageRef}
              className={`post-media-lightbox-stage${zoomScale > 1 ? ' zoomed' : ''}${isDragging ? ' dragging' : ''}`}
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedMediaIndex(null) }}
              onMouseDown={(e) => { if (zoomScale > 1) { e.preventDefault(); startPan(e.clientX, e.clientY) } }}
              onMouseMove={(e) => movePan(e.clientX, e.clientY)}
              onMouseUp={stopPan}
              onMouseLeave={stopPan}
              onTouchStart={(e) => { if (zoomScale > 1) { const t = e.touches[0]; if (t) startPan(t.clientX, t.clientY) } }}
              onTouchMove={(e) => { const t = e.touches[0]; if (t) movePan(t.clientX, t.clientY) }}
              onTouchEnd={stopPan}
            >
              <img
                key={selectedMediaIndex}
                className="post-media-lightbox-image"
                src={activeMedia.url}
                alt={report?.title || 'Report image'}
                style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})` }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </article>
  )
}

function MapCenterUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 })
  }, [center[0], center[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function NewsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [showQuiz, setShowQuiz] = useState(false)
  const [activeFeed, setActiveFeed] = useState('latest')
  const [sortMode, setSortMode] = useState('recent')
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)
  const [reports, setReports] = useState([])
  const [pagination, setPagination] = useState({
    limit: PAGE_SIZE,
    offset: 0,
    hasMore: false,
    returned: 0,
  })
  const [feedMeta, setFeedMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false)
  const [geoState, setGeoState] = useState({
    status: 'idle',
    coords: null,
  })

  const requestIdRef = useRef(0)
  const closeSearchTimeoutRef = useRef(null)
  const sortDropdownRef = useRef(null)


  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  const handleReportUpdated = (reportId, partialUpdate) => {
    if (!reportId || !partialUpdate) return
    setReports((previousReports) =>
      previousReports.map((report) =>
        report.id === reportId ? { ...report, ...partialUpdate } : report,
      ),
    )
  }

  useEffect(() => {
    const nextQuery = new URLSearchParams(location.search).get('q') || ''
    setUserSearchQuery((previousQuery) => (previousQuery === nextQuery ? previousQuery : nextQuery))
  }, [location.search])

  useEffect(() => {
    if (activeFeed !== 'nearby' || geoState.status !== 'idle') {
      return
    }

    if (!navigator.geolocation) {
      setGeoState({
        status: 'unavailable',
        coords: null,
      })
      return
    }

    setGeoState({
      status: 'loading',
      coords: null,
    })

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoState({
          status: 'ready',
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        })
      },
      () => {
        setGeoState({
          status: 'denied',
          coords: null,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    )
  }, [activeFeed, geoState.status])

  const effectiveFeed = useMemo(() => {
    if (activeFeed !== 'nearby') {
      return activeFeed
    }

    if (geoState.status === 'ready') {
      return 'nearby'
    }

    if (geoState.status === 'denied' || geoState.status === 'unavailable') {
      return 'latest'
    }

    return null
  }, [activeFeed, geoState.status])

  const nearbyMessage = useMemo(() => {
    if (activeFeed !== 'nearby') {
      return ''
    }
    if (geoState.status === 'loading' || geoState.status === 'idle') {
      return 'Finding reports near you...'
    }
    if (geoState.status === 'ready') {
      return `Showing reports within ${DEFAULT_RADIUS_KM} km of your location.`
    }
    return 'Nearby feed is unavailable without location access, so the latest reports are shown instead.'
  }, [activeFeed, geoState.status])

  const selectedSortOption = useMemo(
    () => SORT_OPTIONS.find((option) => option.id === sortMode) || SORT_OPTIONS[0],
    [sortMode],
  )

  useEffect(() => {
    if (!isSortMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!sortDropdownRef.current?.contains(event.target)) {
        setIsSortMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSortMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSortMenuOpen])

  useEffect(() => {
    if (!effectiveFeed) {
      return
    }

    let isActive = true
    const nextRequestId = requestIdRef.current + 1
    requestIdRef.current = nextRequestId

    setIsLoading(true)
    setFeedError('')
    setLoadMoreError('')

    const params = {
      limit: PAGE_SIZE,
      offset: 0,
      feed: effectiveFeed,
      sort: sortMode,
    }

    if (effectiveFeed === 'nearby' && geoState.coords) {
      params.lat = geoState.coords.lat
      params.lng = geoState.coords.lng
      params.radiusKm = DEFAULT_RADIUS_KM
    }

    listReports(params)
      .then((response) => {
        if (!isActive || requestIdRef.current !== nextRequestId) {
          return
        }

        setReports(response.reports)
        setPagination(response.pagination)
        setFeedMeta(response.meta)
      })
      .catch((error) => {
        if (!isActive || requestIdRef.current !== nextRequestId) {
          return
        }

        setFeedError(error.message || 'Failed to load the reports feed.')
        setReports([])
        setPagination({
          limit: PAGE_SIZE,
          offset: 0,
          hasMore: false,
          returned: 0,
        })
        setFeedMeta(null)
      })
      .finally(() => {
        if (isActive && requestIdRef.current === nextRequestId) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [effectiveFeed, sortMode, geoState.coords])

  const handleShowMore = async () => {
    if (isLoadingMore || !pagination.hasMore || !effectiveFeed) {
      return
    }

    const nextRequestId = requestIdRef.current + 1
    requestIdRef.current = nextRequestId

    setIsLoadingMore(true)
    setLoadMoreError('')

    try {
      const response = await listReports({
        limit: PAGE_SIZE,
        offset: reports.length,
        feed: effectiveFeed,
        sort: sortMode,
        lat: effectiveFeed === 'nearby' ? geoState.coords?.lat : undefined,
        lng: effectiveFeed === 'nearby' ? geoState.coords?.lng : undefined,
        radiusKm: effectiveFeed === 'nearby' ? DEFAULT_RADIUS_KM : undefined,
      })

      if (requestIdRef.current !== nextRequestId) {
        return
      }

      setReports((previousReports) => mergeReports(previousReports, response.reports))
      setPagination(response.pagination)
      setFeedMeta(response.meta)
    } catch (error) {
      if (requestIdRef.current === nextRequestId) {
        setLoadMoreError(error.message || 'Failed to load more reports.')
      }
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setIsLoadingMore(false)
      }
    }
  }

  const filteredReports = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase()

    if (!query) {
      return reports
    }

    return reports.filter((report) => {
      const authorProfile = getReportAuthorProfile(report)
      const title = String(report?.title || '').toLowerCase()
      const location = String(report?.locationLabel || '').toLowerCase()
      const type = String(report?.incidentType || '').toLowerCase()
      const description = String(report?.description || '').toLowerCase()
      const status = String(report?.status || '').toLowerCase()
      const severity = String(report?.severity || '').toLowerCase()
      const authorName = String(authorProfile?.name || '').toLowerCase()
      const authorEmail = String(authorProfile?.email || '').toLowerCase()

      return (
        title.includes(query)
        || location.includes(query)
        || type.includes(query)
        || description.includes(query)
        || status.includes(query)
        || severity.includes(query)
        || authorName.includes(query)
        || authorEmail.includes(query)
      )
    })
  }, [reports, userSearchQuery])

  const quickSearchIncidents = useMemo(() => filteredReports.slice(0, 8), [filteredReports])

  const searchableUsers = useMemo(() => {
    const uniqueUsers = new Map()

    reports.forEach((report) => {
      const profile = getReportAuthorProfile(report)
      if (!profile?.name) return

      const identityKey = profile.id != null
        ? `id:${String(profile.id)}`
        : `name:${String(profile.name).trim().toLowerCase()}`

      if (!uniqueUsers.has(identityKey)) {
        uniqueUsers.set(identityKey, profile)
      }
    })

    return Array.from(uniqueUsers.values()).sort((left, right) => left.name.localeCompare(right.name))
  }, [reports])

  const filteredUsers = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase()
    if (!query) return []

    return searchableUsers
      .filter((profile) => {
        const nameMatch = String(profile.name || '').toLowerCase().includes(query)
        const emailMatch = String(profile.email || '').toLowerCase().includes(query)
        return nameMatch || emailMatch
      })
      .slice(0, 5)
  }, [searchableUsers, userSearchQuery])

  const quickSearchItems = useMemo(() => {
    const query = userSearchQuery.trim()
    if (!query) return []

    const accountItems = filteredUsers.map((profile) => ({
      kind: 'account',
      id: profile.id != null ? `account-${profile.id}` : `account-${profile.name}`,
      title: profile.name,
      subtitle: profile.email || 'Feed contributor',
      avatarUrl: getUserAvatarUrl(profile) || profileAvatar,
      profile,
    }))

    const incidentItems = quickSearchIncidents.map((report) => ({
      kind: 'report',
      id: `report-${report.id}`,
      title: report?.title || 'Reported incident',
      subtitle: report?.locationLabel || report?.incidentType || 'Incident report',
      report,
    }))

    return [...accountItems, ...incidentItems].slice(0, 10)
  }, [filteredUsers, quickSearchIncidents, userSearchQuery])

  const markerReports = useMemo(
    () => filteredReports.filter((report) => report?.location?.lat != null && report?.location?.lng != null),
    [filteredReports],
  )

  const mapCenter = useMemo(() => {
    if (activeFeed === 'nearby' && geoState.status === 'ready' && geoState.coords) {
      return geoState.coords
    }

    if (markerReports.length > 0) {
      return {
        lat: markerReports[0].location.lat,
        lng: markerReports[0].location.lng,
      }
    }

    return FALLBACK_MAP_CENTER
  }, [activeFeed, geoState.coords, geoState.status, markerReports])

  const trendingReports = useMemo(() => {
    return [...filteredReports]
      .sort((left, right) => {
        const severityWeight = (value) => {
          if (value === 'high') return 3
          if (value === 'medium') return 2
          if (value === 'low') return 1
          return 0
        }

        const severityDiff = severityWeight(right?.severity) - severityWeight(left?.severity)
        if (severityDiff !== 0) {
          return severityDiff
        }

        const leftDate = new Date(left?.occurredAt || left?.createdAt || 0).getTime()
        const rightDate = new Date(right?.occurredAt || right?.createdAt || 0).getTime()
        return rightDate - leftDate
      })
      .slice(0, 3)
  }, [filteredReports])

  const profileName = user?.name || 'Guest Driver'
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleClass = primaryRole === 'admin'
    ? 'role-admin'
    : primaryRole === 'police'
      ? 'role-police'
      : 'role-citoyen'

  const handleHeaderAvatarImageError = (event) => {
    const avatarButton = event.currentTarget.closest('.dash-avatar')
    if (!avatarButton) {
      return
    }

    avatarButton.classList.remove('has-image')
    event.currentTarget.remove()
  }

  const handleQuickSearchAvatarImageError = (event) => {
    if (event.currentTarget.src !== profileAvatar) {
      event.currentTarget.src = profileAvatar
      return
    }

    const avatarElement = event.currentTarget.closest('.news-user-search-avatar')
    if (!avatarElement) {
      return
    }

    avatarElement.classList.remove('has-image')
    event.currentTarget.remove()
  }

  const feedHeadline = useMemo(() => {
    if (isLoading) {
      return 'Loading live reports...'
    }
    if (feedError) {
      return 'Live feed unavailable right now'
    }
    if (!reports.length) {
      return 'No reports available for this feed'
    }
    if (userSearchQuery.trim()) {
      return `Found ${filteredReports.length} matching report${filteredReports.length === 1 ? '' : 's'}`
    }
    return `Showing ${reports.length} live report${reports.length === 1 ? '' : 's'}`
  }, [feedError, filteredReports.length, isLoading, reports.length, userSearchQuery])

  const followingUnsupported = activeFeed === 'following' && feedMeta?.followingSupported === false

  const handleOpenAuthorProfile = (profile) => {
    if (!profile || !profile.name) {
      return
    }

    const currentUserId = user?.id ?? user?.userId ?? user?.user_id
    const targetUserId = profile?.id ?? profile?.userId ?? profile?.user_id
    const currentUserEmail = String(user?.email || '').trim().toLowerCase()
    const targetUserEmail = String(profile?.email || '').trim().toLowerCase()
    const currentUserName = String(user?.name || '').trim().toLowerCase()
    const targetUserName = String(profile?.name || '').trim().toLowerCase()

    const sameById = currentUserId != null && targetUserId != null && String(currentUserId) === String(targetUserId)
    const sameByEmail = Boolean(currentUserEmail && targetUserEmail && currentUserEmail === targetUserEmail)
    const sameByName = Boolean(currentUserName && targetUserName && currentUserName === targetUserName)

    if (sameById || sameByEmail || sameByName) {
      navigate('/profile')
      setIsUserSearchOpen(false)
      return
    }

    navigate('/profile', {
      state: {
        profileUser: profile,
        source: 'feed',
      },
    })

    setIsUserSearchOpen(false)
  }

  const handleOpenIncident = (report) => {
    if (!report?.id) return
    navigate(`/incident/${report.id}`)
    setIsUserSearchOpen(false)
  }

  const handleSearchFocus = () => {
    if (closeSearchTimeoutRef.current) {
      window.clearTimeout(closeSearchTimeoutRef.current)
      closeSearchTimeoutRef.current = null
    }
    setIsUserSearchOpen(true)
  }

  const handleSearchBlur = () => {
    closeSearchTimeoutRef.current = window.setTimeout(() => {
      setIsUserSearchOpen(false)
    }, 120)
  }

  useEffect(() => {
    return () => {
      if (closeSearchTimeoutRef.current) {
        window.clearTimeout(closeSearchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="siara-news-root">
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab dash-tab-active">Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <div className="news-user-search">
              <input
                className="dash-search"
                type="search"
                placeholder="Search users, incidents, roads, zones…"
                aria-label="Search users, incidents, roads, zones"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return

                  const query = event.currentTarget.value.trim()
                  if (!query) return

                  if (quickSearchItems.length > 0) {
                    event.preventDefault()
                    const firstItem = quickSearchItems[0]
                    if (firstItem.kind === 'account') {
                      handleOpenAuthorProfile(firstItem.profile)
                    } else {
                      handleOpenIncident(firstItem.report)
                    }
                    return
                  }

                  setUserSearchQuery(query)
                  setIsUserSearchOpen(false)
                }}
              />

              {isUserSearchOpen && userSearchQuery.trim() && (
                <div className="news-user-search-menu" role="listbox" aria-label="Matching accounts and incidents">
                  {quickSearchItems.length > 0 ? (
                    quickSearchItems.map((item) => (
                      <button
                        key={item.id}
                        className="news-user-search-item"
                        onMouseDown={() => {
                          if (item.kind === 'account') {
                            handleOpenAuthorProfile(item.profile)
                          } else {
                            handleOpenIncident(item.report)
                          }
                        }}
                      >
                        <span className={`news-user-search-avatar ${item.avatarUrl ? 'has-image' : ''}`}>
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt={`${item.title} avatar`} className="news-user-search-avatar-image" loading="lazy" onError={handleQuickSearchAvatarImageError} />
                          ) : null}
                          <span className="news-user-search-avatar-fallback">{getAuthorInitials(item.title || 'R')}</span>
                        </span>
                        <span className="news-user-search-labels">
                          <span className="news-user-search-name-row">
                            <span className="news-user-search-name">{item.title}</span>
                            <span className={`news-user-search-type ${item.kind}`}>{item.kind === 'account' ? 'Account' : 'Report'}</span>
                          </span>
                          <span className="news-user-search-meta">{item.subtitle}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="news-user-search-empty">No matching account or accident found in current feed.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown((previous) => !previous)} aria-label="User profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" onError={handleHeaderAvatarImageError} />
                ) : null}
                <span className="dash-avatar-fallback">{getAuthorInitials(profileName)}</span>
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

      <div className="siara-news-layout">
        <aside className="sidebar-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatarUrl} alt="Profile" className="profile-avatar-large" loading="lazy" onError={(event) => {
                if (event.currentTarget.src !== profileAvatar) {
                  event.currentTarget.src = profileAvatar
                }
              }} />
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <FeedSidebarNav activeKey="feed" onOpenQuiz={() => setShowQuiz(true)} />

          <div className="card smart-filters">
            <div className="card-header">
              <h3 className="card-title">Smart Filters</h3>
              <button className="collapse-btn" onClick={() => setFiltersOpen((previous) => !previous)}>
                {filtersOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            {filtersOpen && (
              <>
                <div className="filter-section">
                  <label className="filter-label">Feed mode</label>
                  <FancySelect
                    value={activeFeed}
                    onChange={setActiveFeed}
                    menuAlign="left"
                    options={FEED_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
                  />
                </div>
                <div className="filter-section">
                  <label className="filter-label">Sort</label>
                  <FancySelect
                    value={sortMode}
                    onChange={setSortMode}
                    menuAlign="left"
                    options={SORT_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
                  />
                </div>
                <div className="filter-section">
                  <label className="filter-label">Severity</label>
                  <div className="filter-pills">
                    <button className="severity-pill severity-low" onClick={() => setSortMode('recent')}>Low</button>
                    <button className="severity-pill severity-medium" onClick={() => setSortMode('severity')}>Medium</button>
                    <button className="severity-pill severity-high" onClick={() => setSortMode('severity')}>High</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card saved-filters">
            <h3 className="card-title">Saved Filters</h3>
            <div className="saved-filter-item" onClick={() => { setActiveFeed('latest'); setSortMode('recent') }}>Latest reports</div>
            <div className="saved-filter-item" onClick={() => { setActiveFeed('verified'); setSortMode('severity') }}>Verified + severe</div>
            <div className="saved-filter-item" onClick={() => setActiveFeed('nearby')}>Reports near me</div>
          </div>
        </aside>

        <main className="feed-center">
          <button className="realtime-indicator" type="button">
            {feedHeadline}
          </button>

          <div className="card report-cta-card">
            <p className="report-cta-copy">Want to report a new incident?</p>
            <button className="btn-publier report-cta-btn" onClick={() => navigate('/report')}>
              Go to Report Page
            </button>
          </div>

          <div className="feed-tabs-sticky">
            <div className="feed-tabs">
              {FEED_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`feed-tab ${activeFeed === tab.id ? 'feed-tab-active' : ''}`}
                  onClick={() => setActiveFeed(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="feed-sort">
              <span>Sort by:</span>
              <div className="feed-sort-dropdown" ref={sortDropdownRef}>
                <button
                  type="button"
                  className={`feed-sort-trigger ${isSortMenuOpen ? 'open' : ''}`}
                  onClick={() => setIsSortMenuOpen((previous) => !previous)}
                  aria-haspopup="listbox"
                  aria-expanded={isSortMenuOpen}
                  aria-label="Sort reports"
                >
                  <span>{selectedSortOption.label}</span>
                  <span className="feed-sort-chevron" aria-hidden="true"><KeyboardArrowDownRoundedIcon fontSize="inherit" /></span>
                </button>

                {isSortMenuOpen ? (
                  <div className="feed-sort-menu" role="listbox" aria-label="Sort options">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`feed-sort-option ${option.id === sortMode ? 'selected' : ''}`}
                        onClick={() => {
                          setSortMode(option.id)
                          setIsSortMenuOpen(false)
                        }}
                        role="option"
                        aria-selected={option.id === sortMode}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {nearbyMessage && <div className="card feed-state-card">{nearbyMessage}</div>}

          {feedError && (
            <div className="card feed-state-card feed-state-error">
              <h3 className="feed-state-title">Feed unavailable</h3>
              <p>{feedError}</p>
            </div>
          )}

          {!feedError && isLoading && (
            <div className="card feed-state-card">
              <h3 className="feed-state-title">Loading reports</h3>
              <p>Fetching the latest incident data for your feed.</p>
            </div>
          )}

          {!feedError && !isLoading && filteredReports.length === 0 && (
            <div className="card feed-state-card">
              <h3 className="feed-state-title">{followingUnsupported && !userSearchQuery.trim() ? 'Following feed not available yet' : 'No reports found'}</h3>
              <p>
                {userSearchQuery.trim()
                  ? 'Try a different search term for the incident title, location, or type.'
                  : followingUnsupported
                  ? 'This repository does not currently include a following relationship, so there are no follow-based reports to show yet.'
                  : 'Try switching tabs or sorting options to load a different set of reports.'}
              </p>
            </div>
          )}

          {!feedError && !isLoading && filteredReports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              navigate={navigate}
              onOpenAuthorProfile={handleOpenAuthorProfile}
              onReportUpdated={handleReportUpdated}
              currentUser={user}
            />
          ))}

          {!feedError && reports.length > 0 && (
            <div className="feed-pagination">
              {loadMoreError && <p className="feed-load-more-error">{loadMoreError}</p>}
              {pagination.hasMore ? (
                <button className="widget-see-more show-more-btn" onClick={handleShowMore} disabled={isLoadingMore}>
                  {isLoadingMore ? (
                    <>
                      <span className="show-more-spinner" aria-hidden />
                      Loading more
                    </>
                  ) : (
                    <>
                      Show more
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <p className="feed-pagination-end">You have reached the end of the current feed.</p>
              )}
            </div>
          )}
        </main>

        <aside className="sidebar-right">
          <div className="card widget-map">
            <div className="map-widget-header">
              <h3 className="widget-title">Incidents Near You</h3>
              <div className="map-legends">
                <span className="map-legend"><span className="legend-dot danger"></span>High</span>
                <span className="map-legend"><span className="legend-dot accident"></span>Medium</span>
                <span className="map-legend"><span className="legend-dot normal"></span>Low</span>
              </div>
            </div>
            <div className="map-widget-container" style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden' }}>
              {(() => {
                const mapZoom = geoState.status === 'ready' ? 13 : markerReports.length > 0 ? 11 : 8
                const mapCenterArr = [mapCenter.lat, mapCenter.lng]
                return (
                  <MapContainer
                    center={mapCenterArr}
                    zoom={mapZoom}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapCenterUpdater center={mapCenterArr} zoom={mapZoom} />
                    {geoState.status === 'ready' && geoState.coords && (
                      <CircleMarker
                        center={[geoState.coords.lat, geoState.coords.lng]}
                        radius={9}
                        pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#6366f1', fillOpacity: 1 }}
                      >
                        <Popup>Your location</Popup>
                      </CircleMarker>
                    )}
                    {markerReports.map((report) => (
                      <CircleMarker
                        key={report.id}
                        center={[report.location.lat, report.location.lng]}
                        radius={7}
                        pathOptions={{ color: '#fff', weight: 2, fillColor: getMarkerColor(report.severity), fillOpacity: 1 }}
                      >
                        <Popup>{report.title || report.type}</Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                )
              })()}
            </div>
            <p className="map-widget-status">
              {markerReports.length > 0
                ? `${markerReports.length} report${markerReports.length === 1 ? '' : 's'} with map coordinates are visible.`
                : 'No mapped reports are available in the current feed.'}
            </p>
            <button className="btn-open-map" onClick={() => navigate('/map')}>Open Full Map</button>
          </div>

          <div className="card widget-trending">
            <h3 className="widget-title">Trending Incidents</h3>
            {trendingReports.length > 0 ? (
              trendingReports.map((report) => (
                <div className="trending-item" key={`trending-${report.id}`}>
                  <span className={`severity-pill ${getSeverityClass(report.severity)} small`}>
                    {report.severity ? report.severity.charAt(0).toUpperCase() + report.severity.slice(1) : 'Info'}
                  </span>
                  <div className="trending-info">
                    <div className="trending-header">
                      <p className="trending-location">{report.locationLabel || report.title || 'Reported incident'}</p>
                      <span className="trending-icon">{report.incidentType || 'report'}</span>
                    </div>
                    <div className="trending-bar"></div>
                    <span className="trending-time">{formatRelativeTime(report.createdAt || report.occurredAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="widget-empty-copy">Trending incident data will appear here once reports are loaded.</p>
            )}
            <button className="widget-see-more" onClick={() => navigate('/map')}>See more</button>
          </div>

          <div className="card widget-alerts">
            <h3 className="widget-title">Priority Alerts</h3>
            {filteredReports.filter((report) => report.status === 'verified' || report.severity === 'high').slice(0, 3).map((report) => (
              <div className="alert-item" key={`alert-${report.id}`}>
                {report.title || report.locationLabel || 'Reported incident'} in {report.locationLabel || 'the selected area'}
              </div>
            ))}
            {filteredReports.length === 0 && (
              <div className="alert-item">Live feed alerts will appear here when reports are available.</div>
            )}
            <button className="btn-activate-alerts" onClick={() => navigate('/alerts')}>Enable Alerts</button>
          </div>

          <div className="card widget-quick-actions">
            <h3 className="widget-title">Quick Actions</h3>
            <button className="quick-action-btn" onClick={() => navigate('/report')}>Add a Report</button>
            <button className="quick-action-btn" onClick={() => navigate('/map')}>Open Incident Map</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
