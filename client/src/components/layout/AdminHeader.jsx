import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../../contexts/AuthContext'

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
  const { logout } = useContext(AuthContext)

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
        <button
          className="admin-header-logout"
          title="Log out"
          onClick={() => {
            Promise.resolve(logout()).finally(() => navigate('/login'))
          }}
        >
          Deconnexion
        </button>
      </div>
    </header>
  )
}
