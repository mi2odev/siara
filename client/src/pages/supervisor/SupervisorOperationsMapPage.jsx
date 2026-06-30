import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  getSupervisorGlobalMap,
  getSupervisorPilotDashboard,
  listInterventions,
} from '../../services/policeService'
import '../../styles/SupervisorMode.css'

const ALGERIA_CENTER = [28.0339, 1.6596]
const DEFAULT_ZOOM = 5
const STALE_MS = 15 * 60 * 1000 // an on-duty officer with no fresh ping is "stale"
const ACTIVE_STATUSES = new Set(['pending', 'verifying', 'verified', 'in_progress', 'dispatched', 'assigned'])

const SEVERITY_CONFIG = {
  high: { color: '#dc2626', marker: 'H', labelKey: 'supervisorOperationsMapPage.severity.high' },
  medium: { color: '#d97706', marker: 'M', labelKey: 'supervisorOperationsMapPage.severity.medium' },
  low: { color: '#16a34a', marker: 'L', labelKey: 'supervisorOperationsMapPage.severity.low' },
}

const OFFICER_STATUS = {
  responding: { color: '#d97706', labelKey: 'supervisorOperationsMapPage.officerStatus.responding' },
  available: { color: '#2563eb', labelKey: 'supervisorOperationsMapPage.officerStatus.available' },
  stale: { color: '#94a3b8', labelKey: 'supervisorOperationsMapPage.officerStatus.stale' },
  off: { color: '#64748b', labelKey: 'supervisorOperationsMapPage.officerStatus.off' },
}

const INTERVENTION_STATUS_COLOR = {
  planned: '#d97706',
  in_progress: '#2563eb',
  completed: '#16a34a',
  cancelled: '#94a3b8',
}

// Hollow ring (distinct from the solid incident pins) — a dangerous segment.
function segmentIcon(severity) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low
  const size = 26
  return L.divIcon({
    className: 'sv-ops-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
      border:3px solid ${cfg.color};background:rgba(255,255,255,0.92);
      box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;
      justify-content:center;color:${cfg.color};font-weight:800;font-size:13px;">!</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

// Rounded square — an intervention, coloured by status.
function interventionIcon(status) {
  const color = INTERVENTION_STATUS_COLOR[status] || '#64748b'
  const size = 24
  return L.divIcon({
    className: 'sv-ops-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:6px;
      background:${color};color:#fff;border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;
      justify-content:center;font-weight:800;font-size:13px;">+</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

function severityKey(inc) {
  if (inc.severity === 'high' || inc.severity === 'medium' || inc.severity === 'low') return inc.severity
  const hint = Number(inc.severityHint || 0)
  if (hint >= 3) return 'high'
  if (hint >= 2) return 'medium'
  return 'low'
}

function isActiveIncident(inc) {
  return ACTIVE_STATUSES.has(String(inc.status || '').toLowerCase())
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function officerStatusKey(off, assignedCount, now) {
  if (!off.isOnDuty) return 'off'
  const ts = off.locationCapturedAt ? new Date(off.locationCapturedAt).getTime() : 0
  if (!ts || now - ts > STALE_MS) return 'stale'
  if (assignedCount > 0) return 'responding'
  return 'available'
}

function incidentIcon(severity, unassigned) {
  const cfg = SEVERITY_CONFIG[severity]
  const size = 34
  return L.divIcon({
    className: `sv-ops-pin ${unassigned ? 'sv-ops-pin--unassigned' : ''}`,
    html: `<div class="sv-ops-pin-dot" style="
      width:${size}px;height:${size}px;background:${cfg.color};
    ">${cfg.marker}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

function officerIcon(statusKey) {
  const cfg = OFFICER_STATUS[statusKey]
  const size = 30
  const hollow = statusKey === 'stale' || statusKey === 'off'
  return L.divIcon({
    className: 'sv-ops-pin',
    html: `<div class="sv-ops-pin-dot" style="
      width:${size}px;height:${size}px;
      background:${hollow ? '#ffffff' : cfg.color};
      color:${hollow ? cfg.color : '#fff'};
      border-color:${hollow ? cfg.color : 'rgba(255,255,255,0.9)'};
    ">P</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

function formatRelative(value, t) {
  if (!value) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (diff < 1) return t('supervisorOperationsMapPage.time.justNow')
  if (diff < 60) return t('supervisorOperationsMapPage.time.minutesAgo', { count: diff })
  const h = Math.floor(diff / 60)
  if (h < 24) return t('supervisorOperationsMapPage.time.hoursAgo', { count: h })
  return t('supervisorOperationsMapPage.time.daysAgo', { count: Math.floor(h / 24) })
}

function statusLabel(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Fits the map to the given points once, and exposes a fit() trigger via key bump.
function FitBounds({ points, fitKey }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) {
      map.flyTo(points[0], 12, { duration: 0.6 })
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 })
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function SupervisorOperationsMapPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['supervisor', 'common'])
  const mapRef = useRef(null)
  const markerRefs = useRef({})

  const [data, setData] = useState({ incidents: [], officers: [], segments: [], interventions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const [showIncidents, setShowIncidents] = useState(true)
  const [showOfficers, setShowOfficers] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
  const [showSegments, setShowSegments] = useState(true)
  const [showInterventions, setShowInterventions] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] = useState('all') // all | assigned | unassigned
  const [dutyFilter, setDutyFilter] = useState('all') // all | on | off

  const [activeTab, setActiveTab] = useState('incidents')
  const [selectedKey, setSelectedKey] = useState(null)
  const [fitKey, setFitKey] = useState(0)
  const didInitialFit = useRef(false)

  const load = useCallback(async () => {
    try {
      // Live incidents/officers must succeed; the pilot segments + interventions
      // overlays are best-effort so they never break the core operations map.
      const [result, pilot, interventionsRes] = await Promise.all([
        getSupervisorGlobalMap(),
        getSupervisorPilotDashboard({ days: 90 }).catch(() => ({ segments: [] })),
        listInterventions().catch(() => ({ items: [] })),
      ])
      setData({
        incidents: result.incidents || [],
        officers: result.officers || [],
        segments: (pilot.segments || []).filter((s) => s.lat != null && s.lng != null),
        interventions: (interventionsRes.items || []).filter((i) => i.lat != null && i.lng != null),
      })
      setLastRefreshed(new Date())
      setError(null)
    } catch (err) {
      setError(err.message || t('supervisorOperationsMapPage.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  // ── Derived intelligence ────────────────────────────────────────────────
  const now = lastRefreshed ? lastRefreshed.getTime() : Date.now()

  // How many active incidents each officer is assigned to (→ "responding").
  const assignedCountByOfficer = useMemo(() => {
    const counts = {}
    for (const inc of data.incidents) {
      if (inc.assignedOfficerId && isActiveIncident(inc)) {
        counts[inc.assignedOfficerId] = (counts[inc.assignedOfficerId] || 0) + 1
      }
    }
    return counts
  }, [data.incidents])

  const officers = useMemo(
    () =>
      data.officers.map((off) => ({
        ...off,
        statusKey: officerStatusKey(off, assignedCountByOfficer[off.id] || 0, now),
        assignedCount: assignedCountByOfficer[off.id] || 0,
        hasLocation: off.lat != null && off.lng != null,
      })),
    [data.officers, assignedCountByOfficer, now]
  )

  const officersById = useMemo(() => {
    const map = {}
    for (const off of officers) map[off.id] = off
    return map
  }, [officers])

  // On-duty officers that have a live position — candidates for "nearest".
  const liveOfficers = useMemo(
    () => officers.filter((o) => o.isOnDuty && o.hasLocation && o.statusKey !== 'stale'),
    [officers]
  )

  const incidents = useMemo(
    () =>
      data.incidents.map((inc) => {
        const sev = severityKey(inc)
        const active = isActiveIncident(inc)
        const unassigned = active && !inc.assignedOfficerId
        let nearest = null
        if (inc.lat != null && inc.lng != null && liveOfficers.length) {
          for (const off of liveOfficers) {
            const km = haversineKm(inc.lat, inc.lng, off.lat, off.lng)
            if (!nearest || km < nearest.km) nearest = { officer: off, km }
          }
        }
        return { ...inc, sev, active, unassigned, nearest, hasLocation: inc.lat != null && inc.lng != null }
      }),
    [data.incidents, liveOfficers]
  )

  // ── Filters → what's actually on the map ────────────────────────────────
  const visibleIncidents = useMemo(
    () =>
      incidents.filter((inc) => {
        if (!showIncidents || !inc.hasLocation) return false
        if (severityFilter !== 'all' && inc.sev !== severityFilter) return false
        if (assignmentFilter === 'assigned' && inc.unassigned) return false
        if (assignmentFilter === 'unassigned' && !inc.unassigned) return false
        return true
      }),
    [incidents, showIncidents, severityFilter, assignmentFilter]
  )

  const visibleOfficers = useMemo(
    () =>
      officers.filter((off) => {
        if (!showOfficers || !off.hasLocation) return false
        if (dutyFilter === 'on' && !off.isOnDuty) return false
        if (dutyFilter === 'off' && off.isOnDuty) return false
        return true
      }),
    [officers, showOfficers, dutyFilter]
  )

  // Assignment lines: officer (with location) → their assigned active incident.
  const assignmentLinks = useMemo(() => {
    if (!showLinks) return []
    const visibleIncIds = new Set(visibleIncidents.map((i) => i.id))
    const visibleOffIds = new Set(visibleOfficers.map((o) => o.id))
    const links = []
    for (const inc of visibleIncidents) {
      if (!inc.assignedOfficerId) continue
      const off = officersById[inc.assignedOfficerId]
      if (!off || !off.hasLocation) continue
      if (!visibleIncIds.has(inc.id) || !visibleOffIds.has(off.id)) continue
      links.push({ id: `${off.id}-${inc.id}`, from: [off.lat, off.lng], to: [inc.lat, inc.lng] })
    }
    return links
  }, [showLinks, visibleIncidents, visibleOfficers, officersById])

  // ── KPI coverage strip ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = incidents.filter((i) => i.active)
    return {
      active: active.length,
      unassigned: active.filter((i) => i.unassigned).length,
      highUnassigned: active.filter((i) => i.unassigned && i.sev === 'high').length,
      high: active.filter((i) => i.sev === 'high').length,
      onDuty: officers.filter((o) => o.isOnDuty).length,
      responding: officers.filter((o) => o.statusKey === 'responding').length,
      stale: officers.filter((o) => o.statusKey === 'stale').length,
    }
  }, [incidents, officers])

  const severityCounts = useMemo(
    () =>
      Object.fromEntries(
        ['high', 'medium', 'low'].map((k) => [k, incidents.filter((i) => i.sev === k).length])
      ),
    [incidents]
  )

  const visibleSegments = useMemo(
    () => (showSegments ? data.segments : []),
    [showSegments, data.segments]
  )
  const visibleInterventions = useMemo(
    () => (showInterventions ? data.interventions : []),
    [showInterventions, data.interventions]
  )

  // ── Map points for auto-fit ─────────────────────────────────────────────
  const fitPoints = useMemo(
    () => [
      ...visibleIncidents.map((i) => [i.lat, i.lng]),
      ...visibleOfficers.map((o) => [o.lat, o.lng]),
      ...visibleSegments.map((s) => [s.lat, s.lng]),
      ...visibleInterventions.map((i) => [i.lat, i.lng]),
    ],
    [visibleIncidents, visibleOfficers, visibleSegments, visibleInterventions]
  )

  useEffect(() => {
    if (!didInitialFit.current && fitPoints.length) {
      didInitialFit.current = true
      setFitKey((k) => k + 1)
    }
  }, [fitPoints])

  const focusOn = useCallback((key, lat, lng) => {
    setSelectedKey(key)
    if (lat == null || lng == null) return
    mapRef.current?.flyTo([lat, lng], 13, { duration: 0.6 })
    const marker = markerRefs.current[key]
    if (marker) setTimeout(() => marker.openPopup(), 350)
  }, [])

  return (
    <PoliceShell activeKey="global-map" rightPanelCollapsed>
      <div className="supervisor-page sv-ops">
        <div className="sv-page-header">
          <div className="sv-page-title-block">
            <span className="sv-page-eyebrow">{t('supervisorOperationsMapPage.eyebrow')}</span>
            <h1 className="sv-page-title">{t('supervisorOperationsMapPage.title')}</h1>
            <p className="sv-page-subtitle">
              {t('supervisorOperationsMapPage.subtitle')}
              {lastRefreshed && ` · ${t('supervisorOperationsMapPage.updatedAt', { time: formatRelative(lastRefreshed, t) })}`}
            </p>
          </div>
          <div className="sv-page-actions">
            <button className="sv-btn sv-btn-ghost" onClick={() => setFitKey((k) => k + 1)}>
              <CenterFocusStrongRoundedIcon fontSize="inherit" /> {t('supervisorOperationsMapPage.actions.fit')}
            </button>
            <button className="sv-btn sv-btn-ghost sv-btn-refresh" onClick={load} disabled={loading}>
              <RefreshRoundedIcon fontSize="inherit" /> {t('common:actions.retry')}
            </button>
          </div>
        </div>

        {error && <div className="sv-error sv-ops-error">{error}</div>}

        {/* Coverage KPIs */}
        <div className="sv-kpi-bar sv-ops-kpis">
          <div className="sv-kpi-card kpi-primary">
            <span className="sv-kpi-label">{t('supervisorOperationsMapPage.kpi.activeIncidents')}</span>
            <span className="sv-kpi-value">{kpis.active}</span>
            <span className="sv-kpi-sub">{t('supervisorOperationsMapPage.kpi.highSeverity', { count: kpis.high })}</span>
          </div>
          <div className={`sv-kpi-card ${kpis.unassigned ? 'kpi-high' : 'kpi-good'}`}>
            <span className="sv-kpi-label">{t('supervisorOperationsMapPage.kpi.unassigned')}</span>
            <span className="sv-kpi-value">{kpis.unassigned}</span>
            <span className="sv-kpi-sub">{t('supervisorOperationsMapPage.kpi.highSeverityUncovered', { count: kpis.highUnassigned })}</span>
          </div>
          <div className="sv-kpi-card kpi-accent">
            <span className="sv-kpi-label">{t('supervisorOperationsMapPage.kpi.onDuty')}</span>
            <span className="sv-kpi-value">{kpis.onDuty}</span>
            <span className="sv-kpi-sub">{t('supervisorOperationsMapPage.kpi.respondingNow', { count: kpis.responding })}</span>
          </div>
          <div className={`sv-kpi-card ${kpis.stale ? 'kpi-warning' : 'kpi-good'}`}>
            <span className="sv-kpi-label">{t('supervisorOperationsMapPage.kpi.signalLost')}</span>
            <span className="sv-kpi-value">{kpis.stale}</span>
            <span className="sv-kpi-sub">{t('supervisorOperationsMapPage.kpi.noPingThreshold')}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sv-ops-toolbar">
          <div className="sv-ops-toolbar-group">
            <span className="sv-ops-toolbar-label">{t('supervisorOperationsMapPage.toolbar.layers')}</span>
            <button className={`sv-filter-btn ${showIncidents ? 'active' : ''}`} onClick={() => setShowIncidents((v) => !v)}>
              {t('supervisorOperationsMapPage.toolbar.incidentsCount', { count: incidents.length })}
            </button>
            <button className={`sv-filter-btn ${showOfficers ? 'active' : ''}`} onClick={() => setShowOfficers((v) => !v)}>
              {t('supervisorOperationsMapPage.toolbar.officersCount', { count: officers.length })}
            </button>
            <button className={`sv-filter-btn ${showLinks ? 'active' : ''}`} onClick={() => setShowLinks((v) => !v)}>
              {t('supervisorOperationsMapPage.toolbar.assignmentLinks')}
            </button>
            <button className={`sv-filter-btn ${showSegments ? 'active' : ''}`} onClick={() => setShowSegments((v) => !v)}>
              {t('supervisorOperationsMapPage.toolbar.riskSegments', { count: data.segments.length })}
            </button>
            <button className={`sv-filter-btn ${showInterventions ? 'active' : ''}`} onClick={() => setShowInterventions((v) => !v)}>
              {t('supervisorOperationsMapPage.toolbar.interventions', { count: data.interventions.length })}
            </button>
          </div>

          <div className="sv-ops-toolbar-group">
            <span className="sv-ops-toolbar-label">{t('supervisorOperationsMapPage.toolbar.severity')}</span>
            {['all', 'high', 'medium', 'low'].map((s) => (
              <button key={s} className={`sv-filter-btn ${severityFilter === s ? 'active' : ''}`} onClick={() => setSeverityFilter(s)}>
                {s === 'all' ? t('supervisorOperationsMapPage.filter.all') : `${t(SEVERITY_CONFIG[s].labelKey)} (${severityCounts[s] ?? 0})`}
              </button>
            ))}
          </div>

          <div className="sv-ops-toolbar-group">
            <span className="sv-ops-toolbar-label">{t('supervisorOperationsMapPage.toolbar.coverage')}</span>
            {[
              { k: 'all', labelKey: 'supervisorOperationsMapPage.filter.all' },
              { k: 'unassigned', labelKey: 'supervisorOperationsMapPage.filter.unassigned' },
              { k: 'assigned', labelKey: 'supervisorOperationsMapPage.filter.assigned' },
            ].map((o) => (
              <button key={o.k} className={`sv-filter-btn ${assignmentFilter === o.k ? 'active' : ''}`} onClick={() => setAssignmentFilter(o.k)}>
                {t(o.labelKey)}
              </button>
            ))}
          </div>

          <div className="sv-ops-toolbar-group">
            <span className="sv-ops-toolbar-label">{t('supervisorOperationsMapPage.toolbar.duty')}</span>
            {[
              { k: 'all', labelKey: 'supervisorOperationsMapPage.filter.all' },
              { k: 'on', labelKey: 'supervisorOperationsMapPage.filter.onDuty' },
              { k: 'off', labelKey: 'supervisorOperationsMapPage.filter.offDuty' },
            ].map((o) => (
              <button key={o.k} className={`sv-filter-btn ${dutyFilter === o.k ? 'active' : ''}`} onClick={() => setDutyFilter(o.k)}>
                {t(o.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Map + side panel */}
        <div className="sv-ops-layout">
          <div className="sv-ops-map">
            {loading && (
              <div className="sv-ops-map-loading">
                <div className="sv-loading-spinner" />
                <span>{t('supervisorOperationsMapPage.loadingMapData')}</span>
              </div>
            )}
            <MapContainer center={ALGERIA_CENTER} zoom={DEFAULT_ZOOM} className="sv-ops-map-canvas" ref={mapRef}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={fitPoints} fitKey={fitKey} />

              {assignmentLinks.map((link) => (
                <Polyline
                  key={link.id}
                  positions={[link.from, link.to]}
                  pathOptions={{ color: '#0e7490', weight: 2, opacity: 0.55, dashArray: '5 6' }}
                />
              ))}

              {visibleIncidents.map((inc) => {
                const cfg = SEVERITY_CONFIG[inc.sev]
                const key = `inc-${inc.id}`
                return (
                  <Marker
                    key={key}
                    position={[inc.lat, inc.lng]}
                    icon={incidentIcon(inc.sev, inc.unassigned)}
                    ref={(m) => { if (m) markerRefs.current[key] = m }}
                  >
                    <Popup minWidth={230}>
                      <div className="sv-ops-popup">
                        <div className="sv-ops-popup-title">{inc.title || inc.id?.slice(0, 8)}</div>
                        <div className="sv-ops-popup-chips">
                          <span className="sv-ops-chip" style={{ background: cfg.color }}>{t(cfg.labelKey)}</span>
                          <span className="sv-ops-chip sv-ops-chip--muted">{statusLabel(inc.status)}</span>
                          {inc.unassigned && <span className="sv-ops-chip sv-ops-chip--warn">{t('supervisorOperationsMapPage.filter.unassigned')}</span>}
                        </div>
                        {inc.locationLabel && (
                          <div className="sv-ops-popup-row"><LocationOnOutlinedIcon fontSize="inherit" /> {inc.locationLabel}</div>
                        )}
                        {inc.assignedOfficerName ? (
                          <div className="sv-ops-popup-row"><LocalPoliceOutlinedIcon fontSize="inherit" /> {inc.assignedOfficerName}</div>
                        ) : inc.nearest ? (
                          <div className="sv-ops-popup-row"><NearMeOutlinedIcon fontSize="inherit" /> {t('supervisorOperationsMapPage.popup.nearest', { name: inc.nearest.officer.name, km: inc.nearest.km.toFixed(1) })}</div>
                        ) : null}
                        <div className="sv-ops-popup-time">{formatRelative(inc.occurredAt || inc.createdAt, t)}</div>
                        <button className="sv-ops-popup-btn" onClick={() => navigate(`/police/incident/${inc.id}`)}>
                          {t('supervisorOperationsMapPage.popup.viewDetails')} <ArrowForwardRoundedIcon fontSize="inherit" />
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {visibleOfficers.map((off) => {
                const cfg = OFFICER_STATUS[off.statusKey]
                const key = `off-${off.id}`
                return (
                  <Marker
                    key={key}
                    position={[off.lat, off.lng]}
                    icon={officerIcon(off.statusKey)}
                    ref={(m) => { if (m) markerRefs.current[key] = m }}
                  >
                    <Popup minWidth={200}>
                      <div className="sv-ops-popup">
                        <div className="sv-ops-popup-title">{off.name}</div>
                        <div className="sv-ops-popup-chips">
                          <span className="sv-ops-chip" style={{ background: cfg.color }}>{t(cfg.labelKey)}</span>
                          {off.assignedCount > 0 && <span className="sv-ops-chip sv-ops-chip--muted">{t('supervisorOperationsMapPage.popup.assignedCount', { count: off.assignedCount })}</span>}
                        </div>
                        {(off.rank || off.badgeNumber) && (
                          <div className="sv-ops-popup-row">{[off.rank, off.badgeNumber && t('supervisorOperationsMapPage.popup.badgeNumber', { number: off.badgeNumber })].filter(Boolean).join(' · ')}</div>
                        )}
                        {(off.communeName || off.wilayaName) && (
                          <div className="sv-ops-popup-row"><LocationOnOutlinedIcon fontSize="inherit" /> {[off.communeName, off.wilayaName].filter(Boolean).join(', ')}</div>
                        )}
                        {off.locationCapturedAt && (
                          <div className="sv-ops-popup-time">{t('supervisorOperationsMapPage.popup.lastPing', { time: formatRelative(off.locationCapturedAt, t) })}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {visibleSegments.map((seg) => {
                const cfg = SEVERITY_CONFIG[seg.severity] || SEVERITY_CONFIG.low
                const key = `seg-${seg.roadSegmentId}`
                return (
                  <Marker
                    key={key}
                    position={[seg.lat, seg.lng]}
                    icon={segmentIcon(seg.severity)}
                    ref={(m) => { if (m) markerRefs.current[key] = m }}
                  >
                    <Popup minWidth={230}>
                      <div className="sv-ops-popup">
                        <div className="sv-ops-popup-title">{seg.road}</div>
                        <div className="sv-ops-popup-chips">
                          <span className="sv-ops-chip" style={{ background: cfg.color }}>{t(cfg.labelKey)}</span>
                          {seg.occurrence && (
                            <span className="sv-ops-chip sv-ops-chip--muted">{seg.occurrence.percent}% · {t('supervisorOperationsMapPage.segment.occurrenceBeta')}</span>
                          )}
                        </div>
                        <div className="sv-ops-popup-row"><ReportProblemOutlinedIcon fontSize="inherit" /> {t('supervisorOperationsMapPage.segment.verified', { count: seg.verifiedReports })}</div>
                        <button
                          className="sv-ops-popup-btn"
                          onClick={() => navigate('/police/supervisor/interventions', { state: { prefillSegment: { roadSegmentId: seg.roadSegmentId, locationLabel: seg.road } } })}
                        >
                          {t('supervisorOperationsMapPage.segment.logIntervention')} <ArrowForwardRoundedIcon fontSize="inherit" />
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {visibleInterventions.map((iv) => {
                const color = INTERVENTION_STATUS_COLOR[iv.status] || '#64748b'
                const key = `iv-${iv.id}`
                return (
                  <Marker
                    key={key}
                    position={[iv.lat, iv.lng]}
                    icon={interventionIcon(iv.status)}
                    ref={(m) => { if (m) markerRefs.current[key] = m }}
                  >
                    <Popup minWidth={220}>
                      <div className="sv-ops-popup">
                        <div className="sv-ops-popup-title">{iv.title}</div>
                        <div className="sv-ops-popup-chips">
                          <span className="sv-ops-chip" style={{ background: color }}>{t(`supervisorInterventionsPage.statuses.${iv.status}`)}</span>
                          <span className="sv-ops-chip sv-ops-chip--muted">{t(`supervisorInterventionsPage.types.${iv.type}`)}</span>
                          <span className="sv-ops-chip sv-ops-chip--muted">{t(`supervisorInterventionsPage.visibility.${iv.visibility}`)}</span>
                        </div>
                        {iv.roadName && (<div className="sv-ops-popup-row"><LocationOnOutlinedIcon fontSize="inherit" /> {iv.roadName}</div>)}
                        {iv.outcomeNote && (<div className="sv-ops-popup-row">{iv.outcomeNote}</div>)}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>

            {/* Legend */}
            <div className="sv-map-legend sv-ops-legend">
              <span className="sv-map-legend-title">{t('supervisorOperationsMapPage.legend.incidents')}</span>
              {['high', 'medium', 'low'].map((sk) => (
                <div key={sk} className="sv-map-legend-item">
                  <span className="sv-map-legend-dot" style={{ background: SEVERITY_CONFIG[sk].color }} />
                  {t(SEVERITY_CONFIG[sk].labelKey)}
                  <span className="sv-ops-legend-count">{severityCounts[sk] ?? 0}</span>
                </div>
              ))}
              <span className="sv-map-legend-title" style={{ marginTop: 6 }}>{t('supervisorOperationsMapPage.legend.officers')}</span>
              {['responding', 'available', 'stale', 'off'].map((sk) => (
                <div key={sk} className="sv-map-legend-item">
                  <span className="sv-map-legend-dot" style={{ background: OFFICER_STATUS[sk].color }} />
                  {t(OFFICER_STATUS[sk].labelKey)}
                </div>
              ))}
              <span className="sv-map-legend-title" style={{ marginTop: 6 }}>{t('supervisorOperationsMapPage.legend.riskSegments')}</span>
              {['high', 'medium', 'low'].map((sk) => (
                <div key={`segleg-${sk}`} className="sv-map-legend-item">
                  <span className="sv-map-legend-dot" style={{ background: 'transparent', border: `2px solid ${SEVERITY_CONFIG[sk].color}` }} />
                  {t(SEVERITY_CONFIG[sk].labelKey)}
                </div>
              ))}
              <span className="sv-map-legend-title" style={{ marginTop: 6 }}>{t('supervisorOperationsMapPage.legend.interventions')}</span>
              {['planned', 'in_progress', 'completed', 'cancelled'].map((sk) => (
                <div key={`ivleg-${sk}`} className="sv-map-legend-item">
                  <span className="sv-map-legend-dot" style={{ background: INTERVENTION_STATUS_COLOR[sk], borderRadius: 3 }} />
                  {t(`supervisorInterventionsPage.statuses.${sk}`)}
                </div>
              ))}
            </div>
          </div>

          {/* Synced side list */}
          <aside className="sv-ops-aside">
            <div className="sv-ops-tabs">
              <button className={`sv-ops-tab ${activeTab === 'incidents' ? 'active' : ''}`} onClick={() => setActiveTab('incidents')}>
                {t('supervisorOperationsMapPage.tabs.incidents')} <span className="sv-ops-tab-count">{visibleIncidents.length}</span>
              </button>
              <button className={`sv-ops-tab ${activeTab === 'officers' ? 'active' : ''}`} onClick={() => setActiveTab('officers')}>
                {t('supervisorOperationsMapPage.tabs.officers')} <span className="sv-ops-tab-count">{visibleOfficers.length}</span>
              </button>
            </div>

            <div className="sv-ops-list">
              {activeTab === 'incidents' && visibleIncidents.length === 0 && (
                <div className="sv-ops-list-empty">{t('supervisorOperationsMapPage.empty.noIncidents')}</div>
              )}
              {activeTab === 'incidents' &&
                visibleIncidents.map((inc) => {
                  const key = `inc-${inc.id}`
                  return (
                    <button
                      key={key}
                      className={`sv-ops-item ${selectedKey === key ? 'selected' : ''}`}
                      onClick={() => focusOn(key, inc.lat, inc.lng)}
                    >
                      <span className="sv-ops-item-dot" style={{ background: SEVERITY_CONFIG[inc.sev].color }} />
                      <span className="sv-ops-item-body">
                        <span className="sv-ops-item-title">{inc.title || inc.id?.slice(0, 8)}</span>
                        <span className="sv-ops-item-meta">
                          {statusLabel(inc.status)}
                          {inc.locationLabel ? ` · ${inc.locationLabel}` : ''}
                        </span>
                      </span>
                      {inc.unassigned ? (
                        <span className="sv-ops-item-tag sv-ops-item-tag--warn"><ReportProblemOutlinedIcon fontSize="inherit" /></span>
                      ) : (
                        <span className="sv-ops-item-time">{formatRelative(inc.occurredAt || inc.createdAt, t)}</span>
                      )}
                    </button>
                  )
                })}

              {activeTab === 'officers' && visibleOfficers.length === 0 && (
                <div className="sv-ops-list-empty">{t('supervisorOperationsMapPage.empty.noOfficers')}</div>
              )}
              {activeTab === 'officers' &&
                visibleOfficers.map((off) => {
                  const key = `off-${off.id}`
                  const cfg = OFFICER_STATUS[off.statusKey]
                  return (
                    <button
                      key={key}
                      className={`sv-ops-item ${selectedKey === key ? 'selected' : ''}`}
                      onClick={() => focusOn(key, off.lat, off.lng)}
                    >
                      <span className="sv-ops-item-dot" style={{ background: cfg.color }} />
                      <span className="sv-ops-item-body">
                        <span className="sv-ops-item-title">{off.name}</span>
                        <span className="sv-ops-item-meta">
                          {t(cfg.labelKey)}
                          {off.assignedCount > 0 ? ` · ${t('supervisorOperationsMapPage.list.assignedCount', { count: off.assignedCount })}` : ''}
                        </span>
                      </span>
                      <span className="sv-ops-item-time">{off.locationCapturedAt ? formatRelative(off.locationCapturedAt, t) : '—'}</span>
                    </button>
                  )
                })}
            </div>
          </aside>
        </div>
      </div>
    </PoliceShell>
  )
}
