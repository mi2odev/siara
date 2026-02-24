import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const routeNames = {
  '/admin/overview': 'System Overview',
  '/admin/incidents': 'Incident Management',
  '/admin/alerts': 'Alert Operations',
  '/admin/zones': 'Risk & Zones',
  '/admin/ai': 'AI Supervision',
  '/admin/users': 'User Governance',
  '/admin/analytics': 'Analytics',
  '/admin/system': 'Configuration',
}

export default function AdminHeader({ onToggleSidebar }) {
  const navigate = useNavigate()
  const location = useLocation()

  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/')
  const pageName = routeNames[basePath] || 'Admin'
  const isDetailPage = location.pathname.split('/').length > 3

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <div className="admin-breadcrumb">
          <span style={{ opacity: 0.5 }}>SIARA</span>
          <span style={{ opacity: 0.2 }}>/</span>
          <span>{pageName}</span>
          {isDetailPage && (
            <>
              <span style={{ opacity: 0.2 }}>/</span>
              <span style={{ color: 'var(--admin-text)' }}>Detail</span>
            </>
          )}
        </div>
      </div>
      <div className="admin-header-right">
        <input
          type="search"
          className="admin-header-search"
          placeholder="Search incidents, users, zones…"
        />
        <span className="admin-role-badge">Super Admin</span>
        <button className="admin-header-btn" title="Notifications" onClick={() => navigate('/admin/alerts')}>
          🔔
          <span className="notif-dot"></span>
        </button>
        <button className="admin-header-btn" title="Settings" onClick={() => navigate('/admin/system')}>
          ⚙
        </button>
        <div className="admin-avatar" title="Admin User">SA</div>
      </div>
    </header>
  )
}
