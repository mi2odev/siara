import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDepartureOptions } from '../../services/departureOptionsService'

// Compact 4-window "Best time to leave" surface used inside the
// RouteOverviewCard in MapLibre navigation mode. Collapsed by default
// (one-line teaser); expands into a list with an explicit
// "Use this departure" button per row.
//
// This is intentionally a separate component from BestTimeToLeavePanel so
// the Leaflet planning surface stays exactly as it was.

const OFFSETS_MIN = [0, 30, 60, 120] // 4 windows

function tierFromLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'extreme' || text === 'critical') return 'extreme'
  if (text === 'high') return 'high'
  if (text === 'moderate' || text === 'medium') return 'moderate'
  if (text === 'low') return 'low'
  const n = Number(percent)
  if (!Number.isFinite(n)) return 'unknown'
  if (n >= 75) return 'extreme'
  if (n >= 50) return 'high'
  if (n >= 25) return 'moderate'
  return 'low'
}

function formatRiskPercent(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${Math.round(n)}%` : '—'
}

function formatClock(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildTimestamps(baseMs) {
  return OFFSETS_MIN.map((min) => new Date(baseMs + min * 60 * 1000).toISOString())
}

function buildCacheKey(origin, destination, baseMs) {
  if (!origin || !destination) return null
  const round = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(4) : 'na')
  // 5-minute bucket on the base time so the same minute doesn't requery.
  const bucket = Math.floor(baseMs / (5 * 60 * 1000))
  return [
    round(origin.lat),
    round(origin.lng),
    round(destination.lat),
    round(destination.lng),
    bucket,
  ].join('|')
}

export default function BestTimeToLeaveCompact({
  origin,
  destination,
  enabled = true,
  onSelectTimestamp,
}) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [options, setOptions] = useState([])
  const [bestOption, setBestOption] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const cacheRef = useRef(new Map())
  const lastCacheKeyRef = useRef(null)

  const baseMs = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin?.lat, origin?.lng, destination?.lat, destination?.lng],
  )

  const requestKey = useMemo(
    () => buildCacheKey(origin, destination, baseMs),
    [origin, destination, baseMs],
  )

  const runQuery = useCallback(async () => {
    if (!enabled || !origin || !destination) return
    const cacheKey = buildCacheKey(origin, destination, baseMs)
    if (!cacheKey) return

    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)
      setOptions(cached.options || [])
      setBestOption(cached.bestOption || null)
      setError('')
      setState('success')
      lastCacheKeyRef.current = cacheKey
      return
    }

    const timestamps = buildTimestamps(baseMs)
    setState('loading')
    setError('')
    try {
      const data = await fetchDepartureOptions({ origin, destination, timestamps })
      const opts = Array.isArray(data?.options) ? data.options : []
      const best = data?.bestOption || null
      cacheRef.current.set(cacheKey, { options: opts, bestOption: best })
      lastCacheKeyRef.current = cacheKey
      setOptions(opts)
      setBestOption(best)
      setState('success')
    } catch (err) {
      setError(err?.message || 'Could not check departure times.')
      setState('error')
    }
  }, [enabled, origin, destination, baseMs])

  useEffect(() => {
    if (!enabled || !requestKey) {
      setState('idle')
      setOptions([])
      setBestOption(null)
      setError('')
      return undefined
    }
    if (lastCacheKeyRef.current === requestKey) return undefined
    const handle = setTimeout(() => {
      runQuery()
    }, 300)
    return () => clearTimeout(handle)
  }, [enabled, requestKey, runQuery])

  if (!enabled) return null

  const nowOption = options[0]
  const nowTier = nowOption
    ? tierFromLevel(nowOption.riskLevel, nowOption.riskPercent)
    : 'unknown'
  const teaser = (() => {
    if (state === 'loading') return 'Checking departure times…'
    if (state === 'error') return error || 'Could not check departure times.'
    if (!nowOption) return 'No departure data yet.'
    if (bestOption && bestOption.timestamp !== nowOption.timestamp) {
      return `Now: ${nowTier} · Best at ${formatClock(bestOption.timestamp)}`
    }
    return `Now: ${nowTier} (${formatRiskPercent(nowOption.riskPercent)})`
  })()

  return (
    <section className="siara-best-time-compact" aria-label="Best time to leave">
      <button
        type="button"
        className="siara-best-time-compact__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="siara-best-time-compact__icon" aria-hidden="true">⏰</span>
        <span className="siara-best-time-compact__title">Best time to leave</span>
        <span
          className={`siara-best-time-compact__chevron${
            expanded ? ' siara-best-time-compact__chevron--open' : ''
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {!expanded ? (
        <p className="siara-best-time-compact__teaser">{teaser}</p>
      ) : (
        <div className="siara-best-time-compact__body">
          {state === 'loading' ? (
            <p className="siara-best-time-compact__hint">Checking safer departure times…</p>
          ) : state === 'error' ? (
            <p className="siara-best-time-compact__error" role="alert">{error}</p>
          ) : options.length === 0 ? (
            <p className="siara-best-time-compact__hint">No departure options available.</p>
          ) : (
            <ul className="siara-best-time-compact__list">
              {options.map((opt) => {
                const tier = tierFromLevel(opt.riskLevel, opt.riskPercent)
                const isBest = bestOption && opt.timestamp === bestOption.timestamp
                const failed = !opt.ok
                return (
                  <li
                    key={opt.timestamp}
                    className={`siara-best-time-compact__row${isBest ? ' is-best' : ''}${failed ? ' is-failed' : ''}`}
                  >
                    <div className="siara-best-time-compact__row-info">
                      <span className="siara-best-time-compact__row-label">
                        {opt.label || formatClock(opt.timestamp)}
                      </span>
                      <span className="siara-best-time-compact__row-time">
                        {formatClock(opt.timestamp)}
                      </span>
                      <span className={`siara-best-time-compact__row-risk risk-${tier}`}>
                        {failed ? '—' : formatRiskPercent(opt.riskPercent)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="siara-best-time-compact__use-btn"
                      onClick={() => {
                        if (failed) return
                        if (typeof onSelectTimestamp === 'function') {
                          onSelectTimestamp(opt.timestamp, opt)
                        }
                      }}
                      disabled={failed}
                    >
                      Use this departure
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
