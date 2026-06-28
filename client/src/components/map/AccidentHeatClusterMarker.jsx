import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker, Popup } from 'react-leaflet'

import {
  buildAccidentHeatClusterIcon,
  formatHeatmapTimestamp,
  HEATMAP_LEGEND_COLORS,
} from './heatmapVisuals'

const SEVERITY_ROW_KEYS = ['high', 'medium', 'low']

export default function AccidentHeatClusterMarker({ cluster, onExplain }) {
  const { t } = useTranslation(['map', 'common'])

  const SEVERITY_ROWS = [
    { key: 'high', label: t('accidentHeatClusterMarker.severityHigh') },
    { key: 'medium', label: t('accidentHeatClusterMarker.severityMedium') },
    { key: 'low', label: t('accidentHeatClusterMarker.severityLow') },
  ]

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
            {t('accidentHeatClusterMarker.reportCount', { count: reportCount })}
          </p>
          <p className="accident-heat-popup__sub">
            <span
              className={`accident-heat-popup__pill accident-heat-popup__pill--${dominant}`}
            >
              {t('accidentHeatClusterMarker.dominant', { dominant })}
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
            <span>{t('accidentHeatClusterMarker.avgSeverity')}</span>
            <strong>
              {cluster?.averageSeverity != null
                ? Number(cluster.averageSeverity).toFixed(2)
                : '—'}
            </strong>
          </div>
          <div className="accident-heat-popup__row">
            <span>{t('accidentHeatClusterMarker.officerVerified')}</span>
            <strong>{cluster?.verifiedCount || 0}</strong>
          </div>
          <div className="accident-heat-popup__row">
            <span>{t('accidentHeatClusterMarker.latestReport')}</span>
            <strong>{formatHeatmapTimestamp(cluster?.latestReportAt)}</strong>
          </div>
          {typeof onExplain === 'function' ? (
            <button
              type="button"
              onClick={() => onExplain(cluster)}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '8px 10px',
                background: '#007BFF',
                color: '#FFFFFF',
                border: '1px solid #007BFF',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t('accidentHeatClusterMarker.whyDangerous')}
            </button>
          ) : null}
        </div>
      </Popup>
    </Marker>
  )
}
