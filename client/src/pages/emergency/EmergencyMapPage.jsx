import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import EmergencyShell from '../../components/layout/EmergencyShell'

import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined'

const INCIDENTS = [
  { id: 'EMG-2041', severity: 'high', title: '3-car collision', location: 'A1 km 47, Boudouaou',     lat: 36.7271, lng: 3.4189 },
  { id: 'EMG-2040', severity: 'high', title: 'Building fire',   location: 'Rue Didouche, Algiers',  lat: 36.7717, lng: 3.0586 },
  { id: 'EMG-2038', severity: 'high',     title: 'Pedestrian struck', location: 'Bd Krim, Telemly',     lat: 36.7600, lng: 3.0490 },
  { id: 'EMG-2036', severity: 'medium',   title: 'Cargo spill',     location: 'RN5, Rouiba',            lat: 36.7400, lng: 3.2870 },
]

const HOSPITALS = [
  { id: 'CHU-1', name: 'CHU Mustapha Pacha', lat: 36.7549, lng: 3.0610 },
  { id: 'CHU-2', name: 'CHU Bab El Oued',    lat: 36.7918, lng: 3.0500 },
]

const SEVERITY_COLOR = {
  high:     '#DC2626',
  medium:   '#F4A261',
  low:      '#0FA958',
}

function FlyTo({ center, zoom = 14 }) {
  const map = useMap()
  React.useEffect(() => {
    if (center) map.flyTo(center, zoom, { animate: true, duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]])
  return null
}

export default function EmergencyMapPage() {
  const { t } = useTranslation(['emergency', 'common'])
  const [selectedId, setSelectedId] = useState(null)

  const selected = useMemo(
    () => INCIDENTS.find((i) => i.id === selectedId) || null,
    [selectedId],
  )

  const center = selected ? [selected.lat, selected.lng] : [36.7538, 3.0588]

  return (
    <EmergencyShell unitId="AMB-A12" unitStatus="responding" activeMissions={2}>
      <header className="em-page-head">
        <div>
          <span className="em-eyebrow">{t('emergencyMapPage.eyebrow')}</span>
          <h1 className="em-page-title">{t('emergencyMapPage.title')}</h1>
          <p className="em-page-subtitle">{t('emergencyMapPage.subtitle')}</p>
        </div>
      </header>

      <div className="em-map-layout">
        <div className="em-map-shell">
          <MapContainer center={[36.7538, 3.0588]} zoom={11} scrollWheelZoom>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FlyTo center={center} zoom={13} />

            {INCIDENTS.map((inc) => (
              <CircleMarker
                key={inc.id}
                center={[inc.lat, inc.lng]}
                radius={selectedId === inc.id ? 14 : 10}
                pathOptions={{
                  color: SEVERITY_COLOR[inc.severity],
                  fillColor: SEVERITY_COLOR[inc.severity],
                  fillOpacity: 0.7,
                  weight: 2,
                }}
                eventHandlers={{ click: () => setSelectedId(inc.id) }}
              >
                <Popup>
                  <strong>{inc.id}</strong><br />
                  {inc.title}<br />
                  <small>{inc.location}</small>
                </Popup>
              </CircleMarker>
            ))}

            {HOSPITALS.map((h) => (
              <CircleMarker
                key={h.id}
                center={[h.lat, h.lng]}
                radius={8}
                pathOptions={{ color: '#1D4ED8', fillColor: '#1D4ED8', fillOpacity: 0.4, weight: 2 }}
              >
                <Popup>
                  <strong>{t('emergencyMapPage.hospitalLabel')}</strong><br />
                  {h.name}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div className="em-map-side">
          <section className="em-section">
            <header className="em-section-head">
              <h2 className="em-section-title">
                <span className="em-section-title-icon"><MapOutlinedIcon fontSize="inherit" /></span>
                {t('emergencyMapPage.activeIncidents')}
                <span className="em-section-count">{INCIDENTS.length}</span>
              </h2>
            </header>
            <div>
              {INCIDENTS.map((inc) => (
                <div
                  key={inc.id}
                  className={`em-map-list-item ${selectedId === inc.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(inc.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`em-map-list-bullet ${inc.severity}`} aria-hidden="true" />
                  <div>
                    <div className="em-map-list-title">{inc.title}</div>
                    <div className="em-map-list-loc">{inc.id} · {inc.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="em-section">
            <header className="em-section-head">
              <h2 className="em-section-title">
                <span className="em-section-title-icon" style={{ background: 'var(--em-blue-soft)', color: 'var(--em-blue)' }}>
                  <LocalHospitalOutlinedIcon fontSize="inherit" />
                </span>
                {t('emergencyMapPage.nearbyHospitals')}
              </h2>
            </header>
            <div>
              {HOSPITALS.map((h) => (
                <div key={h.id} className="em-map-list-item">
                  <span className="em-map-list-bullet" style={{ background: '#1D4ED8' }} aria-hidden="true" />
                  <div>
                    <div className="em-map-list-title">{h.name}</div>
                    <div className="em-map-list-loc">{h.id}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </EmergencyShell>
  )
}
