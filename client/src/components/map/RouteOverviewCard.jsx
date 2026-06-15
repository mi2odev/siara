import { useMemo } from 'react'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import BestTimeToLeaveCompact from './BestTimeToLeaveCompact'
import '../../styles/RouteOverviewCard.css'
import { routeOccurrenceRisk, segmentOccurrenceRisk } from '../../utils/occurrenceRisk'

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
  unknown: 'risk-unknown',
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
}

const TIER_LABELS = {
  unknown: 'Unknown',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const ALT_ICONS = {
  safest: ShieldOutlinedIcon,
  balanced: BalanceOutlinedIcon,
  fastest: BoltOutlinedIcon,
}

function tierFromLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'unknown' || text === 'unavailable') return 'unknown'
  if (TIER_CLASSES[text]) return text
  if (percent === null || percent === undefined || percent === '') return 'unknown'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'unknown'
  if (numeric >= 75) return 'high'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'medium'
  return 'low'
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return 'â€”'
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
    // Headline route risk = occurrence model (probability of an accident),
    // falling back to the severity danger score when occurrence is unavailable.
    const occ = routeOccurrenceRisk(selectedRoute)
    const dangerPercent = occ ? occ.percent : Number(summary.danger_percent)
    const riskAvailable =
      occ != null ||
      (selectedRoute.riskAvailable !== false &&
        selectedRoute.risk_available !== false &&
        summary.riskAvailable !== false &&
        summary.risk_available !== false)
    const tier = occ
      ? occ.level || tierFromLevel(null, occ.percent)
      : tierFromLevel(summary.danger_level, dangerPercent)
    return {
      routeType: selectedRoute.route_type || null,
      routeLabel: selectedRoute.route_label || titleCase(selectedRoute.route_type),
      distanceKm: Number(selectedRoute.distance_km),
      durationMin: Number(selectedRoute.duration_min ?? selectedRoute.eta_min),
      dangerPercent: riskAvailable && Number.isFinite(dangerPercent) ? dangerPercent : null,
      riskAvailable,
      riskMessage:
        selectedRoute.riskMessage ||
        selectedRoute.message ||
        summary.message ||
        'Route loaded, but risk scoring is unavailable.',
      tier,
      tierClass: TIER_CLASSES[tier] || 'risk-low',
      tierLabel: TIER_LABELS[tier] || 'Unknown',
    }
  }, [selectedRoute])

  if (!data) return null

  const summary = explanation?.summary || ''
  const reasons = Array.isArray(explanation?.reasons) ? explanation.reasons : []
  const source = explanation?.source || null
  const segmentSummary = Array.isArray(selectedRoute?.segments)
    ? selectedRoute.segments.slice(0, 5)
    : []

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
        <span className="siara-route-overview__icon" aria-hidden="true">
          <ExploreOutlinedIcon fontSize="inherit" />
        </span>
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
        <div className="siara-route-overview__why-head">
          <p className="siara-route-overview__why-title">Why this route?</p>
          {source === 'ollama' ? (
            <span className="siara-route-overview__ai-chip">
              <AutoAwesomeOutlinedIcon fontSize="inherit" aria-hidden="true" />
              AI explanation
            </span>
          ) : null}
        </div>
        <div className="siara-route-overview__why-panel">
          {!data.riskAvailable ? (
            <p className="siara-route-overview__why-text siara-route-overview__why-text--muted">
              {data.riskMessage}
            </p>
          ) : explanationLoading && !summary ? (
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
          {typeof onGenerateAiExplanation === 'function' && source !== 'ollama' ? (
            <button
              type="button"
              className="siara-route-overview__ai-button"
              onClick={onGenerateAiExplanation}
              disabled={aiGenerating}
            >
              <AutoAwesomeOutlinedIcon fontSize="inherit" aria-hidden="true" />
              {aiGenerating ? 'Calling Ollama…' : 'Generate AI explanation'}
            </button>
          ) : null}
        </div>
      </div>

      {segmentSummary.length > 0 ? (
        <div className="siara-route-overview__segments">
          <p className="siara-route-overview__section-label">Segment risk summary</p>
          {segmentSummary.map((segment, index) => {
            // Prefer the occurrence-model probability for the segment; fall back
            // to the severity danger score when occurrence data is missing.
            const segOcc = segmentOccurrenceRisk(segment)
            const rawPercent = segOcc ? segOcc.percent : segment?.danger_percent
            const percent = Number(rawPercent)
            const hasPercent =
              rawPercent !== null &&
              rawPercent !== undefined &&
              rawPercent !== '' &&
              Number.isFinite(percent)
            const tier = segOcc
              ? segOcc.level || tierFromLevel(null, segOcc.percent)
              : tierFromLevel(segment?.danger_level, hasPercent ? percent : null)
            const sp = segment?.severity_probabilities
            const sevVal = (k) => {
              const n = sp ? Number(sp[`severity_${k}`]) : NaN
              return Number.isFinite(n) ? n : 0
            }
            const sevColors = { 1: '#16a34a', 2: '#f59e0b', 3: '#ea580c', 4: '#b91c1c' }
            return (
              <div
                key={segment?.segment_id || `segment-${index}`}
                className="siara-route-overview__segment"
              >
                <div className="siara-route-overview__segment-row">
                  <span>Segment {index + 1}</span>
                  <span className={`siara-route-overview__segment-risk ${TIER_CLASSES[tier] || 'risk-low'}`}>
                    {formatPercent(hasPercent ? percent : null)} {TIER_LABELS[tier] || ''}
                  </span>
                </div>
                {sp ? (
                  <>
                    <span
                      style={{
                        display: 'flex',
                        height: 6,
                        borderRadius: 4,
                        overflow: 'hidden',
                        background: '#eef2f7',
                        margin: '4px 0 2px',
                      }}
                    >
                      {[1, 2, 3, 4].map((k) => (
                        <span
                          key={k}
                          title={`Severity ${k}: ${sevVal(k)}%`}
                          style={{ width: `${Math.max(0, Math.min(100, sevVal(k)))}%`, background: sevColors[k] }}
                        />
                      ))}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: '#64748b',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>S1 {sevVal(1)}%</span>
                      <span>S2 {sevVal(2)}%</span>
                      <span>S3 {sevVal(3)}%</span>
                      <span>S4 {sevVal(4)}%</span>
                    </span>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {altChips.length > 0 && typeof onChangeRouteType === 'function' ? (
        <div className="siara-route-overview__alts-section">
          <p className="siara-route-overview__section-label">Switch route</p>
          <div className="siara-route-overview__alts" role="group" aria-label="Route alternatives">
            {altChips.map((route) => {
              const rawAltPercent = route?.summary?.danger_percent
              const altPercent = Number(rawAltPercent)
              const altHasPercent =
                rawAltPercent !== null &&
                rawAltPercent !== undefined &&
                rawAltPercent !== '' &&
                Number.isFinite(altPercent)
              return (
                <button
                  key={route.route_type}
                  type="button"
                  className="siara-route-overview__alt-btn"
                  onClick={() => onChangeRouteType(route.route_type)}
                >
                  <span className="siara-route-overview__alt-icon" aria-hidden="true">
                    {(() => {
                      const Icon = ALT_ICONS[route.route_type] || RouteOutlinedIcon
                      const altColor = route.route_type === 'safest' ? 'icon-security' : ''
                      return <Icon fontSize="inherit" className={altColor} />
                    })()}
                  </span>
                  <span className="siara-route-overview__alt-name">
                    {route.route_label || titleCase(route.route_type)}
                  </span>
                  <span className="siara-route-overview__alt-risk">
                    {altHasPercent ? `${Math.round(altPercent)}% risk` : 'unknown risk'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <BestTimeToLeaveCompact
        origin={origin}
        destination={destination}
        enabled={Boolean(origin && destination)}
        routeIdentity={selectedRoute?.route_identity || selectedRoute?.route_id || data.routeType || ''}
        onSelectTimestamp={onSelectDepartureTimestamp}
      />
    </aside>
  )
}
