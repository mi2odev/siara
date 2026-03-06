import React from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const SAMPLE_POINTS = [
  { lat: 36.75, lng: 3.06, label: 'Algiers', severity: 'high' },
  { lat: 36.36, lng: 6.61, label: 'Constantine', severity: 'medium' },
  { lat: 35.69, lng: -0.63, label: 'Oran', severity: 'high' },
  { lat: 36.47, lng: 2.83, label: 'Blida', severity: 'low' },
  { lat: 36.19, lng: 5.41, label: 'Setif', severity: 'medium' },
  { lat: 34.85, lng: 5.72, label: 'Biskra', severity: 'low' },
  { lat: 35.40, lng: 1.32, label: 'Tiaret', severity: 'medium' },
]

const COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' }

export default function MapPreview() {
  return (
    <MapContainer
      center={[28.5, 2.5]}
      zoom={5}
      style={{ width: '100%', height: '450px', borderRadius: 16 }}
      scrollWheelZoom={false}
      dragging={true}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {SAMPLE_POINTS.map((pt, i) => (
        <CircleMarker
          key={i}
          center={[pt.lat, pt.lng]}
          radius={10}
          pathOptions={{ color: COLORS[pt.severity], fillColor: COLORS[pt.severity], fillOpacity: 0.7, weight: 2 }}
        >
          <Tooltip>{pt.label} — {pt.severity} risk</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
