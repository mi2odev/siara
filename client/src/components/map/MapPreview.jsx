import React, { useMemo } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import ReportMapMarker from './ReportMapMarker'
import useReportMapReports from '../../hooks/useReportMapReports'

const FALLBACK_CENTER = [28.5, 2.5]

export default function MapPreview({ reports: reportsProp }) {
  const {
    mapReadyReports,
  } = useReportMapReports({
    limit: 8,
    feed: 'latest',
    sort: 'recent',
  })

  const reports = reportsProp || mapReadyReports
  const mapCenter = useMemo(() => {
    const firstReport = (reports || []).find(
      (report) => report?.location?.lat != null && report?.location?.lng != null,
    )

    if (!firstReport) {
      return FALLBACK_CENTER
    }

    return [firstReport.location.lat, firstReport.location.lng]
  }, [reports])

  return (
    <MapContainer
      center={mapCenter}
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
      {(reports || []).map((report) => (
        <ReportMapMarker key={report.id} report={report} />
      ))}
    </MapContainer>
  )
}
