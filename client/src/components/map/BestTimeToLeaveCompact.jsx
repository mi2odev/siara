import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchDepartureOptions } from '../../services/departureOptionsService'

const OFFSETS_MIN = [0, 30, 60, 120]

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
  return Number.isFinite(n) ? `${Math.round(n)}%` : '--'
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

function buildCacheKey(origin, destination, baseMs, routeIdentity) {
  if (!origin || !destination) return null
  const round = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(4) : 'na')
  const bucket = Math.floor(baseMs / (5 * 60 * 1000))
  return [
    routeIdentity || 'route',
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
  routeIdentity = '',
}) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [options, setOptions] = useState([])
  const [bestOption, setBestOption] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const cacheRef = useRef(new Map())
  const lastCacheKeyRef = useRef(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef(null)

  const baseMs = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin?.lat, origin?.lng, destination?.lat, destination?.lng, routeIdentity],
  )

  const requestKey = useMemo(
    () => buildCacheKey(origin, destination, baseMs, routeIdentity),
    [origin, destination, baseMs, routeIdentity],
  )

  const runQuery = useCallback(async ({ force = false } = {}) => {
    if (!enabled || !origin || !destination) return
    const cacheKey = buildCacheKey(origin, destination, baseMs, routeIdentity)
    if (!cacheKey) return

    if (!force && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)
      setOptions(cached.options || [])
      setBestOption(cached.bestOption || null)
      setError('')
      setState('success')
      lastCacheKeyRef.current = cacheKey
      return
    }

    const requestId = ++requestIdRef.current
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    const controller = new AbortController()
    abortRef.current = controller

    setState('loading')
    setError('')
    try {
      const data = await fetchDepartureOptions({
        origin,
        destination,
        timestamps: buildTimestamps(baseMs),
        signal: controller.signal,
        maxAlternatives: 1,
      })
      if (requestId !== requestIdRef.current || controller.signal.aborted) return
      const opts = Array.isArray(data?.options) ? data.options : []
      const best = data?.bestOption || null
      cacheRef.current.set(cacheKey, { options: opts, bestOption: best })
      lastCacheKeyRef.current = cacheKey
      setOptions(opts)
      setBestOption(best)
      setState('success')
    } catch (err) {
      if (
        requestId !== requestIdRef.current ||
        controller.signal.aborted ||
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED'
      ) {
        return
      }
      setError(err?.message || 'Could not check departure times.')
      setState('error')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [enabled, origin, destination, baseMs, routeIdentity])

  useEffect(() => {
    if (!enabled || !requestKey) {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
      setState('idle')
      setOptions([])
      setBestOption(null)
      setError('')
      return undefined
    }
    if (!expanded || lastCacheKeyRef.current === requestKey) return undefined
    const handle = setTimeout(() => {
      runQuery()
    }, 300)
    return () => clearTimeout(handle)
  }, [enabled, expanded, requestKey, runQuery])

  useEffect(() => () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  if (!enabled) return null

  const nowOption = options[0]
  const nowTier = nowOption
    ? tierFromLevel(nowOption.riskLevel, nowOption.riskPercent)
    : 'unknown'
  const teaser = (() => {
    if (!expanded && state === 'idle') return 'Expand to compare departure times.'
    if (state === 'loading') return 'Checking departure times...'
    if (state === 'error') return error || 'Could not check departure times.'
    if (!nowOption) return 'No departure data yet.'
    if (bestOption && bestOption.timestamp !== nowOption.timestamp) {
      return `Now: ${nowTier} | Best at ${formatClock(bestOption.timestamp)}`
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
        <span className="siara-best-time-compact__icon" aria-hidden="true">Time</span>
        <span className="siara-best-time-compact__title">Best time to leave</span>
        <span
          className={`siara-best-time-compact__chevron${
            expanded ? ' siara-best-time-compact__chevron--open' : ''
          }`}
          aria-hidden="true"
        >
          v
        </span>
      </button>

      {!expanded ? (
        <p className="siara-best-time-compact__teaser">{teaser}</p>
      ) : (
        <div className="siara-best-time-compact__body">
          <button
            type="button"
            className="siara-best-time-compact__refresh"
            onClick={() => runQuery({ force: true })}
            disabled={state === 'loading' || !origin || !destination}
          >
            {state === 'loading' ? 'Checking...' : 'Refresh'}
          </button>
          {state === 'loading' ? (
            <p className="siara-best-time-compact__hint">Checking safer departure times...</p>
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
                        {failed ? '--' : formatRiskPercent(opt.riskPercent)}
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
