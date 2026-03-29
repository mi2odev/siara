import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet'

import PoliceShell from '../../components/layout/PoliceShell'
import { POLICE_INCIDENTS } from '../../data/policeMockData'

export default function PoliceIncidentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')

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

  const triggerAction = (label) => {
    setToast(label)
    setTimeout(() => setToast(''), 1700)
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

  const rightPanel = (
    <section className="police-section police-detail-actions">
      <h2>Incident Actions</h2>
      <div className="police-detail-action-stack">
        <button className="police-action police-action-verify" onClick={() => triggerAction('Incident verified')}>Verify Incident</button>
        <button className="police-action police-action-view" onClick={() => triggerAction('Ambulance requested')}>Request Ambulance</button>
        <button className="police-action police-action-reject" onClick={() => triggerAction('Marked as false')}>Mark as False</button>
        <button className="police-action police-action-resolve" onClick={() => triggerAction('Incident closed')}>Close Incident</button>
      </div>

      <label className="police-meta" htmlFor="police-note">Operational Notes</label>
      <textarea
        id="police-note"
        className="police-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Operational notes..."
      />
      <div className="police-action-row police-detail-note-actions">
        <button className="police-action police-action-verify" onClick={() => triggerAction('Notes saved')}>Save Notes</button>
        <button className="police-action police-action-view" onClick={() => navigate('/police/verification')}>Go to Queue</button>
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

          <div className="police-incident-media">
            {incident.image
              ? <img src={incident.image} alt={incident.type} className="police-incident-image" />
              : <div className="police-verification-placeholder">No photos available</div>}
          </div>
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

      {toast ? <div className="police-toast">{toast}</div> : null}
    </PoliceShell>
  )
}
