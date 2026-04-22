import React, { memo, useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

import '../../styles/ReportMapMarker.css'

const SEVERITY_HINT_TO_LEVEL = {
  1: 'low',
  2: 'medium',
  3: 'high',
}

const TYPE_META = {
  accident: { icon: '🚗', label: 'Accident' },
  traffic: { icon: '🚦', label: 'Traffic' },
  danger: { icon: '⚠️', label: 'Danger' },
  weather: { icon: '🌧️', label: 'Weather' },
  roadworks: { icon: '🚧', label: 'Roadworks' },
  other: { icon: '❓', label: 'Other' },
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
  if (explicitSeverity === 'high' || explicitSeverity === 'medium' || explicitSeverity === 'low') {
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
        <span class="siara-report-pin__fallback" aria-hidden="true">${escapeHtml(typeMeta.icon)}</span>
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
                {typeMeta.icon}
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
          {typeMeta.icon}
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

function ReportMapMarker({ report, onClick, tooltipPane, onTooltipVisibilityChange }) {
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
      <Tooltip
        direction="top"
        offset={[0, -20]}
        sticky
        opacity={1}
        pane={tooltipPane || undefined}
        className="siara-report-tooltip"
      >
        <ReportHoverCard report={report} />
      </Tooltip>
    </Marker>
  )
}

export default memo(ReportMapMarker)
