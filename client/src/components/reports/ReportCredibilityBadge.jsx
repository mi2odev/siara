import { useMemo, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded'
import { computeReportCredibility } from '../../utils/reportCredibility'
import '../../styles/ReportCredibilityBadge.css'

export default function ReportCredibilityBadge({
  report,
  showTooltip = true,
  compact = false,
}) {
  const { t } = useTranslation(['reports', 'common'])
  const credibility = useMemo(() => computeReportCredibility(report), [report])
  const [tooltipPos, setTooltipPos] = useState(null)
  const badgeRef = useRef(null)

  const open = useCallback(() => {
    if (!badgeRef.current) return
    const rect = badgeRef.current.getBoundingClientRect()
    setTooltipPos({ top: rect.top - 6, left: rect.left })
  }, [])

  const close = useCallback(() => setTooltipPos(null), [])

  if (!credibility || credibility.level === 'unknown') return null

  const LEVEL_LABELS = {
    high: t('reportCredibilityBadge.levelHigh'),
    medium: t('reportCredibilityBadge.levelMedium'),
    low: t('reportCredibilityBadge.levelLow'),
    unknown: t('reportCredibilityBadge.levelUnknown'),
  }

  const label = compact
    ? t('reportCredibilityBadge.labelCompact', { score: credibility.score })
    : `${LEVEL_LABELS[credibility.level] || t('reportCredibilityBadge.labelFallback')} ${credibility.score}`

  return (
    <>
      <span
        ref={badgeRef}
        className={`siara-credibility level-${credibility.level}`}
        tabIndex={0}
        role="status"
        aria-label={t('reportCredibilityBadge.ariaLabel', {
          level: LEVEL_LABELS[credibility.level],
          score: credibility.score,
        })}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
      >
        <span className="siara-credibility__dot" aria-hidden="true" />
        <span>{label}</span>
        {credibility.isSpam ? (
          <span className="siara-credibility__spam">{t('reportCredibilityBadge.spam')}</span>
        ) : null}
      </span>

      {showTooltip && tooltipPos && credibility.reasons.length > 0 &&
        createPortal(
          <span
            className="siara-credibility-tooltip siara-credibility-tooltip--portal"
            role="tooltip"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <span className="siara-credibility-tooltip__title">{t('reportCredibilityBadge.tooltipTitle')}</span>
            <ul className="siara-credibility-tooltip__list">
              {credibility.reasons.map((reason, idx) => (
                <li
                  key={`${reason.kind}-${idx}`}
                  className={`siara-credibility-tooltip__item kind-${reason.kind}`}
                >
                  <span className="siara-credibility-tooltip__item-glyph" aria-hidden="true">
                    {reason.kind === 'positive'
                      ? <CheckRoundedIcon fontSize="inherit" className="icon-success" />
                      : <PriorityHighRoundedIcon fontSize="inherit" className="icon-warning" />}
                  </span>
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          </span>,
          document.body
        )
      }
    </>
  )
}
