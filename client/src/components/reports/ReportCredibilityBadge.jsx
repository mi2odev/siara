import { useMemo } from 'react'
import { computeReportCredibility } from '../../utils/reportCredibility'
import '../../styles/ReportCredibilityBadge.css'

const LEVEL_LABELS = {
  high: 'High credibility',
  medium: 'Medium credibility',
  low: 'Low credibility',
  unknown: 'Credibility pending',
}

export default function ReportCredibilityBadge({
  report,
  showTooltip = true,
  compact = false,
}) {
  const credibility = useMemo(() => computeReportCredibility(report), [report])
  if (!credibility || credibility.level === 'unknown') {
    return null
  }

  const label = compact
    ? `Credibility ${credibility.score}`
    : `${LEVEL_LABELS[credibility.level] || 'Credibility'} ${credibility.score}`

  return (
    <span
      className={`siara-credibility level-${credibility.level}`}
      tabIndex={0}
      role="status"
      aria-label={`${LEVEL_LABELS[credibility.level]}, score ${credibility.score} out of 100`}
    >
      <span className="siara-credibility__dot" aria-hidden="true" />
      <span>{label}</span>
      {credibility.isSpam ? (
        <span className="siara-credibility__spam">Spam</span>
      ) : null}
      {showTooltip && credibility.reasons.length > 0 ? (
        <span className="siara-credibility-tooltip" role="tooltip">
          <span className="siara-credibility-tooltip__title">
            Why this credibility?
          </span>
          <ul className="siara-credibility-tooltip__list">
            {credibility.reasons.map((reason, idx) => (
              <li
                key={`${reason.kind}-${idx}`}
                className={`siara-credibility-tooltip__item kind-${reason.kind}`}
              >
                <span className="siara-credibility-tooltip__item-glyph" aria-hidden="true">
                  {reason.kind === 'positive' ? '✓' : '!'}
                </span>
                <span>{reason.text}</span>
              </li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  )
}
