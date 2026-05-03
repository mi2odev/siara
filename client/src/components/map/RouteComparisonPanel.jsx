import { useMemo } from 'react'
import '../../styles/RouteComparisonPanel.css'

function normaliseLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'extreme'
  if (text === 'high') return 'high'
  if (text === 'moderate' || text === 'medium') return 'moderate'
  if (text === 'low') return 'low'
  const n = Number(percent)
  if (!Number.isFinite(n)) return 'low'
  if (n >= 75) return 'extreme'
  if (n >= 50) return 'high'
  if (n >= 25) return 'moderate'
  return 'low'
}

function levelLabel(level) {
  if (!level) return '—'
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function countHighRiskSegments(route) {
  const segments = Array.isArray(route?.segments) ? route.segments : []
  let count = 0
  for (const seg of segments) {
    const level = normaliseLevel(seg?.danger_level, seg?.danger_percent)
    if (level === 'high' || level === 'extreme') count += 1
  }
  return count
}

function formatRiskPercent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatMinutes(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)} min` : 'n/a'
}

function formatKm(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : 'n/a'
}

export default function RouteComparisonPanel({
  routes,
  selectedRouteType,
  onSelect,
  clustersNearbyByRouteType = null,
  reportsNearbyByRouteType = null,
}) {
  const items = useMemo(() => {
    if (!Array.isArray(routes)) return []
    return routes.map((route) => {
      const dangerPercent = Number(route?.summary?.danger_percent)
      const level = normaliseLevel(route?.summary?.danger_level, dangerPercent)
      const highRiskSegmentCount = countHighRiskSegments(route)
      const clustersNearby =
        clustersNearbyByRouteType && route?.route_type
          ? Number(clustersNearbyByRouteType[route.route_type] || 0)
          : 0
      const reportsNearby =
        reportsNearbyByRouteType && route?.route_type
          ? Number(reportsNearbyByRouteType[route.route_type] || 0)
          : 0
      return {
        ...route,
        normalisedRiskLevel: level,
        highRiskSegmentCount,
        clustersNearby,
        reportsNearby,
      }
    })
  }, [routes, clustersNearbyByRouteType, reportsNearbyByRouteType])

  if (!items.length) {
    return (
      <p className="siara-route-comparison-empty">
        No alternative routes available yet.
      </p>
    )
  }

  return (
    <div className="siara-route-card-grid" role="list">
      {items.map((route) => {
        const isSelected = route.route_type === selectedRouteType
        const accent = route.route_color || undefined
        const dangerPercent = formatRiskPercent(route?.summary?.danger_percent)

        return (
          <button
            key={`route-card-${route.route_type || route.route_id}`}
            type="button"
            role="listitem"
            className={`siara-route-card ${isSelected ? 'is-selected' : ''}`}
            style={accent ? { '--route-accent': accent } : undefined}
            onClick={() => {
              if (typeof onSelect === 'function' && route.route_type) {
                onSelect(route.route_type)
              }
            }}
            aria-pressed={isSelected}
          >
            <span className="siara-route-card__header">
              <span>{route.route_label || route.route_type || 'Route'}</span>
              <span className="siara-route-card__badges">
                <span
                  className={`siara-route-card__risk-pill risk-${route.normalisedRiskLevel}`}
                >
                  {levelLabel(route.normalisedRiskLevel)}
                </span>
                {route.is_recommended && (
                  <span className="siara-route-card__badge">Recommended</span>
                )}
                {isSelected && (
                  <span className="siara-route-card__badge is-selected">Selected</span>
                )}
              </span>
            </span>

            <span className="siara-route-card__meta">
              risk {dangerPercent} • eta {formatMinutes(route?.duration_min)}
            </span>

            <span className="siara-route-card__meta siara-route-card__meta--summary">
              ETA {formatMinutes(route?.duration_min)}
              {' • '}distance {formatKm(route?.distance_km)}
              {' • '}danger {dangerPercent}
            </span>

            <span className="siara-route-card__factors" aria-label="Route risk factors">
              <span
                className={`siara-route-card__factor ${route.highRiskSegmentCount > 0 ? 'is-warning' : ''}`}
                title="High-risk road segments on this route"
              >
                <span className="siara-route-card__factor-icon" aria-hidden="true">
                  🛣️
                </span>
                <span className="siara-route-card__factor-value">
                  {route.highRiskSegmentCount}
                </span>
                <span>high-risk seg.</span>
              </span>
              <span
                className={`siara-route-card__factor ${route.clustersNearby > 0 ? 'is-warning' : ''}`}
                title="Accident heat clusters within 1.5 km of this route"
              >
                <span className="siara-route-card__factor-icon" aria-hidden="true">
                  🔥
                </span>
                <span className="siara-route-card__factor-value">
                  {route.clustersNearby}
                </span>
                <span>clusters</span>
              </span>
              {reportsNearbyByRouteType ? (
                <span
                  className={`siara-route-card__factor ${route.reportsNearby > 0 ? 'is-warning' : ''}`}
                  title="Recent reports near this route"
                >
                  <span className="siara-route-card__factor-icon" aria-hidden="true">
                    📍
                  </span>
                  <span className="siara-route-card__factor-value">
                    {route.reportsNearby}
                  </span>
                  <span>reports</span>
                </span>
              ) : null}
            </span>

            {route.comparisonText ? (
              <span className="siara-route-card__meta">{route.comparisonText}</span>
            ) : null}
            {route.recommendedReason ? (
              <span className="siara-route-card__reason">{route.recommendedReason}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
