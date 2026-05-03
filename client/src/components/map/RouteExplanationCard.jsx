import { useMemo, useState } from 'react'
import '../../styles/RouteExplanationCard.css'

function riskTier(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'extreme'
  if (text === 'high') return 'high'
  if (text === 'moderate' || text === 'medium') return 'moderate'
  if (text === 'low') return 'low'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'low'
  if (numeric >= 75) return 'extreme'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'moderate'
  return 'low'
}

function impactClass(impact) {
  const text = String(impact || '').toLowerCase()
  if (text === 'positive' || text === 'good' || text === 'safer') return 'impact-positive'
  if (text === 'negative' || text === 'bad' || text === 'risky') return 'impact-negative'
  return 'impact-neutral'
}

function reasonIcon(type) {
  switch (String(type || '').toLowerCase()) {
    case 'heatmap':
    case 'cluster':
      return '🔥'
    case 'report':
    case 'reports':
      return '📍'
    case 'segment':
    case 'road':
      return '🛣️'
    case 'weather':
      return '🌧️'
    case 'time':
    case 'departure':
      return '🕒'
    case 'police':
    case 'verified':
      return '🛡️'
    case 'tradeoff':
      return '⚖️'
    default:
      return '•'
  }
}

function formatRiskPercent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatMinutes(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${Math.round(n)} min`
}

export default function RouteExplanationCard({
  loading = false,
  error = '',
  summary = '',
  reasons = [],
  comparison = null,
  recommendedRouteType = '',
  recommendedRiskLevel = '',
  recommendedRiskPercent = null,
  details = '',
  onRetry,
}) {
  const [showDetails, setShowDetails] = useState(false)

  const tier = useMemo(
    () => riskTier(recommendedRiskLevel, recommendedRiskPercent),
    [recommendedRiskLevel, recommendedRiskPercent],
  )

  const recommendedLabel = recommendedRouteType
    ? recommendedRouteType.charAt(0).toUpperCase() + recommendedRouteType.slice(1)
    : 'Recommended'

  if (loading) {
    return (
      <div
        className="siara-route-explanation"
        role="status"
        aria-live="polite"
        aria-label="Calculating route explanation"
      >
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">🧭</span>
          <h4 className="siara-route-explanation__title">Why this route?</h4>
        </div>
        <div className="siara-route-explanation__skeleton" />
        <div className="siara-route-explanation__skeleton siara-route-explanation__skeleton--short" />
        <div className="siara-route-explanation__skeleton" />
        <p className="siara-route-explanation__hint">Analysing risk factors…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="siara-route-explanation"
        role="alert"
        aria-label="Route explanation error"
      >
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">🧭</span>
          <h4 className="siara-route-explanation__title">Why this route?</h4>
        </div>
        <p className="siara-route-explanation__error">{error}</p>
        {onRetry ? (
          <button
            type="button"
            className="siara-route-explanation__toggle"
            onClick={onRetry}
          >
            Retry explanation
          </button>
        ) : null}
      </div>
    )
  }

  const hasSummary = Boolean(summary && summary.trim())
  const hasReasons = Array.isArray(reasons) && reasons.length > 0
  const hasComparison = comparison && (
    Number.isFinite(Number(comparison.fastestRisk)) ||
    Number.isFinite(Number(comparison.safestRisk)) ||
    Number.isFinite(Number(comparison.balancedRisk))
  )

  if (!hasSummary && !hasReasons && !hasComparison) {
    return (
      <div className="siara-route-explanation" aria-label="No route explanation">
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">🧭</span>
          <h4 className="siara-route-explanation__title">Why this route?</h4>
        </div>
        <p className="siara-route-explanation__hint">
          No risk explanation available for this route yet.
        </p>
      </div>
    )
  }

  return (
    <section
      className="siara-route-explanation"
      role="region"
      aria-label="Route recommendation explanation"
    >
      <div className="siara-route-explanation__header">
        <span className="siara-route-explanation__icon" aria-hidden="true">🧭</span>
        <h4 className="siara-route-explanation__title">Why this route?</h4>
        <span className={`siara-route-explanation__badge risk-${tier}`}>
          {recommendedLabel}
        </span>
      </div>

      {hasSummary ? (
        <p className="siara-route-explanation__summary">{summary}</p>
      ) : null}

      {hasComparison ? (
        <div className="siara-route-explanation__compare" aria-label="Route risk comparison">
          <div className="siara-route-explanation__compare-cell">
            <span className="siara-route-explanation__compare-label">Fastest</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.fastestRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">risk</span>
          </div>
          <div
            className={`siara-route-explanation__compare-cell ${
              recommendedRouteType === 'balanced'
                ? 'siara-route-explanation__compare-cell--highlight'
                : ''
            }`}
          >
            <span className="siara-route-explanation__compare-label">Balanced</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.balancedRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">risk</span>
          </div>
          <div
            className={`siara-route-explanation__compare-cell ${
              recommendedRouteType === 'safest'
                ? 'siara-route-explanation__compare-cell--highlight'
                : ''
            }`}
          >
            <span className="siara-route-explanation__compare-label">Safest</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.safestRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">
              {Number.isFinite(Number(comparison.safestExtraMinutes))
                ? `+${formatMinutes(comparison.safestExtraMinutes)}`
                : 'risk'}
            </span>
          </div>
        </div>
      ) : null}

      {hasReasons ? (
        <ul className="siara-route-explanation__reasons">
          {reasons.slice(0, 5).map((reason, idx) => {
            const key = reason?.id || `${reason?.type || 'reason'}-${idx}`
            return (
              <li key={key} className="siara-route-explanation__reason">
                <span
                  className="siara-route-explanation__reason-icon"
                  aria-hidden="true"
                >
                  {reasonIcon(reason?.type)}
                </span>
                <div className="siara-route-explanation__reason-body">
                  <span className="siara-route-explanation__reason-label">
                    {reason?.label || 'Risk factor'}
                  </span>
                  {reason?.detail ? (
                    <span className="siara-route-explanation__reason-detail">
                      {reason.detail}
                    </span>
                  ) : null}
                </div>
                {reason?.impact ? (
                  <span
                    className={`siara-route-explanation__reason-impact ${impactClass(reason.impact)}`}
                  >
                    {reason.impactLabel || reason.impact}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {details ? (
        <>
          <button
            type="button"
            className="siara-route-explanation__toggle"
            onClick={() => setShowDetails(prev => !prev)}
            aria-expanded={showDetails}
          >
            {showDetails ? 'Hide details' : 'View details'}
          </button>
          {showDetails ? (
            <div className="siara-route-explanation__details">{details}</div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
