import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined'
import { getReportSuggestions } from '../../services/reportsService'
import '../../styles/ReportSuggestionCard.css'

const DEBOUNCE_MS = 600

function distanceLabel(meters, t) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return t('reportSuggestionCard.distanceMeters', { count: Math.round(n) })
  return t('reportSuggestionCard.distanceKm', { count: (n / 1000).toFixed(1) })
}

function formatTimeAgo(iso, t) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return t('reportSuggestionCard.timeJustNow')
  if (minutes < 60) return t('reportSuggestionCard.timeMinutesAgo', { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('reportSuggestionCard.timeHoursAgo', { count: hours })
  return t('reportSuggestionCard.timeDaysAgo', { count: Math.round(hours / 24) })
}

export default function ReportSuggestionCard({
  title,
  description,
  lat,
  lng,
  currentType,
  currentSeverity,
  onApplyType,
  onApplySeverity,
  onConfirmExisting,
}) {
  const { t } = useTranslation(['reports', 'common'])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastKeyRef = useRef('')

  useEffect(() => {
    const key = JSON.stringify({
      title: (title || '').trim().toLowerCase(),
      description: (description || '').trim().toLowerCase().slice(0, 200),
      lat: lat != null ? Number(lat).toFixed(4) : null,
      lng: lng != null ? Number(lng).toFixed(4) : null,
    })
    if (key === lastKeyRef.current) return undefined
    if (!title && !description && lat == null && lng == null) {
      setData(null)
      return undefined
    }
    const handle = setTimeout(async () => {
      lastKeyRef.current = key
      setLoading(true)
      setError('')
      try {
        const result = await getReportSuggestions({ title, description, lat, lng })
        setData(result)
      } catch (err) {
        setError(err?.message || t('reportSuggestionCard.suggestionsUnavailable'))
        setData(null)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [title, description, lat, lng])

  if (!data && !loading && !error) return null

  const showSuggestType =
    data?.suggestedType && data.suggestedType !== currentType
  const showSuggestSeverity =
    data?.suggestedSeverity && data.suggestedSeverity !== currentSeverity
  const duplicates = Array.isArray(data?.duplicateCandidates) ? data.duplicateCandidates : []
  const warnings = Array.isArray(data?.warnings) ? data.warnings : []
  const nonDuplicateWarnings = warnings.filter((w) => w.kind !== 'duplicate')
  const duplicateWarning = warnings.find((w) => w.kind === 'duplicate')

  return (
    <div className="siara-suggest" role="region" aria-label={t('reportSuggestionCard.ariaLabel')}>
      <div className="siara-suggest__header">
        <span className="siara-suggest__icon" aria-hidden="true">
          <TipsAndUpdatesOutlinedIcon fontSize="inherit" className="icon-info" />
        </span>
        <h4 className="siara-suggest__title">{t('reportSuggestionCard.title')}</h4>
        {loading ? <span className="siara-suggest__hint">{t('reportSuggestionCard.updating')}</span> : null}
      </div>

      {error ? <p className="siara-suggest__loading">{error}</p> : null}

      {showSuggestType || showSuggestSeverity ? (
        <div className="siara-suggest__row">
          {showSuggestType ? (
            <button
              type="button"
              className="siara-suggest__chip"
              onClick={() => onApplyType?.(data.suggestedType)}
              disabled={typeof onApplyType !== 'function'}
            >
              {t('reportSuggestionCard.useType', { type: data.suggestedType })}
            </button>
          ) : null}
          {showSuggestSeverity ? (
            <button
              type="button"
              className="siara-suggest__chip"
              onClick={() => onApplySeverity?.(data.suggestedSeverity)}
              disabled={typeof onApplySeverity !== 'function'}
            >
              {t('reportSuggestionCard.setSeverity', { severity: data.suggestedSeverity })}
            </button>
          ) : null}
        </div>
      ) : null}

      {nonDuplicateWarnings.length > 0 ? (
        <ul className="siara-suggest__warnings">
          {nonDuplicateWarnings.map((w, idx) => (
            <li key={`warn-${idx}`} className="siara-suggest__warning">
              <WarningAmberOutlinedIcon fontSize="inherit" aria-hidden="true" className="icon-warning" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {duplicateWarning ? (
        <p className="siara-suggest__warning is-duplicate">
          <RepeatOutlinedIcon fontSize="inherit" aria-hidden="true" />
          <span>{duplicateWarning.message}</span>
        </p>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="siara-suggest__duplicates">
          <h5 className="siara-suggest__duplicates-title">
            {t('reportSuggestionCard.possiblyReported')}
          </h5>
          {duplicates.map((dup) => (
            <div key={`dup-${dup.reportId}`}>
              <Link
                to={`/incident/${dup.reportId}`}
                className="siara-suggest__duplicate"
              >
                <span className="siara-suggest__duplicate-title">
                  {dup.title || t('reportSuggestionCard.reportFallbackTitle', { id: dup.reportId })}
                </span>
                <span className="siara-suggest__duplicate-meta">
                  <span>{dup.incidentType || t('reportSuggestionCard.incidentFallback')}</span>
                  <span>•</span>
                  <span>{distanceLabel(dup.distanceMeters, t)}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(dup.createdAt, t)}</span>
                  {dup.verifiedByPolice ? <span>• {t('reportSuggestionCard.policeVerified')}</span> : null}
                </span>
              </Link>
              {typeof onConfirmExisting === 'function' ? (
                <button
                  type="button"
                  className="siara-suggest__chip"
                  style={{ marginTop: 4 }}
                  onClick={() => onConfirmExisting(dup)}
                >
                  {t('reportSuggestionCard.confirmExisting')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
