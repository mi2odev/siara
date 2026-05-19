import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import '../../styles/AdminPanel.css'

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="admin-root">
      <AdminSidebar collapsed={sidebarCollapsed} />
      <div className="admin-workspace">
        <AdminHeader onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
