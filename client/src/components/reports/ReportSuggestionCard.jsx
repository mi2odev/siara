import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReportSuggestions } from '../../services/reportsService'
import '../../styles/ReportSuggestionCard.css'

const DEBOUNCE_MS = 600

function distanceLabel(meters) {
  const n = Number(meters)
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return `${Math.round(n)} m away`
  return `${(n / 1000).toFixed(1)} km away`
}

function formatTimeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
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
        setError(err?.message || 'Suggestions unavailable')
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
    <div className="siara-suggest" role="region" aria-label="SIARA suggestions">
      <div className="siara-suggest__header">
        <span className="siara-suggest__icon" aria-hidden="true">💡</span>
        <h4 className="siara-suggest__title">SIARA suggestions</h4>
        {loading ? <span className="siara-suggest__hint">Updating…</span> : null}
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
              Use type: {data.suggestedType}
            </button>
          ) : null}
          {showSuggestSeverity ? (
            <button
              type="button"
              className="siara-suggest__chip"
              onClick={() => onApplySeverity?.(data.suggestedSeverity)}
              disabled={typeof onApplySeverity !== 'function'}
            >
              Set severity: {data.suggestedSeverity}
            </button>
          ) : null}
        </div>
      ) : null}

      {nonDuplicateWarnings.length > 0 ? (
        <ul className="siara-suggest__warnings">
          {nonDuplicateWarnings.map((w, idx) => (
            <li key={`warn-${idx}`} className="siara-suggest__warning">
              <span aria-hidden="true">⚠️</span>
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {duplicateWarning ? (
        <p className="siara-suggest__warning is-duplicate">
          <span aria-hidden="true">🔁</span>
          <span>{duplicateWarning.message}</span>
        </p>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="siara-suggest__duplicates">
          <h5 className="siara-suggest__duplicates-title">
            Possibly already reported
          </h5>
          {duplicates.map((dup) => (
            <div key={`dup-${dup.reportId}`}>
              <Link
                to={`/incident/${dup.reportId}`}
                className="siara-suggest__duplicate"
              >
                <span className="siara-suggest__duplicate-title">
                  {dup.title || `Report #${dup.reportId}`}
                </span>
                <span className="siara-suggest__duplicate-meta">
                  <span>{dup.incidentType || 'incident'}</span>
                  <span>•</span>
                  <span>{distanceLabel(dup.distanceMeters)}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(dup.createdAt)}</span>
                  {dup.verifiedByPolice ? <span>• Police-verified</span> : null}
                </span>
              </Link>
              {typeof onConfirmExisting === 'function' ? (
                <button
                  type="button"
                  className="siara-suggest__chip"
                  style={{ marginTop: 4 }}
                  onClick={() => onConfirmExisting(dup)}
                >
                  Confirm this existing report instead
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
