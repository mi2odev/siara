import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useLiveLocation from '../../hooks/useLiveLocation'

// Default Leaflet marker icons don't load correctly under Vite's bundler
// because the relative URLs in the CSS get rewritten. Re-bind them once.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const DEFAULT_CENTER = [33.5731, -7.5898] // Casablanca fallback
const DEFAULT_ZOOM = 15

/**
 * Recenters the map whenever `position` changes AND `followUser` is true.
 * Lives inside <MapContainer> so it can grab the map instance via useMap().
 */
function FollowController({ position, followUser, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (followUser && position) {
      map.setView([position.lat, position.lng], zoom ?? map.getZoom(), {
        animate: true,
      })
    }
  }, [position, followUser, zoom, map])
  return null
}

/**
 * Detects a *user-initiated* drag/zoom and disables auto-centering.
 * `dragstart` and `zoomstart` only fire on real user interaction —
 * programmatic setView() calls don't trigger them, so we won't loop.
 */
function UserGestureWatcher({ onUserInteract }) {
  useMapEvents({
    dragstart: () => onUserInteract(),
    zoomstart: (e) => {
      // Ignore the first zoomstart caused by setView() right after mount.
      // Leaflet sets `e.hard` only for hard sets, but the cleanest signal
      // is to check for a pointer/wheel originator on the original event.
      if (e.originalEvent) onUserInteract()
    },
  })
  return null
}

/**
 * Live location map.
 *
 * Behaviour:
 * - Asks the browser for location permission on mount.
 * - Tracks the user marker continuously via watchPosition().
 * - Auto-centers the map only while followUser === true.
 * - Disables follow as soon as the user drags or zooms manually.
 * - "My Location" button re-enables follow and snaps back to the user.
 */
export default function LiveLocationMap({
  height = 480,
  zoom = DEFAULT_ZOOM,
  initialCenter = DEFAULT_CENTER,
}) {
  const { position, error, status, requestStart } = useLiveLocation()

  // followUser starts true so the first valid fix recenters the map.
  const [followUser, setFollowUser] = useState(true)

  // Keep a ref to the map instance for the "My Location" button.
  const mapRef = useRef(null)

  const handleMyLocation = () => {
    setFollowUser(true)
    if (position && mapRef.current) {
      mapRef.current.setView([position.lat, position.lng], zoom, { animate: true })
    } else {
      // No fix yet (e.g. user previously denied and just re-allowed).
      requestStart()
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <MapContainer
        center={position ? [position.lat, position.lng] : initialCenter}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <UserGestureWatcher onUserInteract={() => setFollowUser(false)} />
        <FollowController position={position} followUser={followUser} zoom={zoom} />

        {position && (
          <>
            <Marker position={[position.lat, position.lng]} />
            {/* Accuracy halo so the user sees how precise the fix is. */}
            <Circle
              center={[position.lat, position.lng]}
              radius={position.accuracy}
              pathOptions={{ color: '#1976d2', fillOpacity: 0.1, weight: 1 }}
            />
          </>
        )}
      </MapContainer>

      <button
        type="button"
        onClick={handleMyLocation}
        aria-label="Center on my location"
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 1000,
          padding: '10px 14px',
          borderRadius: 999,
          border: 'none',
          background: followUser ? '#1976d2' : '#fff',
          color: followUser ? '#fff' : '#1976d2',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        My Location
      </button>

      {/* Lightweight status banner for the four error cases. */}
      {status !== 'watching' && (
        <StatusBanner status={status} error={error} onRetry={requestStart} />
      )}
    </div>
  )
}

function StatusBanner({ status, error, onRetry }) {
  const messages = {
    idle: 'Locating…',
    requesting: 'Requesting location permission…',
    denied: 'Location permission was denied. Enable it in your browser settings.',
    unavailable: 'Location currently unavailable. Check GPS / network.',
    unsupported: 'This browser does not support geolocation.',
    insecure: 'Geolocation needs HTTPS — open the site over a secure connection.',
  }
  const text = messages[status] ?? error?.message ?? 'Locating…'
  const isError = ['denied', 'unavailable', 'unsupported', 'insecure'].includes(status)

  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        padding: '8px 14px',
        borderRadius: 8,
        background: isError ? '#fdecea' : '#e3f2fd',
        color: isError ? '#b71c1c' : '#0d47a1',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: 14,
      }}
    >
      {text}
      {isError && status !== 'unsupported' && status !== 'insecure' && (
        <button
          onClick={onRetry}
          style={{
            marginLeft: 10,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
