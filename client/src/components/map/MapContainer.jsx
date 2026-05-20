// DEPRECATED placeholder. The active SIARA map uses `MapContainer` imported
// from `react-leaflet` directly inside `SiaraMap.jsx`. This file is kept only
// as a no-op stub so old imports do not break the build — it is NOT mounted
// anywhere in the current routes. Delete once a grep confirms no consumers.
import React from 'react'

export default function MapContainer({ children }) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn(
      '[siara] components/map/MapContainer.jsx is a deprecated placeholder; ' +
        'the active map is rendered by SiaraMap.jsx via react-leaflet.',
    )
  }
  return (
    <div
      style={{
        width: '100%',
        height: '400px',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'linear-gradient(180deg,var(--siara-gradient-start),var(--siara-gradient-end))',
      }}
    >
      <div style={{ color: 'var(--siara-text-light)', padding: 12 }}>
        Deprecated MapContainer stub. See SiaraMap.jsx for the live map.
      </div>
      {children}
    </div>
  )
}
