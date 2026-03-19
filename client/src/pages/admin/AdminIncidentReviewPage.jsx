/**
 * @file AdminIncidentReviewPage.jsx
 * @description Admin page for reviewing a single incident report in a 3-column split layout.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  fetchAdminIncident,
  submitAdminIncidentAction,
} from '../../services/adminIncidentsService'

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

function getConfidenceLabel(incident) {
  if (typeof incident?.aiAssessment?.confidence === 'number' && incident.aiAssessment.status === 'completed') {
    return `${incident.aiAssessment.confidence}%`
  }

  if (incident?.aiAssessment?.status === 'pending') {
    return 'Pending AI'
  }

  if (incident?.aiAssessment?.status === 'failed') {
    return 'AI failed'
  }

  return EMPTY_TEXT
}

function getAssessmentStatusLabel(status) {
  if (status === 'completed') return 'Completed'
  if (status === 'pending') return 'Pending'
  if (status === 'failed') return 'Failed'
  return 'Not available'
}

function getDecisionAction(decision) {
  switch (decision) {
    case 'approve':
      return 'verify'
    case 'change':
      return 'change_severity'
    case 'merge':
      return 'merge'
    case 'info':
      return 'request_info'
    case 'flag':
      return 'flag'
    case 'reject':
      return 'reject'
    case 'archive':
      return 'archive'
    default:
      return null
  }
}

export default function AdminIncidentReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [incident, setIncident] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [decision, setDecision] = useState('')
  const [newSeverity, setNewSeverity] = useState('medium')
  const [actionNote, setActionNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [mergeTargetReportId, setMergeTargetReportId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [noteSubmitting, setNoteSubmitting] = useState(false)

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
          setMergeTargetReportId(payload.nearbyReports[0]?.reportId || '')
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
      await submitAdminIncidentAction(incident.reportId, {
        action,
        note: actionNote,
        severity: decision === 'change' ? newSeverity : null,
        mergeTargetReportId: decision === 'merge' ? mergeTargetReportId : null,
      })

      navigate('/admin/incidents')
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
        <h2 className="admin-card-title">Loading incident...</h2>
        <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
          Fetching the latest incident details and moderation history.
        </p>
      </div>
    )
  }

  if (error && !incident) {
    return (
      <div className="admin-card">
        <h2 className="admin-card-title">Incident unavailable</h2>
        <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
          {error.message || 'Unable to load this incident report.'}
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="admin-btn admin-btn-primary" onClick={() => navigate('/admin/incidents')}>
            Back to Queue
          </button>
        </div>
      </div>
    )
  }

  if (!incident) {
    return null
  }

  return (
    <div className="admin-review-split">
      <div className="admin-review-left">
        <button className="admin-btn admin-btn-ghost" onClick={() => navigate('/admin/incidents')} style={{ marginBottom: 10, fontSize: 11 }}>
          ← Back to Queue
        </button>

        {error && (
          <div
            className="admin-card"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <h3 className="admin-card-title">Action failed</h3>
            <p className="admin-card-subtitle" style={{ marginTop: 6 }}>
              {error.message || 'Please try again.'}
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
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--admin-text-secondary)', marginTop: 8 }}>
            {incident.description || 'No additional description was provided for this report.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Status</span>
              <span className="admin-mini-stat-value">{incident.status}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Reported</span>
              <span className="admin-mini-stat-value">{formatDateTime(incident.createdAt)}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Severity Source</span>
              <span className="admin-mini-stat-value">{incident.severitySource === 'ai' ? 'AI assessment' : 'Report hint'}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Open Flags</span>
              <span className="admin-mini-stat-value">{incident.openFlagCount}</span>
            </div>
          </div>
          {incident.mergedIntoReportId ? (
            <div className="admin-internal-note">
              <div className="admin-internal-note-label">Merge</div>
              <div style={{ fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                Merged into {incident.mergedIntoReportId} on {formatDateTime(incident.mergedAt)}
              </div>
              {incident.mergeReason ? (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--admin-text-secondary)' }}>
                  Reason: {incident.mergeReason}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {incident.media.length > 0 && (
          <div className="admin-card">
            <h3 className="admin-card-title">Evidence ({incident.media.length})</h3>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {incident.media.map((mediaItem, index) => (
                <a
                  key={mediaItem.id}
                  href={mediaItem.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', width: 100, height: 70, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--admin-border)' }}
                >
                  <img
                    src={mediaItem.url}
                    alt={`Evidence ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="admin-card">
          <h3 className="admin-card-title">Reporter Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Reporter</span>
              <span className="admin-mini-stat-value">{incident.reporter.name}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Reporter Score</span>
              <span className="admin-mini-stat-value">{EMPTY_TEXT}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Total Reports</span>
              <span className="admin-mini-stat-value">{incident.reporter.totalReports}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Joined</span>
              <span className="admin-mini-stat-value">{formatDateOnly(incident.reporter.joinedAt)}</span>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">AI Assessment</h3>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Status</span>
              <span style={{ fontWeight: 600 }}>{getAssessmentStatusLabel(incident.aiAssessment.status)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Severity</span>
              <span style={{ fontWeight: 600 }}>
                {incident.severitySource === 'ai'
                  ? `AI ${incident.severity}`
                  : `Report hint (${incident.severity})`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Confidence</span>
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
                <span style={{ fontWeight: 600 }}>{getConfidenceLabel(incident)}</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Latest Update</span>
              <span style={{ fontWeight: 600 }}>{formatDateTime(incident.aiAssessment.assessedAt)}</span>
            </div>
            {incident.aiAssessment.modelVersionId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
                <span style={{ color: 'var(--admin-text-muted)' }}>Model Version</span>
                <span style={{ fontWeight: 600 }}>{incident.aiAssessment.modelVersionId.slice(0, 8)}</span>
              </div>
            ) : null}
            {incident.aiAssessment.status !== 'completed' ? (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--admin-surface-2)', borderRadius: 6, color: 'var(--admin-text-secondary)', fontSize: 11 }}>
                AI verification is not fully active yet for incident reports, so severity falls back to the report hint until a completed assessment exists.
              </div>
            ) : null}
          </div>
        </div>

        {incident.flags.length > 0 && (
          <div className="admin-card">
            <h3 className="admin-card-title">Community Flags</h3>
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
                <p style={{ fontSize: 11, color: 'var(--admin-text-muted)' }}>All community flags have been resolved.</p>
              )}
            </div>
          </div>
        )}

        <div className="admin-card">
          <h3 className="admin-card-title">Timeline</h3>
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
        <div className="admin-card" style={{ flex: 1, minHeight: 300 }}>
          <h3 className="admin-card-title">Incident Location</h3>
          <div style={{ background: 'var(--admin-surface-alt)', borderRadius: 8, height: 260, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)', fontSize: 12, position: 'relative' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📍</div>
              <div>{incident.location}</div>
              <div style={{ fontSize: 10, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {incident.coordinates.lat != null && incident.coordinates.lng != null
                  ? `${incident.coordinates.lat.toFixed(4)}°N, ${incident.coordinates.lng.toFixed(4)}°E`
                  : EMPTY_TEXT}
              </div>
            </div>
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => navigate('/map')}>
                Open Full Map
              </button>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Nearby Reports</h3>
          {incident.nearbyReports.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {incident.nearbyReports.map((nearby) => (
                <div key={nearby.reportId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{nearby.displayId}</div>
                    <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>
                      {nearby.location} · {formatDistance(nearby.distanceKm)}
                    </div>
                    {decision === 'merge' ? (
                      <button
                        className={`admin-btn admin-btn-sm ${mergeTargetReportId === nearby.reportId ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                        style={{ marginTop: 6 }}
                        onClick={() => setMergeTargetReportId(nearby.reportId)}
                      >
                        {mergeTargetReportId === nearby.reportId ? 'Selected Target' : 'Use as Merge Target'}
                      </button>
                    ) : null}
                  </div>
                  <span className={`admin-pill ${nearby.severity}`}>{nearby.severity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 8 }}>No nearby reports found</p>
          )}
          {incident.nearbyReports.length >= 2 && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--admin-warning)', fontWeight: 600 }}>
                ⚠ Cluster detected · {incident.nearbyReports.length + 1} incidents within 5 km
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="admin-review-right">
        <div className="admin-card">
          <h3 className="admin-card-title">Decision Engine</h3>
          <p style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 4, marginBottom: 12 }}>
            Select an action for this incident
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className={`admin-btn admin-btn-full ${decision === 'approve' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setDecision('approve')}>
              ✓ Approve & Publish
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'change' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setDecision('change')}>
              ✎ Change Severity
            </button>
            {decision === 'change' && (
              <select className="admin-select" value={newSeverity} onChange={(event) => setNewSeverity(event.target.value)} style={{ marginLeft: 8 }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            )}
            <button className={`admin-btn admin-btn-full ${decision === 'merge' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setDecision('merge')}>
              ⊕ Merge with Cluster
            </button>
            {decision === 'merge' && (
              <input
                className="admin-input"
                type="text"
                placeholder="Merge target report ID"
                value={mergeTargetReportId}
                onChange={(event) => setMergeTargetReportId(event.target.value)}
                style={{ marginLeft: 8 }}
              />
            )}
            <button className={`admin-btn admin-btn-full ${decision === 'info' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => setDecision('info')}>
              ? Request More Info
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'flag' ? 'admin-btn-warning' : 'admin-btn-ghost'}`} onClick={() => setDecision('flag')}>
              ⚑ Flag for Review
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'archive' ? 'admin-btn-warning' : 'admin-btn-ghost'}`} onClick={() => setDecision('archive')}>
              ▪ Archive
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'reject' ? 'admin-btn-danger' : 'admin-btn-ghost'}`} onClick={() => setDecision('reject')}>
              ✕ Reject
            </button>
          </div>

          {decision && (
            <div style={{ marginTop: 12 }}>
              <textarea
                className="admin-textarea"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder={
                  decision === 'merge'
                    ? 'Merge reason (optional)'
                    : decision === 'info'
                      ? 'Request details (optional)'
                      : 'Reviewer note (optional)'
                }
              />
              <button
                className="admin-btn admin-btn-primary admin-btn-full"
                style={{ marginTop: 10 }}
                onClick={handleDecisionSubmit}
                disabled={isSubmitting || (decision === 'merge' && !mergeTargetReportId)}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Decision →'}
              </button>
            </div>
          )}
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Internal Notes</h3>
          <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {incident.notes.length === 0 && <p style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>No notes yet</p>}
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
              placeholder="Add internal note..."
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addNote()}
              style={{ flex: 1, height: 30, fontSize: 11 }}
            />
            <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={addNote} disabled={noteSubmitting}>
              {noteSubmitting ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
