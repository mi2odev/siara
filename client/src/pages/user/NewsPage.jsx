import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'
import { createPortal } from 'react-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import { getUserRoles } from '../../utils/roleUtils'
import DrivingQuiz from '../../components/ui/DrivingQuiz'
import { listReports } from '../../services/reportsService'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import '../../styles/NewsPage.css'
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

function getMarkerIcon(severity) {
  const color = severity === 'high' ? '#ff3b30' : severity === 'medium' ? '#ff9500' : '#34c759'

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    scale: 7,
    strokeWeight: 2,
    strokeColor: '#ffffff',
  }
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
  const normalized = String(name || 'Citizen').trim()
  if (!normalized) {
    return 'CT'
  }

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
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

function formatDateTime(value) {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildReportTags(report) {
  const tags = []

  if (report?.incidentType) {
    tags.push(`#${report.incidentType}`)
  }
  if (report?.status) {
    tags.push(`#${report.status}`)
  }
  if (Array.isArray(report?.media) && report.media.length > 0) {
    tags.push(`#${report.media.length}-photo${report.media.length > 1 ? 's' : ''}`)
  }

  return tags
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
  const isAdmin = normalizedRoles.includes('admin')
  const isPolice = normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')

  if (isAdmin) {
    return { className: 'badge-admin', label: 'Admin' }
  }

  if (isPolice) {
    return { className: 'badge-police', label: 'Police' }
  }

  return { className: 'badge-citoyen', label: 'Citizen' }
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

function ReportCard({ report, navigate, onOpenAuthorProfile }) {
  const authorProfile = getReportAuthorProfile(report)
  const authorName = authorProfile.name
  const authorRoleBadge = getAuthorRoleBadge(authorProfile)
  const severityClass = getSeverityClass(report?.severity)
  const severityLabel = getSeverityLabel(report?.severity)
  const media = Array.isArray(report?.media) ? report.media : []
  const visibleMedia = media.slice(0, 3)
  const remainingMediaCount = Math.max(0, media.length - visibleMedia.length)
  const tags = buildReportTags(report)
  const description = report?.description || ''
  const shouldShowSeeMore = description.length > 180
  const isVerified = report?.status === 'verified'
  const statusLabel = report?.status ? report.status.charAt(0).toUpperCase() + report.status.slice(1) : 'Pending'
  const occurredAt = report?.occurredAt || report?.createdAt
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const activeMedia = selectedMediaIndex == null ? null : media[selectedMediaIndex]
  const handleOpenProfile = () => {
    onOpenAuthorProfile(authorProfile)
  }

  useEffect(() => {
    if (selectedMediaIndex == null) return () => {}

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedMediaIndex(null)
      }

      if (event.key === 'ArrowRight' && media.length > 1) {
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % media.length))
      }

      if (event.key === 'ArrowLeft' && media.length > 1) {
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

  const handleLightboxWheel = (event) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.12 : 0.12
    setZoomScale((prev) => clampScale(prev + delta))
  }

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

    const deltaX = clientX - dragRef.current.startX
    const deltaY = clientY - dragRef.current.startY

    setPanOffset({
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
    })
  }

  const stopPan = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <article className={`card post-card ${report?.severity === 'high' ? 'severity-high-indicator' : ''}`}>
      <header className="post-header">
        <div className="post-header-left">
          <button className="post-avatar post-avatar-btn" onClick={handleOpenProfile} aria-label={`Open ${authorName} profile`}>
            {getAuthorInitials(authorName)}
          </button>
          <div className="post-meta-block">
            <div className="post-author-row">
              <button className="post-author post-author-btn hoverable-name" onClick={handleOpenProfile}>
                {authorName}
              </button>
              {isVerified && <span className="badge badge-verified">Verified</span>}
              <span className={`badge ${authorRoleBadge.className}`}>{authorRoleBadge.label}</span>
            </div>
            <div className="post-meta-row">
              <span className="post-time">{formatRelativeTime(report?.createdAt || occurredAt)}</span>
              <span className="post-dot">•</span>
              <span className="post-location">{report?.locationLabel || 'Reported location'}</span>
            </div>
          </div>
        </div>
        <div className="post-header-right">
          <span className={`severity-pill ${severityClass} small`}>{severityLabel}</span>
          <button className="post-options-btn" onClick={() => navigate(`/incident/${report.id}`)}>...</button>
        </div>
      </header>

      <div className="post-body">
        <h2 className="post-title">{report?.title || 'Untitled report'}</h2>
        <p className={`post-text ${shouldShowSeeMore ? 'clamp-lines' : ''}`}>
          {description || 'No additional description was provided for this report.'}
        </p>
        {shouldShowSeeMore && (
          <button className="post-see-more" onClick={() => navigate(`/incident/${report.id}`)}>
            See more
          </button>
        )}

        {tags.length > 0 && (
          <div className="post-tags">
            {tags.map((tag) => (
              <span className="post-tag" key={`${report.id}-${tag}`}>{tag}</span>
            ))}
          </div>
        )}

        {visibleMedia.length > 0 && (
          <div
            className="post-media-grid"
            style={{ gridTemplateColumns: `repeat(${visibleMedia.length}, minmax(0, 1fr))` }}
          >
            {visibleMedia.map((mediaItem, index) => {
              const isLastVisibleItem = index === visibleMedia.length - 1
              const showOverlay = remainingMediaCount > 0 && isLastVisibleItem

              return (
                <div className={`media-item ${showOverlay ? 'media-more' : ''}`} key={mediaItem.id || `${report.id}-${index}`}>
                  <button
                    type="button"
                    className="post-media-open-btn"
                    onClick={() => {
                      setSelectedMediaIndex(index)
                      setZoomScale(1)
                    }}
                    aria-label="Open photo"
                  >
                    <img
                      className="media-thumbnail"
                      src={mediaItem.url}
                      alt={report?.title || 'Report media'}
                      loading="lazy"
                    />
                  </button>
                  {showOverlay && <span className="media-more-count">+{remainingMediaCount}</span>}
                </div>
              )
            })}
          </div>
        )}

        <button className="post-map-preview" onClick={() => navigate('/map')}>
          View on map
        </button>
      </div>

      <footer className="post-footer">
        <div className="post-reactions">
          <button className="reaction-btn">
            <span>{report?.incidentType || 'report'}</span>
          </button>
          <button className="reaction-btn">
            <span>{statusLabel}</span>
          </button>
          {report?.distanceKm != null && (
            <button className="reaction-btn">
              <span>{report.distanceKm} km away</span>
            </button>
          )}
        </div>

        <div className="post-stats">
          <button className="post-stat-btn" onClick={() => navigate(`/incident/${report.id}`)}>
            View details
          </button>
          <button className="post-stat-btn" onClick={() => navigate('/map')}>
            Open map
          </button>
          <button className="post-stat-btn">
            {media.length} photo{media.length === 1 ? '' : 's'}
          </button>
        </div>
      </footer>

      <div className="post-comments-preview">
        <div className="comment-box">
          <strong>Occurred:</strong> {formatDateTime(occurredAt)}
        </div>
      </div>

      {activeMedia && createPortal(
        <div className="post-media-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setSelectedMediaIndex(null)}>
          <div className="post-media-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="post-media-lightbox-toolbar">
              <button type="button" className="post-media-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <button type="button" className="post-media-zoom-btn reset" onClick={zoomReset} aria-label="Reset zoom">
                {Math.round(zoomScale * 100)}%
              </button>
              <button type="button" className="post-media-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>

            <button
              type="button"
              className="post-media-lightbox-close"
              onClick={() => setSelectedMediaIndex(null)}
              aria-label="Close photo preview"
            >
              ×
            </button>

            <div
              className={`post-media-lightbox-stage ${zoomScale > 1 ? 'zoomed' : ''} ${isDragging ? 'dragging' : ''}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedMediaIndex(null)
                }
              }}
              onWheel={handleLightboxWheel}
              onMouseDown={(event) => {
                event.preventDefault()
                startPan(event.clientX, event.clientY)
              }}
              onMouseMove={(event) => movePan(event.clientX, event.clientY)}
              onMouseUp={stopPan}
              onMouseLeave={stopPan}
              onTouchStart={(event) => {
                const touch = event.touches[0]
                if (!touch) return
                startPan(touch.clientX, touch.clientY)
              }}
              onTouchMove={(event) => {
                const touch = event.touches[0]
                if (!touch) return
                movePan(touch.clientX, touch.clientY)
              }}
              onTouchEnd={stopPan}
            >
              <img
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

export default function NewsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [showQuiz, setShowQuiz] = useState(false)
  const [activeFeed, setActiveFeed] = useState('latest')
  const [sortMode, setSortMode] = useState('recent')
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

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY,
  })

  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
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
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
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
                placeholder="Search accounts or accidents..."
                aria-label="Search accounts or accidents"
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
                        <span className="news-user-search-avatar">{getAuthorInitials(item.title || 'R')}</span>
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
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              🔔
              <span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn dash-icon-btn-messages" aria-label="Messages"></button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown((previous) => !previous)} aria-label="User profile">
                {getAuthorInitials(profileName)}
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
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">V</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/home')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">🏠</span>
              <span className="nav-label">Home</span>
            </button>
            <button className="nav-item nav-item-active">
              <span className="nav-accent"></span>
              <span className="nav-icon">📰</span>
              <span className="nav-label">News Feed</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/report')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">📝</span>
              <span className="nav-label">My Reports</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/map')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">🗺️</span>
              <span className="nav-label">Incident Map</span>
            </button>

            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}>
              <span className="nav-accent"></span>
              <span className="nav-icon">🚗</span>
              <span className="nav-label">Driver Quiz</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/predictions')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">📊</span>
              <span className="nav-label">Statistics</span>
            </button>
            <button className="nav-item" onClick={() => navigate('/alerts')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">🚨</span>
              <span className="nav-label">Alerts</span>
            </button>

            <div className="nav-section-label">SETTINGS</div>
            <button className="nav-item" onClick={() => navigate('/settings')}>
              <span className="nav-accent"></span>
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">Settings</span>
            </button>
          </nav>

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
                  <select className="filter-select" value={activeFeed} onChange={(event) => setActiveFeed(event.target.value)}>
                    {FEED_TABS.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.label}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-section">
                  <label className="filter-label">Sort</label>
                  <select className="filter-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
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
              <label htmlFor="feed-sort-select">Sort by:</label>
              <select
                className="feed-sort-select"
                id="feed-sort-select"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
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
            <ReportCard key={report.id} report={report} navigate={navigate} onOpenAuthorProfile={handleOpenAuthorProfile} />
          ))}

          {!feedError && reports.length > 0 && (
            <div className="feed-pagination">
              {loadMoreError && <p className="feed-load-more-error">{loadMoreError}</p>}
              {pagination.hasMore ? (
                <button className="widget-see-more show-more-btn" onClick={handleShowMore} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading more...' : 'Show more'}
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
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={markerReports.length > 0 ? 11 : 8}
                  options={{ disableDefaultUI: true }}
                >
                  {markerReports.map((report) => (
                    <Marker
                      key={report.id}
                      position={{ lat: report.location.lat, lng: report.location.lng }}
                      icon={getMarkerIcon(report.severity)}
                    />
                  ))}
                </GoogleMap>
              ) : (
                <div className="map-widget-loading">Loading map...</div>
              )}
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
