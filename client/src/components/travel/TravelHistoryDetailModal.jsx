import { useEffect, useState } from 'react'
import {
  getTravelHistoryDetail,
  updateTravelHistoryRating,
} from '../../services/travelHistoryService'

const RISK_LEVELS = ['low', 'moderate', 'medium', 'high', 'extreme', 'critical']

function riskTone(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'high'
  if (text === 'high') return 'high'
  if (text === 'moderate' || text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return 'low'
  if (numeric >= 75) return 'high'
  if (numeric >= 50) return 'medium'
  return 'low'
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

function formatDuration(seconds) {
  const num = Number(seconds)
  if (!Number.isFinite(num) || num <= 0) return '—'
  const minutes = Math.floor(num / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

function formatDistance(km) {
  const num = Number(km)
  if (!Number.isFinite(num)) return '—'
  return `${num.toFixed(1)} km`
}

function formatRiskLabel(level, percent) {
  const text = String(level || '').trim()
  const numeric = Number(percent)
  const percentText = Number.isFinite(numeric) ? `${Math.round(numeric)}%` : '—'
  return text ? `${percentText} (${text})` : percentText
}

function StarRow({ value, onChange, disabled }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <div className="th-star-row" role="radiogroup" aria-label="Trip rating">
      {stars.map((star) => {
        const filled = Number(value) >= star
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            className={`th-star ${filled ? 'is-filled' : ''}`}
            onClick={() => onChange?.(star)}
            aria-checked={Number(value) === star}
            role="radio"
          >
            {filled ? '★' : '☆'}
          </button>
        )
      })}
    </div>
  )
}

export default function TravelHistoryDetailModal({ tripId, open, onClose, onRatingUpdated }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!open || !tripId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setSavedMessage('')
    getTravelHistoryDetail(tripId)
      .then((data) => {
        if (cancelled) return
        setDetail(data || null)
        setRating(data?.rating ?? null)
        setFeedback(data?.feedbackText || '')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Failed to load trip details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tripId])

  if (!open) return null

  const segments = Array.isArray(detail?.segmentsSnapshot) ? detail.segmentsSnapshot : []
  const routeSnapshot =
    detail?.routeSnapshot && typeof detail.routeSnapshot === 'object'
      ? detail.routeSnapshot
      : {}

  const handleSaveRating = async () => {
    if (!detail?.id) return
    try {
      setSaving(true)
      setError('')
      setSavedMessage('')
      await updateTravelHistoryRating(detail.id, rating, feedback)
      setSavedMessage('Saved')
      onRatingUpdated?.(detail.id, { rating, feedbackText: feedback })
    } catch (err) {
      setError(err.message || 'Failed to update rating')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="th-modal-overlay" role="dialog" aria-modal="true" aria-label="Trip details">
      <div className="th-modal-backdrop" onClick={onClose} />
      <div className="th-modal-panel">
        <header className="th-modal-header">
          <div>
            <h3 className="th-modal-title">
              {detail?.destination?.name || 'Trip details'}
            </h3>
            <p className="th-modal-sub">
              {detail?.origin?.name ? `From ${detail.origin.name}` : 'Saved trip'}
            </p>
          </div>
          <button type="button" className="th-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="th-modal-body">
          {loading ? (
            <p className="ud-forecast-caption">Loading trip details…</p>
          ) : error ? (
            <p className="ud-forecast-caption" role="alert">{error}</p>
          ) : !detail ? (
            <p className="ud-forecast-caption">Trip not found.</p>
          ) : (
            <>
              <div className="th-summary-grid">
                <div className="th-summary-item">
                  <span className="th-summary-label">From</span>
                  <strong className="th-summary-value">
                    {detail.origin?.name || `${detail.origin?.lat?.toFixed(4)}, ${detail.origin?.lng?.toFixed(4)}`}
                  </strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">To</span>
                  <strong className="th-summary-value">
                    {detail.destination?.name || `${detail.destination?.lat?.toFixed(4)}, ${detail.destination?.lng?.toFixed(4)}`}
                  </strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Started</span>
                  <strong className="th-summary-value">{formatDateTime(detail.startedAt)}</strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Arrived</span>
                  <strong className="th-summary-value">{formatDateTime(detail.arrivedAt)}</strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Duration</span>
                  <strong className="th-summary-value">{formatDuration(detail.durationSeconds)}</strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Distance</span>
                  <strong className="th-summary-value">{formatDistance(detail.distanceKm)}</strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Route type</span>
                  <strong className="th-summary-value">
                    {detail.routeType || routeSnapshot.route_type || '—'}
                  </strong>
                </div>
                <div className="th-summary-item">
                  <span className="th-summary-label">Overall risk</span>
                  <strong className={`th-risk-badge ${riskTone(detail.overallRiskLevel, detail.overallRiskPercent)}`}>
                    {formatRiskLabel(detail.overallRiskLevel, detail.overallRiskPercent)}
                  </strong>
                </div>
              </div>

              <div className="th-rating-block">
                <div className="th-rating-label">Your rating</div>
                <StarRow value={rating} onChange={setRating} disabled={saving} />
                <textarea
                  className="th-feedback-textarea"
                  rows={3}
                  placeholder="Share feedback about this trip (optional)"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  disabled={saving}
                />
                <div className="th-rating-actions">
                  <button
                    type="button"
                    className="ud-link-btn"
                    onClick={handleSaveRating}
                    disabled={saving || (rating == null && !feedback)}
                  >
                    {saving ? 'Saving…' : 'Save rating'}
                  </button>
                  {savedMessage && (
                    <span className="th-rating-saved">{savedMessage}</span>
                  )}
                </div>
              </div>

              <div className="th-segments-block">
                <h4 className="ud-mini-title" style={{ marginBottom: 8 }}>
                  Road segments ({segments.length})
                </h4>
                {segments.length === 0 ? (
                  <p className="ud-forecast-caption">No segment data was captured for this trip.</p>
                ) : (
                  <div className="ud-table-wrapper">
                    <table className="ud-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Segment</th>
                          <th>Distance</th>
                          <th>Risk</th>
                          <th>Window</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {segments.map((segment, index) => {
                          const riskLevel = String(segment?.danger_level || '').toLowerCase()
                          const isKnownLevel = RISK_LEVELS.includes(riskLevel)
                          const tone = riskTone(segment?.danger_level, segment?.danger_percent)
                          const startKm = Number(segment?.start_km)
                          const endKm = Number(segment?.end_km)
                          const window =
                            Number.isFinite(startKm) && Number.isFinite(endKm)
                              ? `${startKm.toFixed(1)}–${endKm.toFixed(1)} km`
                              : '—'
                          const time =
                            segment?.predicted_enter_at ||
                            segment?.risk_timestamp_used ||
                            null
                          const segmentLabel =
                            segment?.name ||
                            segment?.ref ||
                            (segment?.segment_id != null
                              ? `Segment ${segment.segment_id}`
                              : `Segment ${segment?.index || index + 1}`)
                          return (
                            <tr key={`${segment?.segment_id || segment?.index || index}`}>
                              <td className="ud-road-rank">{segment?.index || index + 1}</td>
                              <td className="ud-cell-primary">{segmentLabel}</td>
                              <td>{formatDistance(segment?.distance_km)}</td>
                              <td>
                                <span className={`th-risk-badge ${tone}`}>
                                  {Number.isFinite(Number(segment?.danger_percent))
                                    ? `${Math.round(Number(segment.danger_percent))}%`
                                    : '—'}
                                  {isKnownLevel ? ` • ${riskLevel}` : ''}
                                </span>
                              </td>
                              <td className="ud-cell-muted">{window}</td>
                              <td className="ud-cell-muted">{formatDateTime(time)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
