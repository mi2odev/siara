import { useEffect, useMemo, useState } from 'react'
import { getMySafetySummary } from '../../services/travelHistoryService'
import '../../styles/PersonalSafetyScoreCard.css'

function scoreClass(score) {
  if (!Number.isFinite(Number(score))) return 'score-fair'
  if (score >= 75) return 'score-good'
  if (score >= 50) return 'score-fair'
  return 'score-poor'
}

function scoreLabel(score) {
  if (!Number.isFinite(Number(score))) return 'Not enough trips yet'
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Strong'
  if (score >= 50) return 'Fair'
  if (score >= 30) return 'Needs improvement'
  return 'High-risk pattern'
}

export default function PersonalSafetyScoreCard({ refreshKey = 0 }) {
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setError('')
    ;(async () => {
      try {
        const result = await getMySafetySummary()
        if (cancelled) return
        setData(result)
        setState('success')
      } catch (err) {
        if (cancelled) return
        setError(err?.message || 'Failed to load safety summary')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const trendMaxRisk = useMemo(() => {
    if (!data?.weeklyTrend?.length) return 100
    const values = data.weeklyTrend
      .map((w) => Number(w?.avgRiskPercent))
      .filter((v) => Number.isFinite(v))
    if (!values.length) return 100
    return Math.max(20, Math.max(...values))
  }, [data])

  if (state === 'loading') {
    return (
      <section className="siara-safety-score" aria-busy="true">
        <div className="siara-safety-score__header">
          <span className="siara-safety-score__icon" aria-hidden="true">🛡️</span>
          <h3 className="siara-safety-score__title">Your SIARA safety score</h3>
        </div>
        <div className="siara-safety-score__skeleton" />
        <div className="siara-safety-score__skeleton" style={{ width: '70%' }} />
        <div className="siara-safety-score__skeleton" />
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section className="siara-safety-score" role="alert">
        <div className="siara-safety-score__header">
          <span className="siara-safety-score__icon" aria-hidden="true">🛡️</span>
          <h3 className="siara-safety-score__title">Your SIARA safety score</h3>
        </div>
        <p className="siara-safety-score__error">{error}</p>
      </section>
    )
  }

  if (!data || !data.tripCount) {
    return (
      <section className="siara-safety-score">
        <div className="siara-safety-score__header">
          <span className="siara-safety-score__icon" aria-hidden="true">🛡️</span>
          <h3 className="siara-safety-score__title">Your SIARA safety score</h3>
        </div>
        <p className="siara-safety-score__empty">
          Complete your first SIARA-guided trip to start tracking your personal safety
          score, route preferences, and weekly risk trends.
        </p>
      </section>
    )
  }

  const sClass = scoreClass(data.safetyScore)
  const distanceLabel = Number.isFinite(Number(data.totalDistanceKm))
    ? `${Number(data.totalDistanceKm).toFixed(1)} km`
    : '—'
  const avgRiskLabel = Number.isFinite(Number(data.avgRiskPercent))
    ? `${Number(data.avgRiskPercent).toFixed(0)}%`
    : '—'
  const avgRatingLabel = Number.isFinite(Number(data.avgRating))
    ? `${Number(data.avgRating).toFixed(1)} / 5`
    : 'no ratings'

  return (
    <section className="siara-safety-score">
      <div className="siara-safety-score__header">
        <span className="siara-safety-score__icon" aria-hidden="true">🛡️</span>
        <h3 className="siara-safety-score__title">Your SIARA safety score</h3>
      </div>

      <div className="siara-safety-score__score-row">
        <div className={`siara-safety-score__score-circle ${sClass}`}>
          <span className="siara-safety-score__score-value">
            {Number.isFinite(Number(data.safetyScore)) ? data.safetyScore : '—'}
          </span>
          <span className="siara-safety-score__score-max">/ 100</span>
        </div>
        <div className="siara-safety-score__score-meta">
          <span className="siara-safety-score__score-label">
            {scoreLabel(data.safetyScore)}
          </span>
          <span className="siara-safety-score__score-sub">
            Calculated from {data.tripCount} completed{' '}
            {data.tripCount === 1 ? 'trip' : 'trips'} — average risk{' '}
            {avgRiskLabel}, {data.highRiskTripCount} high-risk{' '}
            {data.highRiskTripCount === 1 ? 'trip' : 'trips'}.
          </span>
        </div>
      </div>

      <div className="siara-safety-score__metrics">
        <div className="siara-safety-score__metric">
          <span className="siara-safety-score__metric-label">Trips</span>
          <span className="siara-safety-score__metric-value">{data.tripCount}</span>
          <span className="siara-safety-score__metric-sub">completed</span>
        </div>
        <div className="siara-safety-score__metric">
          <span className="siara-safety-score__metric-label">Distance</span>
          <span className="siara-safety-score__metric-value">{distanceLabel}</span>
          <span className="siara-safety-score__metric-sub">total driven</span>
        </div>
        <div className="siara-safety-score__metric">
          <span className="siara-safety-score__metric-label">Avg risk</span>
          <span className="siara-safety-score__metric-value">{avgRiskLabel}</span>
          <span className="siara-safety-score__metric-sub">across trips</span>
        </div>
        <div className="siara-safety-score__metric">
          <span className="siara-safety-score__metric-label">Safest route used</span>
          <span className="siara-safety-score__metric-value">
            {data.safestRouteUsageCount}
          </span>
          <span className="siara-safety-score__metric-sub">times</span>
        </div>
        <div className="siara-safety-score__metric">
          <span className="siara-safety-score__metric-label">Avg rating</span>
          <span className="siara-safety-score__metric-value">{avgRatingLabel}</span>
          <span className="siara-safety-score__metric-sub">your feedback</span>
        </div>
      </div>

      {data.weeklyTrend?.length ? (
        <div>
          <span className="siara-safety-score__metric-label" style={{ display: 'block', marginBottom: 4 }}>
            Weekly avg risk
          </span>
          <div className="siara-safety-score__trend" aria-hidden="true">
            {data.weeklyTrend.map((week) => {
              const pct = Number(week?.avgRiskPercent)
              const heightPct = Number.isFinite(pct)
                ? Math.max(8, (pct / trendMaxRisk) * 100)
                : 4
              const isCurrent = Number(week?.weekOffset) === 0
              return (
                <div
                  className="siara-safety-score__trend-bar"
                  key={`week-${week.weekOffset}`}
                >
                  <span
                    className={`siara-safety-score__trend-bar-fill ${isCurrent ? 'is-current' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span>{week.weekLabel}</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {Number.isFinite(pct) ? `${Math.round(pct)}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {data.tips?.length ? (
        <ul className="siara-safety-score__tips">
          {data.tips.map((tip) => (
            <li key={tip.id} className="siara-safety-score__tip">
              {tip.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
