import React from 'react'

export default function MarkersLayer({ points = [] }) {
  return (
    <div style={{padding:12,color:'var(--siara-accent)'}}>Markers: {points.length} (placeholder)</div>
  )
}
