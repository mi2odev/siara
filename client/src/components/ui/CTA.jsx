import React from 'react'
import Button from './Button'

export default function CTA({ title, subtitle, primaryLabel = 'Se connecter', onPrimary, onSecondary }){
  return (
    <section style={{padding:'48px 0',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(90deg,var(--siara-secondary),var(--siara-deep))'}}>
      <div style={{maxWidth:980,display:'flex',flexDirection:'column',alignItems:'center',gap:12,textAlign:'center'}}>
        <h3 style={{color:'var(--siara-light)',fontSize:20,margin:0}}>{title}</h3>
        {subtitle && <p style={{color:'var(--siara-accent)',opacity:0.95,maxWidth:740}}>{subtitle}</p>}
        <div style={{display:'flex',gap:12,marginTop:8}}>
          <Button onClick={onPrimary}>{primaryLabel}</Button>
          <Button variant="ghost" onClick={onSecondary}>Contactez-nous</Button>
        </div>
      </div>
    </section>
  )
}
