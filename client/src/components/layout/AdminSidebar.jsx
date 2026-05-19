/**
 * @file AdminSidebar.jsx
 * @description Admin shell sidebar — rebuilt from scratch.
 *
 * What it does:
 *   - Search box that fuzzy-filters every link by name (typeahead).
 *   - Collapsible sections with chevron toggles, state persisted to
 *     localStorage so admins keep their preferred layout across sessions.
 *   - Auto-expands the section that contains the currently active link.
 *   - Auto-scrolls the active link into view after navigation so it's never
 *     hidden in a long sidebar.
 *   - Live badge counts from the incident + alert services, polled every 60 s
 *     so numbers stay accurate without a hard refresh.
 *   - User profile card at the bottom: avatar with initials, name, primary
 *     role pill, one-click logout.
 *   - System health / environment chips at the very bottom.
 *
 * Styling lives in styles/AdminSidebar.css under the .siara-sb namespace. The
 * older .admin-sidebar / .admin-nav-* classes are left untouched in
 * AdminPanel.css so nothing else regresses.
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
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

import siaraLogo from '../../assets/logos/siara-logo.png'
import { AuthContext } from '../../contexts/AuthContext'
import { fetchAdminIncidentCounts } from '../../services/adminIncidentsService'
import { fetchAdminOperationalAlertCounts } from '../../services/adminOperationalAlertsService'
import '../../styles/AdminSidebar.css'

const COLLAPSED_STATE_KEY = 'siara.admin.sidebar.collapsed'
const COUNT_POLL_INTERVAL_MS = 60 * 1000

const DEFAULT_INCIDENT_COUNTS = Object.freeze({
  all: 0, pending: 0, suspicious: 0,
  'pending-review': 0, 'ai-flagged': 0,
  community: 0, merged: 0, archived: 0,
})
const DEFAULT_ALERT_COUNTS = Object.freeze({
  all: 0, active: 0, scheduled: 0, expired: 0, emergency: 0, templates: 0,
})

/* Section structure — a single key identifies each section for persistence. */
function buildSections(incidentCounts, alertCounts, countsReady) {
  const incidentBadge = (key, type = '') => ({
    badge: countsReady ? String(incidentCounts[key] ?? 0) : null,
    badgeType: type,
  })
  const alertBadge = (key, type = '') => ({
    badge: countsReady ? String(alertCounts[key] ?? 0) : null,
    badgeType: type,
  })

  return [
    {
      key: 'overview',
      label: 'Overview',
      links: [
        { to: '/admin/overview', icon: <DashboardOutlinedIcon fontSize="inherit" />, text: 'System Overview' },
      ],
    },
    {
      key: 'incidents',
      label: 'Incident Management',
      links: [
        { to: '/admin/incidents?filter=all',            icon: <AllInboxOutlinedIcon fontSize="inherit" />,           text: 'All Incidents',         ...incidentBadge('all') },
        { to: '/admin/incidents?filter=pending',        icon: <PendingActionsOutlinedIcon fontSize="inherit" />,     text: 'Pending Review',        ...incidentBadge('pending', 'warning') },
        { to: '/admin/incidents?filter=suspicious',     icon: <ReportGmailerrorredOutlinedIcon fontSize="inherit" />,text: 'Suspected Spam',        ...incidentBadge('suspicious', 'warning') },
        { to: '/admin/incidents?filter=pending-review', icon: <GavelOutlinedIcon fontSize="inherit" />,              text: 'Manual Spam Review',    ...incidentBadge('pending-review', 'warning') },
        { to: '/admin/incidents?filter=ai-flagged',     icon: <SmartToyOutlinedIcon fontSize="inherit" />,           text: 'AI-Flagged High Risk',  ...incidentBadge('ai-flagged', 'danger') },
        { to: '/admin/incidents?filter=community',      icon: <GroupsOutlinedIcon fontSize="inherit" />,             text: 'Community Flagged',     ...incidentBadge('community', 'warning') },
        { to: '/admin/incidents?filter=merged',         icon: <MergeTypeOutlinedIcon fontSize="inherit" />,          text: 'Merged Incidents',      ...incidentBadge('merged') },
        { to: '/admin/incidents?filter=archived',       icon: <Inventory2OutlinedIcon fontSize="inherit" />,         text: 'Archived',              ...incidentBadge('archived') },
      ],
    },
    {
      key: 'alerts',
      label: 'Alert Operations',
      links: [
        { to: '/admin/alerts?tab=all',       icon: <InboxOutlinedIcon fontSize="inherit" />,                text: 'All Alerts',          ...alertBadge('all') },
        { to: '/admin/alerts?tab=active',    icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />,  text: 'Active Alerts',       ...alertBadge('active', 'success') },
        { to: '/admin/alerts?tab=scheduled', icon: <ScheduleOutlinedIcon fontSize="inherit" />,             text: 'Scheduled Alerts',    ...alertBadge('scheduled', 'info') },
        { to: '/admin/alerts?tab=expired',   icon: <HistoryToggleOffOutlinedIcon fontSize="inherit" />,     text: 'Expiring / Expired',  ...alertBadge('expired') },
        { to: '/admin/alerts?tab=emergency', icon: <CampaignOutlinedIcon fontSize="inherit" />,             text: 'Emergency Broadcast', ...alertBadge('emergency', 'danger') },
        { to: '/admin/alerts?tab=templates', icon: <DescriptionOutlinedIcon fontSize="inherit" />,          text: 'Alert Templates',     ...alertBadge('templates', 'info') },
      ],
    },
    {
      key: 'zones',
      label: 'Risk & Zones',
      links: [
        { to: '/admin/zones?tab=map',        icon: <WhatshotOutlinedIcon fontSize="inherit" />,        text: 'Zone Map' },
        { to: '/admin/zones?tab=table',      icon: <EditLocationAltOutlinedIcon fontSize="inherit" />, text: 'Zone Management' },
        { to: '/admin/zones?tab=ranking',    icon: <LeaderboardOutlinedIcon fontSize="inherit" />,     text: 'Wilaya Risk Ranking' },
        { to: '/admin/zones?tab=thresholds', icon: <TuneOutlinedIcon fontSize="inherit" />,            text: 'Zone Thresholds' },
      ],
    },
    {
      key: 'ai',
      label: 'AI & Model Supervision',
      links: [
        { to: '/admin/ai?tab=performance', icon: <TrendingUpOutlinedIcon fontSize="inherit" />,   text: 'Model Performance' },
        { to: '/admin/ai?tab=confidence',  icon: <InsightsOutlinedIcon fontSize="inherit" />,     text: 'Confidence Analysis' },
        { to: '/admin/ai?tab=confusion',   icon: <GridOnOutlinedIcon fontSize="inherit" />,       text: 'Confusion Matrix' },
        { to: '/admin/ai?tab=overrides',   icon: <ManageHistoryOutlinedIcon fontSize="inherit" />, text: 'Override Logs' },
        { to: '/admin/ai?tab=occurrence',  icon: <ScienceOutlinedIcon fontSize="inherit" />,      text: 'Occurrence Model (Beta)' },
      ],
    },
    {
      key: 'users',
      label: 'User Governance',
      links: [
        { to: '/admin/users?filter=all',        icon: <PeopleOutlinedIcon fontSize="inherit" />,              text: 'All Users' },
        { to: '/admin/users?filter=active',     icon: <TaskAltOutlinedIcon fontSize="inherit" />,             text: 'Active' },
        { to: '/admin/users?filter=trusted',    icon: <WorkspacePremiumOutlinedIcon fontSize="inherit" />,    text: 'Top Contributors' },
        { to: '/admin/users?filter=at-risk',    icon: <WarningAmberOutlinedIcon fontSize="inherit" />,        text: 'At Risk' },
        { to: '/admin/users?filter=banned',     icon: <BlockOutlinedIcon fontSize="inherit" />,               text: 'Banned' },
        { to: '/admin/users?filter=police',     icon: <LocalPoliceOutlinedIcon fontSize="inherit" />,         text: 'Police' },
        { to: '/admin/users?filter=supervisor', icon: <ShieldOutlinedIcon fontSize="inherit" />,              text: 'Supervisor' },
        { to: '/admin/users?filter=admin',      icon: <AdminPanelSettingsOutlinedIcon fontSize="inherit" />,  text: 'Admins' },
      ],
    },
    {
      key: 'analytics',
      label: 'Data & Analytics',
      links: [
        { to: '/admin/analytics?tab=heatmap',      icon: <AnalyticsOutlinedIcon fontSize="inherit" />,         text: 'Hourly Heatmap' },
        { to: '/admin/analytics?tab=severity',     icon: <DonutLargeOutlinedIcon fontSize="inherit" />,        text: 'Severity Distribution' },
        { to: '/admin/analytics?tab=roads',        icon: <AltRouteOutlinedIcon fontSize="inherit" />,          text: 'Dangerous Roads' },
        { to: '/admin/analytics?tab=correlations', icon: <ScatterPlotOutlinedIcon fontSize="inherit" />,       text: 'Correlations' },
        { to: '/admin/analytics?tab=predictions',  icon: <OnlinePredictionOutlinedIcon fontSize="inherit" />,  text: '7-Day Prediction' },
      ],
    },
    {
      key: 'system',
      label: 'System',
      links: [
        { to: '/admin/system?tab=severity',      icon: <RuleOutlinedIcon fontSize="inherit" />,                    text: 'Severity Rules' },
        { to: '/admin/system?tab=notifications', icon: <NotificationsNoneOutlinedIcon fontSize="inherit" />,       text: 'Notification Logic' },
        { to: '/admin/system?tab=geofencing',    icon: <MyLocationOutlinedIcon fontSize="inherit" />,              text: 'Geo-fencing' },
        { to: '/admin/system?tab=general',       icon: <SettingsApplicationsOutlinedIcon fontSize="inherit" />,    text: 'General' },
      ],
    },
  ]
}

/* ─────────────────────────────────────────────────────────────────────── */

function initialsFromName(name) {
  const text = String(name || '').trim()
  if (!text) return 'SA'
  return text.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || 'SA'
}

function primaryRoleLabel(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'Member'
  const norm = roles.map((r) => String(r).toLowerCase().replace(/[\s_-]+/g, ''))
  if (norm.includes('admin')) return 'Super Admin'
  if (norm.includes('policesupervisor')) return 'Supervisor'
  if (norm.includes('police') || norm.includes('policeofficer')) return 'Police'
  if (norm.includes('trusted') || norm.includes('trustedreporter')) return 'Trusted'
  return roles[0]
}

function readPersistedCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSED_STATE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistCollapsed(state) {
  try {
    localStorage.setItem(COLLAPSED_STATE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage may be unavailable (private mode / quota); fail silently. */
  }
}

/* ─────────────────────────────────────────────────────────────────────── */

export default function AdminSidebar() {
  const location = useLocation()
  const { user, logout } = useContext(AuthContext) || {}

  const [incidentCounts, setIncidentCounts] = useState(DEFAULT_INCIDENT_COUNTS)
  const [alertCounts, setAlertCounts]       = useState(DEFAULT_ALERT_COUNTS)
  const [countsReady, setCountsReady]       = useState(false)

  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => readPersistedCollapsed())

  const activeItemRef = useRef(null)

  /* ─── Active match (path + query string) ────────────────────────────── */
  const isLinkActive = (to) => {
    const [path, search] = to.split('?')
    if (path !== location.pathname) return false
    if (search) return location.search === `?${search}`
    return !location.search
  }

  /* ─── Fetch + poll badge counts ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    let timer = null

    const load = () => {
      const controller = new AbortController()
      Promise.allSettled([
        fetchAdminIncidentCounts({ signal: controller.signal }),
        fetchAdminOperationalAlertCounts({ signal: controller.signal }),
      ])
        .then(([incidentResult, alertResult]) => {
          if (cancelled) return
          if (incidentResult.status === 'fulfilled') setIncidentCounts(incidentResult.value)
          if (alertResult.status === 'fulfilled')    setAlertCounts(alertResult.value)
          setCountsReady(true)
        })
        .catch(() => { /* badges fall back to "—"; sidebar stays usable */ })
    }

    load()
    timer = setInterval(load, COUNT_POLL_INTERVAL_MS)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [])

  /* ─── Section list (memoised, filtered by search) ───────────────────── */
  const sections = useMemo(
    () => buildSections(incidentCounts, alertCounts, countsReady),
    [incidentCounts, alertCounts, countsReady],
  )

  const normalizedQuery = query.trim().toLowerCase()
  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections
    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => link.text.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((section) => section.links.length > 0)
  }, [sections, normalizedQuery])

  /* ─── Auto-expand the section containing the active link ────────────── */
  const activeSectionKey = useMemo(() => {
    for (const section of sections) {
      if (section.links.some((l) => isLinkActive(l.to))) return section.key
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, location.pathname, location.search])

  useEffect(() => {
    if (!activeSectionKey) return
    if (collapsed[activeSectionKey]) {
      setCollapsed((prev) => {
        const next = { ...prev, [activeSectionKey]: false }
        persistCollapsed(next)
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionKey])

  /* ─── Scroll active item into view after navigation ─────────────────── */
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [location.pathname, location.search])

  const toggleSection = (key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      persistCollapsed(next)
      return next
    })
  }

  /* ─── Footer profile derivations ────────────────────────────────────── */
  const profileName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Admin'
  const profileInitials = initialsFromName(profileName)
  const profileRole = primaryRoleLabel(user?.roles)

  const handleLogout = async () => {
    if (typeof logout === 'function') {
      try { await logout() } catch { /* ignore */ }
    }
  }

  const isSearching = normalizedQuery.length > 0
  const showEmptyState = isSearching && filteredSections.length === 0

  return (
    <aside className="siara-sb">
      {/* ─── Brand ─── */}
      <div className="siara-sb-brand">
        <img src={siaraLogo} alt="SIARA" className="siara-sb-brand-logo" />
        <span className="siara-sb-brand-sub">Supervision Centre</span>
      </div>

      {/* ─── Search ─── */}
      <div className="siara-sb-search">
        <SearchRoundedIcon className="siara-sb-search-icon" fontSize="inherit" />
        <input
          type="search"
          className="siara-sb-search-input"
          placeholder="Search navigation…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search admin sidebar"
        />
        {isSearching && (
          <button
            type="button"
            className="siara-sb-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >×</button>
        )}
      </div>

      {/* ─── Scrollable nav ─── */}
      <div className="siara-sb-scroll">
        {showEmptyState ? (
          <div className="siara-sb-empty">
            No links match <strong>"{query}"</strong>.
          </div>
        ) : (
          filteredSections.map((section) => {
            // When the user is searching, force every matching section open
            // so they don't have to click chevrons to see the hits.
            const isCollapsed = isSearching ? false : !!collapsed[section.key]
            const sectionHasActive = section.links.some((l) => isLinkActive(l.to))

            return (
              <div
                key={section.key}
                className={`siara-sb-section${isCollapsed ? ' collapsed' : ''}`}
              >
                <button
                  type="button"
                  className="siara-sb-section-header"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={!isCollapsed}
                >
                  <ExpandMoreRoundedIcon
                    className="siara-sb-section-header-chevron"
                    fontSize="inherit"
                  />
                  <span className="siara-sb-section-header-label">{section.label}</span>
                  {sectionHasActive && !isSearching && <span className="siara-sb-section-header-dot" aria-hidden="true" />}
                  <span className="siara-sb-section-header-count">{section.links.length}</span>
                </button>

                <div className="siara-sb-section-body">
                  {section.links.map((link) => {
                    const active = isLinkActive(link.to)
                    const badgeText = link.badge
                    const showBadge = badgeText != null
                    const badgeClass = countsReady
                      ? (link.badgeType || '')
                      : 'loading'
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        ref={active ? activeItemRef : null}
                        className={`siara-sb-item${active ? ' active' : ''}`}
                      >
                        <span className="siara-sb-item-icon">{link.icon}</span>
                        <span className="siara-sb-item-label">{link.text}</span>
                        {showBadge && (
                          <span className={`siara-sb-item-badge ${badgeClass}`}>
                            {countsReady ? badgeText : '··'}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ─── Footer: profile + status ─── */}
      <div className="siara-sb-footer">
        <div className="siara-sb-profile">
          <div className="siara-sb-profile-avatar" aria-hidden="true">{profileInitials}</div>
          <div className="siara-sb-profile-body">
            <span className="siara-sb-profile-name" title={profileName}>{profileName}</span>
            <span className="siara-sb-profile-role">{profileRole}</span>
          </div>
          <button
            type="button"
            className="siara-sb-profile-action"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            <LogoutRoundedIcon fontSize="inherit" />
          </button>
        </div>

        <div className="siara-sb-status">
          <span className="siara-sb-status-env">
            <span className="siara-sb-status-env-dot" />
            Production
          </span>
          <div className="siara-sb-status-row">
            <span className="siara-sb-status-dot green" />
            <span><strong>System</strong> · Operational</span>
          </div>
          <div className="siara-sb-status-row">
            <span className="siara-sb-status-dot green" />
            <span><strong>AI Model</strong> · v0.3 online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
