import React from 'react'
import MapContainer from './MapContainer'

export default function MapPreview(){
  return (
    <div style={{padding:24}}>
      <h4 style={{color:'var(--siara-accent)',marginBottom:12}}>Aperçu de la carte</h4>
      <MapContainer>
        <div style={{padding:12,color:'var(--siara-accent)'}}>Carte prototype — zones de risque simulées</div>
      </MapContainer>
    </div>
  )
}
