import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside className="w-64 bg-transparent border-r border-white/6 min-h-screen p-4">
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <NavLink to="/dashboard" style={{color:'var(--siara-accent)',textDecoration:'none'}}>Dashboard</NavLink>
        <NavLink to="/admin/services" style={{color:'var(--siara-accent)',textDecoration:'none'}}>Service Control</NavLink>
        <hr style={{borderColor:'rgba(255,255,255,0.04)'}} />
        <NavLink to="/home" style={{color:'var(--siara-accent)',textDecoration:'none'}}>Home</NavLink>
        <NavLink to="/services" style={{color:'var(--siara-accent)',textDecoration:'none'}}>Services</NavLink>
        <NavLink to="/news" style={{color:'var(--siara-accent)',textDecoration:'none'}}>News</NavLink>
      </div>
    </aside>
  )
}
