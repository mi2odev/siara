import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

/* ── Mock incident data ── */
const mockIncidents = {
  'INC-2401': {
    id: 'INC-2401', location: 'Blvd Zirout Youcef, Algiers', lat: 36.7538, lng: 3.0588,
    severity: 'high', confidence: 94, status: 'pending', type: 'Collision',
    description: 'Multi-vehicle collision involving 3 cars on the main boulevard. Traffic is blocked in both directions. Emergency services have been notified.',
    reporter: { name: 'ahmed_b', reliability: 92, totalReports: 48, accuracy: 94, joined: '2023-06-12' },
    aiClassification: { type: 'Vehicle Collision', severity: 'High', confidence: 94, model: 'SiaraNet v2.3', factors: ['Multiple vehicles detected', 'Road blockage confirmed', 'Rush hour timing'] },
    nearby: [
      { id: 'INC-2396', location: 'Place des Martyrs', distance: '0.8 km', severity: 'medium' },
      { id: 'INC-2397', location: 'El Harrach Bridge', distance: '3.2 km', severity: 'high' },
    ],
    photos: ['photo_collision_01.jpg', 'photo_collision_02.jpg'],
    timeline: [
      { time: '08:34', event: 'Reported by ahmed_b' },
      { time: '08:34', event: 'AI classification: High severity (94%)' },
      { time: '08:36', event: 'Entered review queue' },
    ],
    notes: [],
  },
}

const defaultInc = {
  id: 'INC-0000', location: 'Unknown Location', lat: 36.75, lng: 3.06,
  severity: 'medium', confidence: 75, status: 'pending', type: 'Unknown',
  description: 'No additional details available for this incident.',
  reporter: { name: 'unknown', reliability: 50, totalReports: 0, accuracy: 0, joined: 'N/A' },
  aiClassification: { type: 'Unclassified', severity: 'Medium', confidence: 75, model: 'SiaraNet v2.3', factors: [] },
  nearby: [], photos: [], timeline: [{ time: '--:--', event: 'Report created' }], notes: [],
}

export default function AdminIncidentReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const inc = mockIncidents[id] || { ...defaultInc, id: id || 'INC-0000' }

  const [decision, setDecision] = useState('')
  const [newSeverity, setNewSeverity] = useState(inc.severity)
  const [internalNote, setInternalNote] = useState('')
  const [notes, setNotes] = useState(inc.notes)

  const handleDecision = (d) => {
    setDecision(d)
    // In real app, POST to API
  }

  const addNote = () => {
    if (!internalNote.trim()) return
    setNotes([...notes, { author: 'Super Admin', time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), text: internalNote }])
    setInternalNote('')
  }

  return (
    <div className="admin-review-split">
      {/* LEFT — Incident Details */}
      <div className="admin-review-left">
        <button className="admin-btn admin-btn-ghost" onClick={() => navigate('/admin/incidents')} style={{ marginBottom: 10, fontSize: 11 }}>
          ← Back to Queue
        </button>

        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title" style={{ fontSize: 15 }}>{inc.id}</h2>
              <p className="admin-card-subtitle">{inc.type} · {inc.location}</p>
            </div>
            <span className={`admin-pill ${inc.severity}`}>{inc.severity}</span>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--admin-text-secondary)', marginTop: 8 }}>{inc.description}</p>
        </div>

        {/* Photos */}
        {inc.photos.length > 0 && (
          <div className="admin-card">
            <h3 className="admin-card-title">Evidence ({inc.photos.length})</h3>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {inc.photos.map((p, i) => (
                <div key={i} style={{ width: 100, height: 70, background: 'var(--admin-surface-alt)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--admin-text-muted)' }}>
                  📷 {i + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reporter Details */}
        <div className="admin-card">
          <h3 className="admin-card-title">Reporter Profile</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Username</span>
              <span className="admin-mini-stat-value">{inc.reporter.name}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Reliability Score</span>
              <span className="admin-mini-stat-value" style={{ color: inc.reporter.reliability >= 80 ? 'var(--admin-success)' : 'var(--admin-warning)' }}>
                {inc.reporter.reliability}%
              </span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Total Reports</span>
              <span className="admin-mini-stat-value">{inc.reporter.totalReports}</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Past Accuracy</span>
              <span className="admin-mini-stat-value">{inc.reporter.accuracy}%</span>
            </div>
          </div>
        </div>

        {/* AI Classification */}
        <div className="admin-card">
          <h3 className="admin-card-title">AI Classification</h3>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Model</span>
              <span style={{ fontWeight: 600 }}>{inc.aiClassification.model}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Type</span>
              <span style={{ fontWeight: 600 }}>{inc.aiClassification.type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5 }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Confidence</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="admin-progress" style={{ width: 60 }}>
                  <div className={`admin-progress-fill ${inc.aiClassification.confidence >= 85 ? 'success' : 'warning'}`} style={{ width: `${inc.aiClassification.confidence}%` }}></div>
                </div>
                <span style={{ fontWeight: 600, fontSize: 11 }}>{inc.aiClassification.confidence}%</span>
              </div>
            </div>
            {inc.aiClassification.factors.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contributing Factors</span>
                <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11, color: 'var(--admin-text-secondary)', lineHeight: 1.8 }}>
                  {inc.aiClassification.factors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="admin-card">
          <h3 className="admin-card-title">Timeline</h3>
          <div className="admin-audit-log" style={{ marginTop: 8, maxHeight: 'none' }}>
            {inc.timeline.map((t, i) => (
              <div className="admin-audit-entry" key={i}>
                <span className="admin-audit-time">{t.time}</span>
                <span className="admin-audit-text">{t.event}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER — Map & Nearby */}
      <div className="admin-review-center">
        <div className="admin-card" style={{ flex: 1, minHeight: 300 }}>
          <h3 className="admin-card-title">Incident Location</h3>
          <div style={{ background: 'var(--admin-surface-alt)', borderRadius: 8, height: 260, marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)', fontSize: 12, position: 'relative' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📍</div>
              <div>{inc.location}</div>
              <div style={{ fontSize: 10, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{inc.lat.toFixed(4)}°N, {inc.lng.toFixed(4)}°E</div>
            </div>
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <button className="admin-btn admin-btn-sm admin-btn-ghost">Open Full Map</button>
            </div>
          </div>
        </div>

        {/* Nearby Reports */}
        <div className="admin-card">
          <h3 className="admin-card-title">Nearby Reports</h3>
          {inc.nearby.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {inc.nearby.map(n => (
                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{n.id}</div>
                    <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{n.location} · {n.distance}</div>
                  </div>
                  <span className={`admin-pill ${n.severity}`}>{n.severity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', marginTop: 8 }}>No nearby reports found</p>
          )}
          {inc.nearby.length >= 2 && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: 10.5, color: 'var(--admin-warning)', fontWeight: 600 }}>⚠ Cluster Detected — {inc.nearby.length + 1} incidents within 5km radius</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Decision Engine */}
      <div className="admin-review-right">
        <div className="admin-card">
          <h3 className="admin-card-title">Decision Engine</h3>
          <p style={{ fontSize: 10.5, color: 'var(--admin-text-muted)', marginTop: 4, marginBottom: 12 }}>Select an action for this incident</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className={`admin-btn admin-btn-full ${decision === 'approve' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => handleDecision('approve')}>
              ✓ Approve & Publish
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'change' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => handleDecision('change')}>
              ✎ Change Severity
            </button>
            {decision === 'change' && (
              <select className="admin-select" value={newSeverity} onChange={e => setNewSeverity(e.target.value)} style={{ marginLeft: 8 }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            )}
            <button className={`admin-btn admin-btn-full ${decision === 'merge' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => handleDecision('merge')}>
              ⊕ Merge with Cluster
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'info' ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => handleDecision('info')}>
              ? Request More Info
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'flag' ? 'admin-btn-warning' : 'admin-btn-ghost'}`} onClick={() => handleDecision('flag')}>
              ⚑ Flag for Review
            </button>
            <button className={`admin-btn admin-btn-full ${decision === 'reject' ? 'admin-btn-danger' : 'admin-btn-ghost'}`} onClick={() => handleDecision('reject')}>
              ✕ Reject
            </button>
          </div>

          {decision && (
            <div style={{ marginTop: 12 }}>
              <button className="admin-btn admin-btn-primary admin-btn-full" onClick={() => { alert(`Decision "${decision}" submitted for ${inc.id}`); navigate('/admin/incidents') }}>
                Confirm Decision →
              </button>
            </div>
          )}
        </div>

        {/* Internal Notes */}
        <div className="admin-card">
          <h3 className="admin-card-title">Internal Notes</h3>
          <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto' }}>
            {notes.length === 0 && <p style={{ fontSize: 10.5, color: 'var(--admin-text-muted)' }}>No notes yet</p>}
            {notes.map((n, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--admin-border)', fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--admin-primary)' }}>{n.author}</span>
                  <span style={{ color: 'var(--admin-text-muted)', fontSize: 10 }}>{n.time}</span>
                </div>
                <p style={{ color: 'var(--admin-text-secondary)', margin: 0 }}>{n.text}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input className="admin-input" type="text" placeholder="Add internal note…" value={internalNote} onChange={e => setInternalNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} style={{ flex: 1, height: 30, fontSize: 11 }} />
            <button className="admin-btn admin-btn-sm admin-btn-primary" onClick={addNote}>Add</button>
          </div>
        </div>
      </div>
    </div>
  )
}
