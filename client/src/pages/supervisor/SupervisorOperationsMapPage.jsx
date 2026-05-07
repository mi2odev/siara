import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { getSupervisorGlobalMap } from '../../services/policeService'
import '../../styles/SupervisorMode.css'

// Algeria center
const ALGERIA_CENTER = [28.0339, 1.6596]
const DEFAULT_ZOOM = 5

function makeDivIcon(color, label, size = 32) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.45);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.44)}px;line-height:1;color:#fff;font-weight:700;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

const SEVERITY_CONFIG = {
  critical: { color: '#dc2626', emoji: '🔴', label: 'Critical' },
  high:     { color: '#ea580c', emoji: '🟠', label: 'High' },
  medium:   { color: '#ca8a04', emoji: '🟡', label: 'Medium' },
  low:      { color: '#16a34a', emoji: '🟢', label: 'Low' },
}

function sevKey(hint) {
  if (hint >= 4) return 'critical'
  if (hint >= 3) return 'high'
  if (hint >= 2) return 'medium'
  return 'low'
}

function formatRelative(value) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusLabel(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function SupervisorOperationsMapPage() {
  const navigate = useNavigate()
  const mapRef = useRef(null)

  const [data, setData] = useState({ incidents: [], officers: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const [showIncidents, setShowIncidents] = useState(true)
  const [showOfficers, setShowOfficers] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const result = await getSupervisorGlobalMap()
      setData(result)
      setLastRefreshed(new Date())
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load map data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const visibleIncidents = (data.incidents || []).filter((inc) => {
    if (!showIncidents) return false
    if (!inc.lat || !inc.lng) return false
    if (severityFilter !== 'all' && sevKey(inc.severityHint) !== severityFilter) return false
    return true
  })

  const visibleOfficers = (data.officers || []).filter((off) => {
    if (!showOfficers) return false
    return off.lat && off.lng
  })

  const incidentCounts = Object.fromEntries(
    ['critical', 'high', 'medium', 'low'].map((k) => [
      k,
      (data.incidents || []).filter((i) => sevKey(i.severityHint) === k).length,
    ])
  )

  return (
    <PoliceShell activeKey="global-map" rightPanelCollapsed>
      <div className="supervisor-page" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div className="sv-page-header" style={{ flexShrink: 0 }}>
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">Supervisor — Monitoring</span>
            <h1 className="sv-page-title">Global Operations Map</h1>
            <p className="sv-page-subtitle">
              Live incident and officer positions across all zones
              {lastRefreshed && ` · Updated ${formatRelative(lastRefreshed)}`}
            </p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost" onClick={load} disabled={loading}>↻ Refresh</button>
          </div>
        </div>

        {error && <div className="sv-error" style={{ marginBottom: 12, flexShrink: 0 }}>{error}</div>}

        {/* Controls bar */}
        <div className="sv-filters-bar" style={{ flexShrink: 0, flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className={`sv-filter-btn ${showIncidents ? 'active' : ''}`}
              onClick={() => setShowIncidents((v) => !v)}
            >
              🔴 Incidents ({data.incidents?.length ?? 0})
            </button>
            <button
              className={`sv-filter-btn ${showOfficers ? 'active' : ''}`}
              onClick={() => setShowOfficers((v) => !v)}
            >
              🔵 Officers ({data.officers?.length ?? 0})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--sv-text-muted)', paddingRight: 2 }}>Severity:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
              <button
                key={s}
                className={`sv-filter-btn ${severityFilter === s ? 'active' : ''}`}
                onClick={() => setSeverityFilter(s)}
                style={{ fontSize: 11 }}
              >
                {s === 'all' ? 'All' : SEVERITY_CONFIG[s].label}
                {s !== 'all' && ` (${incidentCounts[s] ?? 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Map + Legend wrapper */}
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          {/* Map */}
          <div style={{ flex: 1, borderRadius: 'var(--sv-radius)', overflow: 'hidden', position: 'relative', minHeight: 480 }}>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1000,
                background: 'rgba(var(--sv-bg-rgb,15,23,42),0.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, color: 'var(--sv-text)',
              }}>
                <div className="sv-loading-spinner" />
                <span style={{ fontSize: 13 }}>Loading map data...</span>
              </div>
            )}
            <MapContainer
              center={ALGERIA_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Incident markers */}
              {visibleIncidents.map((inc) => {
                const sk = sevKey(inc.severityHint)
                const cfg = SEVERITY_CONFIG[sk]
                const icon = makeDivIcon(cfg.color, cfg.emoji, 34)
                return (
                  <Marker key={`inc-${inc.id}`} position={[inc.lat, inc.lng]} icon={icon}>
                    <Popup minWidth={220}>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                          {inc.title || inc.id?.slice(0, 8)}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            background: cfg.color, color: '#fff',
                            borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                          }}>{cfg.label}</span>
                          <span style={{
                            background: '#334155', color: '#cbd5e1',
                            borderRadius: 4, padding: '1px 7px', fontSize: 11,
                          }}>{statusLabel(inc.status)}</span>
                        </div>
                        {inc.locationLabel && (
                          <div style={{ color: '#64748b', marginBottom: 2 }}>📍 {inc.locationLabel}</div>
                        )}
                        {inc.assignedOfficerName && (
                          <div style={{ color: '#64748b', marginBottom: 2 }}>👮 {inc.assignedOfficerName}</div>
                        )}
                        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
                          {formatRelative(inc.occurredAt || inc.createdAt)}
                        </div>
                        <button
                          onClick={() => navigate(`/police/incident/${inc.id}`)}
                          style={{
                            width: '100%', padding: '5px 0', cursor: 'pointer',
                            background: 'var(--sv-primary, #0e7490)', color: '#fff',
                            border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          }}
                        >
                          View Details →
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {/* Officer markers */}
              {visibleOfficers.map((off) => {
                const color = off.isOnDuty ? '#2563eb' : '#64748b'
                const icon = makeDivIcon(color, '👮', 30)
                return (
                  <Marker key={`off-${off.id}`} position={[off.lat, off.lng]} icon={icon}>
                    <Popup minWidth={200}>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{off.name}</div>
                        {off.rank && <div style={{ color: '#64748b', fontSize: 12 }}>{off.rank}</div>}
                        {off.badgeNumber && (
                          <div style={{ color: '#64748b', fontSize: 12 }}>Badge #{off.badgeNumber}</div>
                        )}
                        <div style={{ marginTop: 6 }}>
                          <span style={{
                            background: off.isOnDuty ? '#166534' : '#374151',
                            color: off.isOnDuty ? '#bbf7d0' : '#9ca3af',
                            borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                          }}>
                            {off.isOnDuty ? 'On Duty' : 'Off Duty'}
                          </span>
                        </div>
                        {(off.communeName || off.wilayaName) && (
                          <div style={{ color: '#64748b', marginTop: 4, fontSize: 12 }}>
                            📍 {[off.communeName, off.wilayaName].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {off.locationCapturedAt && (
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            Last seen: {formatRelative(off.locationCapturedAt)}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sv-section" style={{ flex: '0 0 auto' }}>
              <div className="sv-section-head">
                <h2 className="sv-section-title" style={{ fontSize: 13 }}>Legend</h2>
              </div>
              <div className="sv-section-body" style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Incidents
                </div>
                {['critical', 'high', 'medium', 'low'].map((sk) => {
                  const cfg = SEVERITY_CONFIG[sk]
                  return (
                    <div key={sk} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: cfg.color, flexShrink: 0,
                        border: '1.5px solid rgba(255,255,255,0.3)',
                      }} />
                      <span style={{ fontSize: 12, color: 'var(--sv-text)' }}>
                        {cfg.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sv-text-muted)' }}>
                        {incidentCounts[sk] ?? 0}
                      </span>
                    </div>
                  )
                })}

                <div style={{ height: 1, background: 'var(--sv-border)', margin: '10px 0' }} />

                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sv-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Officers
                </div>
                {[
                  { color: '#2563eb', label: 'On Duty', count: (data.officers || []).filter((o) => o.isOnDuty).length },
                  { color: '#64748b', label: 'Off Duty', count: (data.officers || []).filter((o) => !o.isOnDuty).length },
                ].map(({ color, label, count }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: color, flexShrink: 0,
                      border: '1.5px solid rgba(255,255,255,0.3)',
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--sv-text)' }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sv-text-muted)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary counts */}
            <div className="sv-section" style={{ flex: '0 0 auto' }}>
              <div className="sv-section-head">
                <h2 className="sv-section-title" style={{ fontSize: 13 }}>Summary</h2>
              </div>
              <div className="sv-section-body" style={{ padding: '10px 14px' }}>
                {[
                  { label: 'Visible Incidents', value: visibleIncidents.length },
                  { label: 'Visible Officers', value: visibleOfficers.length },
                  { label: 'Total Incidents', value: data.incidents?.length ?? 0 },
                  { label: 'Total Officers', value: data.officers?.length ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--sv-text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--sv-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PoliceShell>
  )
}
