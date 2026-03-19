import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import siaraLogo from '../../assets/logos/siara-logo.png'
import { fetchAdminIncidentCounts } from '../../services/adminIncidentsService'
import { fetchAdminOperationalAlertCounts } from '../../services/adminOperationalAlertsService'

function buildSections(incidentCounts, alertCounts) {
  return [
    {
      label: 'Overview',
      links: [
        { to: '/admin/overview', icon: '\u25C9', text: 'System Overview', badge: null },
      ],
    },
    {
      label: 'Incident Management',
      links: [
        { to: '/admin/incidents', icon: '\u26A1', text: 'Pending Review', badge: String(incidentCounts.pending ?? 0), badgeType: '' },
        { to: '/admin/incidents?filter=ai-flagged', icon: '\u25CE', text: 'AI-Flagged High Risk', badge: String(incidentCounts['ai-flagged'] ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=community', icon: '\u2691', text: 'Community Flagged', badge: String(incidentCounts.community ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=merged', icon: '\u2295', text: 'Merged Incidents', badge: String(incidentCounts.merged ?? 0), badgeType: '' },
        { to: '/admin/incidents?filter=archived', icon: '\u25AA', text: 'Archived', badge: String(incidentCounts.archived ?? 0), badgeType: '' },
      ],
    },
    {
      label: 'Alert Operations',
      links: [
        { to: '/admin/alerts', icon: '\u25B2', text: 'Active Alerts', badge: String(alertCounts.active ?? 0), badgeType: '' },
        { to: '/admin/alerts?tab=scheduled', icon: '\u25F7', text: 'Scheduled Alerts', badge: String(alertCounts.scheduled ?? 0), badgeType: 'info' },
        { to: '/admin/alerts?tab=expired', icon: '\u25D4', text: 'Expiring / Expired', badge: String(alertCounts.expired ?? 0), badgeType: '' },
        { to: '/admin/alerts?tab=emergency', icon: '\u25C6', text: 'Emergency Broadcast', badge: String(alertCounts.emergency ?? 0), badgeType: 'warning' },
        { to: '/admin/alerts?tab=templates', icon: '\u25E7', text: 'Alert Templates', badge: String(alertCounts.templates ?? 0), badgeType: 'info' },
      ],
    },
    {
      label: 'Risk & Zones',
      links: [
        { to: '/admin/zones', icon: '\u25C8', text: 'Risk Heatmap' },
        { to: '/admin/zones?tab=thresholds', icon: '\u25AC', text: 'Zone Thresholds' },
        { to: '/admin/zones?tab=table', icon: '\u270E', text: 'Zone Management' },
        { to: '/admin/zones?tab=ranking', icon: '\u25BD', text: 'Wilaya Risk Ranking' },
      ],
    },
    {
      label: 'AI & Model Supervision',
      links: [
        { to: '/admin/ai', icon: '\u25C7', text: 'Accuracy Trends' },
        { to: '/admin/ai?tab=confidence', icon: '\u25AD', text: 'Confidence Distribution' },
        { to: '/admin/ai?tab=confusion', icon: '\u2715', text: 'Confusion Matrix' },
        { to: '/admin/ai?tab=overrides', icon: '\u21B9', text: 'Override Logs' },
      ],
    },
    {
      label: 'User Governance',
      links: [
        { to: '/admin/users', icon: '\u25CE', text: 'All Users', badge: '2', badgeType: 'info' },
        { to: '/admin/users?filter=at-risk', icon: '\u26A0', text: 'At Risk Users' },
        { to: '/admin/users?filter=trusted', icon: '\u2605', text: 'Top Contributors' },
        { to: '/admin/users?filter=suspended', icon: '\u2298', text: 'Suspensions' },
      ],
    },
    {
      label: 'Data & Analytics',
      links: [
        { to: '/admin/analytics', icon: '\u25EB', text: 'Analytics Dashboard' },
      ],
    },
    {
      label: 'System',
      links: [
        { to: '/admin/system', icon: '\u2699', text: 'Configuration' },
      ],
    },
  ]
}

export default function AdminSidebar() {
  const location = useLocation()
  const [incidentCounts, setIncidentCounts] = useState({
    pending: 0,
    'ai-flagged': 0,
    community: 0,
    merged: 0,
    archived: 0,
  })
  const [alertCounts, setAlertCounts] = useState({
    all: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    emergency: 0,
    templates: 0,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadCounts() {
      const [incidentResult, alertResult] = await Promise.allSettled([
        fetchAdminIncidentCounts({
          signal: controller.signal,
        }),
        fetchAdminOperationalAlertCounts({
          signal: controller.signal,
        }),
      ])

      if (controller.signal.aborted) {
        return
      }

      if (incidentResult.status === 'fulfilled') {
        setIncidentCounts(incidentResult.value)
      }

      if (alertResult.status === 'fulfilled') {
        setAlertCounts(alertResult.value)
      }
    }

    loadCounts().catch(() => {
      // Keep the shell usable even if counts fail to load.
    })

    return () => controller.abort()
  }, [])

  const sections = buildSections(incidentCounts, alertCounts)

  const isLinkActive = (to) => {
    const [path, search] = to.split('?')
    if (path !== location.pathname) return false
    if (search) return location.search === `?${search}`
    return !location.search
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <img src={siaraLogo} alt="SIARA" />
        <div className="admin-sidebar-brand-text">
          <span className="brand-name">SIARA</span>
          <span className="brand-sub">Supervision Centre</span>
        </div>
      </div>

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
                {link.badge != null && (
                  <span className={`nav-badge ${link.badgeType || ''}`}>{link.badge}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

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
