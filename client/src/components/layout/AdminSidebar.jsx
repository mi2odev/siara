import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import siaraLogo from '../../assets/logos/siara-logo.png'

const sections = [
  {
    label: 'Overview',
    links: [
      { to: '/admin/overview', icon: '◉', text: 'System Overview', badge: null },
    ],
  },
  {
    label: 'Incident Management',
    links: [
      { to: '/admin/incidents', icon: '⚡', text: 'Pending Review', badge: '8', badgeType: '' },
      { to: '/admin/incidents?filter=ai-flagged', icon: '◎', text: 'AI-Flagged High Risk', badge: '3', badgeType: 'warning' },
      { to: '/admin/incidents?filter=community', icon: '⚑', text: 'Community Flagged', badge: '2', badgeType: 'warning' },
      { to: '/admin/incidents?filter=merged', icon: '⊕', text: 'Merged Incidents' },
      { to: '/admin/incidents?filter=archived', icon: '▪', text: 'Archived' },
    ],
  },
  {
    label: 'Alert Operations',
    links: [
      { to: '/admin/alerts', icon: '▲', text: 'Active Alerts', badge: '4', badgeType: '' },
      { to: '/admin/alerts?tab=scheduled', icon: '◷', text: 'Scheduled Alerts' },
      { to: '/admin/alerts?tab=expired', icon: '◔', text: 'Expiring / Expired' },
      { to: '/admin/alerts?tab=emergency', icon: '◆', text: 'Emergency Broadcast' },
      { to: '/admin/alerts?tab=templates', icon: '▧', text: 'Alert Templates' },
    ],
  },
  {
    label: 'Risk & Zones',
    links: [
      { to: '/admin/zones', icon: '◈', text: 'Risk Heatmap' },
      { to: '/admin/zones?tab=thresholds', icon: '▬', text: 'Zone Thresholds' },
      { to: '/admin/zones?tab=table', icon: '✎', text: 'Zone Management' },
      { to: '/admin/zones?tab=ranking', icon: '▽', text: 'Wilaya Risk Ranking' },
    ],
  },
  {
    label: 'AI & Model Supervision',
    links: [
      { to: '/admin/ai', icon: '◇', text: 'Accuracy Trends' },
      { to: '/admin/ai?tab=confidence', icon: '▭', text: 'Confidence Distribution' },
      { to: '/admin/ai?tab=confusion', icon: '✕', text: 'Confusion Matrix' },
      { to: '/admin/ai?tab=overrides', icon: '↹', text: 'Override Logs' },
    ],
  },
  {
    label: 'User Governance',
    links: [
      { to: '/admin/users', icon: '◎', text: 'All Users', badge: '2', badgeType: 'info' },
      { to: '/admin/users?filter=at-risk', icon: '⚠', text: 'At Risk Users' },
      { to: '/admin/users?filter=trusted', icon: '★', text: 'Top Contributors' },
      { to: '/admin/users?filter=suspended', icon: '⊘', text: 'Suspensions' },
    ],
  },
  {
    label: 'Data & Analytics',
    links: [
      { to: '/admin/analytics', icon: '◫', text: 'Analytics Dashboard' },
    ],
  },
  {
    label: 'System',
    links: [
      { to: '/admin/system', icon: '⚙', text: 'Configuration' },
    ],
  },
]

export default function AdminSidebar() {
  const location = useLocation()

  const isLinkActive = (to) => {
    const [path, search] = to.split('?')
    if (path !== location.pathname) return false
    if (search) return location.search === `?${search}`
    return !location.search
  }

  return (
    <aside className="admin-sidebar">
      {/* Brand */}
      <div className="admin-sidebar-brand">
        <img src={siaraLogo} alt="SIARA" />
        <div className="admin-sidebar-brand-text">
          <span className="brand-name">SIARA</span>
          <span className="brand-sub">Supervision Centre</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav">
        {sections.map((section) => (
          <div className="admin-nav-section" key={section.label}>
            <div className="admin-nav-section-label">{section.label}</div>
            {section.links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`admin-nav-link${isLinkActive(link.to) ? ' active' : ''}`}
              >
                <span className="nav-icon">{link.icon}</span>
                {link.text}
                {link.badge && (
                  <span className={`nav-badge ${link.badgeType || ''}`}>{link.badge}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="admin-sidebar-footer">
        <div className="admin-env-badge">
          <span className="env-dot"></span>
          Production
        </div>
        <div className="admin-health-row">
          <span className="admin-health-dot green"></span>
          System Health: Operational
        </div>
        <div className="admin-health-row">
          <span className="admin-health-dot green"></span>
          AI Model: Online (v0.3)
        </div>
      </div>
    </aside>
  )
}
