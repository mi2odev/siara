import React from 'react'

export default function StatCard({ value, label }) {
  return (
    <div style={{background:'var(--siara-secondary)',padding:16,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:6}}>
      <div style={{fontSize:20,fontWeight:700,color:'var(--siara-accent)'}}>{value}</div>
      <div style={{fontSize:13,color:'var(--siara-accent)',opacity:0.9}}>{label}</div>
    </div>
  )
}
