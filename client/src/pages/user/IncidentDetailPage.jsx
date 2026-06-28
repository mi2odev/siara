import React, { useState, useContext, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FancySelect from '../../components/ui/FancySelect'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined'
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import NotificationBell from '../../components/notifications/NotificationBell'
import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import { Link } from 'react-router-dom'
import {
  deleteReport,
  getReport,
  getReportThread,
  updateReport,
} from '../../services/reportsService'
import ReportCredibilityBadge from '../../components/reports/ReportCredibilityBadge'
import '../../styles/IncidentDetailPage.css'
import '../../styles/NewsPage.css'
import '../../styles/AlertsPage.css'
import '../../styles/DashboardPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'

const REPORT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getIncidentTypeMeta(type, t) {
  const INCIDENT_TYPE_META = {
    accident: { label: t('incidentDetailPage.types.accident'), icon: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" /> },
    traffic: { label: t('incidentDetailPage.types.traffic'), icon: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    danger: { label: t('incidentDetailPage.types.danger'), icon: <WarningAmberOutlinedIcon fontSize="inherit" className="icon-fire" /> },
    weather: { label: t('incidentDetailPage.types.weather'), icon: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" /> },
    roadworks: { label: t('incidentDetailPage.types.roadworks'), icon: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    other: { label: t('incidentDetailPage.types.other'), icon: <LocationOnOutlinedIcon fontSize="inherit" className="icon-muted" /> },
  }
  return INCIDENT_TYPE_META[type] || { label: t('incidentDetailPage.types.incident'), icon: <LocationOnOutlinedIcon fontSize="inherit" /> }
}

function getStatusMeta(t) {
  return {
    pending: { label: t('incidentDetailPage.status.pending'), icon: t('incidentDetailPage.status.pending') },
    verified: { label: t('incidentDetailPage.status.verified'), icon: t('incidentDetailPage.status.verified') },
    rejected: { label: t('incidentDetailPage.status.rejected'), icon: t('incidentDetailPage.status.rejected') },
    resolved: { label: t('incidentDetailPage.status.resolved'), icon: t('incidentDetailPage.status.resolved') },
  }
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

function getSeverityLabel(severity, t) {
  switch (severity) {
    case 'high': return t('incidentDetailPage.severity.high')
    case 'medium': return t('incidentDetailPage.severity.medium')
    case 'low': return t('incidentDetailPage.severity.low')
    default: return t('incidentDetailPage.severity.unknown')
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
  if (type === 'feed') return <ArticleOutlinedIcon fontSize="inherit" />
  if (type === 'map') return <MapOutlinedIcon fontSize="inherit" />
  if (type === 'alerts') return <NotificationsActiveOutlinedIcon fontSize="inherit" />
  return <PersonOutlinedIcon fontSize="inherit" />
}

function formatTimeAgo(value, t) {
  if (!value) return t('incidentDetailPage.timeAgo.unknown')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('incidentDetailPage.timeAgo.unknown')

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return t('incidentDetailPage.timeAgo.justNow')
  if (diffMinutes < 60) return t('incidentDetailPage.timeAgo.minutesAgo', { count: diffMinutes })

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return t('incidentDetailPage.timeAgo.hoursAgo', { count: diffHours })

  const diffDays = Math.round(diffHours / 24)
  return t('incidentDetailPage.timeAgo.daysAgo', { count: diffDays })
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

function formatReporterDisplayName(name, t) {
  if (typeof name !== 'string' || !name.trim()) return t('incidentDetailPage.timeline.anonymousUser')

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

function buildTimelineFromReport(report, viewerUser = null, t) {
  const reporter = report?.reportedBy || report?.reported_by || null
  const reporterName = formatReporterDisplayName(reporter?.name || report?.authorName || '', t)
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
    ? t('incidentDetailPage.timeline.administrator')
    : isPoliceReporter
      ? t('incidentDetailPage.timeline.policeOfficer')
      : t('incidentDetailPage.timeline.citizenReporter')

  const timeline = [
    {
      time: formatClock(report.createdAt),
      source: isPoliceReporter || isAdminReporter ? 'authority' : 'user',
      sourceLabel: submitterLabel,
      text: t('incidentDetailPage.timeline.reportSubmittedBy', { name: reporterName }),
    },
  ]

  if (report.updatedAt && report.updatedAt !== report.createdAt) {
    timeline.push({
      time: formatClock(report.updatedAt),
      source: 'system',
      sourceLabel: t('incidentDetailPage.timeline.system'),
      text: t('incidentDetailPage.timeline.reportDetailsUpdated'),
    })
  }

  if (report.status && report.status !== 'pending') {
    const STATUS_META_LOCAL = getStatusMeta(t)
    const statusLabel = STATUS_META_LOCAL[report.status]?.label || report.status
    timeline.push({
      time: formatClock(report.updatedAt || report.createdAt),
      source: 'authority',
      sourceLabel: t('incidentDetailPage.timeline.authority'),
      text: t('incidentDetailPage.timeline.statusUpdatedTo', { status: statusLabel }),
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

function buildDisplayIncident(report, id, viewerUser = null, t) {
  if (!report) {
    return { ...mockIncident, id: id || mockIncident.id }
  }

  return {
    id: report.id,
    type: report.incidentType,
    title: report.title,
    description: report.description || t('incidentDetailPage.noDescription'),
    severity: report.severity || 'medium',
    locationLabel: report.locationLabel || t('incidentDetailPage.reportedLocation'),
    location: report.location,
    reportedAt: report.createdAt,
    updatedAt: report.updatedAt,
    status: report.status || 'pending',
    reporterName: report.reportedBy?.name || t('incidentDetailPage.citizen'),
    media: Array.isArray(report.media)
      ? report.media.map((media) => ({
          id: media.id,
          url: media.url,
          caption: media.mediaType === 'image' ? t('incidentDetailPage.reportImage') : media.mediaType || t('incidentDetailPage.reportMedia'),
          uploadedAt: media.uploadedAt,
        }))
      : [],
    timeline: buildTimelineFromReport(report, viewerUser, t),
    confirmations: 0,
    comments: 0,
    estimatedDelay: t('incidentDetailPage.timeAgo.unknown'),
    alternativeRoutes: [t('incidentDetailPage.checkLiveMap')],
    tags: [report.incidentType, report.severity, report.status].filter(Boolean),
    sourceCount: 1,
  }
}

export default function IncidentDetailPage() {
  const { t } = useTranslation(['reports', 'common'])
  const navigate = useNavigate()
  const { id } = useParams()
  const { user, logout } = useContext(AuthContext)

  const [showDropdown, setShowDropdown] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [report, setReport] = useState(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [thread, setThread] = useState(null)
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
  const incident = buildDisplayIncident(report, id, user, t)

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
        setReportError(error.message || t('incidentDetailPage.errors.failedToLoad'))
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
    if (!isRealReport) {
      setThread(null)
      return undefined
    }
    let cancelled = false
    getReportThread(id)
      .then((data) => {
        if (cancelled) return
        if (data && data.threadId && Array.isArray(data.members) && data.members.length > 1) {
          setThread(data)
        } else {
          setThread(null)
        }
      })
      .catch(() => {
        if (!cancelled) setThread(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, isRealReport])

  useEffect(() => {
    if (selectedMediaIndex == null) return () => {}

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedMediaIndex(null)
      }

      if (event.key === 'ArrowRight' && incident.media.length > 1) {
        setZoomScale(1)
        setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % incident.media.length))
      }

      if (event.key === 'ArrowLeft' && incident.media.length > 1) {
        setZoomScale(1)
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

  const typeMeta = getIncidentTypeMeta(incident.type, t)
  const STATUS_META = getStatusMeta(t)
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
  const userAvatarUrl = getUserAvatarUrl(user)
  const userInitials = getInitialsFromName(profileName)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
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
      setSaveError(t('incidentDetailPage.errors.titleTooShort'))
      return
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setSaveError(t('incidentDetailPage.errors.invalidLatitude'))
      return
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setSaveError(t('incidentDetailPage.errors.invalidLongitude'))
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
      setSaveError(error.message || t('incidentDetailPage.errors.failedToUpdate'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteReport = async () => {
    if (!report || isDeleting) return

    const confirmed = window.confirm(t('incidentDetailPage.confirmDelete'))
    if (!confirmed) return

    setIsDeleting(true)
    setSaveError('')

    try {
      await deleteReport(report.id)
      navigate('/news')
    } catch (error) {
      setSaveError(error.message || t('incidentDetailPage.errors.failedToDelete'))
      setIsDeleting(false)
    }
  }

  return (
    <div className="incident-detail-page">
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>{t('incidentDetailPage.nav.feed')}</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>{t('common:nav.map')}</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('incidentDetailPage.nav.report')}</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>{t('incidentDetailPage.nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('incidentDetailPage.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <button className="dash-icon-btn" aria-label={t('incidentDetailPage.ariaLabels.messages')}>{renderHeaderIcon('message')}</button>
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('incidentDetailPage.ariaLabels.userProfile')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('incidentDetailPage.ariaLabels.userAvatar')} className="dash-avatar-image" loading="lazy" />
                ) : userInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>{t('incidentDetailPage.dropdown.myProfile')}</button>
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

      <div className="incident-layout">
        <aside className="incident-sidebar-left al-left">
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatarUrl} alt={t('incidentDetailPage.ariaLabels.profile')} className="profile-avatar-large" loading="lazy" />            </div>
            <div className="profile-info">
              <p className="profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">{t('incidentDetailPage.profileBio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>{t('incidentDetailPage.viewProfile')}</button>
            </div>
          </div>

          <div className="card al-filter-section">
            <div className="nav-section-label">{t('incidentDetailPage.reportStatus')}</div>
            <nav className="al-nav">
              <button className="al-nav-btn active" type="button">
                <span className="nav-label">{t('incidentDetailPage.filter.all')}</span>
                <span className="nav-count">{leftStats.all}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'pending' ? 'active' : ''}`} type="button">
                <span className="nav-label">{t('incidentDetailPage.status.pending')}</span>
                <span className="nav-count">{leftStats.pending}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'verified' ? 'active' : ''}`} type="button">
                <span className="nav-label">{t('incidentDetailPage.status.verified')}</span>
                <span className="nav-count">{leftStats.verified}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'resolved' ? 'active' : ''}`} type="button">
                <span className="nav-label">{t('incidentDetailPage.status.resolved')}</span>
                <span className="nav-count">{leftStats.resolved}</span>
              </button>
              <button className={`al-nav-btn ${incident.status === 'rejected' ? 'active' : ''}`} type="button">
                <span className="nav-label">{t('incidentDetailPage.status.rejected')}</span>
                <span className="nav-count">{leftStats.rejected}</span>
              </button>
            </nav>
          </div>

          <FeedSidebarNav activeKey="reports" />

          <button className="al-cta" onClick={() => navigate('/report/create')}>{t('incidentDetailPage.newReport')}</button>
        </aside>

        <main className="incident-main">
          {isLoadingReport && (
            <div className="incident-header-block">
              <h1 className="incident-title">{t('incidentDetailPage.loadingReport')}</h1>
            </div>
          )}

          {reportError && (
            <div className="incident-header-block">
              <h1 className="incident-title">{t('incidentDetailPage.reportUnavailable')}</h1>
              <p>{reportError}</p>
            </div>
          )}

          {!isLoadingReport && !reportError && (
            <>
              <div className={`incident-header-block idp-sev-${incident.severity}`}>
                <div className="idp-chips-row">
                  <div className="incident-type-badge">
                    <span className="incident-type-icon">{typeMeta.icon}</span>
                    <span className="incident-type-label">{typeMeta.label}</span>
                  </div>
                  <span className={`meta-verified ${incident.status === 'verified' || incident.status === 'resolved' ? 'verified' : 'pending'}`}>
                    {statusMeta.label}
                  </span>
                  <ReportCredibilityBadge report={incident} />
                </div>
                <h1 className="incident-title">{incident.title}</h1>
                <div className="incident-meta-row">
                  <span className="idp-meta-icon" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5" strokeLinecap="round"/></svg>
                  </span>
                  <span className="meta-time">{formatTimeAgo(incident.reportedAt, t)}</span>
                  <span className="meta-separator">·</span>
                  <span className="idp-meta-icon" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z"/><circle cx="8" cy="6" r="1.6"/></svg>
                  </span>
                  <span className="meta-location">{incident.locationLabel}</span>
                </div>
              </div>

              <div className="idp-info-strip">
                <div
                  className="severity-indicator"
                  style={{ background: `${getSeverityColor(incident.severity)}14`, borderColor: getSeverityColor(incident.severity) }}
                >
                  <span className="severity-dot" style={{ background: getSeverityColor(incident.severity) }}></span>
                  <span className="severity-label" style={{ color: getSeverityColor(incident.severity) }}>{getSeverityLabel(incident.severity, t)}</span>
                </div>
                <div className="idp-strip-meta">
                  <span className="idp-strip-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c.8-3.2 3.9-5.5 8-5.5s7.2 2.3 8 5.5" strokeLinecap="round"/></svg>
                    {t('incidentDetailPage.reportedBy')} <strong>{incident.reporterName}</strong>
                  </span>
                  <span className="idp-strip-sep">·</span>
                  <span className="idp-strip-item">{t('incidentDetailPage.statusLabel')} <strong>{statusMeta.label}</strong></span>
                  <span className="idp-strip-sep">·</span>
                  <span className="idp-strip-item">{t('incidentDetailPage.updatedLabel')} <strong>{formatTimeAgo(incident.updatedAt, t)}</strong></span>
                </div>
              </div>

              {thread && Array.isArray(thread.members) && thread.members.length > 1 ? (
                <div className="incident-description" style={{ marginBottom: 12 }}>
                  <h2 className="section-title">
                    {t('incidentDetailPage.mergedReports.title', { count: thread.members.length })}
                  </h2>
                  <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 10px' }}>
                    {t('incidentDetailPage.mergedReports.description', { count: thread.members.length })}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {thread.members.map((m) => {
                      const isCurrent = m.reportId === id
                      const isPrimary = m.role === 'primary'
                      const rowInner = (
                        <>
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: isPrimary ? '#EEF2FF' : '#F1F5F9',
                              color: isPrimary ? '#4338CA' : '#64748B',
                            }}
                          >
                            {isPrimary ? t('incidentDetailPage.mergedReports.original') : t('incidentDetailPage.mergedReports.merged')}
                          </span>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.title || `Report #${String(m.reportId).slice(0, 8)}`}
                          </span>
                          {isCurrent ? (
                            <span style={{ color: '#4338CA', fontWeight: 600 }}>{t('incidentDetailPage.mergedReports.thisReport')}</span>
                          ) : null}
                          {m.verifiedByPolice ? (
                            <span style={{ color: '#1E40AF' }}>{t('incidentDetailPage.mergedReports.policeVerified')}</span>
                          ) : null}
                          <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#94A3B8' }}>
                            {formatTimeAgo(m.createdAt, t)}
                          </span>
                        </>
                      )
                      const rowStyle = {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        textDecoration: 'none',
                        color: '#0F172A',
                        fontSize: 12,
                        background: isCurrent ? '#F8FAFF' : '#FFFFFF',
                      }
                      return (
                        <li key={`thread-${m.reportId}`}>
                          {isCurrent ? (
                            <div style={rowStyle}>{rowInner}</div>
                          ) : (
                            <Link to={`/incident/${m.reportId}`} style={rowStyle}>
                              {rowInner}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}

              <div className="incident-description">
                <h2 className="section-title">{t('incidentDetailPage.sections.description')}</h2>
                <div className={`description-text ${showFullDescription ? 'expanded' : ''}`}>
                  {showFullDescription ? incident.description : incident.description.split('\n\n')[0]}
                </div>
                {incident.description.split('\n\n').length > 1 && (
                  <button className="show-more-btn" onClick={() => setShowFullDescription(!showFullDescription)}>
                    {showFullDescription ? t('incidentDetailPage.showLess') : t('incidentDetailPage.showMore')}
                  </button>
                )}
              </div>

              {incident.media.length > 0 && (
                <div className="incident-media">
                  <h2 className="section-title">{t('incidentDetailPage.sections.photos')}</h2>
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
                              aria-label={t('incidentDetailPage.ariaLabels.openPhoto')}
                            >
                              <img className="media-image" src={media.url} alt={media.caption || t('incidentDetailPage.reportImage')} loading="lazy" />
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
                <h2 className="section-title">{t('incidentDetailPage.sections.timeline')}</h2>
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
                          {event.sourceLabel || (event.source === 'user' ? t('incidentDetailPage.timeline.citizen') : event.source === 'authority' ? t('incidentDetailPage.timeline.authority') : t('incidentDetailPage.timeline.system'))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="community-signals">
                <h2 className="section-title">{t('incidentDetailPage.sections.communitySignals')}</h2>
                <div className="signals-row">
                  <div className="signal-item">
                    <span className="signal-count">{incident.confirmations}</span>
                    <span className="signal-label">{t('incidentDetailPage.signals.confirmations')}</span>
                  </div>
                  <div className="signal-item">
                    <span className="signal-count">{incident.comments}</span>
                    <span className="signal-label">{t('incidentDetailPage.signals.comments')}</span>
                  </div>
                  <button className="signal-action-btn" disabled={isRealReport}>
                    {isRealReport ? t('incidentDetailPage.signals.availableAfterPublication') : t('incidentDetailPage.signals.iConfirm')}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        <aside className="incident-sidebar-right">
          <div className="context-card mini-map-card">
            <h3 className="context-title">{t('incidentDetailPage.sections.location')}</h3>
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
                  <span>{t('incidentDetailPage.noLocationCoordinates')}</span>
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
              {t('incidentDetailPage.openFullMap')}
            </button>
          </div>

          <div className="context-card safety-card">
            <h3 className="context-title">{t('incidentDetailPage.sections.recommendations')}</h3>
            <div className="safety-alert">
              <span className="safety-text">{incident.status === 'rejected' ? t('incidentDetailPage.safety.treatWithCaution') : t('incidentDetailPage.safety.monitorArea')}</span>
            </div>
            <div className="delay-estimate">
              <span className="delay-text">{t('incidentDetailPage.safety.estimatedDelay')} <strong>{incident.estimatedDelay}</strong></span>
            </div>
            <div className="alternative-routes">
              <span className="alt-label">{t('incidentDetailPage.safety.alternativeRoutes')}</span>
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
            <h3 className="context-title">{t('incidentDetailPage.sections.actions')}</h3>
            <button className={`action-btn follow-btn ${isFollowing ? 'following' : ''}`} onClick={() => setIsFollowing(!isFollowing)}>
              {isFollowing ? t('incidentDetailPage.actions.following') : t('incidentDetailPage.actions.followIncident')}
            </button>
            <button className="action-btn alert-btn" onClick={() => navigate('/alerts/create')}>
              {t('incidentDetailPage.actions.createZoneAlert')}
            </button>
            <button className="action-btn report-btn" onClick={() => navigate('/report')}>
              {t('incidentDetailPage.actions.reportUpdate')}
            </button>

            {canManageReport && !isEditing && (
              <div className="owner-tools">
                <button className="action-btn follow-btn" onClick={handleStartEdit}>
                  {t('incidentDetailPage.actions.editReport')}
                </button>
                <button className="action-btn delete-report-btn" onClick={handleDeleteReport} disabled={isDeleting}>
                  {isDeleting ? t('incidentDetailPage.actions.deleting') : t('incidentDetailPage.actions.deleteReport')}
                </button>
              </div>
            )}

            {canManageReport && isEditing && editForm && (
              <div className="manage-form">
                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.title')}
                  <input className="manage-form-input" value={editForm.title} onChange={(event) => handleEditField('title', event.target.value)} />
                </label>

                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.type')}
                  <FancySelect
                    value={editForm.incidentType}
                    onChange={(value) => handleEditField('incidentType', value)}
                    menuAlign="left"
                    options={Object.entries({
                      accident: t('incidentDetailPage.types.accident'),
                      traffic: t('incidentDetailPage.types.traffic'),
                      danger: t('incidentDetailPage.types.danger'),
                      weather: t('incidentDetailPage.types.weather'),
                      roadworks: t('incidentDetailPage.types.roadworks'),
                      other: t('incidentDetailPage.types.other'),
                    }).map(([key, label]) => ({
                      value: key,
                      label,
                    }))}
                  />
                </label>

                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.severity')}
                  <FancySelect
                    value={editForm.severity}
                    onChange={(value) => handleEditField('severity', value)}
                    menuAlign="left"
                    options={severityOptions.map((s) => ({
                      value: s,
                      label: s.charAt(0).toUpperCase() + s.slice(1),
                    }))}
                  />
                </label>

                {isAdmin && (
                  <label className="manage-form-label">
                    {t('incidentDetailPage.editForm.status')}
                    <FancySelect
                      value={editForm.status}
                      onChange={(value) => handleEditField('status', value)}
                      menuAlign="left"
                      options={Object.entries(getStatusMeta(t)).map(([key, meta]) => ({
                        value: key,
                        label: meta.label,
                      }))}
                    />
                  </label>
                )}

                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.locationLabel')}
                  <input className="manage-form-input" value={editForm.locationLabel} onChange={(event) => handleEditField('locationLabel', event.target.value)} />
                </label>

                <div className="manage-form-grid">
                  <label className="manage-form-label">
                    {t('incidentDetailPage.editForm.latitude')}
                    <input type="number" step="any" className="manage-form-input" value={editForm.lat} onChange={(event) => handleEditField('lat', event.target.value)} />
                  </label>
                  <label className="manage-form-label">
                    {t('incidentDetailPage.editForm.longitude')}
                    <input type="number" step="any" className="manage-form-input" value={editForm.lng} onChange={(event) => handleEditField('lng', event.target.value)} />
                  </label>
                </div>

                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.occurredAt')}
                  <input type="datetime-local" className="manage-form-input" value={editForm.occurredAt} onChange={(event) => handleEditField('occurredAt', event.target.value)} />
                </label>

                <label className="manage-form-label">
                  {t('incidentDetailPage.editForm.description')}
                  <textarea className="manage-form-input manage-form-textarea" value={editForm.description} onChange={(event) => handleEditField('description', event.target.value)} />
                </label>

                <p className="manage-form-note">{t('incidentDetailPage.editForm.mediaNote')}</p>

                {saveError && <p className="manage-form-error">{saveError}</p>}

                <div className="manage-form-actions">
                  <button className="action-btn report-btn" onClick={handleSaveReport} disabled={isSaving}>
                    {isSaving ? t('incidentDetailPage.actions.saving') : t('incidentDetailPage.actions.saveChanges')}
                  </button>
                  <button className="action-btn follow-btn" onClick={handleCancelEdit} disabled={isSaving}>
                    {t('common:actions.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="context-card metadata-card">
            <h3 className="context-title">{t('incidentDetailPage.sections.metadata')}</h3>
            <div className="metadata-list">
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.incidentId')}</span>
                <span className="metadata-value">#{incident.id}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.reporter')}</span>
                <span className="metadata-value">{incident.reporterName}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.status')}</span>
                <span className="metadata-value">{statusMeta.label}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.sources')}</span>
                <span className="metadata-value">{t('incidentDetailPage.metadata.sourceCount', { count: incident.sourceCount })}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.categories')}</span>
                <div className="metadata-tags">
                  {incident.tags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="metadata-tag">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">{t('incidentDetailPage.metadata.lastUpdated')}</span>
                <span className="metadata-value">{formatClock(incident.updatedAt)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {activeMedia && createPortal(
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={t('incidentDetailPage.ariaLabels.photoPreview')} onClick={() => setSelectedMediaIndex(null)}>
          <div className="media-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="media-lightbox-toolbar">
              <button type="button" className="media-zoom-btn" onClick={zoomOut} aria-label={t('incidentDetailPage.ariaLabels.zoomOut')}>−</button>
              <button type="button" className="media-zoom-btn reset" onClick={zoomReset} aria-label={t('incidentDetailPage.ariaLabels.resetZoom')}>
                {Math.round(zoomScale * 100)}%
              </button>
              <button type="button" className="media-zoom-btn" onClick={zoomIn} aria-label={t('incidentDetailPage.ariaLabels.zoomIn')}>+</button>
            </div>

            <button type="button" className="media-lightbox-close" onClick={() => setSelectedMediaIndex(null)} aria-label={t('incidentDetailPage.ariaLabels.closePhotoPreview')}>
              ×
            </button>

            {incident.media.length > 1 && (
              <>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-nav--prev"
                  onClick={(event) => {
                    event.stopPropagation()
                    setZoomScale(1)
                    setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev - 1 + incident.media.length) % incident.media.length))
                  }}
                  aria-label={t('incidentDetailPage.ariaLabels.previousPhoto')}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="media-lightbox-nav media-lightbox-nav--next"
                  onClick={(event) => {
                    event.stopPropagation()
                    setZoomScale(1)
                    setSelectedMediaIndex((prev) => (prev == null ? 0 : (prev + 1) % incident.media.length))
                  }}
                  aria-label={t('incidentDetailPage.ariaLabels.nextPhoto')}
                >
                  ›
                </button>
                <span className="media-lightbox-counter">
                  {selectedMediaIndex + 1} / {incident.media.length}
                </span>
              </>
            )}

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
                alt={activeMedia.caption || t('incidentDetailPage.reportImage')}
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
