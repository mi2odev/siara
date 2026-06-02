import React, { memo, useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

import '../../styles/ReportMapMarker.css'
import { normalizeReportType } from './reportTypeMeta'

const SEVERITY_HINT_TO_LEVEL = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'high',
}

// Inline SVG paths so the same icon set renders inside Leaflet's HTML divIcon
// and JSX without relying on React rendering or remote assets.
const ICON_SVG = {
  accident:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M18 1c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5m.5 6h-1V3h1zm0 1v1h-1V8zM6 13.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S8.33 15 7.5 15 6 14.33 6 13.5m13-.57c.65-.09 1.34-.28 2-.6V19c0 .55-.45 1-1 1h-1c-.55 0-1-.45-1-1v-1H6v1c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-8l2.08-5.99C5.29 4.42 5.84 4 6.5 4h4.79c-.19.63-.29 1.31-.29 2H6.85L5.81 9h5.86c.36.75.84 1.43 1.43 2H5v5h14zm-1.09.07c-.89-.01-1.74-.19-2.53-.51-.23.27-.38.62-.38 1.01 0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5c0-.18-.03-.34-.09-.5"/></svg>',
  traffic:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M20 10h-3V8.86c1.72-.45 3-2 3-3.86h-3V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v1H4c0 1.86 1.28 3.41 3 3.86V10H4c0 1.86 1.28 3.41 3 3.86V15H4c0 1.86 1.28 3.41 3 3.86V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1.14c1.72-.45 3-2 3-3.86h-3v-1.14c1.72-.45 3-2 3-3.86m-5 9H9V5h6zm-3-1c.83 0 1.5-.67 1.5-1.5S12.83 15 12 15s-1.5.67-1.5 1.5.67 1.5 1.5 1.5m0-4.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5M12 9c.83 0 1.5-.67 1.5-1.5S12.83 6 12 6s-1.5.67-1.5 1.5S11.17 9 12 9"/></svg>',
  danger:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="m16 6-.44.55c-.42.52-.98.75-1.54.75C13 7.3 12 6.52 12 5.3V2S4 6 4 13c0 4.42 3.58 8 8 8s8-3.58 8-8c0-2.96-1.61-5.62-4-7m-4 13c-1.1 0-2-.87-2-1.94 0-.51.2-.99.58-1.36L12 14.3l1.43 1.4c.37.37.57.85.57 1.36 0 1.07-.9 1.94-2 1.94m3.96-1.5c.04-.36.22-1.89-1.13-3.22L12 11.5l-2.83 2.78C7.81 15.62 8 17.16 8.04 17.5 6.79 16.4 6 14.79 6 13c0-3.16 2.13-5.65 4.03-7.25.23 1.99 1.93 3.55 3.99 3.55.78 0 1.54-.23 2.18-.66C17.34 9.78 18 11.35 18 13c0 1.79-.79 3.4-2.04 4.5"/></svg>',
  weather:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8m0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2m-4.17-6c.37 0 .67.26.74.62.41 2.22 2.28 2.98 3.64 2.87.43-.02.79.32.79.75 0 .4-.32.73-.72.75-2.13.13-4.62-1.09-5.19-4.12-.08-.45.28-.87.74-.87"/></svg>',
  roadworks:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="m13.7826 15.1719 2.1213-2.1213 5.9963 5.9962-2.1213 2.1213zM17.5 10c1.93 0 3.5-1.57 3.5-3.5 0-.58-.16-1.12-.41-1.6l-2.7 2.7-1.49-1.49 2.7-2.7c-.48-.25-1.02-.41-1.6-.41C15.57 3 14 4.57 14 6.5c0 .41.08.8.21 1.16l-1.85 1.85-1.78-1.78.71-.71-1.41-1.41L12 3.49c-1.17-1.17-3.07-1.17-4.24 0L4.22 7.03l1.41 1.41H2.81l-.71.71 3.54 3.54.71-.71V9.15l1.41 1.41.71-.71 1.78 1.78-7.41 7.41 2.12 2.12L16.34 9.79c.36.13.75.21 1.16.21"/></svg>',
  other:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M11 18h2v-2h-2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4"/></svg>',
}

const TypeIcon = ({ type }) => (
  <span
    className="siara-report-type-icon"
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: ICON_SVG[type] || ICON_SVG.other }}
  />
)

const TYPE_META = {
  accident: { svg: ICON_SVG.accident, label: 'Accident' },
  traffic: { svg: ICON_SVG.traffic, label: 'Traffic' },
  danger: { svg: ICON_SVG.danger, label: 'Danger' },
  weather: { svg: ICON_SVG.weather, label: 'Weather' },
  roadworks: { svg: ICON_SVG.roadworks, label: 'Roadworks' },
  other: { svg: ICON_SVG.other, label: 'Other' },
}

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
}

function toFiniteNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateText(value, maxLength) {
  const normalized = String(value || '').trim()
  if (!normalized || normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function formatRelativeTime(value) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} h ago`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

function getReportSeverity(report) {
  const explicitSeverity = String(report?.severity || '').trim().toLowerCase()
  if (
    explicitSeverity === 'high'
    || explicitSeverity === 'medium'
    || explicitSeverity === 'low'
  ) {
    return explicitSeverity
  }

  const hintSeverity = SEVERITY_HINT_TO_LEVEL[Number(report?.severityHint)]
  return hintSeverity || 'low'
}

function getReportType(report) {
  return normalizeReportType(report?.incidentType || report?.type)
}

function getReportMedia(report) {
  if (!Array.isArray(report?.media)) {
    return []
  }

  return report.media.filter((mediaItem) => String(mediaItem?.url || '').trim())
}

function getReportMarkerPosition(report) {
  const nestedLocation = report?.location && typeof report.location === 'object' ? report.location : null
  const lat = toFiniteNumber(nestedLocation?.lat ?? report?.lat)
  const lng = toFiniteNumber(nestedLocation?.lng ?? report?.lng)

  if (lat == null || lng == null) {
    return null
  }

  return [lat, lng]
}

function buildMarkerHtml({ report }) {
  const reportType = getReportType(report)
  const severity = getReportSeverity(report)
  const typeMeta = TYPE_META[reportType]
  const pinColor = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low
  const title = escapeHtml(report?.title || typeMeta.label)

  return `
    <div class="siara-report-pin siara-report-pin--${severity}" style="--pin-color:${pinColor}" aria-label="${title}">
      <svg class="siara-report-pin__svg" viewBox="0 0 48 64" aria-hidden="true" focusable="false">
        <path
          class="siara-report-pin__body"
          d="M24 2C12.4 2 3 11.3 3 22.7c0 14.7 14 25.8 19.1 37.4.7 1.7 3.1 1.7 3.8 0C31 48.5 45 37.4 45 22.7 45 11.3 35.6 2 24 2Z"
        />
        <path
          class="siara-report-pin__gloss"
          d="M24 6C14.7 6 7.2 13.4 7.2 22.5c0 3 .8 5.9 2.2 8.5 2-14.4 10.5-20 20.2-20 5.3 0 9.6 1.3 12.6 3.5C39.3 9.4 32.1 6 24 6Z"
        />
      </svg>
      <div class="siara-report-pin__slot">
        <span class="siara-report-pin__fallback" aria-hidden="true">${typeMeta.svg}</span>
      </div>
    </div>
  `
}

function ReportHoverCard({ report }) {
  const reportType = getReportType(report)
  const severity = getReportSeverity(report)
  const typeMeta = TYPE_META[reportType]
  const media = getReportMedia(report).slice(0, 3)
  const description = truncateText(report?.description, 110)
  const title = truncateText(report?.title || `${typeMeta.label} report`, 64)
  const locationLabel = truncateText(report?.locationLabel || 'Reported location', 56)
  const relativeTime = formatRelativeTime(report?.occurredAt || report?.createdAt)

  return (
    <div className="siara-report-tooltip-card">
      {media.length > 0 ? (
        <div
          className="siara-report-tooltip__media-grid"
          style={{ gridTemplateColumns: `repeat(${media.length}, minmax(0, 1fr))` }}
        >
          {media.map((mediaItem) => (
            <div className="siara-report-tooltip__media-frame" key={mediaItem.id || mediaItem.url}>
              <span className="siara-report-tooltip__media-fallback" aria-hidden="true">
                <TypeIcon type={reportType} />
              </span>
              <img
                src={mediaItem.url}
                alt={title}
                className="siara-report-tooltip__media-image"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="siara-report-tooltip__hero-fallback" aria-hidden="true">
          <TypeIcon type={reportType} />
        </div>
      )}

      <div className="siara-report-tooltip__meta-row">
        <span className={`siara-report-tooltip__badge siara-report-tooltip__badge--${severity}`}>
          {severity}
        </span>
        <span className="siara-report-tooltip__badge siara-report-tooltip__badge--type">
          {typeMeta.label}
        </span>
      </div>

      <div className="siara-report-tooltip__content">
        <h4 className="siara-report-tooltip__title">{title}</h4>
        {description && (
          <p className="siara-report-tooltip__description">{description}</p>
        )}
        <div className="siara-report-tooltip__footer">
          <span className="siara-report-tooltip__location">{locationLabel}</span>
          <span className="siara-report-tooltip__time">{relativeTime}</span>
        </div>
      </div>
    </div>
  )
}

function ReportMapMarker({ report, onClick, tooltipPane, onTooltipVisibilityChange, showTooltip = true }) {
  const position = useMemo(() => getReportMarkerPosition(report), [report])
  const icon = useMemo(() => {
    if (!position) {
      return null
    }

    return L.divIcon({
      className: 'siara-report-marker-icon',
      html: buildMarkerHtml({ report }),
      iconSize: [48, 64],
      iconAnchor: [24, 62],
      tooltipAnchor: [0, -46],
    })
  }, [position, report])

  if (!position || !icon) {
    return null
  }

  const tooltipProps = {
    direction: 'top',
    offset: [0, -20],
    sticky: true,
    opacity: 1,
    className: 'siara-report-tooltip',
  }
  if (tooltipPane) {
    tooltipProps.pane = tooltipPane
  }

  return (
    <Marker
      position={position}
      icon={icon}
      riseOnHover={true}
      eventHandlers={{
        click: () => onClick?.(report),
        tooltipopen: () => onTooltipVisibilityChange?.(true),
        tooltipclose: () => onTooltipVisibilityChange?.(false),
      }}
    >
      {showTooltip && (
        <Tooltip {...tooltipProps}>
          <ReportHoverCard report={report} />
        </Tooltip>
      )}
    </Marker>
  )
}

export default memo(ReportMapMarker)
