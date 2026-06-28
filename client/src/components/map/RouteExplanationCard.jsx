import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import '../../styles/RouteExplanationCard.css'

function riskTier(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'low'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'medium'
  return 'low'
}

function impactClass(impact) {
  const text = String(impact || '').toLowerCase()
  if (text === 'positive' || text === 'good' || text === 'safer') return 'impact-positive'
  if (text === 'negative' || text === 'bad' || text === 'risky') return 'impact-negative'
  return 'impact-neutral'
}

function ReasonIcon({ type }) {
  const key = String(type || '').toLowerCase()
  const { Cmp, color } = (() => {
    switch (key) {
      case 'heatmap':
      case 'cluster':
        return { Cmp: LocalFireDepartmentOutlinedIcon, color: 'icon-fire' }
      case 'report':
      case 'reports':
        return { Cmp: LocationOnOutlinedIcon, color: '' }
      case 'segment':
      case 'road':
        return { Cmp: RouteOutlinedIcon, color: '' }
      case 'weather':
        return { Cmp: WaterDropOutlinedIcon, color: 'icon-info' }
      case 'time':
      case 'departure':
        return { Cmp: AccessTimeOutlinedIcon, color: '' }
      case 'police':
      case 'verified':
        return { Cmp: ShieldOutlinedIcon, color: 'icon-security' }
      case 'tradeoff':
        return { Cmp: BalanceOutlinedIcon, color: '' }
      default:
        return { Cmp: FiberManualRecordIcon, color: 'icon-muted' }
    }
  })()
  return <Cmp fontSize="inherit" className={color} />
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
  const { t } = useTranslation(['map', 'common'])
  const [showDetails, setShowDetails] = useState(false)

  const tier = useMemo(
    () => riskTier(recommendedRiskLevel, recommendedRiskPercent),
    [recommendedRiskLevel, recommendedRiskPercent],
  )

  const recommendedLabel = recommendedRouteType
    ? recommendedRouteType.charAt(0).toUpperCase() + recommendedRouteType.slice(1)
    : t('routeExplanationCard.recommended')

  if (loading) {
    return (
      <div
        className="siara-route-explanation"
        role="status"
        aria-live="polite"
        aria-label={t('routeExplanationCard.ariaCalculating')}
      >
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">
            <ExploreOutlinedIcon fontSize="inherit" />
          </span>
          <h4 className="siara-route-explanation__title">{t('routeExplanationCard.title')}</h4>
        </div>
        <div className="siara-route-explanation__skeleton" />
        <div className="siara-route-explanation__skeleton siara-route-explanation__skeleton--short" />
        <div className="siara-route-explanation__skeleton" />
        <p className="siara-route-explanation__hint">{t('routeExplanationCard.analysingHint')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="siara-route-explanation"
        role="alert"
        aria-label={t('routeExplanationCard.ariaError')}
      >
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">
            <ExploreOutlinedIcon fontSize="inherit" />
          </span>
          <h4 className="siara-route-explanation__title">{t('routeExplanationCard.title')}</h4>
        </div>
        <p className="siara-route-explanation__error">{error}</p>
        {onRetry ? (
          <button
            type="button"
            className="siara-route-explanation__toggle"
            onClick={onRetry}
          >
            {t('routeExplanationCard.retryExplanation')}
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
      <div className="siara-route-explanation" aria-label={t('routeExplanationCard.ariaEmpty')}>
        <div className="siara-route-explanation__header">
          <span className="siara-route-explanation__icon" aria-hidden="true">
            <ExploreOutlinedIcon fontSize="inherit" />
          </span>
          <h4 className="siara-route-explanation__title">{t('routeExplanationCard.title')}</h4>
        </div>
        <p className="siara-route-explanation__hint">
          {t('routeExplanationCard.emptyHint')}
        </p>
      </div>
    )
  }

  return (
    <section
      className="siara-route-explanation"
      role="region"
      aria-label={t('routeExplanationCard.ariaRegion')}
    >
      <div className="siara-route-explanation__header">
        <span className="siara-route-explanation__icon" aria-hidden="true">
          <ExploreOutlinedIcon fontSize="inherit" />
        </span>
        <h4 className="siara-route-explanation__title">{t('routeExplanationCard.title')}</h4>
        <span className={`siara-route-explanation__badge risk-${tier}`}>
          {recommendedLabel}
        </span>
      </div>

      {hasSummary ? (
        <p className="siara-route-explanation__summary">{summary}</p>
      ) : null}

      {hasComparison ? (
        <div className="siara-route-explanation__compare" aria-label={t('routeExplanationCard.ariaComparison')}>
          <div className="siara-route-explanation__compare-cell">
            <span className="siara-route-explanation__compare-label">{t('routeExplanationCard.fastest')}</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.fastestRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">{t('routeExplanationCard.risk')}</span>
          </div>
          <div
            className={`siara-route-explanation__compare-cell ${
              recommendedRouteType === 'balanced'
                ? 'siara-route-explanation__compare-cell--highlight'
                : ''
            }`}
          >
            <span className="siara-route-explanation__compare-label">{t('routeExplanationCard.balanced')}</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.balancedRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">{t('routeExplanationCard.risk')}</span>
          </div>
          <div
            className={`siara-route-explanation__compare-cell ${
              recommendedRouteType === 'safest'
                ? 'siara-route-explanation__compare-cell--highlight'
                : ''
            }`}
          >
            <span className="siara-route-explanation__compare-label">{t('routeExplanationCard.safest')}</span>
            <span className="siara-route-explanation__compare-value">
              {formatRiskPercent(comparison.safestRisk)}
            </span>
            <span className="siara-route-explanation__compare-sub">
              {Number.isFinite(Number(comparison.safestExtraMinutes))
                ? `+${formatMinutes(comparison.safestExtraMinutes)}`
                : t('routeExplanationCard.risk')}
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
                  <ReasonIcon type={reason?.type} />
                </span>
                <div className="siara-route-explanation__reason-body">
                  <span className="siara-route-explanation__reason-label">
                    {reason?.label || t('routeExplanationCard.riskFactor')}
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
            {showDetails ? t('routeExplanationCard.hideDetails') : t('routeExplanationCard.viewDetails')}
          </button>
          {showDetails ? (
            <div className="siara-route-explanation__details">{details}</div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
