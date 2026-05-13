import React, { memo, useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

import '../../styles/ReportMapMarker.css'

const SEVERITY_HINT_TO_LEVEL = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'high',
}

// Inline Material Symbols SVG paths so the same icon set renders both inside
// Leaflet's HTML divIcon (raw string) and JSX. Each path is drawn at 24x24.
const ICON_SVG = {
  accident:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M11.5 2.2 12.6 5.3l3.1-1.1-1.7 2.8 2.8 1.7-3.2.5-.4 3.2-1.7-2.8-2.9 1.1 1.1-2.9-2.8-1.7 3.2-.5z"/><path d="M2.5 19.5h13.1c.3 0 .5-.2.5-.5v-2.6l-1-2.7-1.6-1.1H7l-1.5 1.1L4 16.4v2.6c0 .3.2.5.5.5zm2.4-3.1a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm9 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z"/><path d="M19.5 13.6c.3 0 .5-.2.5-.5l-.5-2.7-1.1-1.6h-3.2l-1 1.1.6.5 1.6.5L19.5 13.6zm-1.7-1.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>',
  traffic:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">' +
      // Housing
      '<path d="M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 18H8V4h8v16z"/>' +
      // Side brackets (mounting bars)
      '<path d="M3 6h2v2H3zm0 5h2v2H3zm0 5h2v2H3zm16-10h2v2h-2zm0 5h2v2h-2zm0 5h2v2h-2z"/>' +
      // Three lights
      '<circle cx="12" cy="7.5" r="1.6"/>' +
      '<circle cx="12" cy="12" r="1.6"/>' +
      '<circle cx="12" cy="16.5" r="1.6"/>' +
    '</svg>',
  danger:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"/></svg>',
  weather:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M19.36 10.04A7.49 7.49 0 005 9.5 5.5 5.5 0 006 20h13a4.5 4.5 0 00.36-9.96zM7 17a3 3 0 010-6 5.5 5.5 0 0110.5 1.5h.5a2.5 2.5 0 010 5H7z"/></svg>',
  roadworks:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M14.13 7.6L12 2 9.87 7.6l4.26 0zM7.5 8.93L4.21 15h6.58L7.5 8.93zm9 0L13.21 15h6.58L16.5 8.93zM3 17v3h18v-3H3z"/></svg>',
  other:
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-5h2v2h-2v-2zm.5-9a3.5 3.5 0 013.5 3.5c0 1.4-.9 2.2-1.6 2.7-.7.5-1.4.9-1.4 1.8h-2c0-1.5.7-2.2 1.4-2.7.5-.4 1-.7 1-1.3a1.5 1.5 0 00-3 0H8.5a3.5 3.5 0 013-3.5z"/></svg>',
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

function sanitizeImageUrl(url) {
  const normalized = String(url || '').trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
  const normalizedType = String(report?.incidentType || report?.type || 'other').trim().toLowerCase()
  return TYPE_META[normalizedType] ? normalizedType : 'other'
}

function getReportMedia(report) {
  if (!Array.isArray(report?.media)) {
    return []
  }

  return report.media.filter((mediaItem) => String(mediaItem?.url || '').trim())
}

export function getReportMarkerPosition(report) {
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
  const primaryImageUrl = sanitizeImageUrl(getReportMedia(report)[0]?.url)
  const title = escapeHtml(report?.title || typeMeta.label)
  const imageStyle = primaryImageUrl ? ` style="background-image:url('${primaryImageUrl}')"` : ''

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
      <div class="siara-report-pin__slot"${imageStyle}>
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
