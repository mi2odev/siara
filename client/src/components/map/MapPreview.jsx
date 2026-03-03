import React from 'react'
import MapContainer from './MapContainer'

export default function MapPreview(){
  return (
    <div style={{padding:24}}>
      <h4 style={{color:'var(--siara-accent)',marginBottom:12}}>Map Preview</h4>
      <MapContainer>
        <div style={{padding:12,color:'var(--siara-accent)'}}>Prototype map — simulated risk zones</div>
      </MapContainer>
    </div>
  )
}
