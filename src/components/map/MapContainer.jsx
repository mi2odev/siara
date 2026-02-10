import React from 'react'

export default function MapContainer({ children }) {
  return (
    <div style={{width:'100%',height:'400px',borderRadius:12,overflow:'hidden',background:'linear-gradient(180deg,var(--siara-gradient-start),var(--siara-gradient-end))'}}>
      <div style={{color:'var(--siara-text-light)',padding:12}}>Map placeholder — React Leaflet not configured</div>
      {children}
    </div>
  )
}
