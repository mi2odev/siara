import React from 'react'

export default function FeatureCard({ icon, title, children }) {
  return (
    <div style={{background:'var(--siara-muted)',padding:18,borderRadius:12,boxShadow:'0 6px 18px rgba(0,0,0,0.4)',minHeight:140}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
        <div style={{width:44,height:44,display:'grid',placeItems:'center',borderRadius:10,background:'rgba(133,79,108,0.12)',boxShadow:'0 0 8px rgba(133,79,108,0.12)'}}>
          {icon || <span style={{color:'var(--siara-primary)'}}>★</span>}
        </div>
        <div style={{fontWeight:700,color:'var(--siara-accent)'}}>{title}</div>
      </div>
      <div style={{color:'var(--siara-accent)',opacity:0.95,fontSize:14,lineHeight:1.4}}>{children}</div>
    </div>
  )
}
