import React from 'react'

export default function Card({ children, className = '', title }) {
  return (
    <div className={`siara-card bg-white/5 p-4 rounded-md ${className}`}>
      {title && <div className="card-title" style={{fontWeight:600,marginBottom:8}}>{title}</div>}
      <div>{children}</div>
    </div>
  )
}
