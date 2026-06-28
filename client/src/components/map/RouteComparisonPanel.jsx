import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import '../../styles/RouteComparisonPanel.css'

function normaliseLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  const n = Number(percent)
  if (!Number.isFinite(n)) return 'low'
  if (n >= 50) return 'high'
  if (n >= 25) return 'medium'
  return 'low'
}

function countHighRiskSegments(route) {
  const segments = Array.isArray(route?.segments) ? route.segments : []
  let count = 0
  for (const seg of segments) {
    const level = normaliseLevel(seg?.danger_level, seg?.danger_percent)
    if (level === 'high') count += 1
  }
  return count
}

function formatRiskPercent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatMinutes(value, t) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)} ${t('routeComparisonPanel.units.min')}` : t('routeComparisonPanel.units.na')
}

function formatKm(value, t) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : t('routeComparisonPanel.units.na')
}

export default function RouteComparisonPanel({
  routes,
  selectedRouteType,
  onSelect,
  clustersNearbyByRouteType = null,
  reportsNearbyByRouteType = null,
}) {
  const { t } = useTranslation(['map', 'common'])

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
        {t('routeComparisonPanel.empty')}
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
              <span>{route.route_label || route.route_type || t('routeComparisonPanel.routeFallback')}</span>
              <span className="siara-route-card__badges">
                <span
                  className={`siara-route-card__risk-pill risk-${route.normalisedRiskLevel}`}
                >
                  {t(`routeComparisonPanel.riskLevel.${route.normalisedRiskLevel}`)}
                </span>
                {route.is_recommended && (
                  <span className="siara-route-card__badge">{t('routeComparisonPanel.recommended')}</span>
                )}
                {isSelected && (
                  <span className="siara-route-card__badge is-selected">{t('routeComparisonPanel.selected')}</span>
                )}
              </span>
            </span>

            <span className="siara-route-card__meta">
              {t('routeComparisonPanel.metaShort', { risk: dangerPercent, eta: formatMinutes(route?.duration_min, t) })}
            </span>

            <span className="siara-route-card__meta siara-route-card__meta--summary">
              {t('routeComparisonPanel.metaFull', {
                eta: formatMinutes(route?.duration_min, t),
                distance: formatKm(route?.distance_km, t),
                danger: dangerPercent,
              })}
            </span>

            <span className="siara-route-card__factors" aria-label={t('routeComparisonPanel.factorsAriaLabel')}>
              <span
                className={`siara-route-card__factor ${route.highRiskSegmentCount > 0 ? 'is-warning' : ''}`}
                title={t('routeComparisonPanel.highRiskSegmentsTitle')}
              >
                <span className="siara-route-card__factor-icon" aria-hidden="true">
                  <RouteOutlinedIcon fontSize="inherit" />
                </span>
                <span className="siara-route-card__factor-value">
                  {route.highRiskSegmentCount}
                </span>
                <span>{t('routeComparisonPanel.highRiskSegLabel')}</span>
              </span>
              <span
                className={`siara-route-card__factor ${route.clustersNearby > 0 ? 'is-warning' : ''}`}
                title={t('routeComparisonPanel.clustersTitle')}
              >
                <span className="siara-route-card__factor-icon" aria-hidden="true">
                  <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" />
                </span>
                <span className="siara-route-card__factor-value">
                  {route.clustersNearby}
                </span>
                <span>{t('routeComparisonPanel.clusters')}</span>
              </span>
              {reportsNearbyByRouteType ? (
                <span
                  className={`siara-route-card__factor ${route.reportsNearby > 0 ? 'is-warning' : ''}`}
                  title={t('routeComparisonPanel.reportsTitle')}
                >
                  <span className="siara-route-card__factor-icon" aria-hidden="true">
                    <LocationOnOutlinedIcon fontSize="inherit" />
                  </span>
                  <span className="siara-route-card__factor-value">
                    {route.reportsNearby}
                  </span>
                  <span>{t('routeComparisonPanel.reports')}</span>
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
