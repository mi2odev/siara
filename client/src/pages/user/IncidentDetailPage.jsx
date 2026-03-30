import React, { useState, useContext, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { deleteReport, getReport, updateReport } from '../../services/reportsService'
import '../../styles/IncidentDetailPage.css'
import '../../styles/NewsPage.css'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

const REPORT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const INCIDENT_TYPE_META = {
  accident: { label: 'Accident', icon: '🚗' },
  traffic: { label: 'Traffic', icon: '🚦' },
  danger: { label: 'Danger', icon: '⚠️' },
  weather: { label: 'Weather', icon: '🌧️' },
  roadworks: { label: 'Roadworks', icon: '🚧' },
  other: { label: 'Other', icon: '📍' },
}

const STATUS_META = {
  pending: { label: 'Pending', icon: 'Pending' },
  verified: { label: 'Verified', icon: 'Verified' },
  rejected: { label: 'Rejected', icon: 'Rejected' },
  resolved: { label: 'Resolved', icon: 'Resolved' },
}

const severityOptions = ['low', 'medium', 'high']

const mockIncident = {
  id: '1',
  type: 'accident',
  title: 'Multi-vehicle collision on A1 Highway',
  description: `A serious multi-vehicle collision occurred on the A1 Highway near the Bab Ezzouar exit. Initial reports indicate that at least 4 vehicles were involved, including a commercial truck.

Emergency services arrived on scene within 12 minutes of the first report. Traffic is currently being diverted through secondary routes. The incident appears to have been caused by reduced visibility due to morning fog.

Authorities advise all motorists to avoid this section of the highway until further notice. Alternative routes through Mohammadia and Hussein Dey are recommended.`,
  severity: 'high',
  locationLabel: 'Alger, A1 Highway, KM 23',
  location: { lat: 36.7538, lng: 3.0588 },
  reportedAt: '2025-12-31T08:45:00',
  updatedAt: '2025-12-31T09:08:00',
  status: 'verified',
  reporterName: 'Zitouni M.',
  media: [
    { type: 'image', caption: 'Scene from distance' },
    { type: 'image', caption: 'Traffic backup' },
    { type: 'image', caption: 'Emergency response' },
  ],
  timeline: [
    { time: '08:45', source: 'user', sourceLabel: 'Citizen Reporter', text: 'Report submitted by a citizen.' },
    { time: '08:52', source: 'system', sourceLabel: 'System', text: 'Incident verified by five community reports.' },
    { time: '08:57', source: 'authority', sourceLabel: 'Authority', text: 'Emergency response units were dispatched.' },
    { time: '09:03', source: 'authority', sourceLabel: 'Authority', text: 'Traffic diversion was activated.' },
    { time: '09:08', source: 'authority', sourceLabel: 'Authority', text: 'Ambulance teams arrived on scene.' },
  ],
  confirmations: 47,
  comments: 12,
  estimatedDelay: '45-60 min',
  alternativeRoutes: ['Via Mohammadia', 'Via Hussein Dey', 'Via Les Eucalyptus'],
  tags: ['highway', 'multi-vehicle', 'traffic-blocked'],
  sourceCount: 23,
}

const relatedIncidents = [
  { id: '2', title: 'Traffic jam near Rouiba', severity: 'medium' },
  { id: '3', title: 'Road works on N5', severity: 'low' },
]

function getSeverityColor(severity) {
  switch (severity) {
    case 'high': return '#DC2626'
    case 'medium': return '#F59E0B'
    case 'low': return '#10B981'
    default: return '#64748B'
  }
}

function getSeverityLabel(severity) {
  switch (severity) {
    case 'high': return 'High Severity'
    case 'medium': return 'Medium Severity'
    case 'low': return 'Low Severity'
    default: return 'Unknown'
  }
}

function getSourceIcon(source) {
  switch (source) {
    case 'user':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20C4.8 16.8 7.9 14.5 12 14.5C16.1 14.5 19.2 16.8 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'authority':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3L20 7V11C20 16 16.8 20.4 12 22C7.2 20.4 4 16 4 11V7L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    case 'system':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21C16 16.2 18 13.2 18 10.5C18 6.9 15.3 4 12 4C8.7 4 6 6.9 6 10.5C6 13.2 8 16.2 12 21Z" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
  }
}

function renderHeaderIcon(type) {
  if (type === 'notification') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 16V11C18 7.7 15.8 5 12.7 4.2V3.5C12.7 3 12.3 2.7 11.8 2.7C11.3 2.7 10.9 3 10.9 3.5V4.2C7.8 5 5.6 7.7 5.6 11V16L4.2 17.4C3.8 17.8 4.1 18.6 4.7 18.6H19C19.6 18.6 19.9 17.8 19.5 17.4L18 16Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9.6 19.4C10 20.4 10.8 21 11.8 21C12.8 21 13.6 20.4 14 19.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 17.2L3.8 20.2C3.4 20.8 3.8 21.6 4.5 21.6H16.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 15.8C5.8 15.8 4 14 4 11.8V8.8C4 6.6 5.8 4.8 8 4.8H16C18.2 4.8 20 6.6 20 8.8V11.8C20 14 18.2 15.8 16 15.8H8Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function renderNavIcon(type) {
  if (type === 'feed') return '📰'
  if (type === 'map') return '🗺️'
  if (type === 'alerts') return '🚨'
  return '👤'
}

function getIncidentTypeMeta(type) {
  return INCIDENT_TYPE_META[type] || { label: 'Incident', icon: '📍' }
}

function formatTimeAgo(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

function formatClock(value) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateTimeLocalValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function formatReporterDisplayName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'an identified user'

  return name
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (!part) return part
      if (part === part.toUpperCase()) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function buildTimelineFromReport(report, viewerUser = null) {
  const reporter = report?.reportedBy || report?.reported_by || null
  const reporterName = formatReporterDisplayName(reporter?.name || report?.authorName || '')
  const reporterId = reporter?.id || report?.reportedById || report?.reported_by_id || null
  const viewerId = viewerUser?.id || viewerUser?.userId || null
  const viewerRoles = getUserRoles(viewerUser)

  let reporterRoles = getUserRoles(reporter || { role: report?.authorRole })
  if (reporterRoles.length === 0 && reporterId && viewerId && reporterId === viewerId) {
    reporterRoles = viewerRoles
  }

  const isPoliceReporter = reporterRoles.includes('police') || reporterRoles.includes('policeofficer')
  const isAdminReporter = reporterRoles.includes('admin')
  const submitterLabel = isAdminReporter
    ? 'Administrator'
    : isPoliceReporter
      ? 'Police Officer'
      : 'Citizen Reporter'

  const timeline = [
    {
      time: formatClock(report.createdAt),
      source: isPoliceReporter || isAdminReporter ? 'authority' : 'user',
      sourceLabel: submitterLabel,
      text: `Report submitted by ${reporterName}.`,
    },
  ]

  if (report.updatedAt && report.updatedAt !== report.createdAt) {
    timeline.push({
      time: formatClock(report.updatedAt),
      source: 'system',
      sourceLabel: 'System',
      text: 'Report details were updated.',
    })
  }

  if (report.status && report.status !== 'pending') {
    const statusLabel = STATUS_META[report.status]?.label || report.status
    timeline.push({
      time: formatClock(report.updatedAt || report.createdAt),
      source: 'authority',
      sourceLabel: 'Authority',
      text: `Status updated to ${statusLabel}.`,
    })
  }

  return timeline
}

function buildEditForm(report) {
  return {
    incidentType: report.incidentType || 'accident',
    title: report.title || '',
    description: report.description || '',
    severity: report.severity || 'medium',
    status: report.status || 'pending',
    locationLabel: report.locationLabel || '',
    lat: report.location?.lat ?? '',
    lng: report.location?.lng ?? '',
    occurredAt: toDateTimeLocalValue(report.occurredAt),
  }
}

function buildDisplayIncident(report, id, viewerUser = null) {
  if (!report) {
    return { ...mockIncident, id: id || mockIncident.id }
  }

  return {
    id: report.id,
    type: report.incidentType,
    title: report.title,
    description: report.description || 'No description was provided for this report.',
    severity: report.severity || 'medium',
    locationLabel: report.locationLabel || 'Reported location',
    location: report.location,
    reportedAt: report.createdAt,
    updatedAt: report.updatedAt,
    status: report.status || 'pending',
    reporterName: report.reportedBy?.name || 'Citizen',
    media: Array.isArray(report.media)
      ? report.media.map((media) => ({
          id: media.id,
          url: media.url,
          caption: media.mediaType === 'image' ? 'Report image' : media.mediaType || 'Report media',
          uploadedAt: media.uploadedAt,
        }))
      : [],
    timeline: buildTimelineFromReport(report, viewerUser),
    confirmations: 0,
    comments: 0,
    estimatedDelay: 'Unknown',
    alternativeRoutes: ['Check the live map for alternate routes'],
    tags: [report.incidentType, report.severity, report.status].filter(Boolean),
    sourceCount: 1,
  }
}

export default function IncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [report, setReport] = useState(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportError, setReportError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = React.useRef(null)

  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const isRealReport = REPORT_ID_REGEX.test(id || '')
  const isAdmin = Array.isArray(user?.roles)
    ? user.roles.includes('admin')
    : user?.role === 'admin'

  const canManageReport = Boolean(
    report && user && (isAdmin || user.id === report.reportedBy?.id),
  )
  const incident = buildDisplayIncident(report, id, user)

  useEffect(() => {
    let isMounted = true

    if (!isRealReport) {
      setReport(null)
      setReportError('')
      setIsLoadingReport(false)
      setIsEditing(false)
      setEditForm(null)
      return () => {}
    }

    setIsLoadingReport(true)
    setReportError('')
    setIsEditing(false)
    setSaveError('')

    getReport(id)
      .then((loadedReport) => {
        if (!isMounted) return
        setReport(loadedReport)
        setEditForm(buildEditForm(loadedReport))
      })
      .catch((error) => {
        if (!isMounted) return
        setReportError(error.message || 'Failed to load report')
        setReport(null)
      })
      .finally(() => {
        if (isMounted) setIsLoadingReport(false)
      })

    return () => {
      isMounted = false
    }
  }, [id, isRealReport])

  useEffect(() => {
    if (selectedMediaIndex == null) return () => {}

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedMediaIndex(null)
      }

      if (event.key === 'ArrowRight' && incident.media.length > 1) {
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % incident.media.length))
      }

      if (event.key === 'ArrowLeft' && incident.media.length > 1) {
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev - 1 + incident.media.length) % incident.media.length))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedMediaIndex, incident.media.length])

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

  const typeMeta = getIncidentTypeMeta(incident.type)
  const statusMeta = STATUS_META[incident.status] || STATUS_META.pending
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
  const profileName = user?.name || user?.email || incident.reporterName || 'SIARA User'
  const leftStats = {
    all: 1,
    pending: incident.status === 'pending' ? 1 : 0,
    verified: incident.status === 'verified' ? 1 : 0,
    resolved: incident.status === 'resolved' ? 1 : 0,
    rejected: incident.status === 'rejected' ? 1 : 0,
  }
  const hasMapLocation = Number.isFinite(Number(incident.location?.lat)) && Number.isFinite(Number(incident.location?.lng))
  const mapCenter = hasMapLocation
    ? [Number(incident.location.lat), Number(incident.location.lng)]
    : [28.5, 2.5]
  const activeMedia = selectedMediaIndex == null ? null : incident.media[selectedMediaIndex]

  const clampScale = (value) => Math.min(4, Math.max(0.25, value))
  const zoomIn = () => setZoomScale((prev) => clampScale(prev + 0.15))
  const zoomOut = () => setZoomScale((prev) => clampScale(prev - 0.15))
  const zoomReset = () => setZoomScale(1)

  const handleLightboxWheel = (event) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.12 : 0.12
    setZoomScale((prev) => clampScale(prev + delta))
  }

  const handleLightboxDoubleClick = () => {
    setZoomScale((prev) => (prev <= 1 ? 2 : 1))
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

  const handleEditField = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleStartEdit = () => {
    if (!report) return
    setEditForm(buildEditForm(report))
    setSaveError('')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditForm(report ? buildEditForm(report) : null)
    setSaveError('')
    setIsEditing(false)
  }

  const handleSaveReport = async () => {
    if (!report || !editForm) return

    const lat = Number(editForm.lat)
    const lng = Number(editForm.lng)

    if (!editForm.title.trim() || editForm.title.trim().length < 2) {
      setSaveError('Title must be at least 2 characters.')
      return
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setSaveError('Latitude must be a valid number between -90 and 90.')
      return
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setSaveError('Longitude must be a valid number between -180 and 180.')
      return
    }

    setIsSaving(true)
    setSaveError('')

    try {
      const payload = {
        incidentType: editForm.incidentType,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        severity: editForm.severity,
        occurredAt: editForm.occurredAt ? new Date(editForm.occurredAt).toISOString() : report.occurredAt,
        location: {
          lat,
          lng,
          label: editForm.locationLabel.trim(),
        },
      }

      if (isAdmin) {
        payload.status = editForm.status
      }

      const updatedReport = await updateReport(report.id, payload)
      setReport(updatedReport)
      setEditForm(buildEditForm(updatedReport))
      setIsEditing(false)
    } catch (error) {
      setSaveError(error.message || 'Failed to update report')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteReport = async () => {
    if (!report || isDeleting) return

    const confirmed = window.confirm('Delete this report permanently?')
    if (!confirmed) return

    setIsDeleting(true)
    setSaveError('')

    try {
      await deleteReport(report.id)
      navigate('/news')
    } catch (error) {
      setSaveError(error.message || 'Failed to delete report')
      setIsDeleting(false)
    }
  }

  return (
    <div className="incident-detail-page">
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
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              {renderHeaderIcon('notification')}<span className="notification-badge"></span>
            </button>
            <button className="dash-icon-btn" aria-label="Messages">{renderHeaderIcon('message')}</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {user?.name ? user.name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) : 'U'}
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

      <div className="incident-layout">
        <aside className="incident-sidebar-left al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          <div className="card al-filter-section">
            <div className="nav-section-label">REPORT STATUS</div>
            <nav className="al-nav">
              <button className="al-nav-btn active" type="button">
                <span className="nav-label">All</span>
                <span className="nav-count">{leftStats.all}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'pending' ? 'active' : ''}`} type="button">
                <span className="nav-label">Pending</span>
                <span className="nav-count">{leftStats.pending}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'verified' ? 'active' : ''}`} type="button">
                <span className="nav-label">Verified</span>
                <span className="nav-count">{leftStats.verified}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'resolved' ? 'active' : ''}`} type="button">
                <span className="nav-label">Resolved</span>
                <span className="nav-count">{leftStats.resolved}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'rejected' ? 'active' : ''}`} type="button">
                <span className="nav-label">Rejected</span>
                <span className="nav-count">{leftStats.rejected}</span>
              </button>
            </nav>
          </div>

          <div className="card nav-menu">
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-icon">🗺️</span><span className="nav-label">Open Map</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-icon">🔔</span><span className="nav-label">Manage Alerts</span></button>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-icon">📰</span><span className="nav-label">Back to Feed</span></button>
          </div>

          <button className="al-cta" onClick={() => navigate('/report/create')}>+ New Report</button>
        </aside>

        <main className="incident-main">
          {isLoadingReport && (
            <div className="incident-header-block">
              <h1 className="incident-title">Loading report...</h1>
            </div>
          )}

          {reportError && (
            <div className="incident-header-block">
              <h1 className="incident-title">Report unavailable</h1>
              <p>{reportError}</p>
            </div>
          )}

          {!isLoadingReport && !reportError && (
            <>
              <div className="incident-header-block">
                <div className="incident-type-badge">
                  <span className="incident-type-icon">{typeMeta.icon}</span>
                  <span className="incident-type-label">{typeMeta.label}</span>
                </div>
                <h1 className="incident-title">{incident.title}</h1>
                <div className="incident-meta-row">
                  <span className="meta-time">Time {formatTimeAgo(incident.reportedAt)}</span>
                  <span className="meta-separator">•</span>
                  <span className="meta-location">Loc {incident.locationLabel}</span>
                  <span className="meta-separator">•</span>
                  <span className={`meta-verified ${incident.status === 'verified' || incident.status === 'resolved' ? 'verified' : 'pending'}`}>
                    {statusMeta.label}
                  </span>
                </div>
              </div>

              <div className="severity-trust-block">
                <div
                  className="severity-indicator"
                  style={{
                    background: `${getSeverityColor(incident.severity)}15`,
                    borderColor: getSeverityColor(incident.severity),
                  }}
                >
                  <span className="severity-dot" style={{ background: getSeverityColor(incident.severity) }}></span>
                  <span className="severity-label" style={{ color: getSeverityColor(incident.severity) }}>
                    {getSeverityLabel(incident.severity)}
                  </span>
                </div>

                <div className="trust-indicators">
                  <div className="trust-item">
                    <span className="trust-text">Reported by {incident.reporterName}</span>
                  </div>
                  <div className="trust-item">
                    <span className="trust-text">Current status: {statusMeta.label}</span>
                  </div>
                  <div className="trust-item ai">
                    <span className="trust-text">Last updated {formatTimeAgo(incident.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="incident-description">
                <h2 className="section-title">Description</h2>
                <div className={`description-text ${showFullDescription ? 'expanded' : ''}`}>
                  {showFullDescription ? incident.description : incident.description.split('\n\n')[0]}
                </div>
                {incident.description.split('\n\n').length > 1 && (
                  <button className="show-more-btn" onClick={() => setShowFullDescription(!showFullDescription)}>
                    {showFullDescription ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>

              {incident.media.length > 0 && (
                <div className="incident-media">
                  <h2 className="section-title">Photos</h2>
                  <div className="media-grid">
                    {incident.media.map((media, index) => (
                      <div key={media.id || index} className="media-item">
                        {media.url ? (
                          <>
                            <button
                              type="button"
                              className="media-open-btn"
                              onClick={() => {
                                setSelectedMediaIndex(index)
                                setZoomScale(1)
                              }}
                              aria-label="Open photo"
                            >
                              <img className="media-image" src={media.url} alt={media.caption || 'Report image'} loading="lazy" />
                            </button>
                            <span className="media-caption-badge">{media.caption}</span>
                          </>
                        ) : (
                          <div className="media-placeholder">
                            <span>IMG</span>
                            <span className="media-caption">{media.caption}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="incident-timeline">
                <h2 className="section-title">Timeline</h2>
                <div className="timeline-list">
                  {incident.timeline.map((event, index) => (
                    <div key={`${event.time}-${index}`} className="timeline-item">
                      <div className="timeline-marker">
                        <span className="timeline-icon">{getSourceIcon(event.source)}</span>
                        {index < incident.timeline.length - 1 && <div className="timeline-line"></div>}
                      </div>
                      <div className="timeline-content">
                        <span className="timeline-time">{event.time}</span>
                        <span className="timeline-text">{event.text}</span>
                        <span className={`timeline-source ${event.source}`}>
                          {event.sourceLabel || (event.source === 'user' ? 'Citizen' : event.source === 'authority' ? 'Authority' : 'System')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="community-signals">
                <h2 className="section-title">Community Signals</h2>
                <div className="signals-row">
                  <div className="signal-item">
                    <span className="signal-count">{incident.confirmations}</span>
                    <span className="signal-label">Confirmations</span>
                  </div>
                  <div className="signal-item">
                    <span className="signal-count">{incident.comments}</span>
                    <span className="signal-label">Comments</span>
                  </div>
                  <button className="signal-action-btn" disabled={isRealReport}>
                    {isRealReport ? 'Available after publication' : 'I confirm'}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        <aside className="incident-sidebar-right">
          <div className="context-card mini-map-card">
            <h3 className="context-title">Location</h3>
            <div className="mini-map-container">
              {hasMapLocation ? (
                <MapContainer center={mapCenter} zoom={14} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false} dragging={true} zoomControl={false}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <CircleMarker
                    center={mapCenter}
                    radius={8}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: getSeverityColor(incident.severity),
                      fillOpacity: 1,
                    }}
                  />
                </MapContainer>
              ) : (
                <div className="mini-map-empty">
                  <span className="map-empty-icon" aria-hidden="true">{renderNavIcon('map')}</span>
                  <span>No location coordinates available</span>
                </div>
              )}
            </div>
            <div className="map-location-text">
              <span className="location-city">{incident.locationLabel}</span>
              {incident.location?.lat != null && incident.location?.lng != null && (
                <span className="location-road">
                  {incident.location.lat.toFixed(5)}, {incident.location.lng.toFixed(5)}
                </span>
              )}
            </div>
            <button className="open-map-btn" onClick={() => navigate('/map')}>
              Open full map
            </button>
          </div>

          <div className="context-card safety-card">
            <h3 className="context-title">Recommendations</h3>
            <div className="safety-alert">
              <span className="safety-text">{incident.status === 'rejected' ? 'Treat with caution' : 'Monitor this area'}</span>
            </div>
            <div className="delay-estimate">
              <span className="delay-text">Estimated delay: <strong>{incident.estimatedDelay}</strong></span>
            </div>
            <div className="alternative-routes">
              <span className="alt-label">Alternative routes:</span>
              <ul className="alt-list">
                {incident.alternativeRoutes.map((route, index) => (
                  <li key={index} className="alt-item">
                    <span className="alt-arrow">-&gt;</span>
                    {route}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="context-card actions-card">
            <h3 className="context-title">Actions</h3>
            <button className={`action-btn follow-btn ${isFollowing ? 'following' : ''}`} onClick={() => setIsFollowing(!isFollowing)}>
              {isFollowing ? 'Following' : 'Follow this incident'}
            </button>
            <button className="action-btn alert-btn" onClick={() => navigate('/alerts/create')}>
              Create zone alert
            </button>
            <button className="action-btn report-btn" onClick={() => navigate('/report')}>
              Report an update
            </button>

            {canManageReport && !isEditing && (
              <div className="owner-tools">
                <button className="action-btn follow-btn" onClick={handleStartEdit}>
                  Edit report
                </button>
                <button className="action-btn delete-report-btn" onClick={handleDeleteReport} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete report'}
                </button>
              </div>
            )}

            {canManageReport && isEditing && editForm && (
              <div className="manage-form">
                <label className="manage-form-label">
                  Title
                  <input className="manage-form-input" value={editForm.title} onChange={(event) => handleEditField('title', event.target.value)} />
                </label>

                <label className="manage-form-label">
                  Type
                  <select className="manage-form-input" value={editForm.incidentType} onChange={(event) => handleEditField('incidentType', event.target.value)}>
                    {Object.entries(INCIDENT_TYPE_META).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </label>

                <label className="manage-form-label">
                  Severity
                  <select className="manage-form-input" value={editForm.severity} onChange={(event) => handleEditField('severity', event.target.value)}>
                    {severityOptions.map((severity) => (
                      <option key={severity} value={severity}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</option>
                    ))}
                  </select>
                </label>

                {isAdmin && (
                  <label className="manage-form-label">
                    Status
                    <select className="manage-form-input" value={editForm.status} onChange={(event) => handleEditField('status', event.target.value)}>
                      {Object.entries(STATUS_META).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="manage-form-label">
                  Location label
                  <input className="manage-form-input" value={editForm.locationLabel} onChange={(event) => handleEditField('locationLabel', event.target.value)} />
                </label>

                <div className="manage-form-grid">
                  <label className="manage-form-label">
                    Latitude
                    <input type="number" step="any" className="manage-form-input" value={editForm.lat} onChange={(event) => handleEditField('lat', event.target.value)} />
                  </label>
                  <label className="manage-form-label">
                    Longitude
                    <input type="number" step="any" className="manage-form-input" value={editForm.lng} onChange={(event) => handleEditField('lng', event.target.value)} />
                  </label>
                </div>

                <label className="manage-form-label">
                  Occurred at
                  <input type="datetime-local" className="manage-form-input" value={editForm.occurredAt} onChange={(event) => handleEditField('occurredAt', event.target.value)} />
                </label>

                <label className="manage-form-label">
                  Description
                  <textarea className="manage-form-input manage-form-textarea" value={editForm.description} onChange={(event) => handleEditField('description', event.target.value)} />
                </label>

                <p className="manage-form-note">Media is preserved with the report, but media editing from this page is not available yet.</p>

                {saveError && <p className="manage-form-error">{saveError}</p>}

                <div className="manage-form-actions">
                  <button className="action-btn report-btn" onClick={handleSaveReport} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button className="action-btn follow-btn" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="context-card metadata-card">
            <h3 className="context-title">Metadata</h3>
            <div className="metadata-list">
              <div className="metadata-item">
                <span className="metadata-label">Incident ID</span>
                <span className="metadata-value">#{incident.id}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Reporter</span>
                <span className="metadata-value">{incident.reporterName}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Status</span>
                <span className="metadata-value">{statusMeta.label}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Sources</span>
                <span className="metadata-value">{incident.sourceCount} report(s)</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Categories</span>
                <div className="metadata-tags">
                  {incident.tags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="metadata-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Last Updated</span>
                <span className="metadata-value">{formatClock(incident.updatedAt)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {activeMedia && createPortal(
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setSelectedMediaIndex(null)}>
          <div className="media-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="media-lightbox-toolbar">
              <button type="button" className="media-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <button type="button" className="media-zoom-btn reset" onClick={zoomReset} aria-label="Reset zoom">
                {Math.round(zoomScale * 100)}%
              </button>
              <button type="button" className="media-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>

            <button type="button" className="media-lightbox-close" onClick={() => setSelectedMediaIndex(null)} aria-label="Close photo preview">
              ×
            </button>

            <div
              className={`media-lightbox-stage ${zoomScale > 1 ? 'zoomed' : ''} ${isDragging ? 'dragging' : ''}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedMediaIndex(null)
                }
              }}
              onWheel={handleLightboxWheel}
              onDoubleClick={handleLightboxDoubleClick}
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
                className="media-lightbox-image"
                src={activeMedia.url}
                alt={activeMedia.caption || 'Report image'}
                style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})` }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
