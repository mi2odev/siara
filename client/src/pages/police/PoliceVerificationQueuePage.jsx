import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  getPoliceIncidents,
  subscribePoliceIncidents,
  updatePoliceIncidentStatus,
} from '../../data/policeMockData'

export default function PoliceVerificationQueuePage() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState(() => getPoliceIncidents().filter((item) => item.status === 'reported'))
  const [toast, setToast] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState(null)
  const [selectedImageAlt, setSelectedImageAlt] = useState('Incident image')
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const averageReliability = useMemo(() => {
    if (!queue.length) return 0
    return Math.round(queue.reduce((sum, item) => sum + Number(item.reliability || 0), 0) / queue.length)
  }, [queue])

  const takeAction = (incidentId, action) => {
    if (action === 'approved') {
      updatePoliceIncidentStatus(incidentId, 'verified')
    }

    if (action === 'rejected') {
      updatePoliceIncidentStatus(incidentId, 'rejected')
    }

    if (action === 'flagged') {
      setQueue((prev) => prev.filter((item) => item.id !== incidentId))
    }

    setToast(`Incident ${incidentId} ${action}`)
    setTimeout(() => setToast(''), 1700)
  }

  useEffect(() => {
    const unsubscribe = subscribePoliceIncidents((items) => {
      setQueue(items.filter((item) => item.status === 'reported'))
    })

    return unsubscribe
  }, [])

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
    <>
      <section className="police-section">
        <h2>Verification Metrics</h2>
        <ul className="police-list">
          <li><strong>Pending queue:</strong> {queue.length}</li>
          <li><strong>Avg reliability:</strong> {averageReliability}%</li>
          <li><strong>Target SLA:</strong> Verify within 10 min</li>
        </ul>
      </section>
      <section className="police-section">
        <h2>Moderator Notes</h2>
        <ul className="police-list">
          <li>Prioritize high severity + low reliability conflicts.</li>
          <li>Flag repeated false reports for manual review.</li>
          <li>Cross-check with nearby incidents and map evidence.</li>
        </ul>
      </section>
    </>
  )

  return (
    <PoliceShell
      activeKey="verification-queue"
      rightPanel={rightPanel}
      notificationCount={queue.length}
      verificationPendingCount={queue.length}
    >
      <section className="police-section">
        <h2>Verification Queue</h2>
        <div className="police-verification-grid">
          {queue.map((incident) => (
            <article
              key={incident.id}
              className="police-verification-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/police/incident/${incident.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/police/incident/${incident.id}`)
                }
              }}
            >
              <div className="police-verification-left">
                {incident.image
                  ? (
                    <button
                      type="button"
                      className="police-image-open-btn"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedImageUrl(incident.image)
                        setSelectedImageAlt(incident.type)
                      }}
                      aria-label="Open incident image"
                    >
                      <img src={incident.image} alt={incident.type} />
                      <span className="police-queue-hover-preview" aria-hidden="true">
                        <img src={incident.image} alt={incident.type} />
                      </span>
                    </button>
                  )
                  : <div className="police-verification-placeholder">No image provided</div>}
              </div>

              <div className="police-verification-center">
                <strong className="police-title">{incident.id} · {incident.type}</strong>
                <p className="police-meta">{incident.description}</p>
                <span className="police-meta">Reporter: {incident.reporter}</span>
                <span className="police-meta">📍 {incident.location}</span>
                {incident.severity === 'high' && Number(incident.reliability || 0) < 70 ? (
                  <span className="police-conflict-warning">⚠ Conflict: High severity but low reliability</span>
                ) : null}
              </div>

              <div className="police-verification-right">
                <span className="police-verification-reliability">🟢 {incident.reliability}% reliability</span>
                <span className="police-meta">{incident.timeAgo}</span>
                <div className="police-verification-actions">
                  <button className="police-action police-action-verify" onClick={(event) => { event.stopPropagation(); takeAction(incident.id, 'approved') }}>✔ Approve</button>
                  <button className="police-action police-action-reject" onClick={(event) => { event.stopPropagation(); takeAction(incident.id, 'rejected') }}>✖ Reject</button>
                  <button className="police-action police-action-view" onClick={(event) => { event.stopPropagation(); takeAction(incident.id, 'flagged') }}>🚩 Flag user</button>
                </div>
              </div>
            </article>
          ))}
          {queue.length === 0 ? <p className="police-meta">No pending incidents in verification queue.</p> : null}
        </div>
      </section>

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
              <img
                className="police-media-lightbox-image"
                src={selectedImageUrl}
                alt={selectedImageAlt}
                style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})` }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}
