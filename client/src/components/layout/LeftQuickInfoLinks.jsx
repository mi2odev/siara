import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import '../../styles/LeftQuickInfoLinks.css'

const INFO_LINKS = [
  { key: 'contact', label: 'Contact', icon: '📞', path: '/contact' },
  { key: 'about', label: 'About', icon: 'ℹ️', path: '/about' },
  { key: 'description', label: 'Description', icon: '📘', path: '/description' },
]

export default function LeftQuickInfoLinks({ title = 'Quick Pages', className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <section className={`left-quick-links ${className}`.trim()}>
      <h3 className="left-quick-links-title">{title}</h3>
      <div className="left-quick-links-list">
        {INFO_LINKS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`left-quick-link-btn ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="left-quick-link-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
