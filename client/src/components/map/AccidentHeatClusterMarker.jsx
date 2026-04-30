import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'

import {
  buildAccidentHeatClusterIcon,
  formatHeatmapTimestamp,
  HEATMAP_LEGEND_COLORS,
} from './heatmapVisuals'

const SEVERITY_ROWS = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'low', label: 'Low' },
]

export default function AccidentHeatClusterMarker({ cluster }) {
  const lat = Number(cluster?.lat)
  const lng = Number(cluster?.lon)
  const icon = useMemo(() => buildAccidentHeatClusterIcon(cluster), [cluster])

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const counts = cluster?.severityCounts || {}
  const dominant = String(cluster?.dominantSeverity || 'low').toLowerCase()
  const reportCount = Number(cluster?.reportCount) || 0

  return (
    <Marker position={[lat, lng]} icon={icon} keyboard={false}>
      <Popup>
        <div className="accident-heat-popup">
          <p className="accident-heat-popup__title">
            {reportCount} accident report{reportCount === 1 ? '' : 's'}
          </p>
          <p className="accident-heat-popup__sub">
            <span
              className={`accident-heat-popup__pill accident-heat-popup__pill--${dominant}`}
            >
              Dominant: {dominant}
            </span>
          </p>
          <div className="accident-heat-popup__counts">
            {SEVERITY_ROWS.map((row) => (
              <div key={row.key} className="accident-heat-popup__count-cell">
                <span
                  className="accident-heat-popup__count-dot"
                  style={{ background: HEATMAP_LEGEND_COLORS[row.key] }}
                />
                <span>
                  {row.label}: <strong>{counts[row.key] || 0}</strong>
                </span>
              </div>
            ))}
          </div>
          <div className="accident-heat-popup__row">
            <span>Avg severity</span>
            <strong>
              {cluster?.averageSeverity != null
                ? Number(cluster.averageSeverity).toFixed(2)
                : '—'}
            </strong>
          </div>
          <div className="accident-heat-popup__row">
            <span>Officer-verified</span>
            <strong>{cluster?.verifiedCount || 0}</strong>
          </div>
          <div className="accident-heat-popup__row">
            <span>Latest report</span>
            <strong>{formatHeatmapTimestamp(cluster?.latestReportAt)}</strong>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
