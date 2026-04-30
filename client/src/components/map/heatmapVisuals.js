import L from 'leaflet'

// Severity colors used by the heatmap legend, popup pills, and the cloud
// gradient. Centralised here so the AccidentHeatClusterMarker component and
// the SiaraMap legend can share a single source of truth.
export const HEATMAP_LEGEND_COLORS = {
  low: '#3B82F6',
  moderate: '#FACC15',
  high: '#F97316',
  critical: '#DC2626',
}

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low']
const FALLBACK_COLOR = HEATMAP_LEGEND_COLORS.low

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function compactCount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(Math.round(num))
}

function safeId(input) {
  return String(input || 'cluster').replace(/[^a-zA-Z0-9_-]/g, '_')
}

// Convert the backend's cumulative `colorStops` (critical → high → moderate
// → low, each `stop` is the cumulative radius fraction from the center
// outward) into a list of radial-gradient stops that produces a soft heat
// cloud. The strategy:
//   * For each present severity, place TWO stops in the gradient — a more
//     opaque stop at the inner edge of the slice and a softer stop at the
//     outer edge — so neighbouring severities blend into each other instead
//     of forming hard rings.
//   * Always finish with a fully transparent stop so the cloud edges fade
//     into the map.
function buildGradientStops(cluster) {
  const colorStops = Array.isArray(cluster?.colorStops) && cluster.colorStops.length > 0
    ? cluster.colorStops
    : [{ severity: 'low', color: FALLBACK_COLOR, stop: 1 }]

  const total =
    Number(cluster?.severityCounts?.low || 0) +
    Number(cluster?.severityCounts?.moderate || 0) +
    Number(cluster?.severityCounts?.high || 0) +
    Number(cluster?.severityCounts?.critical || 0)

  // Center intensity scales with how dominant the strongest severity is —
  // a cluster of pure-critical reports gets a denser core than a mixed bag.
  const dominantFraction = total > 0
    ? Math.max(...SEVERITY_ORDER.map((key) => Number(cluster?.severityCounts?.[key] || 0))) / total
    : 1
  const centerOpacity = 0.55 + dominantFraction * 0.3 // ~0.55..0.85

  let prev = 0
  const stops = []
  for (let i = 0; i < colorStops.length; i += 1) {
    const slice = colorStops[i]
    const start = prev
    const end = clamp(Number(slice?.stop) || 0, prev, 1)
    if (end <= start) continue
    const color = slice?.color || FALLBACK_COLOR
    const innerOpacity = i === 0
      ? centerOpacity
      : Math.max(0.18, centerOpacity * (1 - end * 0.6))
    const outerOpacity = Math.max(0.1, innerOpacity * 0.55)
    stops.push({ offset: start, color, opacity: innerOpacity })
    stops.push({ offset: end, color, opacity: outerOpacity })
    prev = end
  }
  const lastColor = colorStops[colorStops.length - 1]?.color || FALLBACK_COLOR
  stops.push({ offset: 1, color: lastColor, opacity: 0 })
  return stops
}

export function buildAccidentHeatClusterIcon(cluster) {
  const radiusPx = clamp(Number(cluster?.radiusPx) || 36, 22, 110)
  const blurPad = Math.round(radiusPx * 0.45)
  const totalPx = Math.round(radiusPx * 2 + blurPad * 2)
  const cx = totalPx / 2
  const cy = totalPx / 2

  const stops = buildGradientStops(cluster)
  const reportCount = Number(cluster?.reportCount) || 0
  const countLabel = compactCount(reportCount)

  const idBase = safeId(cluster?.id)
  const gradientId = `accident-heat-grad-${idBase}`
  const blurId = `accident-heat-blur-${idBase}`

  const stdDeviation = Math.max(3, Math.round(radiusPx * 0.18))

  const stopMarkup = stops
    .map(
      (s) =>
        `<stop offset="${(clamp(s.offset, 0, 1) * 100).toFixed(2)}%" stop-color="${s.color}" stop-opacity="${clamp(s.opacity, 0, 1).toFixed(3)}"/>`,
    )
    .join('')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalPx}" height="${totalPx}" viewBox="0 0 ${totalPx} ${totalPx}">
      <defs>
        <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">
          ${stopMarkup}
        </radialGradient>
        <filter id="${blurId}" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="${stdDeviation}"/>
        </filter>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${radiusPx.toFixed(1)}" fill="url(#${gradientId})" filter="url(#${blurId})"/>
    </svg>
  `.trim()

  const countMarkup = reportCount >= 2
    ? `<span class="accident-heat-cluster__count">${countLabel}</span>`
    : ''

  const html = `
    <div class="accident-heat-cluster" style="width:${totalPx}px;height:${totalPx}px;">
      ${svg}
      ${countMarkup}
    </div>
  `

  return L.divIcon({
    className: 'accident-heat-cluster-wrapper',
    html,
    iconSize: [totalPx, totalPx],
    iconAnchor: [cx, cy],
  })
}

export function formatHeatmapTimestamp(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}
