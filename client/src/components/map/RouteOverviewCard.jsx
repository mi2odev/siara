import { useMemo } from 'react'
import BestTimeToLeaveCompact from './BestTimeToLeaveCompact'
import '../../styles/RouteOverviewCard.css'

// Right-side panel surfaced only in MapLibre navigation mode.
//
// Composes:
//   • destination + route-type badge
//   • 3-up stats grid (ETA / distance left / overall risk)
//   • "Why this route?" template summary + bullet reasons (no layout-killing
//     skeleton — the parent card is already fully populated from the
//     route data, so we render the summary inline and never block the UI)
//   • alternative route chips (Safest / Balanced / Fastest)
//   • optional "Generate AI explanation" button to manually trigger Ollama
//
// All data is read from already-loaded selectedRoute + routes — this card
// never triggers /api/risk/route on its own.

const TIER_CLASSES = {
  low: 'risk-low',
  moderate: 'risk-moderate',
  medium: 'risk-moderate',
  high: 'risk-high',
  extreme: 'risk-extreme',
  critical: 'risk-extreme',
}

const TIER_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  medium: 'Moderate',
  high: 'High',
  extreme: 'Extreme',
  critical: 'Extreme',
}

const ALT_ICONS = {
  safest: '🛡️',
  balanced: '⚖️',
  fastest: '⚡',
}

function tierFromLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'medium') return 'moderate'
  if (text === 'critical') return 'extreme'
  if (TIER_CLASSES[text]) return text
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'low'
  if (numeric >= 75) return 'extreme'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'moderate'
  return 'low'
}

function formatPercent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatDistanceKm(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1) return `${Math.round(n * 1000)} m`
  return `${n.toFixed(n < 10 ? 1 : 0)} km`
}

function formatMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${Math.round(n)} min`
}

function titleCase(text) {
  if (!text) return ''
  const s = String(text)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function RouteOverviewCard({
  selectedRoute,
  alternatives = [],
  destinationName = '',
  explanation = null,
  explanationLoading = false,
  explanationError = '',
  onChangeRouteType,
  onGenerateAiExplanation,
  aiGenerating = false,
  origin = null,
  destination = null,
  onSelectDepartureTimestamp,
}) {
  const data = useMemo(() => {
    if (!selectedRoute) return null
    const summary = selectedRoute.summary || {}
    const dangerPercent = Number(summary.danger_percent)
    const tier = tierFromLevel(summary.danger_level, dangerPercent)
    return {
      routeType: selectedRoute.route_type || null,
      routeLabel: selectedRoute.route_label || titleCase(selectedRoute.route_type),
      distanceKm: Number(selectedRoute.distance_km),
      durationMin: Number(selectedRoute.duration_min ?? selectedRoute.eta_min),
      dangerPercent: Number.isFinite(dangerPercent) ? dangerPercent : null,
      tier,
      tierClass: TIER_CLASSES[tier] || 'risk-low',
      tierLabel: TIER_LABELS[tier] || 'Unknown',
    }
  }, [selectedRoute])

  if (!data) return null

  const summary = explanation?.summary || ''
  const reasons = Array.isArray(explanation?.reasons) ? explanation.reasons : []
  const source = explanation?.source || null

  // Filter alternatives to other route types only.
  const altChips = (Array.isArray(alternatives) ? alternatives : [])
    .filter((route) => route && route.route_type && route.route_type !== data.routeType)
    .slice(0, 3)

  return (
    <aside
      className="siara-route-overview"
      role="region"
      aria-label="Selected route overview"
    >
      <header className="siara-route-overview__header">
        <span className="siara-route-overview__icon" aria-hidden="true">🧭</span>
        <h4 className="siara-route-overview__title">Selected route</h4>
        {data.routeLabel ? (
          <span className="siara-route-overview__type-badge">{data.routeLabel}</span>
        ) : null}
      </header>

      {destinationName ? (
        <div className="siara-route-overview__row">
          <span className="siara-route-overview__label">Destination</span>
          <span className="siara-route-overview__value">{destinationName}</span>
        </div>
      ) : null}

      <div className="siara-route-overview__stats">
        <div className="siara-route-overview__stat">
          <strong>{formatMinutes(data.durationMin)}</strong>
          <span>ETA</span>
        </div>
        <div className="siara-route-overview__stat">
          <strong>{formatDistanceKm(data.distanceKm)}</strong>
          <span>Left</span>
        </div>
        <div className={`siara-route-overview__stat ${data.tierClass}`}>
          <strong>{formatPercent(data.dangerPercent)}</strong>
          <span>{data.tierLabel}</span>
        </div>
      </div>

      <div className="siara-route-overview__why">
        <p className="siara-route-overview__why-title">Why this route?</p>
        {explanationLoading && !summary ? (
          <p className="siara-route-overview__why-text siara-route-overview__why-text--muted">
            Analysing risk factors…
          </p>
        ) : summary ? (
          <p className="siara-route-overview__why-text">{summary}</p>
        ) : explanationError ? (
          <p className="siara-route-overview__why-text siara-route-overview__why-text--muted">
            {explanationError}
          </p>
        ) : (
          <p className="siara-route-overview__why-text siara-route-overview__why-text--muted">
            SIARA selected this route based on the available route risk,
            distance, ETA and segment danger data.
          </p>
        )}
        {reasons.length > 0 ? (
          <ul className="siara-route-overview__why-list">
            {reasons.slice(0, 4).map((reason, idx) => {
              const key = reason?.id || `${reason?.type || 'reason'}-${idx}`
              return (
                <li key={key} className="siara-route-overview__why-item">
                  {reason?.label || reason?.detail || 'Risk factor'}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {altChips.length > 0 && typeof onChangeRouteType === 'function' ? (
        <div className="siara-route-overview__alts" role="group" aria-label="Route alternatives">
          {altChips.map((route) => {
            const altPercent = Number(route?.summary?.danger_percent)
            return (
              <button
                key={route.route_type}
                type="button"
                className="siara-route-overview__alt-btn"
                onClick={() => onChangeRouteType(route.route_type)}
              >
                <span className="siara-route-overview__alt-icon" aria-hidden="true">
                  {ALT_ICONS[route.route_type] || '🛣️'}
                </span>
                {route.route_label || titleCase(route.route_type)}
                <small>
                  {Number.isFinite(altPercent) ? `${Math.round(altPercent)}% risk` : 'view'}
                </small>
              </button>
            )
          })}
        </div>
      ) : null}

      <BestTimeToLeaveCompact
        origin={origin}
        destination={destination}
        enabled={Boolean(origin && destination)}
        onSelectTimestamp={onSelectDepartureTimestamp}
      />

      {typeof onGenerateAiExplanation === 'function' && source !== 'ollama' ? (
        <button
          type="button"
          className="siara-route-overview__ai-button"
          onClick={onGenerateAiExplanation}
          disabled={aiGenerating}
        >
          <span aria-hidden="true">✨</span>
          {aiGenerating ? 'Calling Ollama…' : 'Generate AI explanation'}
        </button>
      ) : null}

      {source === 'ollama' ? (
        <div className="siara-route-overview__ai-chip">
          <span aria-hidden="true">✨</span>
          AI explanation
        </div>
      ) : null}
    </aside>
  )
}
