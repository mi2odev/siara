import React, { useEffect, useMemo, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import { getPoliceIncidents, subscribePoliceIncidents } from '../../data/policeMockData'

const DEFAULT_LOCATION = { lat: 36.365, lng: 6.614 }
const RADIUS_OPTIONS = [2, 5, 10]

function toRad(value) {
  return (Number(value) * Math.PI) / 180
}

function distanceKmBetween(lat1, lng1, lat2, lng2) {
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

function severityLabel(value) {
  return String(value || '')
    .replace('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function PoliceNearbyIncidentsPage() {
  const navigate = useNavigate()

  const [incidents, setIncidents] = useState(() => getPoliceIncidents())
  const [officerLocation, setOfficerLocation] = useState(DEFAULT_LOCATION)
  const [locationSource, setLocationSource] = useState('default')
  const [radiusKm, setRadiusKm] = useState(5)
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribePoliceIncidents((items) => {
      setIncidents(items)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!navigator?.geolocation) {
      setLocationSource('default')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position?.coords?.latitude)
        const lng = Number(position?.coords?.longitude)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setOfficerLocation({ lat, lng })
          setLocationSource('live')
        }
      },
      () => {
        setLocationSource('default')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }, [])

  const activeIncidents = useMemo(
    () => incidents.filter((item) => item.status !== 'resolved' && item.status !== 'rejected'),
    [incidents],
  )

  const nearbyIncidents = useMemo(
    () => activeIncidents
      .map((item) => ({
        ...item,
        distanceKm: distanceKmBetween(officerLocation.lat, officerLocation.lng, item.lat, item.lng),
      }))
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm),
    [activeIncidents, officerLocation, radiusKm],
  )

  useEffect(() => {
    if (!nearbyIncidents.length) {
      setSelectedIncidentId(null)
      return
    }

    const exists = nearbyIncidents.some((item) => item.id === selectedIncidentId)
    if (!exists) {
      setSelectedIncidentId(nearbyIncidents[0].id)
    }
  }, [nearbyIncidents, selectedIncidentId])

  const selectedIncident = useMemo(
    () => nearbyIncidents.find((item) => item.id === selectedIncidentId) || null,
    [nearbyIncidents, selectedIncidentId],
  )

  const mapCenter = selectedIncident
    ? [selectedIncident.lat, selectedIncident.lng]
    : [officerLocation.lat, officerLocation.lng]

  const rightPanel = (
    <section className="police-section">
      <h2>Nearby Summary</h2>
      <ul className="police-list">
        <li><strong>Radius:</strong> {radiusKm} km</li>
        <li><strong>Nearby incidents:</strong> {nearbyIncidents.length}</li>
        <li><strong>Location source:</strong> {locationSource === 'live' ? 'Live GPS' : 'Default center'}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell
      activeKey="nearby-incidents"
      rightPanel={rightPanel}
      notificationCount={nearbyIncidents.length}
    >
      <section className="police-section">
        <div className="police-command-section-head">
          <h2>Nearby Incidents</h2>
          <label className="police-filter-field">
            <span>Radius</span>
            <select value={String(radiusKm)} onChange={(event) => setRadiusKm(Number(event.target.value))}>
              {RADIUS_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>{value} km</option>
              ))}
            </select>
          </label>
        </div>

        <p className="police-shortcuts-hint">Showing incidents within {radiusKm} km, sorted by distance.</p>

        <div className="police-nearby-layout">
          <div className="police-nearby-list">
            {nearbyIncidents.map((incident) => (
              <article
                key={incident.id}
                className={`police-nearby-item ${selectedIncidentId === incident.id ? 'active' : ''}`}
                onClick={() => setSelectedIncidentId(incident.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedIncidentId(incident.id)
                  }
                }}
              >
                <div className="police-nearby-item-top">
                  <strong>{incident.id}</strong>
                  <span>{incident.distanceKm.toFixed(2)} km</span>
                </div>
                <p>{incident.location}</p>
                <div className="police-nearby-item-meta">
                  <span>Priority: {severityLabel(incident.severity)}</span>
                  <span>Status: {severityLabel(incident.status)}</span>
                </div>
                <div className="police-nearby-item-actions">
                  <button
                    type="button"
                    className="police-action police-action-view"
                    onClick={(event) => {
                      event.stopPropagation()
                      navigate(`/police/incident/${incident.id}`)
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="police-action police-action-review"
                    onClick={(event) => {
                      event.stopPropagation()
                      navigate('/police/verification', { state: { incidentId: incident.id } })
                    }}
                  >
                    Continue handling
                  </button>
                </div>
              </article>
            ))}

            {nearbyIncidents.length === 0 ? (
              <div className="police-empty-state" role="status" aria-live="polite">
                <div className="police-empty-icon" aria-hidden="true">📍</div>
                <h3>No nearby incidents</h3>
                <p>No active incidents found in this radius.</p>
              </div>
            ) : null}
          </div>

          <div className="police-nearby-map-wrap">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom className="police-leaflet-map" key={selectedIncidentId || 'nearby-map'}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              <Circle
                center={[officerLocation.lat, officerLocation.lng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#2563eb', opacity: 0.65, fillOpacity: 0.06 }}
              />

              <CircleMarker
                center={[officerLocation.lat, officerLocation.lng]}
                radius={8}
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
              >
                <Popup><strong>Your position</strong></Popup>
              </CircleMarker>

              {nearbyIncidents.map((incident) => (
                <CircleMarker
                  key={`nearby-map-${incident.id}`}
                  center={[incident.lat, incident.lng]}
                  radius={selectedIncidentId === incident.id ? 9 : 6}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: incident.severity === 'high' ? '#dc2626' : incident.severity === 'medium' ? '#f59e0b' : '#16a34a', fillOpacity: 0.95 }}
                  eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
                >
                  <Popup>
                    <strong>{incident.id}</strong><br />
                    {incident.location}<br />
                    Distance: {incident.distanceKm.toFixed(2)} km
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      </section>
    </PoliceShell>
  )
}