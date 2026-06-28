import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['police', 'common'])
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
      title: t('policeShell.menu.groups.operations'),
      items: [
        { key: 'dashboard', label: t('policeShell.menu.items.dashboard'), icon: <AccountBalanceOutlinedIcon fontSize="inherit" />, path: '/police' },
        { key: 'active-incidents', label: t('policeShell.menu.items.activeIncidents'), icon: <FiberManualRecordIcon fontSize="inherit" className="icon-severity-high" />, path: '/police?view=active' },
        { key: 'nearby-incidents', label: t('policeShell.menu.items.nearbyIncidents'), icon: <LocationOnOutlinedIcon fontSize="inherit" />, path: '/police/nearby' },
        {
          key: 'verification-queue',
          label: t('policeShell.menu.items.verificationQueue'),
          icon: <PendingActionsOutlinedIcon fontSize="inherit" />,
          path: '/police/verification',
        },
        { key: 'my-incidents', label: t('policeShell.menu.items.myIncidents'), icon: <LocalPoliceOutlinedIcon fontSize="inherit" />, path: '/police/my-incidents' },
        { key: 'assigned-incidents', label: t('policeShell.menu.items.assignedIncidents'), icon: <AssignmentIndOutlinedIcon fontSize="inherit" />, path: '/police/assigned-incidents' },
        { key: 'field-reports', label: t('policeShell.menu.items.fieldReports'), icon: <EditNoteOutlinedIcon fontSize="inherit" />, path: '/police/field-reports' },
        { key: 'alert-center', label: t('policeShell.menu.items.alertCenter'), icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />, path: '/police/alerts' },
        { key: 'operation-history', label: t('policeShell.menu.items.operationHistory'), icon: <HistoryOutlinedIcon fontSize="inherit" />, path: '/police/history' },
      ],
    },
    {
      title: t('policeShell.menu.groups.analytics'),
      items: [
        { key: 'analytics', label: t('policeShell.menu.items.aiInsights'), icon: <PsychologyOutlinedIcon fontSize="inherit" />, path: '/police/insights' },
      ],
    },
    {
      title: t('policeShell.menu.groups.info'),
      items: [
        { key: 'contact', label: t('policeShell.menu.items.contact'), icon: <PhoneOutlinedIcon fontSize="inherit" />, path: '/contact' },
        { key: 'about', label: t('policeShell.menu.items.about'), icon: <InfoOutlinedIcon fontSize="inherit" />, path: '/about' },
        { key: 'overview', label: t('policeShell.menu.items.overview'), icon: <MenuBookOutlinedIcon fontSize="inherit" />, path: '/overview' },
      ],
    },
  ], [t])

  const supervisorMenuGroups = useMemo(() => [
    {
      title: t('policeShell.menu.groups.supervisor'),
      items: [
        { key: 'supervisor-dashboard', label: t('policeShell.menu.items.commandCenter'), icon: <AccountBalanceOutlinedIcon fontSize="inherit" />, path: '/police/supervisor' },
        { key: 'incident-coordination', label: t('policeShell.menu.items.incidentCoordination'), icon: <GpsFixedOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/coordination' },
        { key: 'officer-monitoring', label: t('policeShell.menu.items.officerMonitoring'), icon: <GroupsOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/officers' },
        { key: 'supervisor-alerts', label: t('policeShell.menu.items.supervisorAlerts'), icon: <CampaignOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/alerts' },
        { key: 'operational-analytics', label: t('policeShell.menu.items.analytics'), icon: <InsightsOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/analytics' },
        { key: 'global-map', label: t('policeShell.menu.items.globalMap'), icon: <MapOutlinedIcon fontSize="inherit" />, path: '/police/supervisor/map' },
      ],
    },
    officerMenuGroups[officerMenuGroups.length - 1], // INFO
  ], [t, officerMenuGroups])

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
      nextErrors.name = t('policeShell.contact.errors.invalidName')
    }

    if (!EMAIL_REGEX.test(contactForm.email.trim())) {
      nextErrors.email = t('policeShell.contact.errors.invalidEmail')
    }

    if (contactForm.message.trim().length < 10) {
      nextErrors.message = t('policeShell.contact.errors.shortMessage')
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
      setContactSuccess(t('policeShell.contact.successMessage'))
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      setContactSubmitError(error?.message || t('policeShell.contact.submitError'))
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
              aria-label={t('policeShell.aria.openOperationsMenu')}
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              <ViewSidebarOutlinedIcon fontSize="small" />
            </button>
            <div className="dash-logo-block" onClick={() => navigate(isSupervisor ? '/police/supervisor' : '/police')} role="button" tabIndex={0}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
              {isSupervisor && (
                <span className="supervisor-mode-badge">{t('policeShell.supervisorBadge')}</span>
              )}
            </div>
            <nav className="dash-header-tabs police-switch-anchor" aria-label={t('policeShell.aria.policeModeSwitch')}>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('policeShell.tabs.feed')}</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('common:nav.map')}</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('common:nav.alerts')}</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('policeShell.tabs.report')}</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('policeShell.tabs.dashboardTab')}</button>
              <button type="button" className="dash-tab police-switch-ghost" tabIndex={-1} disabled aria-hidden="true">{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} basicLabel={t('policeShell.switchToNormalMode')} />
            </nav>
          </div>

          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('policeShell.searchPlaceholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>

          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar-wrapper">
              <button className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`} onClick={() => setShowDropdown(!showDropdown)} aria-label={t('policeShell.aria.userProfile')}>
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('policeShell.aria.userAvatar')} className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}><PersonOutlinedIcon fontSize="small" /> {t('policeShell.dropdown.myProfile')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}><SettingsOutlinedIcon fontSize="small" /> {t('common:nav.settings')}</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}><NotificationsOutlinedIcon fontSize="small" /> {t('common:nav.notifications')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}><LogoutOutlinedIcon fontSize="small" className="icon-danger" /> {t('common:nav.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <button
        type="button"
        className={`police-mobile-nav-backdrop ${showMobileMenu ? 'open' : ''}`}
        aria-label={t('policeShell.aria.closePoliceNav')}
        onClick={() => setShowMobileMenu(false)}
      ></button>

      <aside className={`police-mobile-nav ${showMobileMenu ? 'open' : ''}`} aria-hidden={!showMobileMenu}>
        <div className="police-mobile-nav-head">
          <strong>{t('policeShell.operationsMenu')}</strong>
          <button
            type="button"
            className="police-mobile-nav-close"
            aria-label={t('policeShell.aria.closePoliceNav')}
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
              <LocalPoliceOutlinedIcon fontSize="inherit" /> {t('policeShell.modeSwitch.officer')}
            </button>
            <button
              className={`police-mode-pill ${isInSupervisorMode ? 'active' : ''}`}
              onClick={() => { setShowMobileMenu(false); navigate('/police/supervisor') }}
            >
              <AccountBalanceOutlinedIcon fontSize="inherit" /> {t('policeShell.modeSwitch.supervisor')}
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
                <LocalPoliceOutlinedIcon fontSize="inherit" /> {t('policeShell.modeSwitch.officer')}
              </button>
              <button
                className={`police-mode-pill ${isInSupervisorMode ? 'active' : ''}`}
                onClick={() => navigate('/police/supervisor')}
              >
                <AccountBalanceOutlinedIcon fontSize="inherit" /> {t('policeShell.modeSwitch.supervisor')}
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
            <div className="contact-quick-backdrop" onClick={() => setOpenInfoPanel(null)} role="dialog" aria-modal="true" aria-label={t('policeShell.aria.quickInfoPanel')}>
              <div className={`contact-quick-modal panel-${openInfoPanel}`} onClick={(event) => event.stopPropagation()}>
                {openInfoPanel === 'contact' ? (
                  <>
                    <div className="contact-quick-head">
                      <div className="contact-quick-head-main">
                        <div className="contact-quick-brand">
                          <img src={siaraLogo} alt="SIARA" className="contact-quick-brand-logo" />
                          <div>
                            <span className="contact-quick-kicker">{t('policeShell.contact.kicker')}</span>
                            <h3>{t('policeShell.contact.title')}</h3>
                          </div>
                        </div>
                        <p className="contact-quick-sub">{t('policeShell.contact.subtitle')}</p>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label={t('policeShell.aria.closeContactForm')}>×</button>
                    </div>

                    <div className="contact-quick-layout">
                      <form className="contact-quick-form" onSubmit={submitContactForm} noValidate>
                        <div className="contact-quick-grid">
                          <div>
                            <label htmlFor="quick-contact-name">{t('policeShell.contact.nameLabel')}</label>
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
                            <label htmlFor="quick-contact-email">{t('policeShell.contact.emailLabel')}</label>
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

                        <label htmlFor="quick-contact-message">{t('policeShell.contact.messageLabel')}</label>
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
                            {contactSubmitting ? t('policeShell.contact.sending') : t('policeShell.contact.sendMessage')}
                          </button>
                          <a className="contact-quick-mail" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">{t('policeShell.contact.emailDirectly')}</a>
                        </div>
                        {contactSubmitError ? (
                          <p className="contact-quick-error" role="alert">{contactSubmitError}</p>
                        ) : null}
                      </form>

                      <aside className="contact-quick-side" aria-label={t('policeShell.aria.supportInfo')}>
                        <article>
                          <h4>{t('policeShell.contact.side.responseWindowTitle')}</h4>
                          <p>{t('policeShell.contact.side.responseWindowBody')}</p>
                        </article>
                        <article>
                          <h4>{t('policeShell.contact.side.bestForTitle')}</h4>
                          <p>{t('policeShell.contact.side.bestForBody')}</p>
                        </article>
                        <article>
                          <h4>{t('policeShell.contact.side.directContactTitle')}</h4>
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
                        <span className="contact-quick-kicker">{t('policeShell.about.kicker')}</span>
                        <h3>{t('policeShell.about.title')}</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label={t('policeShell.aria.closeAboutPanel')}>×</button>
                    </div>
                    <div className="info-quick-block">
                      <div className="info-quick-brand">
                        <img src={siaraLogo} alt="SIARA" className="info-quick-brand-logo" />
                        <div>
                          <p className="info-quick-brand-name">SIARA</p>
                          <p className="info-quick-brand-caption">{t('policeShell.about.brandCaption')}</p>
                        </div>
                      </div>
                      <p className="info-quick-lead">
                        {t('policeShell.about.lead')}
                      </p>
                      <div className="info-quick-pillars">
                        <article>
                          <span className="info-quick-pillar-icon"><TrackChangesOutlinedIcon fontSize="inherit" /></span>
                          <h4>{t('policeShell.about.pillars.missionTitle')}</h4>
                          <p>{t('policeShell.about.pillars.missionBody')}</p>
                        </article>
                        <article>
                          <span className="info-quick-pillar-icon"><VisibilityOutlinedIcon fontSize="inherit" /></span>
                          <h4>{t('policeShell.about.pillars.visionTitle')}</h4>
                          <p>{t('policeShell.about.pillars.visionBody')}</p>
                        </article>
                        <article>
                          <span className="info-quick-pillar-icon"><HubOutlinedIcon fontSize="inherit" /></span>
                          <h4>{t('policeShell.about.pillars.approachTitle')}</h4>
                          <p>{t('policeShell.about.pillars.approachBody')}</p>
                        </article>
                      </div>
                      <p className="info-quick-section-label">{t('policeShell.about.platformCapabilities')}</p>
                      <div className="info-quick-mini-cards">
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--map"><MapOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>{t('policeShell.about.capabilities.riskMappingTitle')}</h4>
                            <p>{t('policeShell.about.capabilities.riskMappingBody')}</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--alert"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>{t('policeShell.about.capabilities.alertIntelligenceTitle')}</h4>
                            <p>{t('policeShell.about.capabilities.alertIntelligenceBody')}</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--team"><GroupsOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>{t('policeShell.about.capabilities.responseCoordinationTitle')}</h4>
                            <p>{t('policeShell.about.capabilities.responseCoordinationBody')}</p>
                          </div>
                        </article>
                        <article>
                          <span className="info-quick-mini-icon info-quick-mini-icon--insight"><InsightsOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-mini-text">
                            <h4>{t('policeShell.about.capabilities.performanceTrackingTitle')}</h4>
                            <p>{t('policeShell.about.capabilities.performanceTrackingBody')}</p>
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
                        <span className="contact-quick-kicker">{t('policeShell.overview.kicker')}</span>
                        <h3>{t('policeShell.overview.title')}</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label={t('policeShell.aria.closeOverviewPanel')}>×</button>
                    </div>
                    <div className="info-quick-block">
                      <p className="info-quick-lead">
                        {t('policeShell.overview.lead')}
                      </p>
                      <ol className="info-quick-timeline">
                        <li>
                          <span className="info-quick-step-marker"><EditNoteOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>{t('policeShell.overview.steps.incidentIntakeTitle')}</strong>
                            <span>{t('policeShell.overview.steps.incidentIntakeBody')}</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><FactCheckOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>{t('policeShell.overview.steps.dataValidationTitle')}</strong>
                            <span>{t('policeShell.overview.steps.dataValidationBody')}</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><PsychologyOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>{t('policeShell.overview.steps.riskAssessmentTitle')}</strong>
                            <span>{t('policeShell.overview.steps.riskAssessmentBody')}</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><LocalPoliceOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>{t('policeShell.overview.steps.operationalReviewTitle')}</strong>
                            <span>{t('policeShell.overview.steps.operationalReviewBody')}</span>
                          </div>
                        </li>
                        <li>
                          <span className="info-quick-step-marker"><CampaignOutlinedIcon fontSize="inherit" /></span>
                          <div className="info-quick-step-body">
                            <strong>{t('policeShell.overview.steps.alertDistributionTitle')}</strong>
                            <span>{t('policeShell.overview.steps.alertDistributionBody')}</span>
                          </div>
                        </li>
                      </ol>
                      <p className="info-quick-section-label">{t('policeShell.overview.techStack')}</p>
                      <div className="info-quick-chips">
                        <span className="info-quick-chip"><PsychologyOutlinedIcon fontSize="inherit" /> {t('policeShell.overview.chips.aiRiskScoring')}</span>
                        <span className="info-quick-chip"><MapOutlinedIcon fontSize="inherit" /> {t('policeShell.overview.chips.geospatialMapping')}</span>
                        <span className="info-quick-chip"><NotificationsActiveOutlinedIcon fontSize="inherit" /> {t('policeShell.overview.chips.realtimeEvents')}</span>
                        <span className="info-quick-chip"><GpsFixedOutlinedIcon fontSize="inherit" /> {t('policeShell.overview.chips.verificationWorkflow')}</span>
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
