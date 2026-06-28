import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { segmentOccurrenceRisk } from '../../utils/occurrenceRisk'
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'

// Card surfaced automatically while the user is in MapLibre navigation mode.
// It reads from the *selected* route's current segment (computed locally via
// getCurrentSegmentForUser) and renders a deterministic, network-free
// explanation. No Ollama call here — the goal is "always responsive, even
// when the AI explainer is offline".
//
// Layout: compact pill in the top-right of the navigation canvas, collapsed
// by default to a single line. The user can tap the header to expand and
// see the full explanation, length, predicted-time, and top SHAP-style
// factors. This keeps the bottom of the screen clear for the
// NavigationSummaryCard.

const TIER_CLASSES = {
  unknown: 'risk-unknown',
  low: 'risk-low',
  medium: 'risk-medium',
  high: 'risk-high',
}

const TIER_KEYS = {
  unknown: 'unknown',
  low: 'low',
  medium: 'medium',
  high: 'high',
}

function tierFromLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'unknown' || text === 'unavailable') return 'unknown'
  if (TIER_KEYS[text]) return text
  if (percent === null || percent === undefined || percent === '') return 'unknown'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'unknown'
  if (numeric >= 50) return 'high'
  if (numeric >= 25) return 'medium'
  return 'low'
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return 'â€"'
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatDistanceKm(km) {
  const n = Number(km)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1) return `${Math.round(n * 1000)} m`
  return `${n.toFixed(n < 10 ? 1 : 0)} km`
}

function formatTimestamp(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildExplanation({ t, tier, dangerPercent, segmentLabel, factors }) {
  const tierLabel = t(`currentSegmentCard.tier.${tier}`, tier).toLowerCase()
  const reasonBits = Array.isArray(factors) && factors.length > 0
    ? ` ${t('currentSegmentCard.explanation.topFactors', { factors: factors.slice(0, 3).join(', ') })}`
    : ''
  if (Number.isFinite(Number(dangerPercent))) {
    return t('currentSegmentCard.explanation.withScore', {
      segmentLabel,
      tierLabel,
      score: Math.round(Number(dangerPercent)),
    }) + reasonBits
  }
  return t('currentSegmentCard.explanation.noScore', { segmentLabel }) + reasonBits
}

function extractFactors(segment) {
  const candidates = []
  const sources = [segment?.top_factors, segment?.shap, segment?.features, segment?.explanation?.factors]
  for (const source of sources) {
    if (!source) continue
    if (Array.isArray(source)) {
      for (const entry of source) {
        if (!entry) continue
        const label = typeof entry === 'string'
          ? entry
          : entry.label || entry.name || entry.feature || entry.factor || null
        if (label) candidates.push(String(label))
      }
    } else if (typeof source === 'object') {
      for (const key of Object.keys(source)) {
        candidates.push(String(key))
      }
    }
  }
  const seen = new Set()
  const out = []
  for (const label of candidates) {
    if (seen.has(label)) continue
    seen.add(label)
    out.push(label)
    if (out.length >= 3) break
  }
  return out
}

export default function CurrentSegmentCard({
  segment,
  segmentIndex,
  totalSegments,
  searching = false,
}) {
  const { t } = useTranslation(['map', 'common'])
  const [expanded, setExpanded] = useState(false)

  const data = useMemo(() => {
    if (!segment) return null
    // Show the occurrence-model risk (probability of an accident) for the
    // current segment, falling back to the severity danger score when absent.
    const segOcc = segmentOccurrenceRisk(segment)
    const rawDangerPercent = segOcc ? segOcc.percent : segment.danger_percent
    const dangerPercent = Number(rawDangerPercent)
    const hasDangerPercent =
      rawDangerPercent !== null &&
      rawDangerPercent !== undefined &&
      rawDangerPercent !== '' &&
      Number.isFinite(dangerPercent)
    const tier = segOcc
      ? segOcc.level || tierFromLevel(null, segOcc.percent)
      : tierFromLevel(segment.danger_level, hasDangerPercent ? dangerPercent : null)
    const segLabel = segment.segment_label
      || segment.name
      || (segmentIndex != null
        ? t('currentSegmentCard.segmentLabel', {
            index: segmentIndex + 1,
            total: totalSegments || null,
            context: totalSegments ? 'withTotal' : 'noTotal',
          })
        : t('currentSegmentCard.currentSegment'))
    const factors = extractFactors(segment)
    return {
      tier,
      tierClass: TIER_CLASSES[tier] || 'risk-low',
      tierLabel: t(`currentSegmentCard.tier.${tier}`),
      dangerPercent: hasDangerPercent ? dangerPercent : null,
      distanceLabel: formatDistanceKm(segment.distance_km),
      predictedAt: formatTimestamp(segment.predicted_enter_at)
        || formatTimestamp(segment.risk_timestamp_used),
      segmentId: segment.segment_id || null,
      segLabel,
      factors,
      explanation: buildExplanation({
        t,
        tier,
        dangerPercent: hasDangerPercent ? dangerPercent : null,
        segmentLabel: segLabel,
        factors,
      }),
    }
  }, [segment, segmentIndex, totalSegments, t])

  if (!data) {
    return (
      <section
        className="siara-current-segment"
        role="status"
        aria-live="polite"
      >
        <div className="siara-current-segment__header" aria-hidden="true">
          <span className="siara-current-segment__icon">
            <RouteOutlinedIcon fontSize="inherit" />
          </span>
          <h4 className="siara-current-segment__title">{t('currentSegmentCard.title')}</h4>
        </div>
        <p className="siara-current-segment__hint">
          {searching
            ? t('currentSegmentCard.searching')
            : t('currentSegmentCard.hint')}
        </p>
      </section>
    )
  }

  const briefLine = `${data.segLabel} · ${formatPercent(data.dangerPercent)}`

  return (
    <section
      className={`siara-current-segment${expanded ? ' siara-current-segment--expanded' : ''}`}
      role="region"
      aria-label={t('currentSegmentCard.ariaLabel')}
    >
      <button
        type="button"
        className="siara-current-segment__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="siara-current-segment__icon" aria-hidden="true">
          <RouteOutlinedIcon fontSize="inherit" />
        </span>
        <h4 className="siara-current-segment__title">{t('currentSegmentCard.title')}</h4>
        <span className={`siara-current-segment__badge ${data.tierClass}`}>
          {data.tierLabel}
        </span>
        <span
          className={`siara-current-segment__chevron${
            expanded ? ' siara-current-segment__chevron--open' : ''
          }`}
          aria-hidden="true"
        >
          <KeyboardArrowDownRoundedIcon fontSize="inherit" />
        </span>
      </button>

      {!expanded ? (
        <p className="siara-current-segment__brief">{briefLine}</p>
      ) : (
        <div className="siara-current-segment__body">
          <div className="siara-current-segment__row">
            <span className="siara-current-segment__label">{t('currentSegmentCard.fields.segment')}</span>
            <span className="siara-current-segment__value">{data.segLabel}</span>
          </div>
          <div className="siara-current-segment__row">
            <span className="siara-current-segment__label">{t('currentSegmentCard.fields.risk')}</span>
            <span className="siara-current-segment__value">
              {formatPercent(data.dangerPercent)}
            </span>
          </div>
          {data.distanceLabel ? (
            <div className="siara-current-segment__row">
              <span className="siara-current-segment__label">{t('currentSegmentCard.fields.length')}</span>
              <span className="siara-current-segment__value">{data.distanceLabel}</span>
            </div>
          ) : null}
          {data.predictedAt ? (
            <div className="siara-current-segment__row">
              <span className="siara-current-segment__label">{t('currentSegmentCard.fields.riskTime')}</span>
              <span className="siara-current-segment__value">{data.predictedAt}</span>
            </div>
          ) : null}
          <p className="siara-current-segment__explanation">{data.explanation}</p>
          {data.factors.length > 0 ? (
            <ul className="siara-current-segment__factors">
              {data.factors.map((factor) => (
                <li key={factor} className="siara-current-segment__factor">
                  {factor}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  )
}
