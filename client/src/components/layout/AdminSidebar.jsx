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
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import AllInboxOutlinedIcon from '@mui/icons-material/AllInboxOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import MarkunreadMailboxOutlinedIcon from '@mui/icons-material/MarkunreadMailboxOutlined'
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
function buildSections(incidentCounts, alertCounts, countsReady, t) {
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
      label: t('adminSidebar.sections.overview'),
      links: [
        { to: '/admin/overview', icon: <DashboardOutlinedIcon fontSize="inherit" />, text: t('adminSidebar.links.systemOverview') },
      ],
    },
    {
      key: 'incidents',
      label: t('adminSidebar.sections.incidents'),
      links: [
        { to: '/admin/incidents?filter=all',            icon: <AllInboxOutlinedIcon fontSize="inherit" />,           text: t('adminSidebar.links.allIncidents'),        ...incidentBadge('all') },
        { to: '/admin/incidents?filter=pending',        icon: <PendingActionsOutlinedIcon fontSize="inherit" />,     text: t('adminSidebar.links.pendingReview'),       ...incidentBadge('pending', 'warning') },
        { to: '/admin/incidents?filter=suspicious',     icon: <ReportGmailerrorredOutlinedIcon fontSize="inherit" />,text: t('adminSidebar.links.suspectedSpam'),       ...incidentBadge('suspicious', 'warning') },
        { to: '/admin/incidents?filter=pending-review', icon: <GavelOutlinedIcon fontSize="inherit" />,              text: t('adminSidebar.links.manualSpamReview'),    ...incidentBadge('pending-review', 'warning') },
        { to: '/admin/incidents?filter=ai-flagged',     icon: <SmartToyOutlinedIcon fontSize="inherit" />,           text: t('adminSidebar.links.aiFlaggedHighRisk'),   ...incidentBadge('ai-flagged', 'danger') },
        { to: '/admin/incidents?filter=community',      icon: <GroupsOutlinedIcon fontSize="inherit" />,             text: t('adminSidebar.links.communityFlagged'),    ...incidentBadge('community', 'warning') },
        { to: '/admin/incidents?filter=merged',         icon: <MergeTypeOutlinedIcon fontSize="inherit" />,          text: t('adminSidebar.links.mergedIncidents'),     ...incidentBadge('merged') },
        { to: '/admin/incidents?filter=archived',       icon: <Inventory2OutlinedIcon fontSize="inherit" />,         text: t('adminSidebar.links.archived'),            ...incidentBadge('archived') },
      ],
    },
    {
      key: 'alerts',
      label: t('adminSidebar.sections.alerts'),
      links: [
        { to: '/admin/alerts?tab=all',       icon: <InboxOutlinedIcon fontSize="inherit" />,                text: t('adminSidebar.links.allAlerts'),         ...alertBadge('all') },
        { to: '/admin/alerts?tab=active',    icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />,  text: t('adminSidebar.links.activeAlerts'),      ...alertBadge('active', 'success') },
        { to: '/admin/alerts?tab=scheduled', icon: <ScheduleOutlinedIcon fontSize="inherit" />,             text: t('adminSidebar.links.scheduledAlerts'),   ...alertBadge('scheduled', 'info') },
        { to: '/admin/alerts?tab=expired',   icon: <HistoryToggleOffOutlinedIcon fontSize="inherit" />,     text: t('adminSidebar.links.expiringExpired'),   ...alertBadge('expired') },
        { to: '/admin/alerts?tab=emergency', icon: <CampaignOutlinedIcon fontSize="inherit" />,             text: t('adminSidebar.links.emergencyBroadcast'),...alertBadge('emergency', 'danger') },
        { to: '/admin/alerts?tab=templates', icon: <DescriptionOutlinedIcon fontSize="inherit" />,          text: t('adminSidebar.links.alertTemplates'),    ...alertBadge('templates', 'info') },
      ],
    },
    {
      key: 'zones',
      label: t('adminSidebar.sections.zones'),
      links: [
        { to: '/admin/zones?tab=map',        icon: <WhatshotOutlinedIcon fontSize="inherit" />,        text: t('adminSidebar.links.zoneMap') },
        { to: '/admin/zones?tab=table',      icon: <EditLocationAltOutlinedIcon fontSize="inherit" />, text: t('adminSidebar.links.zoneManagement') },
        { to: '/admin/zones?tab=ranking',    icon: <LeaderboardOutlinedIcon fontSize="inherit" />,     text: t('adminSidebar.links.wilayaRiskRanking') },
        { to: '/admin/zones?tab=thresholds', icon: <TuneOutlinedIcon fontSize="inherit" />,            text: t('adminSidebar.links.zoneThresholds') },
      ],
    },
    {
      key: 'ai',
      label: t('adminSidebar.sections.ai'),
      links: [
        { to: '/admin/ai?tab=performance', icon: <TrendingUpOutlinedIcon fontSize="inherit" />,   text: t('adminSidebar.links.modelPerformance') },
        { to: '/admin/ai?tab=confidence',  icon: <InsightsOutlinedIcon fontSize="inherit" />,     text: t('adminSidebar.links.confidenceAnalysis') },
        { to: '/admin/ai?tab=confusion',   icon: <GridOnOutlinedIcon fontSize="inherit" />,       text: t('adminSidebar.links.confusionMatrix') },
        { to: '/admin/ai?tab=overrides',   icon: <ManageHistoryOutlinedIcon fontSize="inherit" />, text: t('adminSidebar.links.overrideLogs') },
        { to: '/admin/ai?tab=occurrence',  icon: <ScienceOutlinedIcon fontSize="inherit" />,      text: t('adminSidebar.links.occurrenceModelBeta') },
      ],
    },
    {
      key: 'users',
      label: t('adminSidebar.sections.users'),
      links: [
        { to: '/admin/users?filter=all',        icon: <PeopleOutlinedIcon fontSize="inherit" />,              text: t('adminSidebar.links.allUsers') },
        { to: '/admin/users?filter=active',     icon: <TaskAltOutlinedIcon fontSize="inherit" />,             text: t('adminSidebar.links.activeUsers') },
        { to: '/admin/users?filter=trusted',    icon: <WorkspacePremiumOutlinedIcon fontSize="inherit" />,    text: t('adminSidebar.links.topContributors') },
        { to: '/admin/users?filter=at-risk',    icon: <WarningAmberOutlinedIcon fontSize="inherit" />,        text: t('adminSidebar.links.atRisk') },
        { to: '/admin/users?filter=banned',     icon: <BlockOutlinedIcon fontSize="inherit" />,               text: t('adminSidebar.links.banned') },
        { to: '/admin/users?filter=police',     icon: <LocalPoliceOutlinedIcon fontSize="inherit" />,         text: t('common:nav.police') },
        { to: '/admin/users?filter=supervisor', icon: <ShieldOutlinedIcon fontSize="inherit" />,              text: t('common:nav.supervisor') },
        { to: '/admin/users?filter=admin',      icon: <AdminPanelSettingsOutlinedIcon fontSize="inherit" />,  text: t('adminSidebar.links.admins') },
      ],
    },
    {
      key: 'analytics',
      label: t('adminSidebar.sections.analytics'),
      links: [
        { to: '/admin/analytics?tab=heatmap',      icon: <AnalyticsOutlinedIcon fontSize="inherit" />,         text: t('adminSidebar.links.hourlyHeatmap') },
        { to: '/admin/analytics?tab=severity',     icon: <DonutLargeOutlinedIcon fontSize="inherit" />,        text: t('adminSidebar.links.severityDistribution') },
        { to: '/admin/analytics?tab=roads',        icon: <AltRouteOutlinedIcon fontSize="inherit" />,          text: t('adminSidebar.links.dangerousRoads') },
        { to: '/admin/analytics?tab=correlations', icon: <ScatterPlotOutlinedIcon fontSize="inherit" />,       text: t('adminSidebar.links.correlations') },
        { to: '/admin/analytics?tab=predictions',  icon: <OnlinePredictionOutlinedIcon fontSize="inherit" />,  text: t('adminSidebar.links.sevenDayPrediction') },
      ],
    },
    {
      key: 'inbox',
      label: t('adminSidebar.sections.inbox'),
      links: [
        { to: '/admin/inbox',              icon: <MarkunreadMailboxOutlinedIcon fontSize="inherit" />, text: t('adminSidebar.links.allInbox') },
        { to: '/admin/inbox?show=support', icon: <InboxOutlinedIcon fontSize="inherit" />,            text: t('adminSidebar.links.contactMessages') },
        { to: '/admin/inbox?show=info',    icon: <AllInboxOutlinedIcon fontSize="inherit" />,         text: t('adminSidebar.links.infoRequestReplies') },
      ],
    },
    {
      key: 'system',
      label: t('adminSidebar.sections.system'),
      links: [
        { to: '/admin/system?tab=severity',      icon: <RuleOutlinedIcon fontSize="inherit" />,                    text: t('adminSidebar.links.severityRules') },
        { to: '/admin/system?tab=notifications', icon: <NotificationsNoneOutlinedIcon fontSize="inherit" />,       text: t('adminSidebar.links.notificationLogic') },
        { to: '/admin/system?tab=geofencing',    icon: <MyLocationOutlinedIcon fontSize="inherit" />,              text: t('adminSidebar.links.geofencing') },
        { to: '/admin/system?tab=general',       icon: <SettingsApplicationsOutlinedIcon fontSize="inherit" />,    text: t('adminSidebar.links.general') },
      ],
    },
  ]
}

/* ─────────────────────────────────────────────────────────────────────── */

/**
 * Score how well a sidebar link's target matches the current location.
 * Returns -1 when the link is not a candidate at all, otherwise a higher
 * score means a better match. The caller highlights the single best-scoring
 * link, so exactly one item lights up — even on:
 *   - landing paths with no query    (/admin/incidents → "All Incidents")
 *   - detail sub-routes              (/admin/incidents/123 → its list link)
 *   - URLs with extra / reordered query params
 * which the old exact `location.search ===` check all missed.
 */
function matchScore(to, location) {
  const [path, search] = to.split('?')

  let score = 0
  if (location.pathname === path) score += 100
  else if (location.pathname.startsWith(`${path}/`)) score += 50
  else return -1 // different path entirely → never this link

  if (search) {
    const linkParams = new URLSearchParams(search)
    const currentParams = new URLSearchParams(location.search)
    for (const [key, value] of linkParams) {
      const current = currentParams.get(key)
      if (current === value) score += 10
      else if (current !== null) return -1 // the param is present but differs → not this link
      // current === null → param absent → neutral, lets the default link win
    }
  }

  return score
}

// initialsFromName / primaryRoleLabel removed — moved into AdminHeader along
// with the profile chip they fed.

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

export default function AdminSidebar({ mobileOpen = false } = {}) {
  const location = useLocation()
  const { t } = useTranslation(['admin', 'common'])
  // AuthContext is no longer consumed here — profile + logout moved to AdminHeader.

  const [incidentCounts, setIncidentCounts] = useState(DEFAULT_INCIDENT_COUNTS)
  const [alertCounts, setAlertCounts]       = useState(DEFAULT_ALERT_COUNTS)
  const [countsReady, setCountsReady]       = useState(false)

  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => readPersistedCollapsed())

  const activeItemRef = useRef(null)

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
    () => buildSections(incidentCounts, alertCounts, countsReady, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incidentCounts, alertCounts, countsReady, t],
  )

  /* ─── Resolve the single best-matching link for the current URL ──────── */
  const activeTo = useMemo(() => {
    let best = null
    let bestScore = 0
    for (const section of sections) {
      for (const link of section.links) {
        const score = matchScore(link.to, location)
        if (score > bestScore) {
          bestScore = score
          best = link.to
        }
      }
    }
    return best
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, location.pathname, location.search])

  const isLinkActive = (to) => to != null && to === activeTo

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

  /* Profile + logout previously lived in the sidebar footer; they were
     promoted to AdminHeader, so the sidebar no longer needs profileName /
     profileInitials / profileRole / handleLogout. */

  const isSearching = normalizedQuery.length > 0
  const showEmptyState = isSearching && filteredSections.length === 0

  return (
    <aside
      id="admin-sidebar"
      className={`siara-sb${mobileOpen ? ' is-mobile-open' : ''}`}
    >
      {/* ─── Brand ─── */}
      <div className="siara-sb-brand">
        <img src={siaraLogo} alt="SIARA" className="siara-sb-brand-logo" />
        <span className="siara-sb-brand-sub">{t('adminSidebar.supervisionCentre')}</span>
      </div>

      {/* ─── Search ─── */}
      <div className="siara-sb-search">
        <SearchRoundedIcon className="siara-sb-search-icon" fontSize="inherit" />
        <input
          type="search"
          className="siara-sb-search-input"
          placeholder={t('adminSidebar.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('adminSidebar.searchAriaLabel')}
        />
        {isSearching && (
          <button
            type="button"
            className="siara-sb-search-clear"
            onClick={() => setQuery('')}
            aria-label={t('adminSidebar.clearSearch')}
          >×</button>
        )}
      </div>

      {/* ─── Scrollable nav ─── */}
      <div className="siara-sb-scroll">
        {showEmptyState ? (
          <div className="siara-sb-empty">
            {t('adminSidebar.noLinksMatch', { query })}
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

      {/* Footer (profile + status) moved to AdminHeader so the sidebar
          becomes pure navigation. */}
    </aside>
  )
}
