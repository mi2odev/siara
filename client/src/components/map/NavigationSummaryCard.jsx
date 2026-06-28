import { useTranslation } from 'react-i18next'
import {
  formatDistanceMeters,
  formatDurationSeconds,
  formatClockTime,
} from '../../utils/navigationHelpers'

function riskTone(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'unknown' || text === 'unavailable') return 'unknown'
  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  if (percent === null || percent === undefined || percent === '') return 'unknown'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'unknown'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'medium'
  return 'low'
}

export default function NavigationSummaryCard({
  open,
  destinationName,
  routeType,
  distanceRemainingM,
  etaSeconds,
  routeRiskPercent,
  routeRiskLevel,
  progressFraction,
  onExit,
}) {
  const { t } = useTranslation(['map', 'common'])

  if (!open) return null

  const distanceLabel = formatDistanceMeters(distanceRemainingM)
  const etaLabel = formatDurationSeconds(etaSeconds)
  const arriveAt = Number.isFinite(Number(etaSeconds))
    ? new Date(Date.now() + Number(etaSeconds) * 1000)
    : null
  const arrivalText = arriveAt ? formatClockTime(arriveAt) : '—'
  const riskTier = riskTone(routeRiskLevel, routeRiskPercent)
  const hasRiskPercent =
    routeRiskPercent !== null &&
    routeRiskPercent !== undefined &&
    routeRiskPercent !== '' &&
    Number.isFinite(Number(routeRiskPercent))
  const riskPercentLabel = hasRiskPercent
    ? `${Math.round(Number(routeRiskPercent))}%`
    : '—'
  const riskLevelText = routeRiskLevel || '—'
  const progressPercent = Number.isFinite(Number(progressFraction))
    ? Math.max(0, Math.min(100, Math.round(Number(progressFraction) * 100)))
    : 0

  return (
    <div className="siara-nav-summary" role="region" aria-label={t('navigationSummaryCard.tripSummary')}>
      <div className="siara-nav-summary__progress" aria-hidden="true">
        <div
          className={`siara-nav-summary__progress-fill risk-${riskTier}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="siara-nav-summary__body">
        <div className="siara-nav-summary__main">
          <div className="siara-nav-summary__eta">
            <span className="siara-nav-summary__eta-value">{etaLabel}</span>
            <span className="siara-nav-summary__eta-sub">{t('navigationSummaryCard.arrive', { time: arrivalText })}</span>
          </div>
          <div className="siara-nav-summary__distance">
            <span className="siara-nav-summary__distance-value">{distanceLabel}</span>
            <span className="siara-nav-summary__distance-sub">{t('navigationSummaryCard.remaining')}</span>
          </div>
          <div className={`siara-nav-summary__risk risk-${riskTier}`}>
            <span className="siara-nav-summary__risk-value">{riskPercentLabel}</span>
            <span className="siara-nav-summary__risk-sub">{riskLevelText}</span>
          </div>
        </div>
        <div className="siara-nav-summary__meta">
          <span className="siara-nav-summary__meta-label">
            {destinationName || t('navigationSummaryCard.destination')}
          </span>
          {routeType ? (
            <span className="siara-nav-summary__meta-tag">{routeType}</span>
          ) : null}
        </div>
        <button
          type="button"
          className="siara-nav-summary__exit"
          onClick={onExit}
        >
          {t('navigationSummaryCard.exitNavigation')}
        </button>
      </div>
    </div>
  )
}
