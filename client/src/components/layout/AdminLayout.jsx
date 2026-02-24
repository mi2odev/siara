import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import AdminContextPanel from './AdminContextPanel'
import '../../styles/AdminPanel.css'

const pagesWithContext = ['/admin/overview', '/admin/incidents', '/admin/zones']

export default function AdminLayout() {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const showCtx = pagesWithContext.some(p => location.pathname.startsWith(p) && location.pathname.split('/').length <= 3)

  return (
    <div className="admin-root">
      <AdminSidebar collapsed={sidebarCollapsed} />
      <div className={`admin-workspace${showCtx ? ' has-ctx' : ''}`}>
        <AdminHeader onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
      {showCtx && <AdminContextPanel />}
    </div>
  )
}
