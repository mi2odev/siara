import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import { fetchDepartureOptions } from '../../services/departureOptionsService'
import '../../styles/BestTimeToLeavePanel.css'

const DEFAULT_OFFSETS_MIN = [0, 30, 60, 120]

function normaliseLevel(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'
  const n = Number(percent)
  if (!Number.isFinite(n)) return 'unknown'
  if (n >= 50) return 'high'
  if (n >= 25) return 'medium'
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
  return date.toTimeString().slice(0, 5)
}

function buildTimestamps(baseMs, offsetsMin) {
  return offsetsMin.map((min) => new Date(baseMs + min * 60 * 1000).toISOString())
}

function buildCacheKey(origin, destination, timestamps) {
  if (!origin || !destination || !Array.isArray(timestamps)) return null
  const round = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(4) : 'na')
  return [
    round(origin.lat),
    round(origin.lng),
    round(destination.lat),
    round(destination.lng),
    timestamps.join(','),
  ].join('|')
}

export default function BestTimeToLeavePanel({
  origin,
  destination,
  offsetsMin = DEFAULT_OFFSETS_MIN,
  onSelectTimestamp,
  enabled = true,
}) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [options, setOptions] = useState([])
  const [bestOption, setBestOption] = useState(null)
  const cacheRef = useRef(new Map())
  const lastCacheKeyRef = useRef(null)

  const baseMs = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin?.lat, origin?.lng, destination?.lat, destination?.lng],
  )

  const requestKey = useMemo(() => {
    if (!origin || !destination) return null
    const timestamps = buildTimestamps(baseMs, offsetsMin)
    return buildCacheKey(origin, destination, timestamps)
  }, [origin, destination, offsetsMin, baseMs])

  const runQuery = useCallback(async () => {
    if (!enabled || !origin || !destination) return
    const timestamps = buildTimestamps(baseMs, offsetsMin)
    const cacheKey = buildCacheKey(origin, destination, timestamps)
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
      setError(err?.message || 'Could not check safer departure times.')
      setState('error')
    }
  }, [enabled, origin, destination, offsetsMin, baseMs])

  useEffect(() => {
    if (!enabled) {
      setState('idle')
      setOptions([])
      setBestOption(null)
      setError('')
      return undefined
    }
    if (!requestKey) {
      setState('idle')
      setOptions([])
      setBestOption(null)
      return undefined
    }
    if (lastCacheKeyRef.current === requestKey) return undefined
    const handle = setTimeout(() => {
      runQuery()
    }, 300)
    return () => clearTimeout(handle)
  }, [enabled, requestKey, runQuery])

  const bestRiskDelta = useMemo(() => {
    if (!bestOption || !options.length) return null
    const now = options[0]
    if (!now?.ok || !Number.isFinite(Number(now?.riskPercent))) return null
    if (!Number.isFinite(Number(bestOption?.riskPercent))) return null
    if (now.timestamp === bestOption.timestamp) return null
    const drop = Number(now.riskPercent) - Number(bestOption.riskPercent)
    if (drop <= 0) return null
    return Math.round(drop)
  }, [bestOption, options])

  if (!enabled) return null

  return (
    <section
      className="siara-best-time"
      aria-label="Best time to leave"
    >
      <div className="siara-best-time__header">
        <span className="siara-best-time__icon" aria-hidden="true">
          <AccessTimeOutlinedIcon fontSize="inherit" />
        </span>
        <h4 className="siara-best-time__title">Best time to leave</h4>
        <button
          type="button"
          className="siara-best-time__refresh"
          onClick={runQuery}
          disabled={state === 'loading' || !origin || !destination}
        >
          {state === 'loading' ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {!origin || !destination ? (
        <p className="siara-best-time__hint">
          Pick an origin and destination to compare departure times.
        </p>
      ) : state === 'loading' ? (
        <>
          <p className="siara-best-time__hint">Checking safer departure times…</p>
          <ul className="siara-best-time__list" aria-hidden="true">
            {offsetsMin.map((m) => (
              <li key={`skel-${m}`} className="siara-best-time__skeleton" />
            ))}
          </ul>
        </>
      ) : state === 'error' ? (
        <p className="siara-best-time__error" role="alert">{error}</p>
      ) : options.length === 0 ? (
        <p className="siara-best-time__hint">No departure options available.</p>
      ) : (
        <>
          {bestOption && bestRiskDelta != null ? (
            <div className="siara-best-time__best">
              Best time to leave: <strong>{formatClock(bestOption.timestamp)}</strong>{' '}
              ({bestOption.label}). Leaving then reduces risk by{' '}
              <strong>{bestRiskDelta}%</strong> versus leaving now.
            </div>
          ) : bestOption ? (
            <div className="siara-best-time__best">
              Best window: <strong>{bestOption.label}</strong> at{' '}
              <strong>{formatClock(bestOption.timestamp)}</strong>.
            </div>
          ) : null}

          <ul className="siara-best-time__list">
            {options.map((opt) => {
              const tier = normaliseLevel(opt.riskLevel, opt.riskPercent)
              const isBest = bestOption && opt.timestamp === bestOption.timestamp
              const failed = !opt.ok
              return (
                <li key={opt.timestamp}>
                  <button
                    type="button"
                    className={`siara-best-time__option ${isBest ? 'is-best' : ''} ${failed ? 'is-failed' : ''}`}
                    onClick={() => {
                      if (failed) return
                      if (typeof onSelectTimestamp === 'function') {
                        onSelectTimestamp(opt.timestamp, opt)
                      }
                    }}
                    disabled={failed}
                    aria-label={`${opt.label} — ${formatClock(opt.timestamp)}`}
                  >
                    <span className="siara-best-time__option-label">{opt.label}</span>
                    <span className="siara-best-time__option-time">
                      {formatClock(opt.timestamp)}
                    </span>
                    <span className={`siara-best-time__option-risk risk-${tier}`}>
                      {failed ? '—' : formatRiskPercent(opt.riskPercent)}
                    </span>
                    <span className="siara-best-time__option-meta">
                      {failed
                        ? 'unavailable'
                        : Number.isFinite(Number(opt.etaMin))
                          ? `${Number(opt.etaMin).toFixed(0)} min ETA`
                          : 'eta n/a'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
