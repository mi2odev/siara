import React, { useMemo, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'

import PoliceShell from '../../components/layout/PoliceShell'
import {
  listPoliceIncidents,
  syncPoliceBrowserLocation,
} from '../../services/policeService'

const DEFAULT_MAP_CENTER = { lat: 36.7538, lng: 3.0588 }

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

function buildLocationState(syncResult, responseLocationRequired) {
  if (syncResult?.state === 'using_last_known' && syncResult?.coords) {
    return {
      key: 'using_last_known',
      message: 'Using the last known recent location while the device location is unstable.',
    }
  }

  if (syncResult?.state === 'permission_denied') {
    return {
      key: responseLocationRequired ? 'permission_denied' : 'using_last_known',
      message: responseLocationRequired
        ? 'Location permission was denied. Nearby incidents will stay empty until a valid location is available.'
        : 'Location permission was denied, so nearby incidents are using your latest valid saved location.',
    }
  }

  if (responseLocationRequired) {
    return {
      key: 'location_unavailable',
      message: 'Location unavailable. Turn on location services and refresh to load nearby incidents.',
    }
  }

  if (!responseLocationRequired) {
    return {
      key: 'nearby_loaded',
      message: syncResult?.source === 'cached' || !syncResult?.ok
        ? 'Nearby incidents loaded using your recent saved position.'
        : 'Nearby incidents loaded from your current device position.',
    }
  }

  return {
    key: 'location_unavailable',
    message: 'Location is temporarily unavailable.',
  }
}

export default function PoliceNearbyIncidentsPage() {
  const navigate = useNavigate()
  const [nearbyIncidents, setNearbyIncidents] = useState([])
  const [locationCoords, setLocationCoords] = useState(null)
  const [locationState, setLocationState] = useState({
    key: 'locating',
    message: 'Locating your device...',
  })
  const [locationRequired, setLocationRequired] = useState(false)
  const [selectedIncidentId, setSelectedIncidentId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadNearby = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    setLocationState({
      key: 'locating',
      message: 'Locating your device...',
    })

    let syncResult = null
    try {
      syncResult = await syncPoliceBrowserLocation()
      if (syncResult?.coords) {
        setLocationCoords(syncResult.coords)
      }
    } catch (locationError) {
      syncResult = {
        ok: false,
        reason: 'temporary_error',
        state: 'location_unavailable',
      }
    }

    try {
      const response = await listPoliceIncidents({
        scope: 'nearby',
        page: 1,
        pageSize: 30,
      })

      setNearbyIncidents(response.items)
      setSelectedIncidentId((previousId) => (
        previousId && response.items.some((item) => item.id === previousId)
          ? previousId
          : response.items[0]?.id || null
      ))
      setLocationRequired(Boolean(response.locationRequired))
      setLocationState(buildLocationState(syncResult, Boolean(response.locationRequired)))
    } catch (loadError) {
      setError(loadError.message || 'Failed to load nearby incidents.')
      setLocationRequired(false)
      setLocationState(buildLocationState(syncResult, true))
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadNearby()
  }, [loadNearby])

  const selectedIncident = useMemo(
    () => nearbyIncidents.find((item) => item.id === selectedIncidentId) || nearbyIncidents[0] || null,
    [nearbyIncidents, selectedIncidentId],
  )

  const mapCenter = selectedIncident?.location?.lat != null && selectedIncident?.location?.lng != null
    ? [selectedIncident.location.lat, selectedIncident.location.lng]
    : locationCoords
      ? [locationCoords.lat, locationCoords.lng]
      : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]

  const rightPanel = (
    <section className="police-section">
      <h2>Nearby Summary</h2>
      <ul className="police-list">
        <li><strong>Radius:</strong> 500 m</li>
        <li><strong>Nearby incidents:</strong> {nearbyIncidents.length}</li>
        <li><strong>Location status:</strong> {displayLabel(locationState.key)}</li>
      </ul>
    </section>
  )

  return (
    <PoliceShell activeKey="nearby-incidents" rightPanel={rightPanel} notificationCount={nearbyIncidents.length}>
      <section className="police-section">
        <div className="police-command-section-head">
          <h2>Nearby Incidents</h2>
          <button
            type="button"
            className="police-action police-action-secondary"
            onClick={loadNearby}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh location'}
          </button>
        </div>

        <p className="police-shortcuts-hint">{locationState.message}</p>
        {error ? <p className="police-meta" style={{ color: '#b91c1c' }}>{error}</p> : null}
        {!error && isLoading ? <p className="police-meta">Loading nearby incidents...</p> : null}

        <div className="police-nearby-layout">
          <div className="police-nearby-list">
            {nearbyIncidents.map((incident) => (
              <article
                key={incident.id}
                className={`police-nearby-item ${selectedIncident?.id === incident.id ? 'active' : ''}`}
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
                  <strong>{incident.displayId}</strong>
                  <span>{incident.distanceLabel || 'Nearby'}</span>
                </div>
                <p>{incident.locationText}</p>
                <div className="police-nearby-item-meta">
                  <span>Priority: {displayLabel(incident.severity)}</span>
                  <span>Status: {displayLabel(incident.status)}</span>
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

            {!isLoading && nearbyIncidents.length === 0 ? (
              <div className="police-empty-state" role="status" aria-live="polite">
                <div className="police-empty-icon" aria-hidden="true">📍</div>
                <h3>{locationRequired ? 'Location unavailable' : 'No nearby incidents'}</h3>
                <p>
                  {locationRequired
                    ? 'No usable officer location is available yet, so nearby incidents cannot be calculated.'
                    : 'No active incidents are currently within 500 meters of your latest valid location.'}
                </p>
              </div>
            ) : null}
          </div>

          <div className="police-nearby-map-wrap">
            <MapContainer center={mapCenter} zoom={14} scrollWheelZoom className="police-leaflet-map" key={selectedIncident?.id || locationState.key}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {locationCoords ? (
                <>
                  <Circle
                    center={[locationCoords.lat, locationCoords.lng]}
                    radius={500}
                    pathOptions={{ color: '#2563eb', opacity: 0.65, fillOpacity: 0.06 }}
                  />

                  <CircleMarker
                    center={[locationCoords.lat, locationCoords.lng]}
                    radius={8}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
                  >
                    <Popup><strong>Your position</strong></Popup>
                  </CircleMarker>
                </>
              ) : null}

              {nearbyIncidents.map((incident) => (
                incident.location?.lat != null && incident.location?.lng != null ? (
                  <CircleMarker
                    key={`nearby-map-${incident.id}`}
                    center={[incident.location.lat, incident.location.lng]}
                    radius={selectedIncident?.id === incident.id ? 9 : 6}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: severityColor(incident.severity),
                      fillOpacity: 0.95,
                    }}
                    eventHandlers={{ click: () => setSelectedIncidentId(incident.id) }}
                  >
                    <Popup>
                      <strong>{incident.displayId}</strong><br />
                      {incident.locationText}<br />
                      {incident.distanceLabel || 'Nearby'}
                    </Popup>
                  </CircleMarker>
                ) : null
              ))}
            </MapContainer>
          </div>
        </div>
      </section>
    </PoliceShell>
  )
}
