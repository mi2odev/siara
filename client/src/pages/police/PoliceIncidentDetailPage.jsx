import React, { useContext } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { useNavigate, useParams } from 'react-router-dom'

import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

import PoliceShell from '../../components/layout/PoliceShell'
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

function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function severityColor(severity) {
  if (severity === 'critical') return '#991b1b'
  if (severity === 'high') return '#dc2626'
  if (severity === 'medium') return '#f59e0b'
  return '#16a34a'
}

function getInitials(name) {
  return String(name || 'O')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'O'
}

export default function PoliceIncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useContext(AuthContext)
  const currentUserId = user?.id || user?.userId || null
  const [note, setNote] = React.useState('')
  const [detail, setDetail] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [editingNoteId, setEditingNoteId] = React.useState(null)
  const [editingDraft, setEditingDraft] = React.useState('')
  const [noteBusyId, setNoteBusyId] = React.useState(null)

  const loadIncident = React.useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getPoliceIncident(id)
      setDetail(response)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load incident details.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    loadIncident()
  }, [loadIncident])

  const incident = detail?.incident || null
  const nearbyIncidents = detail?.nearbyIncidents || []
  const history = detail?.history || []
  const fieldNotes = React.useMemo(
    () => history.filter((entry) => entry.actionType === 'field_note' && entry.note),
    [history],
  )

  const startEditNote = (entry) => {
    setEditingNoteId(entry.id)
    setEditingDraft(entry.note || '')
    setError('')
  }

  const cancelEditNote = () => {
    setEditingNoteId(null)
    setEditingDraft('')
  }

  const saveEditNote = async (entry) => {
    const trimmed = editingDraft.trim()
    if (!trimmed) {
      setError('Note cannot be empty.')
      return
    }
    setNoteBusyId(entry.id)
    setError('')
    try {
      const next = await updatePoliceFieldNote(incident.id, entry.id, { note: trimmed })
      setDetail(next)
      setEditingNoteId(null)
      setEditingDraft('')
    } catch (updateError) {
      setError(updateError.message || 'Failed to update field note.')
    } finally {
      setNoteBusyId(null)
    }
  }

  const removeNote = async (entry) => {
    if (!incident) return
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this field note? This cannot be undone.')
      : true
    if (!confirmed) return
    setNoteBusyId(entry.id)
    setError('')
    try {
      const next = await deletePoliceFieldNote(incident.id, entry.id)
      setDetail(next)
      if (editingNoteId === entry.id) {
        setEditingNoteId(null)
        setEditingDraft('')
      }
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete field note.')
    } finally {
      setNoteBusyId(null)
    }
  }

  const handleAction = async (action, payload = {}) => {
    if (!incident) {
      return
    }

    setError('')

    try {
      if (action === 'verify') {
        setDetail(await verifyPoliceIncident(incident.id, payload))
      } else if (action === 'reject') {
        setDetail(await rejectPoliceIncident(incident.id, payload))
      } else if (action === 'backup') {
        setDetail(await requestPoliceBackup(incident.id, payload))
      } else if (action === 'resolve') {
        setDetail(await updatePoliceIncidentStatus(incident.id, { status: 'resolved', ...payload }))
      } else if (action === 'note') {
        setDetail(await addPoliceFieldNote(incident.id, payload))
        setNote('')
      }
    } catch (actionError) {
      setError(actionError.message || 'Failed to update incident.')
    }
  }

  const rightPanel = (
    <section className="police-section police-detail-actions">
      <h2>Incident Actions</h2>
      <div className="police-detail-action-stack">
        <button className="police-action police-action-verify" onClick={() => handleAction('verify')}>Verify Incident</button>
        <button className="police-action police-action-view" onClick={() => handleAction('backup')}>Request Backup</button>
        <button className="police-action police-action-reject" onClick={() => handleAction('reject')}>Reject Incident</button>
        <button className="police-action police-action-resolve" onClick={() => handleAction('resolve')}>Resolve Incident</button>
      </div>

      <label className="police-meta" htmlFor="police-note">Field Note</label>
      <textarea
        id="police-note"
        className="police-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a field note..."
      />
      <div className="police-action-row police-detail-note-actions">
        <button className="police-action police-action-verify" onClick={() => handleAction('note', { note })} disabled={!note.trim()}>
          Save Note
        </button>
        <button className="police-action police-action-view" onClick={() => navigate('/police/verification')}>
          Open Queue
        </button>
      </div>

      <div className="police-action-history">
        <strong>Recent Actions</strong>
        <ul className="police-list">
          {history.slice(0, 5).map((entry) => (
            <li key={entry.id}>{displayLabel(entry.actionType)} ({entry.createdAtLabel})</li>
          ))}
          {!isLoading && history.length === 0 ? <li>No history recorded yet.</li> : null}
        </ul>
      </div>
    </section>
  )

  const mapCenter = incident?.location?.lat != null && incident?.location?.lng != null
    ? [incident.location.lat, incident.location.lng]
    : [36.7538, 3.0588]

  return (
    <PoliceShell activeKey="active-incidents" rightPanel={rightPanel} verificationPendingCount={incident?.status === 'pending' ? 1 : 0}>
      <div className="police-detail-layout">
        <section className="police-section police-incident-profile" data-severity={incident?.severity || 'low'}>
          {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
          {isLoading ? <p className="police-meta">Loading incident...</p> : null}

          {incident ? (
            <>
              <div className="police-incident-header">
                <p className="police-meta">Incident {incident.displayId}</p>
                <h2>{incident.title}</h2>
                <div className="police-incident-header-badges">
                  <span className={`police-badge ${incident.severity}`}>{displayLabel(incident.severity)}</span>
                  <span className={`police-badge ${incident.status}`}>{displayLabel(incident.status)}</span>
                </div>
              </div>

              <div className="police-incident-facts">
                <div className="police-incident-fact"><span>Location</span><strong>{incident.locationText}</strong></div>
                <div className="police-incident-fact"><span>Wilaya</span><strong>{incident.wilaya?.name || 'Unknown'}</strong></div>
                <div className="police-incident-fact"><span>Commune</span><strong>{incident.commune?.name || 'Unknown'}</strong></div>
                <div className="police-incident-fact"><span>Reported</span><strong>{incident.occurredAtLabel}</strong></div>
                <div className="police-incident-fact"><span>Reporter</span><strong>{incident.reportedBy?.name || 'Unknown'}</strong></div>
                <div className="police-incident-fact"><span>Assigned</span><strong>{incident.assignedOfficer?.name || 'Unassigned'}</strong></div>
              </div>

              <section className="police-incident-notes" aria-labelledby="police-incident-notes-title">
                <div className="police-incident-notes-head">
                  <h3 id="police-incident-notes-title">Field Notes</h3>
                  <span className="police-incident-notes-count">{fieldNotes.length} note{fieldNotes.length === 1 ? '' : 's'}</span>
                </div>

                {fieldNotes.length === 0 ? (
                  <p className="police-meta police-incident-notes-empty">
                    No field notes recorded yet. Use the panel on the right to add one.
                  </p>
                ) : (
                  <ul className="police-incident-notes-list">
                    {fieldNotes.map((entry) => {
                      const isMine = entry.officer?.id && currentUserId && entry.officer.id === currentUserId
                      const isEditing = editingNoteId === entry.id
                      const isBusy = noteBusyId === entry.id
                      return (
                        <li
                          key={entry.id}
                          className={`police-incident-note-card${isMine ? ' is-mine' : ''}`}
                        >
                          <div className="police-incident-note-avatar" aria-hidden="true">
                            {getInitials(entry.officer?.name)}
                          </div>
                          <div className="police-incident-note-body">
                            <div className="police-incident-note-head">
                              <div className="police-incident-note-author">
                                <strong>{entry.officer?.name || 'Officer'}</strong>
                                {isMine ? <span className="police-incident-note-tag">You</span> : null}
                              </div>
                              <time
                                className="police-incident-note-time"
                                dateTime={entry.createdAt || undefined}
                              >
                                {entry.createdAtLabel}
                              </time>
                            </div>

                            {isEditing ? (
                              <>
                                <textarea
                                  className="police-incident-note-editor"
                                  value={editingDraft}
                                  onChange={(event) => setEditingDraft(event.target.value)}
                                  rows={3}
                                  disabled={isBusy}
                                />
                                <div className="police-incident-note-actions">
                                  <button
                                    type="button"
                                    className="police-action police-action-verify police-incident-note-btn"
                                    onClick={() => saveEditNote(entry)}
                                    disabled={isBusy || !editingDraft.trim()}
                                  >
                                    <CheckRoundedIcon fontSize="inherit" />
                                    <span>{isBusy ? 'Saving…' : 'Save'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="police-action police-action-view police-incident-note-btn"
                                    onClick={cancelEditNote}
                                    disabled={isBusy}
                                  >
                                    <CloseRoundedIcon fontSize="inherit" />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="police-incident-note-text">{entry.note}</p>
                                {isMine ? (
                                  <div className="police-incident-note-actions">
                                    <button
                                      type="button"
                                      className="police-action police-action-view police-incident-note-btn"
                                      onClick={() => startEditNote(entry)}
                                      disabled={isBusy}
                                    >
                                      <EditOutlinedIcon fontSize="inherit" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="police-action police-action-reject police-incident-note-btn"
                                      onClick={() => removeNote(entry)}
                                      disabled={isBusy}
                                    >
                                      <DeleteOutlineRoundedIcon fontSize="inherit" />
                                      <span>{isBusy ? 'Removing…' : 'Delete'}</span>
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

              <section className="police-incident-timeline">
                <h3>Operation History</h3>
                <ul className="police-list">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      {displayLabel(entry.actionType)} on {entry.createdAtLabel}
                      {entry.note ? ` - ${entry.note}` : ''}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="police-incident-evidence">
                <header className="police-incident-evidence-head">
                  <h3>Evidence</h3>
                  {incident.media.length > 0 ? (
                    <span className="police-incident-evidence-count">
                      {incident.media.length} item{incident.media.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </header>

                {incident.media.length === 0 ? (
                  <div className="police-incident-evidence-empty">
                    No media evidence attached.
                  </div>
                ) : (
                  <div className="police-evidence-grid">
                    {incident.media.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="police-evidence-item"
                        title="Open full-size"
                      >
                        <div className="police-evidence-thumb">
                          <img
                            src={item.url}
                            alt={incident.title}
                            className="police-evidence-img"
                            loading="lazy"
                            onError={(event) => {
                              const img = event.currentTarget
                              if (img.dataset.fallbackApplied === '1') return
                              img.dataset.fallbackApplied = '1'
                              img.replaceWith(Object.assign(document.createElement('div'), {
                                className: 'police-evidence-missing',
                                textContent: 'Image unavailable',
                              }))
                            }}
                          />
                        </div>
                        <span className="police-evidence-label">{displayLabel(item.mediaType)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <p className="police-incident-description">{incident.description || 'No description provided.'}</p>
            </>
          ) : null}
        </section>

        <section className="police-section police-incident-map-panel">
          <div className="police-incident-map-header">
            <h2>Map and Nearby Incidents</h2>
            <button className="police-action police-action-view" onClick={() => navigate('/police?view=active')}>Back to Active Stream</button>
          </div>

          <div className="police-mini-map police-detail-map">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="police-leaflet-map">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {incident?.location?.lat != null && incident?.location?.lng != null ? (
                <CircleMarker
                  center={[incident.location.lat, incident.location.lng]}
                  radius={8}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: severityColor(incident.severity), fillOpacity: 1 }}
                >
                  <Popup>{incident.displayId}</Popup>
                </CircleMarker>
              ) : null}
              {nearbyIncidents.map((item) => (
                item.location?.lat != null && item.location?.lng != null ? (
                  <CircleMarker
                    key={item.id}
                    center={[item.location.lat, item.location.lng]}
                    radius={6}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: severityColor(item.severity), fillOpacity: 0.9 }}
                  >
                    <Popup>{item.displayId}</Popup>
                  </CircleMarker>
                ) : null
              ))}
            </MapContainer>
          </div>

          <div className="police-nearby-wrap">
            <strong className="police-nearby-title">Nearby Incidents</strong>
            <ul className="police-list police-nearby-list">
              {nearbyIncidents.map((item) => (
                <li key={item.id} className="police-nearby-item" data-severity={item.severity}>
                  <strong className="police-nearby-id">{item.displayId}</strong>
                  <span className="police-nearby-type">{item.title}</span>
                  <span className="police-nearby-location">{item.locationText}</span>
                  <button type="button" className="police-action police-action-view" onClick={() => navigate(`/police/incident/${item.id}`)}>
                    Open
                  </button>
                </li>
              ))}
              {!isLoading && nearbyIncidents.length === 0 ? <li>No nearby incidents found around this report.</li> : null}
            </ul>
          </div>
        </section>
      </div>
    </PoliceShell>
  )
}
