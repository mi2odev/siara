import React, { useContext } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { useNavigate, useParams } from 'react-router-dom'

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import PoliceOfficerPanel from '../../components/police/PoliceOfficerPanel'
import { usePoliceAccess } from '../../components/police/PoliceAccessGate'
import { AuthContext } from '../../contexts/AuthContext'
import {
  addPoliceFieldNote,
  deletePoliceFieldNote,
  getPoliceIncident,
  rejectPoliceIncident,
  requestPoliceBackup,
  updatePoliceFieldNote,
  updatePoliceIncidentStatus,
  verifyPoliceIncident,
} from '../../services/policeService'

function label(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function severityColor(sev) {
  if (sev === 'high') return '#991b1b'
  if (sev === 'medium') return '#d97706'
  return '#16a34a'
}

function initials(name) {
  return (
    String(name || 'O')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'O'
  )
}

export default function PoliceIncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { policeMe } = usePoliceAccess()
  const { user } = useContext(AuthContext)
  const currentUserId = user?.id || user?.userId || null

  const [detail, setDetail] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [note, setNote] = React.useState('')
  const [editingNoteId, setEditingNoteId] = React.useState(null)
  const [editingDraft, setEditingDraft] = React.useState('')
  const [noteBusyId, setNoteBusyId] = React.useState(null)
  const [busyAction, setBusyAction] = React.useState(null)
  const [confirmDialog, setConfirmDialog] = React.useState(null)
  const [successMsg, setSuccessMsg] = React.useState('')

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = React.useState(null)
  const [lightboxScale, setLightboxScale] = React.useState(1)
  const [lightboxOffset, setLightboxOffset] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartRef = React.useRef(null)
  const stageRef = React.useRef(null)

  const mediaList = Array.isArray(detail?.incident?.media) ? detail.incident.media : []
  const lightboxUrl = lightboxIndex == null ? null : mediaList[lightboxIndex]?.url || null

  const closeLightbox = React.useCallback(() => {
    setLightboxIndex(null)
    setLightboxScale(1)
    setLightboxOffset({ x: 0, y: 0 })
    setIsDragging(false)
  }, [])

  const openLightbox = React.useCallback((index) => {
    setLightboxIndex(index)
    setLightboxScale(1)
    setLightboxOffset({ x: 0, y: 0 })
    setIsDragging(false)
  }, [])

  const showPrevImage = React.useCallback(() => {
    if (mediaList.length <= 1) return
    setLightboxScale(1)
    setLightboxOffset({ x: 0, y: 0 })
    setLightboxIndex((prev) => (prev == null ? 0 : (prev - 1 + mediaList.length) % mediaList.length))
  }, [mediaList.length])

  const showNextImage = React.useCallback(() => {
    if (mediaList.length <= 1) return
    setLightboxScale(1)
    setLightboxOffset({ x: 0, y: 0 })
    setLightboxIndex((prev) => (prev == null ? 0 : (prev + 1) % mediaList.length))
  }, [mediaList.length])

  React.useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') showNextImage()
      if (e.key === 'ArrowLeft') showPrevImage()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightboxIndex, closeLightbox, showNextImage, showPrevImage])

  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage || lightboxIndex == null) return
    const onWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setLightboxScale((s) => {
        const next = s * factor
        if (next <= 1) { setLightboxOffset({ x: 0, y: 0 }); return 1 }
        return Math.min(next, 6)
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [lightboxIndex])

  const lbZoomIn = () => setLightboxScale((s) => Math.min(s * 1.5, 6))
  const lbZoomOut = () => setLightboxScale((s) => {
    const next = s / 1.5
    if (next <= 1) { setLightboxOffset({ x: 0, y: 0 }); return 1 }
    return next
  })
  const lbReset = () => { setLightboxScale(1); setLightboxOffset({ x: 0, y: 0 }) }

  const onDragStart = (e) => {
    if (lightboxScale <= 1) return
    setIsDragging(true)
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox: lightboxOffset.x, oy: lightboxOffset.y }
  }
  const onDragMove = (e) => {
    if (!isDragging || !dragStartRef.current) return
    setLightboxOffset({
      x: dragStartRef.current.ox + e.clientX - dragStartRef.current.mx,
      y: dragStartRef.current.oy + e.clientY - dragStartRef.current.my,
    })
  }
  const onDragEnd = () => setIsDragging(false)

  // Data
  const loadIncident = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setDetail(await getPoliceIncident(id))
    } catch (e) {
      setError(e.message || 'Failed to load incident.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => { loadIncident() }, [loadIncident])

  const incident = detail?.incident || null
  const nearbyIncidents = detail?.nearbyIncidents || []
  const history = detail?.history || []
  const fieldNotes = React.useMemo(
    () => history.filter((e) => e.actionType === 'field_note' && e.note),
    [history],
  )

  const startEdit = (entry) => { setEditingNoteId(entry.id); setEditingDraft(entry.note || ''); setError('') }
  const cancelEdit = () => { setEditingNoteId(null); setEditingDraft('') }

  const saveEdit = async (entry) => {
    const trimmed = editingDraft.trim()
    if (!trimmed) { setError('Note cannot be empty.'); return }
    setNoteBusyId(entry.id)
    setError('')
    try {
      setDetail(await updatePoliceFieldNote(incident.id, entry.id, { note: trimmed }))
      setEditingNoteId(null)
      setEditingDraft('')
    } catch (e) {
      setError(e.message || 'Failed to update note.')
    } finally {
      setNoteBusyId(null)
    }
  }

  const deleteNote = async (entry) => {
    if (!incident) return
    if (!window.confirm('Delete this field note? This cannot be undone.')) return
    setNoteBusyId(entry.id)
    setError('')
    try {
      setDetail(await deletePoliceFieldNote(incident.id, entry.id))
      if (editingNoteId === entry.id) cancelEdit()
    } catch (e) {
      setError(e.message || 'Failed to delete note.')
    } finally {
      setNoteBusyId(null)
    }
  }

  const handleAction = async (action, payload = {}) => {
    if (!incident || busyAction) return
    setError('')
    setSuccessMsg('')
    setBusyAction(action)
    try {
      let result
      if (action === 'verify') result = await verifyPoliceIncident(incident.id, payload)
      else if (action === 'reject') result = await rejectPoliceIncident(incident.id, payload)
      else if (action === 'backup') result = await requestPoliceBackup(incident.id, payload)
      else if (action === 'resolve') result = await updatePoliceIncidentStatus(incident.id, { status: 'resolved', ...payload })
      else if (action === 'note') {
        result = await addPoliceFieldNote(incident.id, payload)
        setNote('')
      }
      setDetail(result)
      if (action === 'reject') {
        setSuccessMsg('Incident rejected. Returning to dashboard…')
        setTimeout(() => navigate(-1), 1800)
      } else if (action === 'resolve') {
        setSuccessMsg('Incident resolved. Returning to dashboard…')
        setTimeout(() => navigate(-1), 1800)
      } else if (action === 'verify') {
        setSuccessMsg('Incident verified successfully.')
      } else if (action === 'backup') {
        setSuccessMsg('Backup requested.')
      }
    } catch (e) {
      setError(e.message || 'Action failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const requestAction = (action) => {
    if (!incident || busyAction) return
    if (action === 'reject') {
      setConfirmDialog({
        action,
        label: 'Reject Incident',
        message: 'This will mark the incident as rejected and remove it from the active queue. This action cannot be undone.',
        tone: 'danger',
      })
    } else if (action === 'resolve') {
      setConfirmDialog({
        action,
        label: 'Resolve Incident',
        message: 'This will mark the incident as resolved and close the case.',
        tone: 'resolve',
      })
    } else {
      handleAction(action)
    }
  }

  const mapCenter = incident?.location?.lat != null && incident?.location?.lng != null
    ? [incident.location.lat, incident.location.lng]
    : [36.7538, 3.0588]

  const incidentStatus = incident?.status || ''
  const isTerminal = incidentStatus === 'resolved' || incidentStatus === 'rejected'
  const alreadyVerified = incidentStatus === 'verified'

  const rightPanel = (
    <div className="pid-panel">
      <PoliceOfficerPanel officer={policeMe?.officer} workZone={policeMe?.workZone} />
      {incident ? (
        <div className="pid-panel-status" data-severity={incident.severity}>
          <span className="pid-panel-dot" />
          <div className="pid-panel-status-text">
            <span className="pid-panel-status-label">Severity</span>
            <span className="pid-panel-status-val">{label(incident.severity)}</span>
          </div>
          <div className="pid-panel-status-text pid-panel-status-text--right">
            <span className="pid-panel-status-label">Status</span>
            <span className="pid-panel-status-val">{label(incident.status)}</span>
          </div>
        </div>
      ) : null}

      <div className="pid-panel-section">
        <p className="pid-panel-section-head">Quick Actions</p>

        {successMsg ? (
          <div className="pid-success-banner">
            <CheckCircleOutlineIcon fontSize="small" />
            <span>{successMsg}</span>
          </div>
        ) : null}

        {isTerminal ? (
          <div className="pid-terminal-banner">
            {incidentStatus === 'resolved'
              ? <CheckCircleOutlineIcon fontSize="small" />
              : <CancelOutlinedIcon fontSize="small" />}
            <span>Incident <strong>{label(incidentStatus)}</strong> — no further actions available.</span>
          </div>
        ) : (
          <div className="pid-panel-actions">
            {alreadyVerified ? (
              <div className="pid-verified-chip">
                <VerifiedUserOutlinedIcon fontSize="small" />
                <span>Already Verified</span>
              </div>
            ) : (
              <button
                type="button"
                className="pid-action-btn pid-action-btn--verify"
                onClick={() => requestAction('verify')}
                disabled={!incident || !!busyAction}
              >
                {busyAction === 'verify'
                  ? <span className="pid-btn-spinner" aria-hidden="true" />
                  : <VerifiedUserOutlinedIcon fontSize="small" />}
                <span>{busyAction === 'verify' ? 'Verifying…' : 'Verify Incident'}</span>
              </button>
            )}
            <button
              type="button"
              className="pid-action-btn pid-action-btn--backup"
              onClick={() => requestAction('backup')}
              disabled={!incident || !!busyAction}
            >
              {busyAction === 'backup'
                ? <span className="pid-btn-spinner" aria-hidden="true" />
                : <GroupsOutlinedIcon fontSize="small" />}
              <span>{busyAction === 'backup' ? 'Requesting…' : 'Request Backup'}</span>
            </button>
            <button
              type="button"
              className="pid-action-btn pid-action-btn--resolve"
              onClick={() => requestAction('resolve')}
              disabled={!incident || !!busyAction}
            >
              {busyAction === 'resolve'
                ? <span className="pid-btn-spinner" aria-hidden="true" />
                : <CheckCircleOutlineIcon fontSize="small" />}
              <span>{busyAction === 'resolve' ? 'Resolving…' : 'Resolve Incident'}</span>
            </button>
            <button
              type="button"
              className="pid-action-btn pid-action-btn--reject"
              onClick={() => requestAction('reject')}
              disabled={!incident || !!busyAction}
            >
              {busyAction === 'reject'
                ? <span className="pid-btn-spinner" aria-hidden="true" />
                : <CancelOutlinedIcon fontSize="small" />}
              <span>{busyAction === 'reject' ? 'Rejecting…' : 'Reject Incident'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="pid-panel-section">
        <p className="pid-panel-section-head">Add Field Note</p>
        <textarea
          className="pid-note-composer"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write your field observation…"
          disabled={!incident || !!busyAction}
          rows={4}
        />
        <button
          type="button"
          className="pid-save-note-btn"
          onClick={() => handleAction('note', { note })}
          disabled={!note.trim() || !incident || !!busyAction}
        >
          <NoteAddOutlinedIcon fontSize="small" />
          <span>Save Note</span>
        </button>
      </div>

      <div className="pid-panel-section pid-panel-section--timeline">
        <p className="pid-panel-section-head">Activity Timeline</p>
        {isLoading ? <p className="pid-timeline-empty">Loading…</p> : null}
        {!isLoading && history.length === 0 ? (
          <p className="pid-timeline-empty">No activity recorded yet.</p>
        ) : null}
        <ul className="pid-timeline">
          {history.slice(0, 8).map((entry) => (
            <li key={entry.id} className="pid-tl-entry">
              <span className="pid-tl-dot" />
              <div className="pid-tl-body">
                <span className="pid-tl-action">{label(entry.actionType)}</span>
                <span className="pid-tl-time">{entry.createdAtLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  return (
    <>
      <PoliceShell
        activeKey="active-incidents"
        rightPanel={rightPanel}
      >
        <div className="pid-layout">

          {/* ── Header ── */}
          <header className="pid-header" data-severity={incident?.severity || 'low'}>
            <div className="pid-header-row">
              <button type="button" className="pid-back-btn" onClick={() => navigate(-1)}>
                <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                <span>Back</span>
              </button>
              {incident ? <span className="pid-header-id">{incident.displayId}</span> : null}
              {incident ? (
                <div className="pid-header-badges">
                  <span className={`pid-sev-badge pid-sev--${incident.severity}`}>
                    {label(incident.severity)}
                  </span>
                  <span className="pid-status-chip">{label(incident.status)}</span>
                  {incident.incidentType ? (
                    <span className="pid-type-chip">{label(incident.incidentType)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <h1 className="pid-header-title">
              {incident?.title || (isLoading ? 'Loading…' : 'Incident Detail')}
            </h1>
            {incident?.description ? (
              <p className="pid-header-desc">{incident.description}</p>
            ) : null}
          </header>

          {/* ── Alerts ── */}
          {error ? <div className="pid-alert-error">{error}</div> : null}

          {/* ── Loading ── */}
          {isLoading && !incident ? (
            <div className="pid-loading-state">Loading incident data…</div>
          ) : null}

          {/* ── Body ── */}
          {incident ? (
            <div className="pid-body">

              {/* LEFT */}
              <div className="pid-col-left">

                {/* Intelligence */}
                <section className="pid-card">
                  <h2 className="pid-card-label">Incident Intelligence</h2>
                  <div className="pid-intel-grid">
                    <div className="pid-intel-cell">
                      <span>Incident Type</span>
                      <strong>{label(incident.incidentType) || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell">
                      <span>Source Channel</span>
                      <strong>{label(incident.sourceChannel) || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell">
                      <span>Wilaya</span>
                      <strong>{incident.wilaya?.name || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell">
                      <span>Commune</span>
                      <strong>{incident.commune?.name || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell">
                      <span>Reported by</span>
                      <strong>{incident.reportedBy?.name || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell">
                      <span>Assigned to</span>
                      <strong>{incident.assignedOfficer?.name || 'Unassigned'}</strong>
                    </div>
                    <div className="pid-intel-cell pid-intel-cell--full">
                      <span>Location</span>
                      <strong>{incident.locationText || '—'}</strong>
                    </div>
                    <div className="pid-intel-cell pid-intel-cell--full">
                      <span>Occurred</span>
                      <strong>{incident.occurredAtLabel} · {incident.timeAgo}</strong>
                    </div>
                  </div>
                </section>

                {/* Evidence */}
                <section className="pid-card">
                  <div className="pid-card-head-row">
                    <h2 className="pid-card-label">Evidence</h2>
                    {incident.media?.length > 0 ? (
                      <span className="pid-count-pill">{incident.media.length}</span>
                    ) : null}
                  </div>
                  {!incident.media?.length ? (
                    <p className="pid-empty-msg">No media evidence attached to this report.</p>
                  ) : (
                    <div className="pid-evidence-grid">
                      {incident.media.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className="pid-evidence-tile"
                          title="View full size"
                          onClick={() => openLightbox(index)}
                        >
                          <div className="pid-evidence-thumb">
                            <img
                              src={item.url}
                              alt={incident.title}
                              className="pid-evidence-img"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                if (img.dataset.fb === '1') return
                                img.dataset.fb = '1'
                                img.replaceWith(Object.assign(document.createElement('div'), {
                                  className: 'pid-evidence-broken',
                                  textContent: 'Unavailable',
                                }))
                              }}
                            />
                          </div>
                          <span className="pid-evidence-caption">{label(item.mediaType)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Field Notes */}
                <section className="pid-card">
                  <div className="pid-card-head-row">
                    <h2 className="pid-card-label">Field Notes</h2>
                    <span className="pid-count-pill">{fieldNotes.length}</span>
                  </div>
                  {fieldNotes.length === 0 ? (
                    <p className="pid-empty-msg">No field notes recorded yet. Add one in the right panel.</p>
                  ) : (
                    <ul className="pid-notes-list">
                      {fieldNotes.map((entry) => {
                        const isMine = entry.officer?.id && currentUserId && String(entry.officer.id) === String(currentUserId)
                        const isEditing = editingNoteId === entry.id
                        const isBusy = noteBusyId === entry.id
                        return (
                          <li key={entry.id} className={`pid-note${isMine ? ' pid-note--mine' : ''}`}>
                            <div className={`pid-note-avatar${entry.officer?.avatar_url || entry.officer?.avatarUrl ? ' has-image' : ''}`}>
                              {entry.officer?.avatar_url || entry.officer?.avatarUrl ? (
                                <img src={entry.officer.avatar_url || entry.officer.avatarUrl} alt={entry.officer?.name} className="pid-note-avatar-image" loading="lazy" />
                              ) : (
                                initials(entry.officer?.name)
                              )}
                            </div>
                            <div className="pid-note-bubble">
                              <div className="pid-note-meta">
                                <strong>{entry.officer?.name || 'Officer'}</strong>
                                {isMine ? <span className="pid-you-pill">You</span> : null}
                                <time className="pid-note-time">{entry.createdAtLabel}</time>
                              </div>
                              {isEditing ? (
                                <>
                                  <textarea
                                    className="pid-note-editor"
                                    value={editingDraft}
                                    onChange={(e) => setEditingDraft(e.target.value)}
                                    rows={3}
                                    disabled={isBusy}
                                    autoFocus
                                  />
                                  <div className="pid-note-actions">
                                    <button type="button" className="pid-btn pid-btn--save" onClick={() => saveEdit(entry)} disabled={isBusy || !editingDraft.trim()}>
                                      <CheckRoundedIcon sx={{ fontSize: 13 }} />
                                      {isBusy ? 'Saving…' : 'Save'}
                                    </button>
                                    <button type="button" className="pid-btn pid-btn--cancel" onClick={cancelEdit} disabled={isBusy}>
                                      <CloseRoundedIcon sx={{ fontSize: 13 }} />
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="pid-note-text">{entry.note}</p>
                                  {isMine ? (
                                    <div className="pid-note-actions">
                                      <button type="button" className="pid-btn pid-btn--ghost" onClick={() => startEdit(entry)} disabled={isBusy}>
                                        <EditOutlinedIcon sx={{ fontSize: 13 }} />
                                        Edit
                                      </button>
                                      <button type="button" className="pid-btn pid-btn--delete" onClick={() => deleteNote(entry)} disabled={isBusy}>
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                                        {isBusy ? 'Removing…' : 'Delete'}
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

              </div>

              {/* RIGHT */}
              <div className="pid-col-right">

                {/* Map */}
                <section className="pid-card pid-map-card">
                  <h2 className="pid-card-label">Location</h2>
                  <div className="pid-map-wrap">
                    <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="police-leaflet-map">
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      {incident.location?.lat != null && incident.location?.lng != null ? (
                        <CircleMarker
                          center={[incident.location.lat, incident.location.lng]}
                          radius={10}
                          pathOptions={{ color: '#fff', weight: 2.5, fillColor: severityColor(incident.severity), fillOpacity: 1 }}
                        >
                          <Popup><strong>{incident.displayId}</strong><br />{incident.title}</Popup>
                        </CircleMarker>
                      ) : null}
                      {nearbyIncidents.map((item) =>
                        item.location?.lat != null && item.location?.lng != null ? (
                          <CircleMarker
                            key={item.id}
                            center={[item.location.lat, item.location.lng]}
                            radius={6}
                            pathOptions={{ color: '#fff', weight: 1.5, fillColor: severityColor(item.severity), fillOpacity: 0.85 }}
                          >
                            <Popup>{item.displayId}</Popup>
                          </CircleMarker>
                        ) : null,
                      )}
                    </MapContainer>
                  </div>
                </section>


              </div>
            </div>
          ) : null}

        </div>
      </PoliceShell>

      {/* Confirm dialog */}
      {confirmDialog ? (
        <div
          className="pid-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pid-confirm-title"
          onClick={() => !busyAction && setConfirmDialog(null)}
        >
          <div className="pid-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="pid-confirm-title" className="pid-confirm-title">{confirmDialog.label}</h3>
            <p className="pid-confirm-msg">{confirmDialog.message}</p>
            <div className="pid-confirm-actions">
              <button
                type="button"
                className="pid-confirm-cancel"
                onClick={() => setConfirmDialog(null)}
                disabled={!!busyAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`pid-confirm-ok pid-confirm-ok--${confirmDialog.tone}`}
                onClick={() => { const a = confirmDialog.action; setConfirmDialog(null); handleAction(a) }}
                disabled={!!busyAction}
              >
                {confirmDialog.label}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightboxUrl ? (
        <div className="police-media-lightbox" onClick={closeLightbox}>
          <div className="police-media-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
            <button className="police-media-zoom-btn" onClick={lbZoomIn} title="Zoom in">+</button>
            <button className="police-media-zoom-btn" onClick={lbZoomOut} title="Zoom out">−</button>
            <button className="police-media-zoom-btn reset" onClick={lbReset} title="Reset">1:1</button>
          </div>
          <button className="police-media-lightbox-close" onClick={closeLightbox} title="Close">×</button>

          {mediaList.length > 1 ? (
            <>
              <button
                type="button"
                className="police-media-lightbox-nav police-media-lightbox-nav--prev"
                onClick={(e) => { e.stopPropagation(); showPrevImage() }}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                className="police-media-lightbox-nav police-media-lightbox-nav--next"
                onClick={(e) => { e.stopPropagation(); showNextImage() }}
                aria-label="Next photo"
              >
                ›
              </button>
              <span className="police-media-lightbox-counter">
                {lightboxIndex + 1} / {mediaList.length}
              </span>
            </>
          ) : null}

          <div className="police-media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div
              ref={stageRef}
              className={`police-media-lightbox-stage${lightboxScale > 1 ? ' zoomed' : ''}${isDragging ? ' dragging' : ''}`}
              onMouseDown={onDragStart}
              onMouseMove={onDragMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
            >
              <img
                src={lightboxUrl}
                alt="Evidence"
                className="police-media-lightbox-image"
                draggable={false}
                style={{ transform: `translate(${lightboxOffset.x}px, ${lightboxOffset.y}px) scale(${lightboxScale})` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
