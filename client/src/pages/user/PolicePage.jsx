import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'

import PoliceShell from '../../components/layout/PoliceShell'
import { POLICE_ACTIVE_ALERTS, POLICE_INCIDENTS } from '../../data/policeMockData'

function severityOrder(value) {
  if (value === 'high') return 3
  if (value === 'medium') return 2
  return 1
}

const STATUS_FLOW = ['reported', 'under_review', 'verified', 'resolved']
const DISPATCH_UNITS = [
  { id: 'Unit 12', eta: '3 min', distance: '1.2 km' },
  { id: 'Unit 07', eta: '5 min', distance: '2.4 km' },
  { id: 'Unit 21', eta: '7 min', distance: '3.1 km' },
]

function displayStatus(value) {
  return String(value || '')
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function splitLocation(value) {
  const text = String(value || '')
  const [road, city = ''] = text.split(',')
  const cleanRoad = road?.trim() || 'Unknown location'
  const cleanCity = city?.trim() || ''
  return {
    road: cleanRoad,
    city: cleanCity,
  }
}

function reliabilityMeta(score) {
  const value = Number(score || 0)
  if (value >= 90) {
    return { tier: 'high', label: `High reliability (${value}%)`, icon: '🟢' }
  }

  if (value >= 70) {
    return { tier: 'medium', label: `Medium reliability (${value}%)`, icon: '🟠' }
  }

  return { tier: 'low', label: `Low reliability (${value}%)`, icon: '🔴' }
}

function incidentTypeIcon(type) {
  const normalized = String(type || '').toLowerCase()
  if (normalized.includes('accident') || normalized.includes('collision')) return '🚗'
  if (normalized.includes('road blocked') || normalized.includes('blocked')) return '🚧'
  if (normalized.includes('obstacle') || normalized.includes('debris')) return '⚠️'
  if (normalized.includes('suspicious')) return '🚓'
  return '📍'
}

function parseMinutesFromTimeAgo(value) {
  const text = String(value || '').trim().toLowerCase()
  const minuteMatch = text.match(/(\d+)\s*min/)
  if (minuteMatch) return Number(minuteMatch[1])

  const hourMatch = text.match(/(\d+)\s*h/)
  if (hourMatch) return Number(hourMatch[1]) * 60

  const dayMatch = text.match(/(\d+)\s*d/)
  if (dayMatch) return Number(dayMatch[1]) * 1440

  return Number.POSITIVE_INFINITY
}

function urgencyMeta(incident) {
  const minutes = parseMinutesFromTimeAgo(incident?.timeAgo)
  if (minutes < 5) {
    return { level: 'live', label: 'LIVE' }
  }

  if (minutes < 15) {
    return { level: 'recent', label: 'Recent' }
  }

  return { level: 'normal', label: '' }
}

function distanceKmBetween(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (Number(value) * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(Number(lat2) - Number(lat1))
  const dLng = toRad(Number(lng2) - Number(lng1))
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function sortIncidents(items) {
  return [...items].sort((left, right) => {
    const leftResolved = left.status === 'resolved' ? 1 : 0
    const rightResolved = right.status === 'resolved' ? 1 : 0
    if (leftResolved !== rightResolved) return leftResolved - rightResolved

    const severityDiff = severityOrder(right.severity) - severityOrder(left.severity)
    if (severityDiff !== 0) return severityDiff

    return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  })
}

export default function PolicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [incidents, setIncidents] = useState(sortIncidents(POLICE_INCIDENTS))
  const [selectedIncidentId, setSelectedIncidentId] = useState(POLICE_INCIDENTS[0]?.id || null)
  const [dispatchIncident, setDispatchIncident] = useState(null)
  const [selectedUnitId, setSelectedUnitId] = useState(DISPATCH_UNITS[0].id)
  const [lastRefreshAt, setLastRefreshAt] = useState(new Date())
  const [toast, setToast] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState(null)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [sortBy, setSortBy] = useState('priority')
  const [pinnedIncidentIds, setPinnedIncidentIds] = useState([])
  const [mineStatusFilter, setMineStatusFilter] = useState('all')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [loadError, setLoadError] = useState('')
  const incidentRefs = useRef({})
  const activeView = searchParams.get('view') === 'active'
  const insightsView = searchParams.get('view') === 'insights'
  const mineView = searchParams.get('view') === 'mine'
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const visibleIncidents = useMemo(() => {
    if (mineView) {
      const handledStatuses = new Set(['under_review', 'verified', 'dispatched', 'resolved'])
      return incidents.filter((item) => handledStatuses.has(item.status))
    }

    if (!activeView) return incidents
    return incidents.filter((item) => item.status !== 'resolved' && item.status !== 'rejected')
  }, [incidents, activeView, mineView])

  const filteredIncidents = useMemo(() => {
    const needle = String(searchTerm || '').trim().toLowerCase()

    return visibleIncidents.filter((item) => {
      if (priorityFilter !== 'all' && item.severity !== priorityFilter) {
        return false
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }

      if (mineView && mineStatusFilter !== 'all' && item.status !== mineStatusFilter) {
        return false
      }

      if (needle) {
        const text = `${item.id} ${item.location} ${item.type} ${item.description}`.toLowerCase()
        if (!text.includes(needle)) {
          return false
        }
      }

      return true
    })
  }, [priorityFilter, searchTerm, statusFilter, visibleIncidents, mineView, mineStatusFilter])

  const sortedIncidents = useMemo(() => {
    const distanceAnchor = filteredIncidents.find((item) => item.id === selectedIncidentId) || filteredIncidents[0] || null

    const byPriority = [...filteredIncidents].sort((left, right) => {
      const severityDiff = severityOrder(right.severity) - severityOrder(left.severity)
      if (severityDiff !== 0) return severityDiff
      return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    })

    const byTime = [...filteredIncidents].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )

    const byDistance = [...filteredIncidents].sort((left, right) => {
      if (!distanceAnchor) return 0
      const leftDistance = distanceKmBetween(distanceAnchor.lat, distanceAnchor.lng, left.lat, left.lng)
      const rightDistance = distanceKmBetween(distanceAnchor.lat, distanceAnchor.lng, right.lat, right.lng)
      return leftDistance - rightDistance
    })

    const base = sortBy === 'time' ? byTime : sortBy === 'distance' ? byDistance : byPriority
    const pinnedSet = new Set(pinnedIncidentIds)
    return base.sort((left, right) => {
      const leftPinned = pinnedSet.has(left.id) ? 1 : 0
      const rightPinned = pinnedSet.has(right.id) ? 1 : 0
      return rightPinned - leftPinned
    })
  }, [filteredIncidents, pinnedIncidentIds, selectedIncidentId, sortBy])

  const criticalCount = useMemo(
    () => visibleIncidents.filter((item) => item.severity === 'high' && item.status !== 'resolved').length,
    [visibleIncidents],
  )

  const verificationPendingCount = useMemo(
    () => incidents.filter((item) => item.status === 'reported').length,
    [incidents],
  )

  const emergencyMode = criticalCount >= 3

  const priorityIncidents = useMemo(
    () => sortedIncidents.filter((item) => item.severity === 'high' && item.status !== 'resolved'),
    [sortedIncidents],
  )

  const criticalAlerts = useMemo(
    () => sortedIncidents.filter((item) => item.severity === 'high' && item.status !== 'resolved').slice(0, 5),
    [sortedIncidents],
  )

  const activeFilterTags = useMemo(() => {
    const tags = []
    if (priorityFilter !== 'all') tags.push({ key: 'priority', label: `Priority: ${displayStatus(priorityFilter)}` })
    if (statusFilter !== 'all') tags.push({ key: 'status', label: `Status: ${displayStatus(statusFilter)}` })
    if (mineView && mineStatusFilter !== 'all') tags.push({ key: 'mine_status', label: `Mine: ${displayStatus(mineStatusFilter)}` })
    if (String(searchTerm || '').trim()) tags.push({ key: 'search', label: `Search: ${searchTerm.trim()}` })
    return tags
  }, [priorityFilter, searchTerm, statusFilter, mineView, mineStatusFilter])

  const groupedIncidents = useMemo(() => {
    const high = sortedIncidents.filter((item) => item.severity === 'high')
    const others = sortedIncidents.filter((item) => item.severity !== 'high')
    return { high, others }
  }, [sortedIncidents])

  const selectedIncident = useMemo(
    () => sortedIncidents.find((item) => item.id === selectedIncidentId) || sortedIncidents[0] || null,
    [sortedIncidents, selectedIncidentId],
  )

  const nearbyIncidentIds = useMemo(() => {
    if (!selectedIncident) return new Set()

    const nearby = sortedIncidents
      .filter((item) => item.id !== selectedIncident.id)
      .filter((item) => distanceKmBetween(selectedIncident.lat, selectedIncident.lng, item.lat, item.lng) <= 2)
      .map((item) => item.id)

    return new Set(nearby)
  }, [selectedIncident, sortedIncidents])

  const stats = useMemo(() => {
    const total = incidents.filter((item) => item.status !== 'resolved' && item.status !== 'rejected').length
    const verified = incidents.filter((item) => item.status === 'verified' || item.status === 'dispatched').length
    const pending = incidents.filter((item) => item.status === 'reported' || item.status === 'under_review').length
    const responseAvg = Math.round(
      incidents.reduce((sum, item) => sum + Number(item.responseMinutes || 0), 0) / (incidents.length || 1),
    )

    return {
      total,
      verified,
      pending,
      responseAvg,
    }
  }, [incidents])

  const topDangerousZone = useMemo(() => {
    const zoneScore = new Map()

    incidents.forEach((incident) => {
      zoneScore.set(incident.zone, (zoneScore.get(incident.zone) || 0) + severityOrder(incident.severity))
    })

    return [...zoneScore.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'N/A'
  }, [incidents])

  const trendValue = useMemo(() => {
    const high = incidents.filter((item) => item.severity === 'high').length
    const resolved = incidents.filter((item) => item.status === 'resolved').length
    return `${Math.max(0, high * 7 - resolved * 3)}% risk pressure`
  }, [incidents])

  const quickStats = useMemo(() => ({
    incidentsTrend: '+12%',
    pendingTrend: '-5%',
    responseTrend: 'down',
  }), [])

  const handleAction = (incidentId, action) => {
    setIncidents((prev) => sortIncidents(prev.map((incident) => {
      if (incident.id !== incidentId) {
        return incident
      }

      if (action === 'review') {
        return { ...incident, status: 'under_review' }
      }

      if (action === 'cancel_review') {
        return { ...incident, status: 'reported' }
      }

      if (action === 'verify') {
        return { ...incident, status: 'verified' }
      }

      if (action === 'reject') {
        return { ...incident, status: 'rejected' }
      }

      if (action === 'resolve') {
        return { ...incident, status: 'resolved' }
      }

      if (action === 'assign') {
        return { ...incident, status: 'dispatched' }
      }

      return incident
    })))

    const actionLabel =
      action === 'assign'
        ? 'Backup requested successfully'
        : action === 'review'
          ? 'Incident moved to review'
          : action === 'cancel_review'
            ? 'Review cancelled'
            : action === 'verify'
              ? 'Incident verified successfully'
              : action === 'reject'
                ? 'Incident rejected successfully'
                : action === 'resolve'
                  ? 'Incident closed successfully'
                  : `Incident ${action}ed`
    setToast(actionLabel)
    setTimeout(() => setToast(''), 1800)
  }

  const handleContextAction = (incident, action) => {
    if (!incident) return
    if (action === 'view') {
      navigate(`/police/incident/${incident.id}`)
      return
    }

    if (action === 'dispatch') {
      openDispatch(incident.id)
      return
    }

    if (action === 'review') {
      handleAction(incident.id, 'review')
      return
    }

    if (action === 'verify') {
      handleAction(incident.id, 'verify')
      return
    }

    if (action === 'cancel_review') {
      handleAction(incident.id, 'cancel_review')
      return
    }

    if (action === 'reject') {
      setConfirmAction({
        incident,
        action: 'reject',
        title: 'Confirm Rejection',
        message: 'Are you sure you want to reject this incident?',
        confirmLabel: 'Reject Incident',
      })
      return
    }

    if (action === 'close') {
      setConfirmAction({
        incident,
        action: 'resolve',
        title: 'Confirm Closure',
        message: 'Are you sure you want to close this incident?',
        confirmLabel: 'Close Incident',
      })
    }
  }

  const contextualActions = (incident) => {
    if (!incident) return []
    if (incident.status === 'reported') {
      return [
        { key: 'view', label: '👁 View', style: 'police-action-view' },
        { key: 'review', label: '▶ Start Review', style: 'police-action-review' },
      ]
    }

    if (incident.status === 'under_review') {
      return [
        { key: 'verify', label: '✔ Verify', style: 'police-action-verify' },
        { key: 'reject', label: '✖ Reject', style: 'police-action-reject' },
      ]
    }

    if (incident.status === 'verified') {
      return [
        { key: 'dispatch', label: '🛡 Request Backup', style: 'police-action-dispatch' },
        { key: 'close', label: '✔ Close Incident', style: 'police-action-resolve' },
      ]
    }

    if (incident.status === 'resolved' || incident.status === 'rejected') {
      return []
    }

    if (incident.status === 'dispatched') {
      return [
        { key: 'close', label: '✔ Close Incident', style: 'police-action-resolve' },
      ]
    }

    return [
      { key: 'view', label: '👁 View', style: 'police-action-view' },
    ]
  }

  const openDispatch = (incidentId) => {
    setDispatchIncident(incidents.find((item) => item.id === incidentId) || null)
    setSelectedUnitId(DISPATCH_UNITS[0].id)
  }

  const confirmDispatch = () => {
    if (!dispatchIncident) return
    handleAction(dispatchIncident.id, 'assign')
    setDispatchIncident(null)
  }

  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      try {
        if (!Array.isArray(POLICE_INCIDENTS)) {
          throw new Error('Invalid incident payload')
        }
        setIsLoading(false)
      } catch {
        setLoadError('Failed to load data')
        setIsLoading(false)
      }
    }, 700)

    return () => clearTimeout(loadingTimer)
  }, [])

  useEffect(() => {
    const topCritical = sortedIncidents.find((item) => item.severity === 'high' && item.status !== 'resolved')
    if (!topCritical) return
    setSelectedIncidentId(topCritical.id)
    const target = incidentRefs.current[topCritical.id]
    if (target?.scrollIntoView) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [sortedIncidents])

  useEffect(() => {
    if (!autoRefreshEnabled) return () => {}

    const timer = setInterval(() => {
      setIncidents((prev) => sortIncidents(prev))
      setLastRefreshAt(new Date())
    }, 20000)

    return () => clearInterval(timer)
  }, [autoRefreshEnabled])

  useEffect(() => {
    if (!insightsView) return
    const section = document.getElementById('police-ai-insights')
    if (section?.scrollIntoView) {
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }, [insightsView])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (dispatchIncident) return
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const incident = incidents.find((item) => item.id === selectedIncidentId)
      if (!incident) return

      const key = String(event.key || '').toLowerCase()
      if (key === 'v' && incident.status === 'under_review') {
        event.preventDefault()
        handleAction(incident.id, 'verify')
      }

      if (key === 'r' && incident.status === 'under_review') {
        event.preventDefault()
        setConfirmAction({
          incident,
          action: 'reject',
          title: 'Confirm Rejection',
          message: 'Are you sure you want to reject this incident?',
          confirmLabel: 'Reject Incident',
        })
      }

      if ((key === 'b' || key === 'd') && incident.status === 'verified') {
        event.preventDefault()
        openDispatch(incident.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [incidents, selectedIncidentId, dispatchIncident])

  const mapCenter = useMemo(() => {
    if (selectedIncident) {
      return [selectedIncident.lat, selectedIncident.lng]
    }

    if (!sortedIncidents.length) {
      return [36.365, 6.614]
    }

    const latAvg = sortedIncidents.reduce((sum, item) => sum + Number(item.lat || 0), 0) / sortedIncidents.length
    const lngAvg = sortedIncidents.reduce((sum, item) => sum + Number(item.lng || 0), 0) / sortedIncidents.length
    return [latAvg, lngAvg]
  }, [sortedIncidents, selectedIncident])

  const riskColor = (severity) => {
    if (severity === 'high') return '#dc2626'
    if (severity === 'medium') return '#f59e0b'
    return '#10b981'
  }

  const activeUnit = DISPATCH_UNITS.find((unit) => unit.id === selectedUnitId) || DISPATCH_UNITS[0]

  const clearFilterTag = (key) => {
    if (key === 'priority') setPriorityFilter('all')
    if (key === 'status') setStatusFilter('all')
    if (key === 'mine_status') setMineStatusFilter('all')
    if (key === 'search') setSearchTerm('')
  }

  const togglePinIncident = (incidentId) => {
    setPinnedIncidentIds((prev) => (
      prev.includes(incidentId) ? prev.filter((id) => id !== incidentId) : [...prev, incidentId]
    ))
  }

  const retryLoad = () => {
    setLoadError('')
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
    }, 650)
  }

  const renderIncidentCard = (incident) => {
    const reliability = reliabilityMeta(incident.reliability)
    const locationParts = splitLocation(incident.location)
    const urgency = urgencyMeta(incident)
    const reliabilityValue = Math.max(0, Math.min(100, Number(incident.reliability || 0)))

    return (
      <article
        key={incident.id}
        ref={(element) => { incidentRefs.current[incident.id] = element }}
        className={`police-stream-row ${selectedIncident?.id === incident.id ? 'active' : ''} urgency-${urgency.level}`}
        data-reliability={reliability.tier}
        data-severity={incident.severity}
        onClick={() => setSelectedIncidentId(incident.id)}
        onMouseEnter={() => setSelectedIncidentId(incident.id)}
      >
        <span className={`police-severity-strip ${incident.severity}`} aria-hidden="true"></span>
        <div className="police-stream-main">
          <div className="police-stream-headline">
            <div className="police-stream-title-wrap">
              <div className="police-stream-id" title="Incident ID">{incident.id}</div>
              <strong className="police-stream-title">
                <span className="police-type-icon" title={incident.type}>{incidentTypeIcon(incident.type)}</span>
                <span>{locationParts.city ? `${locationParts.road} - ${locationParts.city}` : locationParts.road}</span>
              </strong>
            </div>
            <div className="police-stream-headline-right">
              <button
                type="button"
                className={`police-pin-btn ${pinnedIncidentIds.includes(incident.id) ? 'active' : ''}`}
                title={pinnedIncidentIds.includes(incident.id) ? 'Unpin incident' : 'Pin incident'}
                onClick={(event) => {
                  event.stopPropagation()
                  togglePinIncident(incident.id)
                }}
              >
                📌
              </button>
              <span className={`police-stream-time ${urgency.level}`} title="Time since report">
                {urgency.level === 'live' ? <span className="police-live-badge">LIVE</span> : null}
                {incident.timeAgo}
              </span>
            </div>
          </div>

          <div className="police-stream-meta-line">
            <span className="police-reliability" title={reliability.label}>{reliability.icon} {incident.reliability}% reliability</span>
            <span className="police-reliability-bar" role="img" aria-label={`Reliability ${incident.reliability}%`}>
              <span className="police-reliability-fill" style={{ width: `${reliabilityValue}%` }}></span>
            </span>
            <span className="police-status-label" title="Current incident status">Status: {displayStatus(incident.status)}</span>
          </div>

          <p className="police-stream-description">{incident.description}</p>
          <div className="police-hover-preview" aria-hidden="true">
            <strong>{incident.id}</strong>
            <span>{incident.location}</span>
            <span>{incident.severity.toUpperCase()} · {incident.type}</span>
            <span>{incident.description}</span>
          </div>
          <div className="police-status-flow" aria-label="Status flow">
            {STATUS_FLOW.map((status) => {
              const flowStatus = incident.status === 'dispatched' ? 'verified' : incident.status
              const isCurrent = flowStatus === status
              const currentIndex = STATUS_FLOW.indexOf(flowStatus)
              const statusIndex = STATUS_FLOW.indexOf(status)
              const isDone = currentIndex > -1 && currentIndex > statusIndex
              return (
                <span
                  key={`${incident.id}-${status}`}
                  className={`police-flow-step ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''} ${!isCurrent && !isDone ? 'future' : ''}`}
                  title={`Flow step: ${displayStatus(status)}`}
                >
                  <span className="police-flow-marker" aria-hidden="true"></span>
                  <span className="police-flow-label">{displayStatus(status)}</span>
                </span>
              )
            })}
          </div>
        </div>

        <div className="police-action-row">
          {contextualActions(incident).map((action) => (
            <button
              key={`${incident.id}-${action.key}`}
              className={`police-action ${action.style}`}
              title={
                action.key === 'verify'
                  ? 'Mark incident as confirmed'
                  : action.key === 'reject'
                    ? 'Reject incident as invalid'
                    : action.key === 'dispatch'
                      ? 'Request backup for this incident'
                      : action.key === 'close'
                        ? 'Close incident after completion'
                        : action.key === 'review'
                          ? 'Move incident to review state'
                          : 'Open incident details'
              }
              onClick={(event) => {
                event.stopPropagation()
                handleContextAction(incident, action.key)
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </article>
    )
  }

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Operational Map</h2>
        <div className="police-section-divider" aria-hidden="true"></div>
        <div className="police-mini-map">
          {isLoading ? (
            <div className="police-map-skeleton" aria-hidden="true"></div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={selectedIncident ? 15 : 13}
              scrollWheelZoom
              className="police-leaflet-map"
              key={selectedIncident?.id || 'map'}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {sortedIncidents.map((incident) => (
                <React.Fragment key={incident.id}>
                  <Circle
                    center={[incident.lat, incident.lng]}
                    radius={incident.severity === 'high' ? 700 : incident.severity === 'medium' ? 520 : 380}
                    pathOptions={{
                      color: selectedIncident?.id === incident.id ? '#1d4ed8' : riskColor(incident.severity),
                      opacity: nearbyIncidentIds.has(incident.id) ? 0.9 : 0.6,
                      fillOpacity: nearbyIncidentIds.has(incident.id) ? 0.15 : 0.08,
                      weight: selectedIncident?.id === incident.id ? 2 : 1,
                    }}
                  />
                  {selectedIncident?.id === incident.id ? (
                    <Circle
                      center={[incident.lat, incident.lng]}
                      radius={incident.severity === 'high' ? 950 : incident.severity === 'medium' ? 760 : 620}
                      pathOptions={{ color: '#2563eb', opacity: 0.55, fillOpacity: 0.04, dashArray: '5,5' }}
                    />
                  ) : null}
                  <CircleMarker
                    center={[incident.lat, incident.lng]}
                    radius={selectedIncident?.id === incident.id ? 9 : nearbyIncidentIds.has(incident.id) ? 7 : 6}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: nearbyIncidentIds.has(incident.id) ? '#0ea5e9' : riskColor(incident.severity),
                      fillOpacity: 0.95,
                    }}
                    eventHandlers={{
                      mouseover: () => setSelectedIncidentId(incident.id),
                      click: () => {
                        setSelectedIncidentId(incident.id)
                        setToast(`Focused ${incident.id}`)
                        const target = incidentRefs.current[incident.id]
                        if (target?.scrollIntoView) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      },
                    }}
                  >
                    <Popup>
                      <strong>{incident.id}</strong><br />
                      {incident.type}<br />
                      {incident.location}
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              ))}
            </MapContainer>
          )}
        </div>
        <p className="police-map-hint">Auto refresh: every 20s · Last updated: {lastRefreshAt.toLocaleTimeString()}</p>
      </section>

      <section className="police-section police-selected-incident-panel">
        <h2>Selected Incident Summary</h2>
        {selectedIncident ? (
          <div className="police-selected-details">
            <div className="police-selected-line"><span>Location</span><strong>{selectedIncident.location}</strong></div>
            <div className="police-selected-line"><span>Type</span><strong>{selectedIncident.type}</strong></div>
            <div className="police-selected-line"><span>Severity</span><strong className={`police-severity-text ${selectedIncident.severity}`}>{selectedIncident.severity.toUpperCase()}</strong></div>
            <div className="police-selected-line"><span>Reliability</span><strong>{selectedIncident.reliability}%</strong></div>
            <div className="police-selected-line"><span>Status</span><strong>{displayStatus(selectedIncident.status)}</strong></div>
          </div>
        ) : (
          <p className="police-meta">No incident selected.</p>
        )}
      </section>

      <section className="police-section">
        <h2>Active Alerts</h2>
        <ul className="police-list">
          {criticalAlerts.slice(0, 5).map((alert) => (
            <li key={alert.id} className="police-alert-item">
              <span className={`police-alert-dot ${alert.severity}`} aria-hidden="true"></span>
              <span>{alert.type} · {alert.location}</span>
            </li>
          ))}
          {criticalAlerts.length === 0 ? POLICE_ACTIVE_ALERTS.map((alert) => <li key={alert}>{alert}</li>) : null}
        </ul>
      </section>

      <section className={`police-section ${insightsView ? 'police-focus-section' : ''}`} id="police-ai-insights">
        <h2>AI Insights</h2>
        <div className="police-insight-list">
          <div className="police-insight-item danger">⚠ Risk rising: <strong>+18%</strong> in last 2h</div>
          <div className="police-insight-item warning">🔥 Peak time: <strong>17:00-19:00</strong></div>
          <div className="police-insight-item info">📍 Hot zone: <strong>{topDangerousZone}</strong></div>
          <div className="police-insight-item neutral">Trend model: <strong>{trendValue}</strong></div>
        </div>
      </section>
    </>
  )

  return (
    <PoliceShell
      activeKey={insightsView ? 'analytics' : mineView ? 'my-incidents' : activeView ? 'active-incidents' : 'dashboard'}
      rightPanel={rightPanel}
      rightPanelCollapsed={rightPanelCollapsed}
      notificationCount={criticalCount}
      emergencyMode={emergencyMode}
      verificationPendingCount={verificationPendingCount}
    >
      <section className="police-section">
        <div className="police-stream-header">
          <div>
            <h2>{activeView ? 'Active Incidents Stream' : mineView ? 'My Incident Stream' : 'Live Incident Stream'}</h2>
            <p className="police-shortcuts-hint">Keyboard: V = Verify • R = Reject • B = Backup.</p>
            <div className="police-counter-summary">
              <span>Active: <strong>{visibleIncidents.length}</strong></span>
              <span>High: <strong>{criticalCount}</strong></span>
              <span>Pending: <strong>{verificationPendingCount}</strong></span>
            </div>
          </div>
          <div className="police-stream-controls">
            <label className="police-filter-field">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort incidents">
                <option value="priority">Priority</option>
                <option value="time">Time</option>
                <option value="distance">Distance</option>
              </select>
            </label>
            <label className="police-filter-field">
              <span>Priority</span>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority">
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="police-filter-field">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
                <option value="all">All</option>
                <option value="reported">Reported</option>
                <option value="under_review">Under Review</option>
                <option value="verified">Verified</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="police-filter-field police-filter-search">
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ID, location, type..."
                aria-label="Search incidents"
              />
            </label>
            <button
              className={`police-action ${autoRefreshEnabled ? 'police-action-dispatch' : 'police-action-view'}`}
              onClick={() => setAutoRefreshEnabled((prev) => !prev)}
              title="Toggle auto refresh"
            >
              {autoRefreshEnabled ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}
            </button>
            <button
              className="police-action police-action-view"
              onClick={() => setRightPanelCollapsed((prev) => !prev)}
              title={rightPanelCollapsed ? 'Expand right panel' : 'Collapse right panel'}
            >
              {rightPanelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
            </button>
          </div>
        </div>

        {mineView ? (
          <div className="police-mine-toolbar">
            <strong className="police-meta">You are handling: {visibleIncidents.length} incidents</strong>
            <div className="police-mine-filters">
              {[
                { key: 'all', label: 'All' },
                { key: 'under_review', label: 'Under Review' },
                { key: 'verified', label: 'Verified' },
                { key: 'resolved', label: 'Resolved' },
              ].map((item) => (
                <button
                  key={item.key}
                  className={`police-status-chip ${mineStatusFilter === item.key ? 'active' : ''}`}
                  onClick={() => setMineStatusFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeFilterTags.length > 0 ? (
          <div className="police-filter-tags" aria-label="Active filters">
            {activeFilterTags.map((tag) => (
              <button
                key={tag.key}
                className="police-filter-tag"
                onClick={() => clearFilterTag(tag.key)}
                title="Remove filter"
              >
                {tag.label} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="police-feed">
          {isLoading ? (
            <>
              <div className="police-stream-skeleton"></div>
              <div className="police-stream-skeleton"></div>
              <div className="police-stream-skeleton"></div>
            </>
          ) : loadError ? (
            <div className="police-empty-state" role="alert">
              <div className="police-empty-icon" aria-hidden="true">⚠️</div>
              <h3>{loadError}</h3>
              <button className="police-action police-action-review" onClick={retryLoad}>Retry</button>
            </div>
          ) : !filteredIncidents.length ? (
            <div className="police-empty-state" role="status" aria-live="polite">
              <div className="police-empty-icon" aria-hidden="true">🛰️</div>
              <h3>No active incidents</h3>
              <p>Try clearing one or more filters to see incidents again.</p>
            </div>
          ) : (
            <>
              {groupedIncidents.high.length > 0 ? (
                <div className="police-group-block">
                  <h3 className="police-group-title">High Priority</h3>
                  {groupedIncidents.high.map((incident) => renderIncidentCard(incident))}
                </div>
              ) : null}
              {groupedIncidents.others.length > 0 ? (
                <div className="police-group-block">
                  <h3 className="police-group-title">Others</h3>
                  {groupedIncidents.others.map((incident) => renderIncidentCard(incident))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="police-section">
        <h2>Priority Incidents</h2>
        <div className="police-priority">
          {priorityIncidents.slice(0, 3).map((incident) => (
            <div key={incident.id} className="police-priority-alert-block">
              <div className="police-priority-header">
                <span className="police-high-priority">HIGH PRIORITY INCIDENT</span>
                <span className="police-meta">{incident.timeAgo}</span>
              </div>
              <strong>{incident.location}</strong>
              <p className="police-meta" style={{ margin: '6px 0 10px' }}>{incident.description}</p>
              <div className="police-priority-actions">
                <button className="police-action police-action-view" onClick={() => navigate(`/police/incident/${incident.id}`)}>OPEN DETAILS</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="police-section">
        <h2>Quick Stats</h2>
        <div className="police-stats-grid">
          <div className="police-stat"><span>Active incidents</span><strong>{stats.total}</strong><em className="trend-up">{quickStats.incidentsTrend}</em></div>
          <div className="police-stat"><span>Pending verification</span><strong>{verificationPendingCount}</strong><em className="trend-down">{quickStats.pendingTrend}</em></div>
          <div className="police-stat"><span>Avg response time</span><strong>{stats.responseAvg} min</strong><em className="trend-down">{quickStats.responseTrend === 'down' ? '↓' : '↑'}</em></div>
        </div>
      </section>

      {dispatchIncident ? (
        <div className="police-dispatch-backdrop" role="presentation" onClick={() => setDispatchIncident(null)}>
          <div className="police-dispatch-modal" role="dialog" aria-modal="true" aria-label="Assign Unit" onClick={(event) => event.stopPropagation()}>
            <h3>Assign Unit</h3>
            <p className="police-meta" style={{ marginTop: 0 }}>{dispatchIncident.id} · {dispatchIncident.location}</p>
            <div className="police-unit-list">
              {DISPATCH_UNITS.map((unit) => (
                <button
                  key={unit.id}
                  className={`police-unit-option ${selectedUnitId === unit.id ? 'active' : ''}`}
                  onClick={() => setSelectedUnitId(unit.id)}
                >
                  <strong>{unit.id}</strong>
                  <span>ETA: {unit.eta}</span>
                  <span>Distance: {unit.distance}</span>
                </button>
              ))}
            </div>
            <div className="police-dispatch-summary">
              <span>ETA: <strong>{activeUnit.eta}</strong></span>
              <span>Distance: <strong>{activeUnit.distance}</strong></span>
            </div>
            <div className="police-action-row">
              <button className="police-action police-action-view" onClick={() => setDispatchIncident(null)}>Cancel</button>
              <button className="police-action police-action-dispatch" onClick={confirmDispatch}>Confirm Dispatch</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="police-dispatch-backdrop" role="presentation" onClick={() => setConfirmAction(null)}>
          <div className="police-dispatch-modal" role="dialog" aria-modal="true" aria-label={confirmAction.title} onClick={(event) => event.stopPropagation()}>
            <h3>{confirmAction.title}</h3>
            <p className="police-meta" style={{ marginTop: 0 }}>{confirmAction.message}</p>
            <p className="police-meta" style={{ marginTop: 0 }}>{confirmAction.incident.id} · {confirmAction.incident.location}</p>
            <div className="police-action-row">
              <button className="police-action police-action-view" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className={`police-action ${confirmAction.action === 'reject' ? 'police-action-reject' : 'police-action-resolve'}`}
                onClick={() => {
                  handleAction(confirmAction.incident.id, confirmAction.action)
                  setConfirmAction(null)
                }}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}
