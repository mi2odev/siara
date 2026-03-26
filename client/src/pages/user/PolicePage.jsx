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

const STATUS_FLOW = ['reported', 'under_review', 'verified', 'dispatched', 'resolved']
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
  const incidentRefs = useRef({})
  const activeView = searchParams.get('view') === 'active'
  const insightsView = searchParams.get('view') === 'insights'

  const visibleIncidents = useMemo(() => {
    if (!activeView) return incidents
    return incidents.filter((item) => item.status !== 'resolved' && item.status !== 'rejected')
  }, [incidents, activeView])

  const criticalCount = useMemo(
    () => visibleIncidents.filter((item) => item.severity === 'high' && item.status !== 'resolved').length,
    [visibleIncidents],
  )

  const emergencyMode = criticalCount >= 3

  const priorityIncidents = useMemo(
    () => visibleIncidents.filter((item) => item.severity === 'high' && item.status !== 'resolved'),
    [visibleIncidents],
  )

  const selectedIncident = useMemo(
    () => visibleIncidents.find((item) => item.id === selectedIncidentId) || visibleIncidents[0] || null,
    [visibleIncidents, selectedIncidentId],
  )

  const stats = useMemo(() => {
    const total = incidents.length
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
    verifiedTrend: 'stable',
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
        ? 'Unit dispatched'
        : action === 'review'
          ? 'Incident under review'
          : action === 'cancel_review'
            ? 'Review cancelled'
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
      handleAction(incident.id, 'reject')
      return
    }

    if (action === 'close') {
      handleAction(incident.id, 'resolve')
    }
  }

  const contextualActions = (incident) => {
    if (!incident) return []
    if (incident.status === 'reported') {
      return [
        { key: 'view', label: 'View', style: 'police-action-view' },
        { key: 'review', label: 'Start Review', style: 'police-action-secondary' },
      ]
    }

    if (incident.status === 'under_review') {
      return [
        { key: 'verify', label: 'Verify', style: 'police-action-verify' },
        { key: 'reject', label: 'Reject', style: 'police-action-reject' },
        { key: 'cancel_review', label: 'Cancel Review', style: 'police-action-secondary' },
      ]
    }

    if (incident.status === 'verified') {
      return [
        { key: 'dispatch', label: 'Dispatch Unit', style: 'police-action-dispatch' },
      ]
    }

    if (incident.status === 'dispatched') {
      return [
        { key: 'close', label: 'Close Incident', style: 'police-action-resolve' },
      ]
    }

    return [
      { key: 'view', label: 'View', style: 'police-action-view' },
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
    const topCritical = visibleIncidents.find((item) => item.severity === 'high' && item.status !== 'resolved')
    if (!topCritical) return
    setSelectedIncidentId(topCritical.id)
    const target = incidentRefs.current[topCritical.id]
    if (target?.scrollIntoView) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [visibleIncidents])

  useEffect(() => {
    const timer = setInterval(() => {
      setIncidents((prev) => sortIncidents(prev))
      setLastRefreshAt(new Date())
    }, 20000)

    return () => clearInterval(timer)
  }, [])

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
        handleAction(incident.id, 'reject')
      }

      if (key === 'd' && incident.status === 'verified') {
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

    if (!visibleIncidents.length) {
      return [36.365, 6.614]
    }

    const latAvg = visibleIncidents.reduce((sum, item) => sum + Number(item.lat || 0), 0) / visibleIncidents.length
    const lngAvg = visibleIncidents.reduce((sum, item) => sum + Number(item.lng || 0), 0) / visibleIncidents.length
    return [latAvg, lngAvg]
  }, [visibleIncidents, selectedIncident])

  const riskColor = (severity) => {
    if (severity === 'high') return '#dc2626'
    if (severity === 'medium') return '#f59e0b'
    return '#10b981'
  }

  const activeUnit = DISPATCH_UNITS.find((unit) => unit.id === selectedUnitId) || DISPATCH_UNITS[0]

  const rightPanel = (
    <>
      <section className="police-section">
        <h2>Operational Map</h2>
        <div className="police-mini-map">
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
            {visibleIncidents.map((incident) => (
              <React.Fragment key={incident.id}>
                <Circle
                  center={[incident.lat, incident.lng]}
                  radius={incident.severity === 'high' ? 700 : incident.severity === 'medium' ? 520 : 380}
                  pathOptions={{ color: riskColor(incident.severity), opacity: 0.6, fillOpacity: 0.08 }}
                />
                <CircleMarker
                  center={[incident.lat, incident.lng]}
                  radius={selectedIncident?.id === incident.id ? 9 : 6}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: riskColor(incident.severity), fillOpacity: 0.95 }}
                  eventHandlers={{
                    mouseover: () => setSelectedIncidentId(incident.id),
                    click: () => {
                      setSelectedIncidentId(incident.id)
                      setToast(`Focused ${incident.id}`)
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
        </div>
        <p className="police-map-hint">Click marker to focus incident, then verify or dispatch directly from stream.</p>
        <p className="police-map-hint">Auto refresh: every 20s · Last sync {lastRefreshAt.toLocaleTimeString()}</p>
      </section>

      <section className="police-section police-selected-incident-panel">
        <h2>Selected Incident</h2>
        {selectedIncident ? (
          <div className="police-selected-details">
            <div className="police-selected-line"><span>Location</span><strong>{selectedIncident.location}</strong></div>
            <div className="police-selected-line"><span>Type</span><strong>{selectedIncident.type}</strong></div>
            <div className="police-selected-line"><span>Severity</span><strong className={`police-severity-text ${selectedIncident.severity}`}>{selectedIncident.severity.toUpperCase()}</strong></div>
            <div className="police-selected-line"><span>Units assigned</span><strong>{selectedIncident.status === 'dispatched' ? 2 : 0}</strong></div>
            <div className="police-selected-line"><span>ETA</span><strong>{selectedIncident.status === 'dispatched' ? '4 min' : 'Pending dispatch'}</strong></div>
          </div>
        ) : (
          <p className="police-meta">No incident selected.</p>
        )}
      </section>

      <section className="police-section">
        <h2>Active Alerts</h2>
        <ul className="police-list">
          {POLICE_ACTIVE_ALERTS.map((alert) => <li key={alert}>{alert}</li>)}
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
      activeKey={insightsView ? 'analytics' : activeView ? 'active-incidents' : 'dashboard'}
      rightPanel={rightPanel}
      notificationCount={criticalCount}
      emergencyMode={emergencyMode}
    >
      <section className="police-section">
        <h2>{activeView ? 'Active Incidents Stream' : 'Live Incident Stream'}</h2>
        <p className="police-shortcuts-hint">Keyboard: V verify · R reject · D dispatch (for selected incident).</p>
        <div className="police-feed">
          {visibleIncidents.map((incident) => {
            const reliability = reliabilityMeta(incident.reliability)
            const locationParts = splitLocation(incident.location)
            return (
              <article
                key={incident.id}
                ref={(element) => { incidentRefs.current[incident.id] = element }}
                className={`police-stream-row ${selectedIncident?.id === incident.id ? 'active' : ''}`}
                data-reliability={reliability.tier}
                onClick={() => setSelectedIncidentId(incident.id)}
                onMouseEnter={() => setSelectedIncidentId(incident.id)}
              >
                <span className={`police-severity-strip ${incident.severity}`} aria-hidden="true"></span>
                <div className="police-stream-main">
                  <div className="police-stream-headline">
                    <span className={`police-badge ${incident.severity}`}>{incident.severity.toUpperCase()}</span>
                    <strong className="police-stream-title">
                      {locationParts.city ? `${locationParts.road} - ${locationParts.city}` : locationParts.road}
                    </strong>
                    <span className="police-stream-time">{incident.timeAgo}</span>
                  </div>
                  <div className="police-stream-meta-line">
                    <span className={`police-reliability ${reliability.tier}`}>{reliability.icon} {reliability.label}</span>
                    <span className="police-status-label">Status: {displayStatus(incident.status)}</span>
                  </div>
                  <p className="police-stream-description">{incident.description}</p>
                  <div className="police-status-flow" aria-label="Status flow">
                    {STATUS_FLOW.map((status) => {
                      const isCurrent = incident.status === status
                      const currentIndex = STATUS_FLOW.indexOf(incident.status)
                      const statusIndex = STATUS_FLOW.indexOf(status)
                      const isDone = currentIndex > -1 && currentIndex > statusIndex
                      const marker = isDone ? '✔' : isCurrent ? '●' : '○'
                      return (
                        <span key={`${incident.id}-${status}`} className={`police-flow-step ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}>
                          {marker} {displayStatus(status)}
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
          })}
          {!visibleIncidents.length ? <p className="police-meta">No active incidents right now.</p> : null}
        </div>
      </section>

      <section className="police-section">
        <h2>Priority Incidents</h2>
        <div className="police-priority">
          {priorityIncidents.map((incident) => (
            <div key={incident.id} className="police-priority-alert-block">
              <div className="police-priority-header">
                <span className="police-high-priority">HIGH PRIORITY INCIDENT</span>
                <span className="police-meta">{incident.timeAgo}</span>
              </div>
              <strong>{incident.location}</strong>
              <p className="police-meta" style={{ margin: '6px 0 10px' }}>{incident.description}</p>
              <div className="police-priority-actions">
                <button className="police-action police-action-dispatch" onClick={() => openDispatch(incident.id)}>DISPATCH NOW</button>
                <button className="police-action police-action-view" onClick={() => navigate(`/police/incident/${incident.id}`)}>OPEN DETAILS</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="police-section">
        <h2>Quick Stats</h2>
        <div className="police-stats-grid">
          <div className="police-stat"><span>Incidents</span><strong>{stats.total}</strong><em className="trend-up">{quickStats.incidentsTrend}</em></div>
          <div className="police-stat"><span>Verified</span><strong>{stats.verified}</strong><em className="trend-stable">{quickStats.verifiedTrend}</em></div>
          <div className="police-stat"><span>Pending</span><strong>{stats.pending}</strong><em className="trend-down">{quickStats.pendingTrend}</em></div>
          <div className="police-stat"><span>Response</span><strong>{stats.responseAvg} min</strong><em className="trend-down">{quickStats.responseTrend === 'down' ? '↓' : '↑'}</em></div>
        </div>
      </section>

      <section className="police-section">
        <h2>Incident Table</h2>
        <div className="police-table-wrap">
          <table className="police-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Location</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIncidents.map((incident) => (
                <tr key={incident.id}>
                  <td>{incident.id}</td>
                  <td>{incident.location}</td>
                  <td>{incident.type}</td>
                  <td><span className={`police-badge ${incident.severity}`}>{incident.severity}</span></td>
                  <td>{incident.timeAgo}</td>
                  <td><span className={`police-badge ${incident.status}`}>{displayStatus(incident.status)}</span></td>
                  <td>
                    <div className="police-action-row">
                      {contextualActions(incident).map((action) => (
                        <button
                          key={`table-${incident.id}-${action.key}`}
                          className={`police-action ${action.style}`}
                          onClick={() => handleContextAction(incident, action.key)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}
