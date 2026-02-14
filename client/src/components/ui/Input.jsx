import React from 'react'

export default function Input({ label, id, error, ...props }) {
  return (
    <div style={{marginBottom: error ? 6 : 12}}>
      {label && <label htmlFor={id} style={{display:'block',marginBottom:6,color:'var(--siara-accent)'}}>{label}</label>}
      <input id={id} {...props} className="siara-input" />
      {error && <div style={{color:'var(--siara-error)',fontSize:12,marginTop:6}}>{error}</div>}
    </div>
  )
}
