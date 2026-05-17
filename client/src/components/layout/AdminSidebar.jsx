import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import AllInboxOutlinedIcon from '@mui/icons-material/AllInboxOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined'
import AltRouteOutlinedIcon from '@mui/icons-material/AltRouteOutlined'
import ScatterPlotOutlinedIcon from '@mui/icons-material/ScatterPlotOutlined'
import OnlinePredictionOutlinedIcon from '@mui/icons-material/OnlinePredictionOutlined'
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import SettingsApplicationsOutlinedIcon from '@mui/icons-material/SettingsApplicationsOutlined'
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined'
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import HistoryToggleOffOutlinedIcon from '@mui/icons-material/HistoryToggleOffOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import WhatshotOutlinedIcon from '@mui/icons-material/WhatshotOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import EditLocationAltOutlinedIcon from '@mui/icons-material/EditLocationAltOutlined'
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined'
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import ManageHistoryOutlinedIcon from '@mui/icons-material/ManageHistoryOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined'
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'

import siaraLogo from '../../assets/logos/siara-logo.png'
import { fetchAdminIncidentCounts } from '../../services/adminIncidentsService'
import { fetchAdminOperationalAlertCounts } from '../../services/adminOperationalAlertsService'

function buildSections(incidentCounts, alertCounts) {
  return [
    {
      label: 'Overview',
      links: [
        { to: '/admin/overview', icon: <DashboardOutlinedIcon fontSize="inherit" />, text: 'System Overview', badge: null },
      ],
    },
    {
      label: 'Incident Management',
      links: [
        { to: '/admin/incidents?filter=all', icon: <AllInboxOutlinedIcon fontSize="inherit" />, text: 'All Incidents', badge: String(incidentCounts.all ?? 0), badgeType: '' },
        { to: '/admin/incidents?filter=pending', icon: <PendingActionsOutlinedIcon fontSize="inherit" />, text: 'Pending Review', badge: String(incidentCounts.pending ?? 0), badgeType: '' },
        { to: '/admin/incidents?filter=suspicious', icon: <ReportGmailerrorredOutlinedIcon fontSize="inherit" />, text: 'Suspected Spam', badge: String(incidentCounts.suspicious ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=pending-review', icon: <GavelOutlinedIcon fontSize="inherit" />, text: 'Manual Spam Review', badge: String(incidentCounts['pending-review'] ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=ai-flagged', icon: <SmartToyOutlinedIcon fontSize="inherit" />, text: 'AI-Flagged High Risk', badge: String(incidentCounts['ai-flagged'] ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=community', icon: <GroupsOutlinedIcon fontSize="inherit" />, text: 'Community Flagged', badge: String(incidentCounts.community ?? 0), badgeType: 'warning' },
        { to: '/admin/incidents?filter=merged', icon: <MergeTypeOutlinedIcon fontSize="inherit" />, text: 'Merged Incidents', badge: String(incidentCounts.merged ?? 0), badgeType: '' },
        { to: '/admin/incidents?filter=archived', icon: <Inventory2OutlinedIcon fontSize="inherit" />, text: 'Archived', badge: String(incidentCounts.archived ?? 0), badgeType: '' },
      ],
    },
    {
      label: 'Alert Operations',
      links: [
        { to: '/admin/alerts?tab=all', icon: <InboxOutlinedIcon fontSize="inherit" />, text: 'All Alerts', badge: String(alertCounts.all ?? 0), badgeType: '' },
        { to: '/admin/alerts?tab=active', icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />, text: 'Active Alerts', badge: String(alertCounts.active ?? 0), badgeType: '' },
        { to: '/admin/alerts?tab=scheduled', icon: <ScheduleOutlinedIcon fontSize="inherit" />, text: 'Scheduled Alerts', badge: String(alertCounts.scheduled ?? 0), badgeType: 'info' },
        { to: '/admin/alerts?tab=expired', icon: <HistoryToggleOffOutlinedIcon fontSize="inherit" />, text: 'Expiring / Expired', badge: String(alertCounts.expired ?? 0), badgeType: '' },
        { to: '/admin/alerts?tab=emergency', icon: <CampaignOutlinedIcon fontSize="inherit" />, text: 'Emergency Broadcast', badge: String(alertCounts.emergency ?? 0), badgeType: 'warning' },
        { to: '/admin/alerts?tab=templates', icon: <DescriptionOutlinedIcon fontSize="inherit" />, text: 'Alert Templates', badge: String(alertCounts.templates ?? 0), badgeType: 'info' },
      ],
    },
    {
      label: 'Risk & Zones',
      links: [
        { to: '/admin/zones', icon: <WhatshotOutlinedIcon fontSize="inherit" />, text: 'Risk Heatmap' },
        { to: '/admin/zones?tab=thresholds', icon: <TuneOutlinedIcon fontSize="inherit" />, text: 'Zone Thresholds' },
        { to: '/admin/zones?tab=table', icon: <EditLocationAltOutlinedIcon fontSize="inherit" />, text: 'Zone Management' },
        { to: '/admin/zones?tab=ranking', icon: <LeaderboardOutlinedIcon fontSize="inherit" />, text: 'Wilaya Risk Ranking' },
      ],
    },
    {
      label: 'AI & Model Supervision',
      links: [
        { to: '/admin/ai?tab=performance', icon: <TrendingUpOutlinedIcon fontSize="inherit" />, text: 'Model Performance' },
        { to: '/admin/ai?tab=confidence', icon: <InsightsOutlinedIcon fontSize="inherit" />, text: 'Confidence Distribution' },
        { to: '/admin/ai?tab=confusion', icon: <GridOnOutlinedIcon fontSize="inherit" />, text: 'Confusion Matrix' },
        { to: '/admin/ai?tab=overrides', icon: <ManageHistoryOutlinedIcon fontSize="inherit" />, text: 'Override Logs' },
        { to: '/admin/ai?tab=occurrence', icon: <ScienceOutlinedIcon fontSize="inherit" />, text: 'Occurrence Model (Beta)' },
      ],
    },
    {
      label: 'User Governance',
      links: [
        { to: '/admin/users?filter=all', icon: <PeopleOutlinedIcon fontSize="inherit" />, text: 'All Users' },
        { to: '/admin/users?filter=active', icon: <TaskAltOutlinedIcon fontSize="inherit" />, text: 'Active' },
        { to: '/admin/users?filter=trusted', icon: <WorkspacePremiumOutlinedIcon fontSize="inherit" />, text: 'Top Contributors' },
        { to: '/admin/users?filter=at-risk', icon: <WarningAmberOutlinedIcon fontSize="inherit" />, text: 'At Risk' },
        { to: '/admin/users?filter=banned', icon: <BlockOutlinedIcon fontSize="inherit" />, text: 'Banned' },
        { to: '/admin/users?filter=police', icon: <LocalPoliceOutlinedIcon fontSize="inherit" />, text: 'Police' },
        { to: '/admin/users?filter=supervisor', icon: <ShieldOutlinedIcon fontSize="inherit" />, text: 'Supervisor' },
        { to: '/admin/users?filter=admin', icon: <AdminPanelSettingsOutlinedIcon fontSize="inherit" />, text: 'Admins' },
      ],
    },
    {
      label: 'Data & Analytics',
      links: [
        { to: '/admin/analytics?tab=heatmap', icon: <AnalyticsOutlinedIcon fontSize="inherit" />, text: 'Hourly Heatmap' },
        { to: '/admin/analytics?tab=severity', icon: <DonutLargeOutlinedIcon fontSize="inherit" />, text: 'Severity Distribution' },
        { to: '/admin/analytics?tab=roads', icon: <AltRouteOutlinedIcon fontSize="inherit" />, text: 'Dangerous Roads' },
        { to: '/admin/analytics?tab=correlations', icon: <ScatterPlotOutlinedIcon fontSize="inherit" />, text: 'Correlations' },
        { to: '/admin/analytics?tab=predictions', icon: <OnlinePredictionOutlinedIcon fontSize="inherit" />, text: '7-Day Prediction' },
      ],
    },
    {
      label: 'System',
      links: [
        { to: '/admin/system?tab=severity', icon: <RuleOutlinedIcon fontSize="inherit" />, text: 'Severity Rules' },
        { to: '/admin/system?tab=notifications', icon: <NotificationsNoneOutlinedIcon fontSize="inherit" />, text: 'Notification Logic' },
        { to: '/admin/system?tab=geofencing', icon: <MyLocationOutlinedIcon fontSize="inherit" />, text: 'Geo-fencing' },
        { to: '/admin/system?tab=general', icon: <SettingsApplicationsOutlinedIcon fontSize="inherit" />, text: 'General' },
      ],
    },
  ]
}

export default function AdminSidebar() {
  const location = useLocation()
  const [incidentCounts, setIncidentCounts] = useState({
    all: 0,
    pending: 0,
    suspicious: 0,
    'pending-review': 0,
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
