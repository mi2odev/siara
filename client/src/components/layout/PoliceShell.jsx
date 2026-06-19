import React, { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined'
import LocalPoliceOutlinedIcon from '@mui/icons-material/LocalPoliceOutlined'
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import NotificationBell from '../notifications/NotificationBell'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined'

import { AuthContext } from '../../contexts/AuthContext'
import { useUiModeStore } from '../../stores/uiModeStore'
import PoliceModeTab from './PoliceModeTab'
import GlobalHeaderSearch from '../search/GlobalHeaderSearch'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'
import 'leaflet/dist/leaflet.css'
import '../../styles/DashboardPage.css'
import '../../styles/PoliceMode.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import { submitSupportMessage } from '../../services/supportMessagesService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function PoliceShell({
  activeKey,
  children,
  rightPanel,
  rightPanelCollapsed = false,
  notificationCount = 0,
  emergencyMode = false,
  // When set, forces officer/supervisor chrome regardless of activeKey. Used by
  // shared pages (e.g. notifications) rendered inside the shell.
  forceMode = null,
  // Optional extra content rendered under the desktop navigation menu (e.g. the
  // notifications page tucks its filters here).
  sidebarExtra = null,
}) {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const setUiMode = useUiModeStore((state) => state.setMode)
  const isSupervisor = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r || '').trim().toLowerCase().replace(/[\s_-]+/g, '')).includes('policesupervisor')
    : false
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [openInfoPanel, setOpenInfoPanel] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactErrors, setContactErrors] = useState({})
  const [contactSuccess, setContactSuccess] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactSubmitError, setContactSubmitError] = useState('')

  const SUPERVISOR_KEYS = useMemo(() => new Set([
    'supervisor-dashboard', 'incident-coordination', 'officer-monitoring',
    'supervisor-alerts', 'operational-analytics', 'global-map',
  ]), [])

  const isInSupervisorMode = forceMode ? forceMode === 'supervisor' : SUPERVISOR_KEYS.has(activeKey)

  // Remember the current police sub-mode so shared pages reached from here
  // (e.g. the notifications page) stay in police mode instead of the citizen UI.
  useEffect(() => {
    setUiMode(isInSupervisorMode ? 'supervisor' : 'officer')
  }, [isInSupervisorMode, setUiMode])

  const officerMenuGroups = useMemo(() => [
    {
      title: 'OPERATIONS',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: <AccountBalanceOutlinedIcon fontSize="inherit" />, path: '/police' },
        { key: 'active-incidents', label: 'Active Incidents', icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-high" />, path: '/police?view=active' },
        { key: 'nearby-incidents', label: 'Nearby Incidents', icon: <LocationOnOutlinedIcon fontSize="inherit" />, path: '/police/nearby' },
        {
          key: 'verification-queue',
          label: 'Verification Queue',
          icon: <PendingActionsOutlinedIcon fontSize="inherit" />,
          path: '/police/verification',
        },
        { key: 'my-incidents', label: 'My Incidents', icon: <LocalPoliceOutlinedIcon fontSize="inherit" />, path: '/police/my-incidents' },
        { key: 'assigned-incidents', label: 'Assigned Incidents', icon: <AssignmentIndOutlinedIcon fontSize="inherit" />, path: '/police/assigned-incidents' },
        { key: 'field-reports', label: 'Field Reports', icon: <EditNoteOutlinedIcon fontSize="inherit" />, path: '/police/field-reports' },
        { key: 'alert-center', label: 'Alert Center', icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />, path: '/police/alerts' },
        { key: 'operation-history', label: 'Operation History', icon: <HistoryOutlinedIcon fontSize="inherit" />, path: '/police/history' },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { key: 'analytics', label: 'AI Insights', icon: <PsychologyOutlinedIcon fontSize="inherit" />, path: '/police/insights' },
      ],
    },
    {
      title: 'INFO',
      items: [
        { key: 'contact', label: 'Contact', icon: <PhoneOutlinedIcon fontSize="inherit" />, path: '/contact' },
        { key: 'about', label: 'About', icon: <InfoOutlinedIcon fontSize="inherit" />, path: '/about' },
        { key: 'overview', label: 'Overview', icon: <MenuBookOutlinedIcon fontSize="inherit" />, path: '/overview' },
      ],
    },
  ], [])

  const supervisorMenuGroups = useMemo(() => [
    {
      title: 'SUPERVISOR',
      items: [
        { key: 'supervisor-dashboard', label: 'Command Center', icon: <AccountBalanceOutlinedIcon fontSize="inherit" />, path: '/police/supervisor' },
        { key: 'incident-coordination', label: 'Incident Coordination', icon: <GpsFixedOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/coordination' },
        { key: 'officer-monitoring', label: 'Officer Monitoring', icon: <GroupsOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/officers' },
        { key: 'supervisor-alerts', label: 'Supervisor Alerts', icon: <CampaignOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/alerts' },
        { key: 'operational-analytics', label: 'Analytics', icon: <InsightsOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/analytics' },
        { key: 'global-map', label: 'Global Map', icon: <MapOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/map' },
      ],
    },
    officerMenuGroups[officerMenuGroups.length - 1], // INFO
  ], [officerMenuGroups])

  const menuGroups = useMemo(() => {
    if (!isSupervisor) return officerMenuGroups
    // Show only the relevant set based on current mode
    return isInSupervisorMode ? supervisorMenuGroups : officerMenuGroups
  }, [isSupervisor, isInSupervisorMode, officerMenuGroups, supervisorMenuGroups])

  const visibleMenuGroups = useMemo(
    () => menuGroups.filter((group) => Array.isArray(group.items) && group.items.length > 0),
    [menuGroups],
  )

  const userAvatarUrl = getUserAvatarUrl(user)
  const profileInitials = getInitialsFromName(user?.name || user?.email || 'Officer', 'O')

  const navigateFromMenu = (item) => {
    setShowDropdown(false)
    setShowMobileMenu(false)

    if (item.key === 'contact' || item.key === 'about' || item.key === 'overview') {
      setOpenInfoPanel(item.key)
      return
    }

    navigate(item.path)
  }

  useEffect(() => {
    if (showMobileMenu) {
      setShowDropdown(false)
    }
  }, [showMobileMenu])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setShowMobileMenu(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!openInfoPanel) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenInfoPanel(null)
      }
    }

    document.body.classList.add('has-left-info-open')
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.classList.remove('has-left-info-open')
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openInfoPanel])

  useEffect(() => {
    if (openInfoPanel !== 'contact') {
      setContactErrors({})
      setContactSuccess('')
    }
  }, [openInfoPanel])

  const onContactChange = (event) => {
    const { name, value } = event.target
    setContactForm((previous) => ({ ...previous, [name]: value }))
    setContactErrors((previous) => ({ ...previous, [name]: '' }))
    if (contactSuccess) setContactSuccess('')
  }

  const validateContactForm = () => {
    const nextErrors = {}

    if (contactForm.name.trim().length < 2) {
      nextErrors.name = 'Please enter a valid name.'
    }

    if (!EMAIL_REGEX.test(contactForm.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (contactForm.message.trim().length < 10) {
      nextErrors.message = 'Message must be at least 10 characters.'
    }

    setContactErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submitContactForm = async (event) => {
    event.preventDefault()
    if (!validateContactForm() || contactSubmitting) return

    setContactSubmitting(true)
    setContactSubmitError('')
    try {
      await submitSupportMessage({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        message: contactForm.message.trim(),
      })
      setContactSuccess('Thank you. We will respond as soon as possible.')
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      setContactSubmitError(error?.message || 'Could not send your message. Please try again.')
    } finally {
      setContactSubmitting(false)
    }
  }

  return (
    <div className={`police-root ${emergencyMode ? 'police-root-emergency' : ''}`}>
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <button
              type="button"
              className="police-mobile-menu-toggle"
              aria-label="Open operations menu"
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              <ViewSidebarOutlinedIcon fontSize="small" />
            </button>
            <div className="dash-logo-block" onClick={() => navigate(isSupervisor ? '/police/supervisor' : '/police')} role="button" tabIndex={0}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
              {isSupervisor && (
                <span className="supervisor-mode-badge">SUPERVISOR</span>
              )}
            </div>
            <nav className="dash-header-tabs police-switch-anchor" aria-label="Police mode switch">
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Feed</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Map</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Alerts</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Report</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Dashboard</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">Predictions</button>
              <PoliceModeTab user={user} basicLabel="Switch to Normal Mode" />
            </nav>
          </div>

          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a zone..."
              ariaLabel="Search"
              currentUser={user}
            />
          </div>

          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}><PersonOutlinedIcon fontSize="small" /> My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}><SettingsOutlinedIcon fontSize="small" /> Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}><NotificationsOutlinedIcon fontSize="small" /> Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}><LogoutOutlinedIcon fontSize="small" className="icon-danger" /> Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <button
        type="button"
        className={`police-mobile-nav-backdrop ${showMobileMenu ? 'open' : ''}`}
        aria-label="Close police navigation"
        onClick={() => setShowMobileMenu(false)}
      ></button>

      <aside className={`police-mobile-nav ${showMobileMenu ? 'open' : ''}`} aria-hidden={!showMobileMenu}>
        <div className="police-mobile-nav-head">
          <strong>Operations Menu</strong>
          <button
            type="button"
            className="police-mobile-nav-close"
            aria-label="Close police navigation"
            onClick={() => setShowMobileMenu(false)}
          >
            ×
          </button>
        </div>

        {isSupervisor && (
          <div className="police-mode-switcher" style={{ margin: '0 0 8px' }}>
            <button
              className={`police-mode-pill ${!isInSupervisorMode ? 'active' : ''}`}
              onClick={() => { setShowMobileMenu(false); navigate('/police') }}
            >
              <LocalPoliceOutlinedIcon fontSize="inherit" /> Officer
            </button>
            <button
              className={`police-mode-pill ${isInSupervisorMode ? 'active' : ''}`}
              onClick={() => { setShowMobileMenu(false); navigate('/police/supervisor') }}
            >
              <AccountBalanceOutlinedIcon fontSize="inherit" /> Supervisor
            </button>
          </div>
        )}
        <nav className="police-menu">
          {visibleMenuGroups.map((group) => (
            <section
              key={`mobile-${group.title}`}
              className="police-menu-group"
            >
              <h3 className="police-menu-group-title">{group.title}</h3>
              <div className="police-menu-group-items">
                {group.items.map((item) => (
                  <button
                    key={`mobile-${item.key}`}
                    className={`police-menu-btn ${(activeKey === item.key || openInfoPanel === item.key) ? 'active' : ''}`}
                    onClick={() => navigateFromMenu(item)}
                  >
                    <span className="police-menu-icon" aria-hidden="true">{item.icon}</span>
                    <span className="police-menu-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className={`police-layout ${rightPanelCollapsed ? 'police-layout-collapsed' : ''}`}>
        <aside className="police-sidebar">
          {isSupervisor && (
            <div className="police-mode-switcher">
              <button
                className={`police-mode-pill ${!isInSupervisorMode ? 'active' : ''}`}
                onClick={() => navigate('/police')}
              >
                <LocalPoliceOutlinedIcon fontSize="inherit" /> Officer
              </button>
              <button
                className={`police-mode-pill ${isInSupervisorMode ? 'active' : ''}`}
                onClick={() => navigate('/police/supervisor')}
              >
                <AccountBalanceOutlinedIcon fontSize="inherit" /> Supervisor
              </button>
            </div>
          )}
          <nav className="police-menu">
            {visibleMenuGroups.map((group) => (
              <section
                key={group.title}
                className="police-menu-group"
              >
                <h3 className="police-menu-group-title">{group.title}</h3>
                <div className="police-menu-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      className={`police-menu-btn ${(activeKey === item.key || openInfoPanel === item.key) ? 'active' : ''}`}
                      onClick={() => navigateFromMenu(item)}
                    >
                      <span className="police-menu-icon" aria-hidden="true">{item.icon}</span>
                      <span className="police-menu-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          {sidebarExtra ? (
            <div className="police-sidebar-extra">{sidebarExtra}</div>
          ) : null}
        </aside>

        <main className="police-center">
          {children}
        </main>

        {!rightPanelCollapsed ? (
          <aside className="police-right">
            {rightPanel}
          </aside>
        ) : null}
      </div>

      {openInfoPanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="contact-quick-backdrop" onClick={() => setOpenInfoPanel(null)} role="dialog" aria-modal="true" aria-label="Quick information panel">
              <div className={`contact-quick-modal panel-${openInfoPanel}`} onClick={(event) => event.stopPropagation()}>
                {openInfoPanel === 'contact' ? (
                  <>
                    <div className="contact-quick-head">
                      <div className="contact-quick-head-main">
                        <div className="contact-quick-brand">
                          <img src={siaraLogo} alt="SIARA" className="contact-quick-brand-logo" />
                          <div>
                            <span className="contact-quick-kicker">Support</span>
                            <h3>Contact SIARA</h3>
                          </div>
                        </div>
                        <p className="contact-quick-sub">Share your request and our team will get back to you quickly.</p>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label="Close contact form">×</button>
                    </div>

                    <div className="contact-quick-layout">
                      <form className="contact-quick-form" onSubmit={submitContactForm} noValidate>
                        <div className="contact-quick-grid">
                          <div>
                            <label htmlFor="quick-contact-name">Name</label>
                            <input
                              id="quick-contact-name"
                              name="name"
                              value={contactForm.name}
                              onChange={onContactChange}
                              className={contactErrors.name ? 'is-invalid' : ''}
                            />
                            {contactErrors.name ? <p className="contact-quick-error">{contactErrors.name}</p> : null}
                          </div>

                          <div>
                            <label htmlFor="quick-contact-email">Email</label>
                            <input
                              id="quick-contact-email"
                              name="email"
                              value={contactForm.email}
                              onChange={onContactChange}
                              className={contactErrors.email ? 'is-invalid' : ''}
                            />
                            {contactErrors.email ? <p className="contact-quick-error">{contactErrors.email}</p> : null}
                          </div>
                        </div>

                        <label htmlFor="quick-contact-message">Message</label>
                        <textarea
                          id="quick-contact-message"
                          name="message"
                          rows={5}
                          value={contactForm.message}
                          onChange={onContactChange}
                          className={contactErrors.message ? 'is-invalid' : ''}
                        />
                        {contactErrors.message ? <p className="contact-quick-error">{contactErrors.message}</p> : null}

                        <div className="contact-quick-actions">
                          <button type="submit" className="contact-quick-submit" disabled={contactSubmitting}>
                            {contactSubmitting ? 'Sending…' : 'Send Message'}
                          </button>
                          <a className="contact-quick-mail" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">Email directly</a>
                        </div>
                        {contactSubmitError ? (
                          <p className="contact-quick-error" role="alert">{contactSubmitError}</p>
                        ) : null}
                      </form>

                      <aside className="contact-quick-side" aria-label="Support information">
                        <article>
                          <h4>Response Window</h4>
                          <p>Most requests are reviewed within one business day.</p>
                        </article>
                        <article>
                          <h4>Best for This Form</h4>
                          <p>Account support, platform feedback, partnerships, and incident workflow questions.</p>
                        </article>
                        <article>
                          <h4>Direct Contact</h4>
                          <p>siara.ai.app@gmail.com</p>
                        </article>
                      </aside>
                    </div>

                    {contactSuccess ? <p className="contact-quick-success" role="status">{contactSuccess}</p> : null}
                  </>
                ) : null}

                {openInfoPanel === 'about' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">Overview</span>
                        <h3>About SIARA</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label="Close about panel">×</button>
                    </div>
                    <div className="info-quick-block">
                      <div className="info-quick-brand">
                        <img src={siaraLogo} alt="SIARA" className="info-quick-brand-logo" />
                        <div>
                          <p className="info-quick-brand-name">SIARA</p>
                          <p className="info-quick-brand-caption">Road Safety Intelligence Platform</p>
                        </div>
                      </div>
                      <p className="info-quick-lead">
                        SIARA is a road safety intelligence platform combining live reporting, mapping, and AI insights
                        to improve incident response.
                      </p>
                      <div className="info-quick-pillars">
                        <article>
                          <span className="info-quick-pillar-icon"><TrackChangesOutlinedIcon fontSize="inherit" /></span>
                          <h4>Mission</h4>
                          <p>Reduce road risk with fast, evidence-based incident coordination.</p>
                        </article>
                        <article>
                          <span className="info-quick-pillar-icon"><VisibilityOutlinedIcon fontSize="inherit" /></span>
                          <h4>Vision</h4>
                          <p>Build connected, AI-supported urban safety systems for smarter mobility.</p>
                        </article>
                        <article>
                          <span className="info-quick-pillar-icon"><HubOutlinedIcon fontSize="inherit" /></span>
                          <h4>Approach</h4>
                          <p>Combine citizen signals, geospatial context, and operational analytics in one workflow.</p>
                        </article>
                      </div>
                      <p className="info-quick-section-label">Platform capabilities</p>
                      <div className="info-quick-mini-cards">
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--map"><MapOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>Risk Mapping</h4>
                            <p>Identify hotspots and incident density zones in real time.</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--alert"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>Alert Intelligence</h4>
                            <p>Prioritize high-impact events using severity and reliability indicators.</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--team"><GroupsOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>Response Coordination</h4>
                            <p>Support faster field decisions with one shared operational view.</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--insight"><InsightsOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>Performance Tracking</h4>
                            <p>Measure verification and response outcomes to improve continuously.</p>
                          </div>
                        </article>
                      </div>
                    </div>
                  </>
                ) : null}

                {openInfoPanel === 'overview' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">Service Flow</span>
                        <h3>SIARA Workflow Overview</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label="Close overview panel">×</button>
                    </div>
                    <div className="info-quick-block">
                      <p className="info-quick-lead">
                        SIARA provides a clear operational pipeline from report intake to validated alert delivery.
                      </p>
                      <ol className="info-quick-timeline">
                        <li>
                          <span className="info-quick-step-marker"><EditNoteOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>Incident Intake</strong>
                            <span>Capture reports with location, media, and contextual metadata.</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><FactCheckOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>Data Validation</strong>
                            <span>Normalize and verify incoming records for analysis readiness.</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><PsychologyOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>Risk Assessment</strong>
                            <span>Estimate urgency and confidence using AI-assisted scoring.</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>Operational Review</strong>
                            <span>Authorized teams validate incidents and assign response priorities.</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><CampaignOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>Alert Distribution</strong>
                            <span>Deliver relevant alerts to users and operational stakeholders.</span>
                          </div>
                        </li>
                      </ol>
                      <p className="info-quick-section-label">Technology stack</p>
                      <div className="info-quick-chips">
                        <span className="info-quick-chip"><PsychologyOutlinedIcon fontSize="inherit" /> AI risk scoring</span>
                        <span className="info-quick-chip"><MapOutlinedIcon fontSize="inherit" /> Geospatial mapping</span>
                        <span className="info-quick-chip"><NotificationsActiveOutlinedIcon fontSize="inherit" /> Real-time events</span>
                        <span className="info-quick-chip"><GpsFixedOutlinedIcon fontSize="inherit" /> Verification workflow</span>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
