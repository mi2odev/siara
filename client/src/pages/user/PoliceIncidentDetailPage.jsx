import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { createPortal } from 'react-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { POLICE_INCIDENTS } from '../../data/policeMockData'

export default function PoliceIncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [note, setNote] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('Karim')
  const [toast, setToast] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState(null)
  const [selectedMediaType, setSelectedMediaType] = useState('image')
  const [selectedMediaAlt, setSelectedMediaAlt] = useState('Incident evidence')
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const incident = useMemo(
    () => POLICE_INCIDENTS.find((item) => item.id === id) || POLICE_INCIDENTS[0],
    [id],
  )

  const nearby = useMemo(
    () => POLICE_INCIDENTS.filter((item) => item.id !== incident.id).slice(0, 3),
    [incident.id],
  )

  const verificationPendingCount = useMemo(
    () => POLICE_INCIDENTS.filter((item) => item.status === 'reported').length,
    [],
  )

  const [notesHistory, setNotesHistory] = useState([
    { id: 1, content: 'Traffic blocked', author: 'Karim', timestamp: '21:10' },
    { id: 2, content: 'Ambulance arrived', author: 'Lina', timestamp: '21:14' },
  ])

  const [actionHistory, setActionHistory] = useState([
    { id: 1, text: 'Verified by Karim', timestamp: '21:10' },
    { id: 2, text: 'Backup requested', timestamp: '21:15' },
  ])

  const timelineEntries = useMemo(
    () => [
      { time: '21:05', action: 'Reported by citizen', actor: incident.reporter || 'Citizen' },
      { time: '21:07', action: 'Under review', actor: 'Officer Karim' },
      { time: '21:10', action: 'Verified', actor: 'Officer Lina' },
      { time: '21:15', action: 'Backup requested', actor: 'Dispatch Unit' },
    ],
    [incident.reporter],
  )

  const evidenceItems = useMemo(() => {
    const items = []
    if (incident.image) {
      items.push({ id: `${incident.id}-img-1`, type: 'image', url: incident.image, label: 'Primary scene capture' })
    }

    nearby.forEach((item) => {
      if (item.image) {
        items.push({ id: `${item.id}-img`, type: 'image', url: item.image, label: `Nearby evidence ${item.id}` })
      }
    })

    items.push({
      id: `${incident.id}-video-1`,
      type: 'video',
      url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      label: 'Traffic cam clip',
    })

    return items.slice(0, 6)
  }, [incident.id, incident.image, nearby])

  const currentTimeText = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  const triggerAction = (label) => {
    setToast(label)
    setActionHistory((prev) => [
      {
        id: Date.now(),
        text: label,
        timestamp: currentTimeText(),
      },
      ...prev,
    ])
    setTimeout(() => setToast(''), 1700)
  }

  const saveNote = () => {
    const trimmed = String(note || '').trim()
    if (!trimmed) return

    setNotesHistory((prev) => [
      {
        id: Date.now(),
        content: trimmed,
        author: String(noteAuthor || 'Officer').trim() || 'Officer',
        timestamp: currentTimeText(),
      },
      ...prev,
    ])
    setNote('')
    triggerAction('Operational note added')
  }

  const reliabilityTier = useMemo(() => {
    if (incident.reliability >= 90) return 'high'
    if (incident.reliability >= 70) return 'medium'
    return 'low'
  }, [incident.reliability])

  const riskColor = (severity) => {
    if (severity === 'high') return '#dc2626'
    if (severity === 'medium') return '#f59e0b'
    return '#10b981'
  }

  useEffect(() => {
    if (!selectedImageUrl) return () => {}

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedImageUrl(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedImageUrl])

  useEffect(() => {
    if (!selectedImageUrl) return () => {}

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedImageUrl])

  useEffect(() => {
    if (!selectedImageUrl) {
      setZoomScale(1)
      setPanOffset({ x: 0, y: 0 })
      setIsDragging(false)
      dragRef.current = null
    }
  }, [selectedImageUrl])

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

  const rightPanel = (
    <section className="police-section police-detail-actions">
      <h2>Incident Actions</h2>
      <div className="police-detail-action-stack">
          <button className="police-action police-action-verify" title="Mark incident as confirmed" onClick={() => triggerAction('Incident verified successfully')}>Verify Incident</button>
          <button className="police-action police-action-view" title="Request support backup" onClick={() => triggerAction('Backup requested successfully')}>Request Backup</button>
          <button className="police-action police-action-reject" title="Mark report as false" onClick={() => triggerAction('Incident marked as false')}>Mark as False</button>
          <button className="police-action police-action-resolve" title="Close incident" onClick={() => triggerAction('Incident closed successfully')}>Close Incident</button>
      </div>

      <label className="police-meta" htmlFor="police-note">Operational Notes</label>
        <input
          id="police-note-author"
          className="police-note-author"
          value={noteAuthor}
          onChange={(event) => setNoteAuthor(event.target.value)}
          placeholder="Officer name"
        />
      <textarea
        id="police-note"
        className="police-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Operational notes..."
      />
      <div className="police-action-row police-detail-note-actions">
          <button className="police-action police-action-verify" onClick={saveNote}>Save Note</button>
          <button className="police-action police-action-view" onClick={() => navigate('/police/verification')}>Go to Queue</button>
      </div>

        <div className="police-note-history">
          <strong>Previous Notes</strong>
          <ul className="police-list">
            {notesHistory.map((entry) => (
              <li key={entry.id}>"{entry.content}" - {entry.author} ({entry.timestamp})</li>
            ))}
          </ul>
        </div>

        <div className="police-action-history">
          <strong>Actions</strong>
          <ul className="police-list">
            {actionHistory.map((entry) => (
              <li key={entry.id}>{entry.text} ({entry.timestamp})</li>
            ))}
          </ul>
        </div>
    </section>
  )

  return (
    <PoliceShell
      activeKey="active-incidents"
      rightPanel={rightPanel}
      notificationCount={3}
      verificationPendingCount={verificationPendingCount}
    >
      <div className="police-detail-layout">
        <section className="police-section police-incident-profile">
          <div className="police-incident-header">
            <p className="police-meta">Incident #{incident.id}</p>
            <h2>{incident.type}</h2>
            <div className="police-incident-header-badges">
              <span className={`police-badge ${incident.severity}`}>{incident.severity}</span>
              <span className={`police-badge ${incident.status}`}>{incident.status}</span>
              <span className={`police-reliability ${reliabilityTier}`}>Reliability {incident.reliability}%</span>
            </div>
          </div>

          <div className="police-incident-facts">
            <div className="police-incident-fact"><span>Location</span><strong>{incident.location}</strong></div>
            <div className="police-incident-fact"><span>Zone</span><strong>{incident.zone}</strong></div>
            <div className="police-incident-fact"><span>Reporter</span><strong>{incident.reporter}</strong></div>
            <div className="police-incident-fact"><span>Time</span><strong>{incident.timeAgo}</strong></div>
          </div>

          <section className="police-incident-timeline">
            <h3>Timeline</h3>
            <ul className="police-list">
              {timelineEntries.map((entry, index) => (
                <li key={`${entry.time}-${index}`}>{entry.time} {entry.action} ({entry.actor})</li>
              ))}
            </ul>
          </section>

          <section className="police-incident-evidence">
            <h3>Evidence</h3>
            <div className="police-evidence-grid">
              {evidenceItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="police-evidence-item"
                  onClick={() => {
                    setSelectedImageUrl(item.url)
                    setSelectedMediaType(item.type)
                    setSelectedMediaAlt(item.label)
                  }}
                  aria-label={`Open evidence ${item.label}`}
                >
                  {item.type === 'video' ? (
                    <video className="police-incident-image" src={item.url} muted playsInline />
                  ) : (
                    <img src={item.url} alt={item.label} className="police-incident-image" />
                  )}
                  <span className="police-evidence-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
          <p className="police-incident-description">{incident.description}</p>
        </section>

        <section className="police-section police-incident-map-panel">
          <div className="police-incident-map-header">
            <h2>Map and Nearby Incidents</h2>
            <button className="police-action police-action-view" onClick={() => navigate('/police?view=active')}>Back to Active Stream</button>
          </div>

          <div className="police-mini-map police-detail-map">
            <MapContainer
              center={[incident.lat, incident.lng]}
              zoom={13}
              scrollWheelZoom
              className="police-leaflet-map"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Circle
                center={[incident.lat, incident.lng]}
                radius={incident.severity === 'high' ? 700 : incident.severity === 'medium' ? 520 : 380}
                pathOptions={{ color: riskColor(incident.severity), opacity: 0.7, fillOpacity: 0.08 }}
              />
              <CircleMarker
                center={[incident.lat, incident.lng]}
                radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: riskColor(incident.severity), fillOpacity: 1 }}
              />
              {nearby.map((item) => (
                <CircleMarker
                  key={item.id}
                  center={[item.lat, item.lng]}
                  radius={5}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: riskColor(item.severity), fillOpacity: 0.9 }}
                />
              ))}
            </MapContainer>
          </div>

          <div className="police-nearby-wrap">
            <strong className="police-nearby-title">Nearby Incidents</strong>
            <ul className="police-list police-nearby-list">
              {nearby.map((item) => (
                <li key={item.id} className="police-nearby-item" onClick={() => navigate(`/police/incident/${item.id}`)} role="button" tabIndex={0}>
                  <strong className="police-nearby-id">{item.id}</strong>
                  <span className="police-nearby-type">{item.type}</span>
                  <span className="police-nearby-location">{item.location}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {selectedImageUrl && createPortal(
        <div className="police-media-lightbox" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setSelectedImageUrl(null)}>
          <div className="police-media-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <div className="police-media-lightbox-toolbar">
              <button type="button" className="police-media-zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
              <button type="button" className="police-media-zoom-btn reset" onClick={zoomReset} aria-label="Reset zoom">
                {Math.round(zoomScale * 100)}%
              </button>
              <button type="button" className="police-media-zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>

            <button
              type="button"
              className="police-media-lightbox-close"
              onClick={() => setSelectedImageUrl(null)}
              aria-label="Close photo preview"
            >
              ×
            </button>

            <div
              className={`police-media-lightbox-stage ${zoomScale > 1 ? 'zoomed' : ''} ${isDragging ? 'dragging' : ''}`}
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
              {selectedMediaType === 'video' ? (
                <video className="police-media-lightbox-image" src={selectedImageUrl} controls autoPlay />
              ) : (
                <img
                  className="police-media-lightbox-image"
                  src={selectedImageUrl}
                  alt={selectedMediaAlt || incident.type}
                  style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})` }}
                />
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}
