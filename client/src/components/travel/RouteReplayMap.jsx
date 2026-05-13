import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../../styles/RouteReplayMap.css'

const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]

const REPLAY_DURATION_MS = 12000

function normalisePathPoint(point) {
  if (!point) return null
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0])
    const lng = Number(point[1])
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  }
  if (typeof point === 'object') {
    const lat = Number(point.lat ?? point.latitude)
    const lng = Number(point.lng ?? point.longitude ?? point.lon)
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  }
  return null
}

function flattenPath(routeSnapshot, segmentsSnapshot) {
  if (Array.isArray(routeSnapshot?.path) && routeSnapshot.path.length >= 2) {
    return routeSnapshot.path.map(normalisePathPoint).filter(Boolean)
  }
  if (Array.isArray(segmentsSnapshot)) {
    const points = []
    for (const seg of segmentsSnapshot) {
      if (Array.isArray(seg?.path)) {
        for (const p of seg.path) {
          const normal = normalisePathPoint(p)
          if (normal) points.push(normal)
        }
      }
    }
    if (points.length >= 2) return points
  }
  return []
}

function dangerColor(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'high') return '#B91C1C'
  if (text === 'medium') return '#F59E0B'
  if (text === 'low') return '#16A34A'
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return '#64748B'
  if (numeric >= 50) return '#B91C1C'
  if (numeric >= 25) return '#F59E0B'
  return '#16A34A'
}

function FitToPath({ path }) {
  const map = useMap()
  useEffect(() => {
    if (!path || path.length < 2) return
    const bounds = path.reduce(
      (acc, [lat, lng]) => {
        acc[0][0] = Math.min(acc[0][0], lat)
        acc[0][1] = Math.min(acc[0][1], lng)
        acc[1][0] = Math.max(acc[1][0], lat)
        acc[1][1] = Math.max(acc[1][1], lng)
        return acc
      },
      [
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ],
    )
    map.fitBounds(bounds, { padding: [24, 24], animate: false })
  }, [map, path])
  return null
}

export default function RouteReplayMap({ trip }) {
  const path = useMemo(() => flattenPath(trip?.routeSnapshot, trip?.segmentsSnapshot), [
    trip?.routeSnapshot,
    trip?.segmentsSnapshot,
  ])
  const segments = useMemo(
    () => (Array.isArray(trip?.segmentsSnapshot) ? trip.segmentsSnapshot : []),
    [trip?.segmentsSnapshot],
  )

  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const lastTickRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    setProgress(0)
    setPlaying(false)
  }, [trip?.id])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTickRef.current = null
      return undefined
    }

    const tick = (timestamp) => {
      if (lastTickRef.current == null) lastTickRef.current = timestamp
      const delta = timestamp - lastTickRef.current
      lastTickRef.current = timestamp
      setProgress((prev) => {
        const next = prev + (delta / REPLAY_DURATION_MS) * speed
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastTickRef.current = null
    }
  }, [playing, speed])

  const segmentColors = useMemo(() => {
    if (!path.length) return []
    if (!segments.length) {
      const fallback = dangerColor(
        trip?.routeSnapshot?.summary?.danger_level || trip?.overallRiskLevel,
        trip?.routeSnapshot?.summary?.danger_percent ?? trip?.overallRiskPercent,
      )
      return path.slice(0, -1).map(() => fallback)
    }
    const perPoint = Math.max(1, Math.floor((path.length - 1) / segments.length))
    return path.slice(0, -1).map((_, idx) => {
      const segIndex = Math.min(segments.length - 1, Math.floor(idx / perPoint))
      const seg = segments[segIndex]
      return dangerColor(seg?.danger_level, seg?.danger_percent)
    })
  }, [path, segments, trip])

  const currentPoint = useMemo(() => {
    if (!path.length) return null
    if (path.length === 1) return path[0]
    const exact = (path.length - 1) * Math.min(1, Math.max(0, progress))
    const idx = Math.floor(exact)
    const frac = exact - idx
    if (idx >= path.length - 1) return path[path.length - 1]
    const a = path[idx]
    const b = path[idx + 1]
    return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
  }, [path, progress])

  const visiblePolylines = useMemo(() => {
    if (path.length < 2) return []
    const result = []
    for (let i = 0; i < path.length - 1; i += 1) {
      result.push({
        positions: [path[i], path[i + 1]],
        color: segmentColors[i] || '#64748B',
      })
    }
    return result
  }, [path, segmentColors])

  if (path.length < 2) {
    return (
      <div className="siara-route-replay__empty">
        No route geometry was captured for this trip — replay is unavailable.
      </div>
    )
  }

  const center = path[Math.floor(path.length / 2)]
  const handleReset = () => {
    setProgress(0)
    setPlaying(false)
  }
  const handleTogglePlay = () => {
    if (progress >= 1) setProgress(0)
    setPlaying((prev) => !prev)
  }

  return (
    <div className="siara-route-replay">
      <div className="siara-route-replay__map">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToPath path={path} />
          {visiblePolylines.map((seg, idx) => (
            <Polyline
              key={`replay-seg-${idx}`}
              positions={seg.positions}
              pathOptions={{
                color: seg.color,
                weight: 6,
                opacity: 0.85,
              }}
            />
          ))}
          <CircleMarker
            center={path[0]}
            radius={7}
            pathOptions={{ color: '#FFFFFF', fillColor: '#0F766E', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              Start
            </Tooltip>
          </CircleMarker>
          <CircleMarker
            center={path[path.length - 1]}
            radius={7}
            pathOptions={{ color: '#FFFFFF', fillColor: '#1D4ED8', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              End
            </Tooltip>
          </CircleMarker>
          {currentPoint ? (
            <CircleMarker
              center={currentPoint}
              radius={9}
              pathOptions={{
                color: '#FFFFFF',
                fillColor: '#FF6F00',
                fillOpacity: 1,
                weight: 3,
              }}
            />
          ) : null}
        </MapContainer>
      </div>

      <div className="siara-route-replay__progress" aria-hidden="true">
        <div
          className="siara-route-replay__progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%` }}
        />
      </div>

      <div className="siara-route-replay__controls">
        <div className="siara-route-replay__btn-group">
          <button
            type="button"
            className="siara-route-replay__btn siara-route-replay__btn--primary"
            onClick={handleTogglePlay}
          >
            {playing ? 'Pause' : progress >= 1 ? 'Replay again' : 'Play'}
          </button>
          <button
            type="button"
            className="siara-route-replay__btn"
            onClick={handleReset}
            disabled={progress === 0 && !playing}
          >
            Reset
          </button>
        </div>

        <label className="siara-route-replay__speed">
          Speed
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value) || 1)}
          >
            {SPEED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="siara-route-replay__meta">
        <span>
          Progress <strong>{Math.round(progress * 100)}%</strong>
        </span>
        {Number.isFinite(Number(trip?.distanceKm)) ? (
          <span>
            Distance <strong>{Number(trip.distanceKm).toFixed(1)} km</strong>
          </span>
        ) : null}
        {Number.isFinite(Number(trip?.overallRiskPercent)) ? (
          <span>
            Overall risk <strong>{Math.round(Number(trip.overallRiskPercent))}%</strong>
          </span>
        ) : null}
        {trip?.routeType ? (
          <span>
            Route type <strong>{trip.routeType}</strong>
          </span>
        ) : null}
      </div>
    </div>
  )
}
