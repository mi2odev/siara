/**
 * @file AdminIncidentReviewPage.jsx
 * @description Admin page for reviewing a single incident report in a 3-column split layout.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'

import { useTranslation } from 'react-i18next'

import {
  fetchAdminIncident,
  fetchAdminIncidents,
  submitAdminIncidentAction,
} from '../../services/adminIncidentsService'
import { normalizeAvatarUrl } from '../../utils/avatarUtils'
import '../../styles/Lightbox.css'

/** Marker fill color keyed by severity tier — matches admin pills. */
function severityMarkerColor(severity) {
  switch (String(severity || '').toLowerCase()) {
    case 'high': return '#ef4444'
    case 'medium': return '#f59e0b'
    case 'low': return '#22c55e'
    default: return '#7c3aed'
  }
}

function clampLightboxScale(value) {
  return Math.min(4, Math.max(0.25, value))
}

const EMPTY_TEXT = '\u2014'

function formatIncidentType(value) {
  return String(value || 'other')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatDateTime(value) {
  if (!value) {
    return EMPTY_TEXT
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return EMPTY_TEXT
  }

  return date.toLocaleString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateOnly(value) {
  if (!value) {
    return EMPTY_TEXT
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return EMPTY_TEXT
  }

  return date.toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDistance(distanceKm) {
  return typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km` : EMPTY_TEXT
}

function formatPercent(value, digits = 2) {
  return typeof value === 'number' ? `${value.toFixed(digits)}%` : EMPTY_TEXT
}

function formatMlStatus(value, t) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return t('adminIncidentReviewPage.mlStatus.notStarted')
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatPredictedLabel(value, t) {
  if (!value) {
    return t('adminIncidentReviewPage.predictedLabel.unclassified')
  }

  return value === 'spam'
    ? t('adminIncidentReviewPage.predictedLabel.spam')
    : t('adminIncidentReviewPage.predictedLabel.real')
}

function getConfidenceFillClass(confidence) {
  if (typeof confidence !== 'number') {
    return ''
  }

  if (confidence >= 85) {
    return 'success'
  }

  if (confidence >= 65) {
    return 'warning'
  }

  return 'danger'
}

function getConfidenceLabel(incident, t) {
  if (typeof incident?.aiAssessment?.confidence === 'number' && incident.aiAssessment.status === 'completed') {
    return `${incident.aiAssessment.confidence}%`
  }

  if (incident?.aiAssessment?.status === 'pending') {
    return t('adminIncidentReviewPage.aiAssessment.pendingAi')
  }

  if (incident?.aiAssessment?.status === 'failed') {
    return t('adminIncidentReviewPage.aiAssessment.aiFailed')
  }

  return EMPTY_TEXT
}

function getAssessmentStatusLabel(status, t) {
  if (status === 'completed') return t('adminIncidentReviewPage.aiAssessment.statusCompleted')
  if (status === 'pending') return t('adminIncidentReviewPage.aiAssessment.statusPending')
  if (status === 'failed') return t('adminIncidentReviewPage.aiAssessment.statusFailed')
  return t('adminIncidentReviewPage.aiAssessment.statusNotAvailable')
}

function getDecisionAction(decision) {
  switch (decision) {
    case 'approve':
      return 'verify'
    case 'change':
      return 'change_severity'
    case 'info':
      return 'request_info'
    case 'flag':
      return 'flag'
    case 'reject':
      return 'reject'
    case 'archive':
      return 'archive'
    case 'unarchive':
      return 'unarchive'
    default:
      return null
  }
}

/* Decision tiles displayed in the action grid. Order is intentional:
 *  - Confirm path  (approve, change severity)
 *  - Investigate   (request info, flag)
 *  - Reject path   (archive, reject)
 * Note: duplicate merging is fully automatic (same place / 6 h), so there is
 * no manual "Merge with Cluster" action here.
 */
function getDecisionTiles(t) {
  return [
    { key: 'approve', label: t('adminIncidentReviewPage.decisionTiles.approve.label'),         hint: t('adminIncidentReviewPage.decisionTiles.approve.hint'),         tone: 'success'  },
    { key: 'change',  label: t('adminIncidentReviewPage.decisionTiles.change.label'),           hint: t('adminIncidentReviewPage.decisionTiles.change.hint'),           tone: 'primary'  },
    { key: 'info',    label: t('adminIncidentReviewPage.decisionTiles.info.label'),             hint: t('adminIncidentReviewPage.decisionTiles.info.hint'),             tone: 'info'     },
    { key: 'flag',    label: t('adminIncidentReviewPage.decisionTiles.flag.label'),             hint: t('adminIncidentReviewPage.decisionTiles.flag.hint'),             tone: 'warning'  },
    { key: 'archive', label: t('adminIncidentReviewPage.decisionTiles.archive.label'),          hint: t('adminIncidentReviewPage.decisionTiles.archive.hint'),          tone: 'neutral'  },
    { key: 'reject',  label: t('adminIncidentReviewPage.decisionTiles.reject.label'),           hint: t('adminIncidentReviewPage.decisionTiles.reject.hint'),           tone: 'danger'   },
  ]
}

function getRejectReasons(t) {
  return [
    { value: 'spam',                  label: t('adminIncidentReviewPage.rejectReasons.spam') },
    { value: 'duplicate',             label: t('adminIncidentReviewPage.rejectReasons.duplicate') },
    { value: 'off_topic',             label: t('adminIncidentReviewPage.rejectReasons.offTopic') },
    { value: 'false_report',          label: t('adminIncidentReviewPage.rejectReasons.falseReport') },
    { value: 'insufficient_evidence', label: t('adminIncidentReviewPage.rejectReasons.insufficientEvidence') },
    { value: 'wrong_location',        label: t('adminIncidentReviewPage.rejectReasons.wrongLocation') },
    { value: 'other',                 label: t('adminIncidentReviewPage.rejectReasons.other') },
  ]
}

const TERMINAL_INCIDENT_STATUSES = new Set(['verified', 'rejected', 'archived', 'merged'])

/** Compute the AI-suggested decision based on the incident's signals. */
function computeAiRecommendation(incident, t) {
  if (!incident) return null
  const aiConf = typeof incident?.aiAssessment?.confidence === 'number' ? incident.aiAssessment.confidence : null
  const aiStatus = incident?.aiAssessment?.status
  const spamScore = typeof incident?.spamAnalysis?.spamScore === 'number' ? incident.spamAnalysis.spamScore : null
  const predicted = String(incident?.spamAnalysis?.predictedLabel || '').toLowerCase()

  if (predicted === 'spam' && (spamScore ?? 0) >= 60) {
    return {
      action: 'reject',
      label: t('adminIncidentReviewPage.aiRec.rejectAsSpam'),
      tone: 'danger',
      explanation: t('adminIncidentReviewPage.aiRec.spamExplanation', { score: Math.round(spamScore) }),
    }
  }
  if (aiStatus === 'completed' && (aiConf ?? 0) >= 85 && (spamScore ?? 0) < 30) {
    return {
      action: 'approve',
      label: t('adminIncidentReviewPage.aiRec.approve'),
      tone: 'success',
      explanation: t('adminIncidentReviewPage.aiRec.approveExplanation', { confidence: Math.round(aiConf) }),
    }
  }
  if (aiStatus === 'completed' && aiConf != null && aiConf >= 40 && aiConf < 85) {
    return {
      action: 'info',
      label: t('adminIncidentReviewPage.aiRec.requestMoreInfo'),
      tone: 'info',
      explanation: t('adminIncidentReviewPage.aiRec.infoExplanation', { confidence: Math.round(aiConf) }),
    }
  }
  return {
    action: null,
    label: t('adminIncidentReviewPage.aiRec.manualReviewNeeded'),
    tone: 'neutral',
    explanation: t('adminIncidentReviewPage.aiRec.manualExplanation'),
  }
}

/** Renders a single evidence thumbnail with a graceful fallback if the image
 * fails to load. Clicking opens the parent's lightbox. */
function EvidenceThumb({ src, alt, uploadedAt, onClick }) {
  const [failed, setFailed] = useState(false)
  const { t } = useTranslation(['admin'])

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 130,
        padding: 0,
        background: 'var(--admin-surface-2)',
        border: '1px solid var(--admin-border)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-1px)'
        event.currentTarget.style.borderColor = 'var(--admin-primary)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)'
        event.currentTarget.style.borderColor = 'var(--admin-border)'
      }}
    >
      <div style={{ width: '100%', height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--admin-surface-alt)' }}>
        {failed || !src ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--admin-text-muted)' }}>
            <BrokenImageOutlinedIcon fontSize="small" />
            <span style={{ fontSize: 10 }}>{t('adminIncidentReviewPage.evidence.notAvailable')}</span>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>
      <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--admin-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {uploadedAt || alt}
      </div>
    </button>
  )
}

export default function AdminIncidentReviewPage() {
  const { t } = useTranslation(['admin', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [decision, setDecision] = useState('')
  const [newSeverity, setNewSeverity] = useState('medium')
  const [actionNote, setActionNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [rejectReason, setRejectReason] = useState('spam')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [mapIncidents, setMapIncidents] = useState([])
  const [mapIncidentsLoading, setMapIncidentsLoading] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const stageRef = useRef(null)

  const totalMedia = incident?.media?.length || 0
  const activeMedia = lightboxIndex != null && incident?.media ? incident.media[lightboxIndex] : null
  const activeMediaUrl = activeMedia ? normalizeAvatarUrl(activeMedia.url) : ''

  /** Esc closes, arrow keys navigate. */
  useEffect(() => {
    if (lightboxIndex == null) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxIndex(null)
      if (event.key === 'ArrowRight' && totalMedia > 1) {
        setZoomScale(1)
        setLightboxIndex((prev) => (prev + 1) % totalMedia)
      }
      if (event.key === 'ArrowLeft' && totalMedia > 1) {
        setZoomScale(1)
        setLightboxIndex((prev) => (prev - 1 + totalMedia) % totalMedia)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxIndex, totalMedia])

  /** Lock body scroll while the lightbox is open. */
  useEffect(() => {
    if (lightboxIndex == null) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [lightboxIndex])

  /** Lock body scroll + Esc-to-close while the fullscreen map is open. */
  useEffect(() => {
    if (!isMapFullscreen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') setIsMapFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isMapFullscreen])

  /** Fetch every incident with coordinates once the fullscreen map opens. */
  useEffect(() => {
    if (!isMapFullscreen) return undefined
    if (mapIncidents.length > 0) return undefined
    const controller = new AbortController()
    setMapIncidentsLoading(true)
    fetchAdminIncidents({ filter: 'all', limit: 500 }, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return
        const withCoords = (payload.incidents || []).filter(
          (row) => row?.coordinates?.lat != null && row?.coordinates?.lng != null,
        )
        setMapIncidents(withCoords)
      })
      .catch(() => { /* leave list empty; current incident still pins */ })
      .finally(() => {
        if (!controller.signal.aborted) setMapIncidentsLoading(false)
      })
    return () => controller.abort()
  }, [isMapFullscreen, mapIncidents.length])

  /** Reset zoom and pan whenever the active image changes. */
  useEffect(() => {
    if (lightboxIndex == null) setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
    setIsDragging(false)
    dragRef.current = null
  }, [lightboxIndex])

  /** When zoom drops to 1, snap pan back to origin. */
  useEffect(() => {
    if (zoomScale <= 1) {
      setPanOffset({ x: 0, y: 0 })
      setIsDragging(false)
      dragRef.current = null
    }
  }, [zoomScale])

  /** Mouse wheel zoom on the stage. */
  useEffect(() => {
    if (!activeMedia) return undefined
    const stage = stageRef.current
    if (!stage) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaY > 0 ? -0.12 : 0.12
      setZoomScale((prev) => clampLightboxScale(prev + delta))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => { stage.removeEventListener('wheel', onWheel) }
  }, [activeMedia])

  const zoomIn = () => setZoomScale((prev) => clampLightboxScale(prev + 0.15))
  const zoomOut = () => setZoomScale((prev) => clampLightboxScale(prev - 0.15))
  const zoomReset = () => setZoomScale(1)

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

  useEffect(() => {
    const controller = new AbortController()

    async function loadIncident() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchAdminIncident(id, {
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          setIncident(payload)
          setNewSeverity(payload.severity)
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadIncident()

    return () => controller.abort()
  }, [id])

  const openFlags = useMemo(
    () => (incident?.flags || []).filter((flag) => flag.open),
    [incident],
  )

  async function handleDecisionSubmit() {
    const action = getDecisionAction(decision)
    if (!incident || !action || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await submitAdminIncidentAction(incident.reportId, {
        action,
        note: actionNote,
        severity: decision === 'change' ? newSeverity : null,
        rejectReason: decision === 'reject' ? rejectReason : null,
      })

      // Stay on the page so the resulting state is visually obvious — for
      // terminal decisions (verify/reject/archive/merge) the "Already X" banner
      // appears, and for request-info / flag the relevant badge becomes visible.
      // Without this the user navigates to the list and assumes nothing changed
      // because archived/verified reports still appear under "All Incidents".
      if (updated) {
        setIncident(updated)
        setDecision('')
        setActionNote('')
        setRejectReason('spam')
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    } catch (requestError) {
      setError(requestError)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUnarchive() {
    if (!incident || isSubmitting || incident.status !== 'archived') {
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const updated = await submitAdminIncidentAction(incident.reportId, { action: 'unarchive' })
      if (updated) setIncident(updated)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function addNote() {
    if (!incident || !internalNote.trim() || noteSubmitting) {
      return
    }

    setNoteSubmitting(true)
    setError(null)

    try {
      const updatedIncident = await submitAdminIncidentAction(incident.reportId, {
        action: 'note',
        note: internalNote,
      })

      setIncident(updatedIncident)
      setInternalNote('')
    } catch (requestError) {
      setError(requestError)
    } finally {
      setNoteSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-card">
        <h2 className="admin-card-title">{t('adminIncidentReviewPage.loading.title')}</h2>
        <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
          {t('adminIncidentReviewPage.loading.subtitle')}
        </p>
      </div>
    )
  }

  if (error && !incident) {
    return (
      <div className="admin-card">
        <h2 className="admin-card-title">{t('adminIncidentReviewPage.errorState.title')}</h2>
        <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
          {error.message || t('adminIncidentReviewPage.errorState.subtitle')}
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="admin-btn admin-btn-primary" onClick={() => navigate('/admin/incidents')}>
            {t('adminIncidentReviewPage.backToQueue')}
          </button>
        </div>
      </div>
    )
  }

  if (!incident) {
    return null
  }

  return (
    <>
    <div className="admin-review-split">
      <div className="admin-review-left">
        <button className="admin-btn admin-btn-ghost" onClick={() => navigate('/admin/incidents')} style={{ marginBottom: 10, fontSize: 11 }}>
          <ArrowBackRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} /> {t('adminIncidentReviewPage.backToQueue')}
        </button>

        {error && (
          <div
            className="admin-card"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <h3 className="admin-card-title">{t('adminIncidentReviewPage.actionFailed.title')}</h3>
            <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
              {error.message || t('adminIncidentReviewPage.actionFailed.subtitle')}
            </p>
          </div>
        )}

        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title" style={{ fontSize: 15 }}>{incident.displayId}</h2>
              <p className="admin-card-subtitle">{formatIncidentType(incident.incidentType)} · {incident.location}</p>
            </div>
            <span className={`admin-pill ${incident.severity}`}>{incident.severity}</span>
          </div>
          <div style={{
            marginTop: 10,
            padding: '10px 12px 10px 14px',
            background: 'var(--admin-surface-2)',
            borderLeft: '3px solid var(--admin-primary)',
            borderRadius: '0 8px 8px 0',
            fontSize: 12.5,
            lineHeight: 1.55,
            color: incident.description ? 'var(--admin-text)' : 'var(--admin-text-muted)',
            fontStyle: incident.description ? 'normal' : 'italic',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <FormatQuoteRoundedIcon fontSize="small" sx={{ color: 'var(--admin-primary)', opacity: 0.6, mt: '-2px', transform: 'scaleX(-1)' }} />
            <span>{incident.description || t('adminIncidentReviewPage.report.noDescription')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.report.status')}</span>
              <span className="admin-mini-stat-value">{incident.status}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.report.reported')}</span>
              <span className="admin-mini-stat-value">{formatDateTime(incident.createdAt)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.report.severitySource')}</span>
              <span className="admin-mini-stat-value">{incident.severitySource === 'ai' ? t('adminIncidentReviewPage.report.severitySourceAi') : t('adminIncidentReviewPage.report.severitySourceHint')}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.report.openFlags')}</span>
              <span className="admin-mini-stat-value">{incident.openFlagCount}</span>
            </div>
          </div>
          {incident.mergedIntoReportId ? (
            <div className="admin-internal-note">
              <div className="admin-internal-note-label">{t('adminIncidentReviewPage.merge.label')}</div>
              <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                {t('adminIncidentReviewPage.merge.mergedInto', { reportId: incident.mergedIntoReportId, date: formatDateTime(incident.mergedAt) })}
              </div>
              {incident.mergeReason ? (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                  {t('adminIncidentReviewPage.merge.reason', { reason: incident.mergeReason })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {incident.mergeGroup ? (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">{t('adminIncidentReviewPage.mergeGroup.title', { count: incident.mergeGroup.memberCount })}</h3>
                <p className="admin-card-subtitle">
                  {t('adminIncidentReviewPage.mergeGroup.subtitle')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {incident.mergeGroup.members.map((member) => {
                const isPrimary = member.role === 'primary'
                return (
                  <button
                    key={`merge-${member.reportId}`}
                    type="button"
                    disabled={member.isCurrent}
                    onClick={() => navigate(`/admin/incidents/${member.reportId}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 8,
                      background: member.isCurrent ? 'var(--admin-bg-subtle, #f8fafc)' : '#ffffff',
                      cursor: member.isCurrent ? 'default' : 'pointer',
                      fontSize: 11.5,
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 9.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: isPrimary ? '#EEF2FF' : '#F1F5F9',
                        color: isPrimary ? '#4338CA' : '#64748B',
                      }}
                    >
                      {isPrimary ? t('adminIncidentReviewPage.mergeGroup.roleOriginal') : t('adminIncidentReviewPage.mergeGroup.roleMerged')}
                    </span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{member.displayId}</span>
                    <span style={{ color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {member.title || t('adminIncidentReviewPage.mergeGroup.untitledReport')}
                    </span>
                    {member.isCurrent ? (
                      <span style={{ color: '#4338CA', fontWeight: 600, flexShrink: 0 }}>· {t('adminIncidentReviewPage.mergeGroup.current')}</span>
                    ) : null}
                    {member.severity ? (
                      <span style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }}>· {member.severity}</span>
                    ) : null}
                    <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--admin-text-muted)' }}>
                      {formatDateTime(member.createdAt)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {incident.media.length > 0 && (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">{t('adminIncidentReviewPage.evidence.title', { count: incident.media.length })}</h3>
                <p className="admin-card-subtitle">{t('adminIncidentReviewPage.evidence.clickHint')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {incident.media.map((mediaItem, index) => (
                <EvidenceThumb
                  key={mediaItem.id || index}
                  src={normalizeAvatarUrl(mediaItem.url)}
                  alt={t('adminIncidentReviewPage.evidence.altText', { index: index + 1 })}
                  uploadedAt={mediaItem.uploadedAt ? formatDateOnly(mediaItem.uploadedAt) : t('adminIncidentReviewPage.evidence.altText', { index: index + 1 })}
                  onClick={() => setLightboxIndex(index)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.reporter.title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.reporter.name')}</span>
              <span className="admin-mini-stat-value">{incident.reporter.name}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.reporter.trust')}</span>
              <span className="admin-mini-stat-value">
                {typeof incident.reporter.reporterScore === 'number'
                  ? `${incident.reporter.reporterScore.toFixed(1)}%`
                  : t('adminIncidentReviewPage.reporter.notProvided')}
              </span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.reporter.totalReports')}</span>
              <span className="admin-mini-stat-value">{incident.reporter.totalReports}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.reporter.joined')}</span>
              <span className="admin-mini-stat-value">{formatDateOnly(incident.reporter.joinedAt)}</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.aiAssessment.title')}</h3>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.aiAssessment.status')}</span>
              <span style={{ fontWeight: 600 }}>{getAssessmentStatusLabel(incident.aiAssessment.status, t)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.aiAssessment.severity')}</span>
              <span style={{ fontWeight: 600 }}>
                {incident.severitySource === 'ai'
                  ? t('adminIncidentReviewPage.aiAssessment.severityAi', { severity: incident.severity })
                  : t('adminIncidentReviewPage.aiAssessment.severityHint', { severity: incident.severity })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.aiAssessment.confidence')}</span>
              {typeof incident.aiAssessment.confidence === 'number' && incident.aiAssessment.status === 'completed' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="admin-progress" style={{ width: 60 }}>
                    <div
                      className={`admin-progress-fill ${getConfidenceFillClass(incident.aiAssessment.confidence)}`}
                      style={{ width: `${incident.aiAssessment.confidence}%` }}
                    ></div>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{incident.aiAssessment.confidence}%</span>
                </div>
              ) : (
                <span style={{ fontWeight: 600 }}>{getConfidenceLabel(incident, t)}</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.aiAssessment.latestUpdate')}</span>
              <span style={{ fontWeight: 600 }}>{formatDateTime(incident.aiAssessment.assessedAt)}</span>
            </div>
            {incident.aiAssessment.modelVersionId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
                <span style={{ color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.aiAssessment.modelVersion')}</span>
                <span style={{ fontWeight: 600 }}>{incident.aiAssessment.modelVersionId.slice(0, 8)}</span>
              </div>
            ) : null}
            {incident.aiAssessment.status !== 'completed' ? (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--admin-surface-2)', borderRadius: 6, color: 'var(--admin-text-secondary)', fontSize: 11 }}>
                {t('adminIncidentReviewPage.aiAssessment.notActiveNote')}
              </div>
            ) : null}
          </div>
        </div>

        {incident.flags.length > 0 && (
          <div className="admin-card">
            <h3 className="admin-card-title">{t('adminIncidentReviewPage.communityFlags.title')}</h3>
            <div style={{ marginTop: 8 }}>
              {openFlags.length > 0 ? openFlags.map((flag) => (
                <div key={flag.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 11.5 }}>{flag.reason}</span>
                    <span style={{ color: 'var(--admin-text-muted)', fontSize: 10.5 }}>{formatDateTime(flag.createdAt)}</span>
                  </div>
                  {flag.comment ? (
                    <p style={{ fontSize: 11, color: 'var(--admin-text-secondary)', marginTop: 4 }}>{flag.comment}</p>
                  ) : null}
                </div>
              )) : (
                <p style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.communityFlags.allResolved')}</p>
              )}
            </div>
          </div>
        )}

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.timeline.title')}</h3>
          <div className="admin-audit-log" style={{ marginTop: 8, maxHeight: 'none' }}>
            {incident.timeline.map((entry) => (
              <div className="admin-audit-entry" key={entry.id}>
                <span className="admin-audit-time">{entry.timeLabel}</span>
                <span className="admin-audit-text">{entry.event}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-review-center">
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">{t('adminIncidentReviewPage.location.title')}</h3>
              <p className="admin-card-subtitle">{incident.location}</p>
            </div>
            {incident.coordinates.lat != null && incident.coordinates.lng != null && (
              <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setIsMapFullscreen(true)}>
                {t('adminIncidentReviewPage.location.openFullMap')}
              </button>
            )}
          </div>
          {incident.coordinates.lat != null && incident.coordinates.lng != null ? (
            <div style={{
              position: 'relative',
              height: 200,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--admin-border)',
            }}>
              <MapContainer
                key={`${incident.coordinates.lat}-${incident.coordinates.lng}`}
                center={[incident.coordinates.lat, incident.coordinates.lng]}
                zoom={14}
                scrollWheelZoom={false}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                  center={[incident.coordinates.lat, incident.coordinates.lng]}
                  radius={9}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: severityMarkerColor(incident.severity),
                    fillOpacity: 1,
                  }}
                />
              </MapContainer>
              <span style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                zIndex: 500,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.92)',
                border: '1px solid var(--admin-border)',
                fontSize: 10.5,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--admin-text-secondary)',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
              }}>
                {incident.coordinates.lat.toFixed(4)}°N · {incident.coordinates.lng.toFixed(4)}°E
              </span>
            </div>
          ) : (
            <div style={{
              height: 200,
              borderRadius: 8,
              border: '1px dashed var(--admin-border)',
              background: 'var(--admin-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--admin-text-muted)',
              fontSize: 12,
            }}>
              {t('adminIncidentReviewPage.location.noCoordinates')}
            </div>
          )}
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.spamAnalysis.title')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.predictedLabel')}</span>
              <span className="admin-mini-stat-value">{formatPredictedLabel(incident.spamAnalysis.predictedLabel, t)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.mlStatus')}</span>
              <span className="admin-mini-stat-value">{formatMlStatus(incident.spamAnalysis.status, t)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.spamScore')}</span>
              <span className="admin-mini-stat-value">{formatPercent(incident.spamAnalysis.spamScore)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.mlConfidence')}</span>
              <span className="admin-mini-stat-value">{formatPercent(incident.spamAnalysis.confidence)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.modelVersion')}</span>
              <span className="admin-mini-stat-value">{incident.spamAnalysis.modelVersion || EMPTY_TEXT}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.classifiedAt')}</span>
              <span className="admin-mini-stat-value">{formatDateTime(incident.spamAnalysis.classifiedAt)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.reviewVerdict')}</span>
              <span className="admin-mini-stat-value">{incident.spamAnalysis.reviewVerdict || t('adminIncidentReviewPage.spamAnalysis.pendingVerdict')}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminIncidentReviewPage.spamAnalysis.reviewedBy')}</span>
              <span className="admin-mini-stat-value">{incident.spamAnalysis.reviewedBy || EMPTY_TEXT}</span>
            </div>
          </div>
          {incident.spamAnalysis.pendingReview ? (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--admin-warning)', fontSize: 11 }}>
              {t('adminIncidentReviewPage.spamAnalysis.suspiciousNote')}
            </div>
          ) : null}
          {incident.spamAnalysis.reviewNotes ? (
            <div className="admin-internal-note" style={{ marginTop: 10 }}>
              <div className="admin-internal-note-label">{t('adminIncidentReviewPage.spamAnalysis.reviewNotes')}</div>
              <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>{incident.spamAnalysis.reviewNotes}</div>
              {incident.spamAnalysis.reviewedAt ? (
                <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--admin-text-muted)' }}>
                  {t('adminIncidentReviewPage.spamAnalysis.reviewedAt', { date: formatDateTime(incident.spamAnalysis.reviewedAt) })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.nearbyReports.title')}</h3>
          {incident.nearbyReports.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {incident.nearbyReports.map((nearby) => (
                <div key={nearby.reportId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{nearby.displayId}</div>
                    <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>
                      {nearby.location} · {formatDistance(nearby.distanceKm)}
                    </div>
                  </div>
                  <span className={`admin-pill ${nearby.severity}`}>{nearby.severity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 8 }}>{t('adminIncidentReviewPage.nearbyReports.none')}</p>
          )}
          {incident.nearbyReports.length >= 2 && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--admin-warning)', fontWeight: 600 }}>
                <WarningAmberRoundedIcon fontSize="inherit" className="icon-warning" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                {t('adminIncidentReviewPage.nearbyReports.clusterDetected', { count: incident.nearbyReports.length + 1 })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="admin-review-right">
        {(() => {
          const isTerminal = TERMINAL_INCIDENT_STATUSES.has(incident.status)
          const aiRec = computeAiRecommendation(incident, t)
          const infoPending = incident.infoRequest?.pending
          const DECISION_TILES = getDecisionTiles(t)
          const REJECT_REASONS = getRejectReasons(t)
          const selectedTile = DECISION_TILES.find((tile) => tile.key === decision)

          const TONE_TO_COLOR = {
            success: 'var(--admin-success)',
            primary: 'var(--admin-primary)',
            info:    '#2563EB',
            warning: 'var(--admin-warning)',
            neutral: 'var(--admin-text-secondary)',
            danger:  'var(--admin-danger)',
          }
          const TONE_TO_BG = {
            success: 'var(--admin-success-subtle)',
            primary: 'var(--admin-primary-subtle)',
            info:    'rgba(59, 130, 246, 0.10)',
            warning: 'var(--admin-warning-subtle)',
            neutral: 'var(--admin-surface-2)',
            danger:  'var(--admin-danger-subtle)',
          }
          const iconFor = (key) => {
            switch (key) {
              case 'approve': return <CheckRoundedIcon fontSize="inherit" />
              case 'change':  return <EditRoundedIcon fontSize="inherit" />
              case 'info':    return <HelpOutlineRoundedIcon fontSize="inherit" />
              case 'flag':    return <FlagOutlinedIcon fontSize="inherit" />
              case 'archive': return <ArchiveOutlinedIcon fontSize="inherit" />
              case 'reject':  return <CloseRoundedIcon fontSize="inherit" />
              default:        return null
            }
          }

          const canSubmit = (() => {
            if (!decision || isSubmitting) return false
            if (decision === 'reject' && !rejectReason) return false
            if (decision === 'info' && !actionNote.trim()) return false
            return true
          })()

          const cancelDecision = () => { setDecision(''); setActionNote('') }

          return (
            <div
              className="admin-card"
              style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* ─── Header ─── */}
              <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--admin-border)',
                background: 'linear-gradient(180deg, #FCFCFD 0%, var(--admin-surface) 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="admin-card-title" style={{ margin: 0, fontSize: 14 }}>{t('adminIncidentReviewPage.decisionEngine.title')}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--admin-text-muted)' }}>
                      {t('adminIncidentReviewPage.decisionEngine.subtitle')}
                    </p>
                  </div>
                  <span className={`admin-pill ${incident.status}`}>{incident.status}</span>
                </div>
              </div>

              {/* ─── Status banners ─── */}
              {isTerminal && (
                <div style={{
                  margin: 14, padding: '12px 14px', borderRadius: 8,
                  background: 'var(--admin-surface-2)', border: '1px solid var(--admin-border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 12, color: 'var(--admin-text-secondary)',
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: 'var(--admin-success-subtle)', color: 'var(--admin-success)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>
                    <CheckRoundedIcon fontSize="inherit" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--admin-text)', textTransform: 'capitalize' }}>
                      {t('adminIncidentReviewPage.decisionEngine.alreadyStatus', { status: incident.status })}
                    </div>
                    {incident.rejectReason && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {t('adminIncidentReviewPage.decisionEngine.rejectReasonDisplay', { reason: incident.rejectReason.replace(/_/g, ' ') })}
                      </div>
                    )}
                    {incident.status === 'archived' && (
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {t('adminIncidentReviewPage.decisionEngine.archivedNote')}
                      </div>
                    )}
                  </div>
                  {incident.status === 'archived' && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={handleUnarchive}
                      disabled={isSubmitting}
                      style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}
                    >
                      {isSubmitting ? t('adminIncidentReviewPage.decisionEngine.unarchiving') : t('adminIncidentReviewPage.decisionEngine.unarchive')}
                    </button>
                  )}
                </div>
              )}

              {!isTerminal && infoPending && (
                <div style={{
                  margin: 14, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.30)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 11.5, color: 'var(--admin-warning)',
                }}>
                  <HelpOutlineRoundedIcon fontSize="inherit" style={{ marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{t('adminIncidentReviewPage.infoRequest.awaitingResponse')}</div>
                    <div style={{ fontSize: 10.5, marginTop: 1, opacity: 0.9, color: 'var(--admin-text-secondary)' }}>
                      {t('adminIncidentReviewPage.infoRequest.asked', { date: formatDateTime(incident.infoRequest.requestedAt) })}
                    </div>
                    {incident.infoRequest?.message ? (
                      <div style={{ fontSize: 11, marginTop: 4, color: 'var(--admin-text)', whiteSpace: 'pre-wrap' }}>
                        "{incident.infoRequest.message}"
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {!isTerminal && !infoPending && incident.infoRequest?.respondedAt && incident.infoRequest?.response && (
                <div style={{
                  margin: 14, padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.30)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  fontSize: 11.5, color: 'var(--admin-success)',
                }}>
                  <CheckRoundedIcon fontSize="inherit" style={{ marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{t('adminIncidentReviewPage.infoRequest.reporterResponded')}</div>
                    <div style={{ fontSize: 10.5, marginTop: 1, opacity: 0.9, color: 'var(--admin-text-secondary)' }}>
                      {t('adminIncidentReviewPage.infoRequest.answered', { date: formatDateTime(incident.infoRequest.respondedAt) })}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: 'var(--admin-text)', whiteSpace: 'pre-wrap' }}>
                      "{incident.infoRequest.response}"
                    </div>
                  </div>
                </div>
              )}

              {/* ─── AI suggestion (compact, one-line) ─── */}
              {!isTerminal && aiRec && (
                <div style={{
                  margin: '14px 14px 8px',
                  padding: '10px 12px', borderRadius: 8,
                  background: TONE_TO_BG[aiRec.tone] || 'var(--admin-surface-2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 50, flexShrink: 0,
                    background: '#fff', color: TONE_TO_COLOR[aiRec.tone] || 'var(--admin-text-secondary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <BoltOutlinedIcon fontSize="inherit" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: TONE_TO_COLOR[aiRec.tone], lineHeight: 1.2 }}>
                      {t('adminIncidentReviewPage.decisionEngine.aiSuggestion')}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-text)', marginTop: 1 }}>
                      {aiRec.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--admin-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                      {aiRec.explanation}
                    </div>
                  </div>
                  {aiRec.action && decision !== aiRec.action && (
                    <button
                      type="button"
                      onClick={() => setDecision(aiRec.action)}
                      style={{
                        flexShrink: 0,
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: 0,
                        background: TONE_TO_COLOR[aiRec.tone],
                        color: '#fff',
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('adminIncidentReviewPage.decisionEngine.useIt')}
                    </button>
                  )}
                </div>
              )}

              {/* ─── Action list (vertical, inline form under the picked row) ───
               *  All 7 rows stay visible at all times so the moderator can
               *  jump from "Approve" to "Reject" without first clicking
               *  Cancel. Clicking a different row swaps the inline form (and
               *  its Confirm/Cancel buttons) under the new selection.
               */}
              {!isTerminal && (
                <div style={{ padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {DECISION_TILES.map((tile) => {
                      const active = decision === tile.key
                      const recommended = aiRec?.action === tile.key
                      const color = TONE_TO_COLOR[tile.tone] || TONE_TO_COLOR.neutral
                      const bg = TONE_TO_BG[tile.tone] || TONE_TO_BG.neutral

                      return (
                        <React.Fragment key={tile.key}>
                          <button
                            type="button"
                            onClick={() => active ? cancelDecision() : setDecision(tile.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 10px',
                              borderRadius: 7,
                              border: 0,
                              background: active ? bg : 'transparent',
                              color: active ? color : 'var(--admin-text)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              position: 'relative',
                              transition: 'background 120ms ease, color 120ms ease',
                              outline: 'none',
                            }}
                            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--admin-surface-2)' }}
                            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                          >
                            {/* Left accent bar for the active row */}
                            {active && (
                              <span style={{
                                position: 'absolute', left: 0, top: 6, bottom: 6,
                                width: 3, borderRadius: '0 2px 2px 0',
                                background: color,
                              }} />
                            )}
                            <span style={{
                              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                              background: active ? color : bg,
                              color: active ? '#fff' : color,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 15,
                            }}>
                              {iconFor(tile.key)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12.5, fontWeight: active ? 700 : 600,
                              }}>
                                {tile.label}
                                {recommended && !active && (
                                  <span style={{
                                    fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4,
                                    textTransform: 'uppercase',
                                    padding: '1px 6px', borderRadius: 999,
                                    background: color, color: '#fff',
                                  }}>AI</span>
                                )}
                              </span>
                              <span style={{
                                display: 'block',
                                fontSize: 10.5, color: 'var(--admin-text-muted)',
                                marginTop: 1, lineHeight: 1.35,
                              }}>
                                {tile.hint}
                              </span>
                            </span>
                            {/* Right-side hint: chevron when not picked, "Change" label when active */}
                            {active ? (
                              <span style={{
                                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
                                textTransform: 'uppercase',
                                padding: '4px 8px', borderRadius: 999,
                                color: color, border: `1px solid ${color}55`,
                                flexShrink: 0,
                              }}>{t('adminIncidentReviewPage.decisionEngine.changeTileLabel')}</span>
                            ) : (
                              <ArrowForwardRoundedIcon
                                fontSize="inherit"
                                style={{
                                  fontSize: 16,
                                  opacity: 0.3,
                                  color: 'var(--admin-text-muted)',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </button>

                          {/* Inline form + Confirm/Cancel — only renders for the
                              picked row, which is now the only row visible. */}
                          {active && (
                            <div style={{
                              margin: '4px 0 6px',
                              padding: '12px 14px',
                              borderRadius: 8,
                              background: 'var(--admin-surface-2)',
                              border: `1px solid ${color}33`,
                              display: 'flex', flexDirection: 'column', gap: 10,
                            }}>
                              {/* Change Severity */}
                              {decision === 'change' && (
                                <div>
                                  <label className="admin-form-label" style={{ marginBottom: 6 }}>{t('adminIncidentReviewPage.form.newSeverity')}</label>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {['low', 'medium', 'high'].map((sev) => (
                                      <button
                                        key={sev}
                                        type="button"
                                        onClick={() => setNewSeverity(sev)}
                                        className={`admin-pill ${sev}`}
                                        style={{
                                          flex: 1, cursor: 'pointer', padding: '7px 10px',
                                          fontSize: 11, textTransform: 'capitalize',
                                          border: newSeverity === sev ? '2px solid currentColor' : '2px solid transparent',
                                          opacity: newSeverity === sev ? 1 : 0.55,
                                        }}
                                      >
                                        {sev}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Reject */}
                              {decision === 'reject' && (
                                <div>
                                  <label className="admin-form-label" style={{ marginBottom: 6 }}>{t('adminIncidentReviewPage.form.rejectionReason')}</label>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                    {REJECT_REASONS.map((reason) => {
                                      const checked = rejectReason === reason.value
                                      return (
                                        <button
                                          key={reason.value}
                                          type="button"
                                          onClick={() => setRejectReason(reason.value)}
                                          style={{
                                            padding: '7px 10px',
                                            borderRadius: 6,
                                            border: `1px solid ${checked ? 'var(--admin-danger)' : 'var(--admin-border)'}`,
                                            background: checked ? 'var(--admin-danger-subtle)' : 'var(--admin-surface)',
                                            color: checked ? 'var(--admin-danger)' : 'var(--admin-text-secondary)',
                                            fontSize: 11, fontWeight: 600,
                                            cursor: 'pointer', textAlign: 'left',
                                          }}
                                        >
                                          {reason.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Reviewer note */}
                              <div>
                                <label className="admin-form-label" style={{ marginBottom: 6 }}>
                                  {decision === 'info'
                                    ? t('adminIncidentReviewPage.form.noteLabel.messageToReporter')
                                    : decision === 'reject'
                                      ? t('adminIncidentReviewPage.form.noteLabel.internalNote')
                                      : t('adminIncidentReviewPage.form.noteLabel.reviewerNote')}
                                  {' '}
                                  <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>
                                    {decision === 'info' ? t('adminIncidentReviewPage.form.noteLabel.required') : t('adminIncidentReviewPage.form.noteLabel.optional')}
                                  </span>
                                </label>
                                <textarea
                                  className="admin-textarea"
                                  value={actionNote}
                                  onChange={(e) => setActionNote(e.target.value)}
                                  rows={3}
                                  placeholder={
                                    decision === 'info'     ? t('adminIncidentReviewPage.form.notePlaceholder.info') :
                                    decision === 'reject'   ? t('adminIncidentReviewPage.form.notePlaceholder.reject') :
                                    decision === 'archive'  ? t('adminIncidentReviewPage.form.notePlaceholder.archive') :
                                    decision === 'flag'     ? t('adminIncidentReviewPage.form.notePlaceholder.flag') :
                                    decision === 'change'   ? t('adminIncidentReviewPage.form.notePlaceholder.change') :
                                                              t('adminIncidentReviewPage.form.notePlaceholder.default')
                                  }
                                  style={{ width: '100%' }}
                                />
                              </div>

                              {/* Confirm / Cancel — sit right under the form so
                                  the moderator never has to scroll to commit. */}
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-sm admin-btn-ghost"
                                  onClick={cancelDecision}
                                  disabled={isSubmitting}
                                >
                                  {t('common:actions.cancel')}
                                </button>
                                <button
                                  type="button"
                                  className={`admin-btn admin-btn-sm ${decision === 'reject' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                                  onClick={handleDecisionSubmit}
                                  disabled={!canSubmit}
                                  style={{ flex: 1, justifyContent: 'center', height: 32 }}
                                >
                                  {isSubmitting ? t('adminIncidentReviewPage.form.submitting') : (
                                    <>
                                      {t('adminIncidentReviewPage.form.confirmAction', { label: tile.label })}
                                      <ArrowForwardRoundedIcon fontSize="inherit" sx={{ verticalAlign: 'middle', ml: 0.5 }} />
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })()}

        <div className="admin-card">
          <h3 className="admin-card-title">{t('adminIncidentReviewPage.internalNotes.title')}</h3>
          <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {incident.notes.length === 0 && <p style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>{t('adminIncidentReviewPage.internalNotes.noNotes')}</p>}
            {incident.notes.map((note) => (
              <div key={note.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--admin-border)', fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>{note.author}</span>
                  <span style={{ color: 'var(--admin-text-muted)', fontSize: 10 }}>{formatDateTime(note.time)}</span>
                </div>
                <p style={{ color: 'var(--admin-text-secondary)', margin: 0 }}>{note.text}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              className="admin-input"
              type="text"
              placeholder={t('adminIncidentReviewPage.internalNotes.placeholder')}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addNote()}
              style={{ flex: 1, height: 30, fontSize: 11 }}
            />
            <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={addNote} disabled={noteSubmitting}>
              {noteSubmitting ? t('adminIncidentReviewPage.internalNotes.saving') : t('adminIncidentReviewPage.internalNotes.add')}
            </button>
          </div>
        </div>
      </div>
    </div>

    {isMapFullscreen && incident.coordinates.lat != null && incident.coordinates.lng != null && createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('adminIncidentReviewPage.fullscreenMap.ariaLabel')}
        onClick={() => setIsMapFullscreen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 1500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          animation: 'fbLightboxFadeIn 0.18s ease',
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            position: 'relative',
            width: 'min(1200px, 96vw)',
            height: 'min(820px, 92vh)',
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-border-2)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 24px 64px -16px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--admin-border)',
            background: 'var(--admin-surface)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>
                {incident.displayId} · {formatIncidentType(incident.incidentType)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {incident.location}
                {' · '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {incident.coordinates.lat.toFixed(4)}°N · {incident.coordinates.lng.toFixed(4)}°E
                </span>
              </div>
            </div>
            <button
              className="admin-btn admin-btn-sm admin-btn-ghost"
              onClick={() => setIsMapFullscreen(false)}
              aria-label={t('adminIncidentReviewPage.fullscreenMap.closeAriaLabel')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <CloseRoundedIcon fontSize="inherit" /> {t('common:actions.close')}
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer
              key={`fullscreen-${incident.coordinates.lat}-${incident.coordinates.lng}`}
              center={[incident.coordinates.lat, incident.coordinates.lng]}
              zoom={13}
              scrollWheelZoom
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Background markers — every other incident with coordinates */}
              {mapIncidents
                .filter((row) => row.reportId !== incident.reportId)
                .map((row) => (
                  <CircleMarker
                    key={row.reportId}
                    center={[row.coordinates.lat, row.coordinates.lng]}
                    radius={6}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.5,
                      fillColor: severityMarkerColor(row.severity),
                      fillOpacity: 0.85,
                    }}
                    eventHandlers={{
                      click: () => navigate(`/admin/incidents/${row.reportId}`),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                      <div style={{ fontSize: 11 }}>
                        <strong>{row.displayId}</strong>
                        <div style={{ color: '#64748b', textTransform: 'capitalize' }}>
                          {row.severity} · {row.status}
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}

              {/* Highlight halo — soft pulsing-style ring behind the current incident */}
              <CircleMarker
                center={[incident.coordinates.lat, incident.coordinates.lng]}
                radius={22}
                pathOptions={{
                  color: severityMarkerColor(incident.severity),
                  weight: 2,
                  fillColor: severityMarkerColor(incident.severity),
                  fillOpacity: 0.12,
                  interactive: false,
                  dashArray: '4 4',
                }}
              />

              {/* Current incident — large, opaque, permanent tooltip */}
              <CircleMarker
                center={[incident.coordinates.lat, incident.coordinates.lng]}
                radius={12}
                pathOptions={{
                  color: '#ffffff',
                  weight: 3,
                  fillColor: severityMarkerColor(incident.severity),
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} permanent opacity={1}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>
                    {incident.displayId} · {t('adminIncidentReviewPage.mergeGroup.current')}
                  </div>
                </Tooltip>
              </CircleMarker>
            </MapContainer>

            {/* Legend — pinned bottom-left */}
            <div style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 500,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.96)',
              border: '1px solid var(--admin-border)',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.10)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: 11,
              color: 'var(--admin-text-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: severityMarkerColor(incident.severity),
                  border: '3px solid #fff',
                  boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.15)',
                }} />
                <span><strong style={{ color: 'var(--admin-text)' }}>{t('adminIncidentReviewPage.fullscreenMap.legendCurrent')}</strong> ({incident.severity})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff' }} />
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', border: '1.5px solid #fff' }} />
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #fff' }} />
                <span>
                  {t('adminIncidentReviewPage.fullscreenMap.legendOthers')} — {mapIncidentsLoading
                    ? t('adminIncidentReviewPage.fullscreenMap.loadingOthers')
                    : t('adminIncidentReviewPage.fullscreenMap.othersCount', { count: Math.max(0, mapIncidents.filter((r) => r.reportId !== incident.reportId).length) })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )}

    {activeMedia && createPortal(
      <div
        className="post-media-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={t('adminIncidentReviewPage.lightbox.ariaLabel')}
        onClick={() => setLightboxIndex(null)}
      >
        <div className="post-media-lightbox-content" onClick={(event) => event.stopPropagation()}>
          <div className="post-media-lightbox-toolbar">
            <button type="button" className="post-media-zoom-btn" onClick={zoomOut} aria-label={t('adminIncidentReviewPage.lightbox.zoomOut')}>−</button>
            <button type="button" className="post-media-zoom-btn reset" onClick={zoomReset} aria-label={t('adminIncidentReviewPage.lightbox.resetZoom')}>{Math.round(zoomScale * 100)}%</button>
            <button type="button" className="post-media-zoom-btn" onClick={zoomIn} aria-label={t('adminIncidentReviewPage.lightbox.zoomIn')}>+</button>
          </div>
          <button
            type="button"
            className="post-media-lightbox-close"
            onClick={() => setLightboxIndex(null)}
            aria-label={t('adminIncidentReviewPage.lightbox.closeAriaLabel')}
          >×</button>

          {totalMedia > 1 && (
            <>
              <button
                type="button"
                className="post-media-lightbox-nav post-media-lightbox-nav--prev"
                onClick={(event) => {
                  event.stopPropagation()
                  setZoomScale(1)
                  setLightboxIndex((prev) => (prev == null ? 0 : (prev - 1 + totalMedia) % totalMedia))
                }}
                aria-label={t('adminIncidentReviewPage.lightbox.prevEvidence')}
              >‹</button>
              <button
                type="button"
                className="post-media-lightbox-nav post-media-lightbox-nav--next"
                onClick={(event) => {
                  event.stopPropagation()
                  setZoomScale(1)
                  setLightboxIndex((prev) => (prev == null ? 0 : (prev + 1) % totalMedia))
                }}
                aria-label={t('adminIncidentReviewPage.lightbox.nextEvidence')}
              >›</button>
              <span className="post-media-lightbox-counter">
                {lightboxIndex + 1} / {totalMedia}
              </span>
            </>
          )}

          <div
            ref={stageRef}
            className={`post-media-lightbox-stage${zoomScale > 1 ? ' zoomed' : ''}${isDragging ? ' dragging' : ''}`}
            onClick={(event) => { if (event.target === event.currentTarget) setLightboxIndex(null) }}
            onMouseDown={(event) => { if (zoomScale > 1) { event.preventDefault(); startPan(event.clientX, event.clientY) } }}
            onMouseMove={(event) => movePan(event.clientX, event.clientY)}
            onMouseUp={stopPan}
            onMouseLeave={stopPan}
            onTouchStart={(event) => { if (zoomScale > 1) { const t = event.touches[0]; if (t) startPan(t.clientX, t.clientY) } }}
            onTouchMove={(event) => { const t = event.touches[0]; if (t) movePan(t.clientX, t.clientY) }}
            onTouchEnd={stopPan}
          >
            <img
              className="post-media-lightbox-image"
              src={activeMediaUrl}
              alt={t('adminIncidentReviewPage.evidence.altText', { index: lightboxIndex + 1 })}
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})` }}
            />
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}
