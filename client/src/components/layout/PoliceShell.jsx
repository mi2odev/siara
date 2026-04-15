import React, { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../../contexts/AuthContext'
import PoliceModeTab from './PoliceModeTab'
import GlobalHeaderSearch from '../search/GlobalHeaderSearch'
import 'leaflet/dist/leaflet.css'
import '../../styles/DashboardPage.css'
import '../../styles/PoliceMode.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getUserInitials(name) {
  const normalized = String(name || 'Officer').trim()
  if (!normalized) return 'O'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export default function PoliceShell({
  activeKey,
  children,
  rightPanel,
  rightPanelCollapsed = false,
  notificationCount = 0,
  emergencyMode = false,
  verificationPendingCount = 0,
}) {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')
  const [openInfoPanel, setOpenInfoPanel] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactErrors, setContactErrors] = useState({})
  const [contactSuccess, setContactSuccess] = useState('')

  const menuGroups = useMemo(() => [
    {
      title: 'OPERATIONS',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '🏛️', path: '/police' },
        { key: 'active-incidents', label: 'Active Incidents', icon: '🔴', path: '/police?view=active' },
        { key: 'nearby-incidents', label: 'Nearby Incidents', icon: '📍', path: '/police/nearby' },
        {
          key: 'verification-queue',
          label: 'Verification Queue',
          icon: '🟡',
          path: '/police/verification',
          badge: verificationPendingCount,
        },
        { key: 'my-incidents', label: 'My Incidents', icon: '👮', path: '/police/my-incidents' },
        { key: 'alert-center', label: 'Alert Center', icon: '🚨', path: '/police/alerts' },
        { key: 'field-reports', label: 'Field Reports', icon: '📝', path: '/police/field-reports' },
        { key: 'operation-history', label: 'Operation History', icon: '🕘', path: '/police/history' },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        { key: 'analytics', label: 'AI Insights', icon: '🧠', path: '/police/insights' },
      ],
    },
    {
      title: 'INFO',
      items: [
        { key: 'contact', label: 'Contact', icon: '📞', path: '/contact' },
        { key: 'about', label: 'About', icon: 'ℹ️', path: '/about' },
        { key: 'description', label: 'Description', icon: '📘', path: '/description' },
      ],
    },
  ], [verificationPendingCount])

  const visibleMenuGroups = useMemo(
    () => menuGroups.filter((group) => Array.isArray(group.items) && group.items.length > 0),
    [menuGroups],
  )

  const profileInitials = getUserInitials(user?.name)

  const navigateFromMenu = (item) => {
    setShowDropdown(false)
    setShowMobileMenu(false)

    if (item.key === 'contact' || item.key === 'about' || item.key === 'description') {
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

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
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

  const submitContactForm = (event) => {
    event.preventDefault()
    if (!validateContactForm()) return

    setContactSuccess('Thank you. We will respond as soon as possible.')
    setContactForm({ name: '', email: '', message: '' })
  }

  return (
    <div className={`police-root ${emergencyMode ? 'police-root-emergency' : ''}`}>
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/police')} role="button" tabIndex={0}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
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
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              🔔
              {notificationCount > 0 ? <span className="notification-badge"></span> : null}
            </button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">{profileInitials}</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 My Profile</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Settings</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home') }}>🚪 Log Out</button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="police-mobile-menu-toggle"
              aria-label="Open police navigation"
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu((prev) => !prev)}
            >
              ☰
            </button>
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

        <nav className="police-menu">
          {visibleMenuGroups.map((group) => (
            <section key={`mobile-${group.title}`} className="police-menu-group">
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
                    {item.badge > 0 ? <span className="police-menu-badge">{item.badge}</span> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <div className={`police-layout ${rightPanelCollapsed ? 'police-layout-collapsed' : ''}`}>
        <aside className="police-sidebar">
          <nav className="police-menu">
            {visibleMenuGroups.map((group) => (
              <section key={group.title} className="police-menu-group">
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
                      {item.badge > 0 ? <span className="police-menu-badge">{item.badge}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
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
                          <button type="submit" className="contact-quick-submit">Send Message</button>
                          <a className="contact-quick-mail" href="mailto:siara.ai.app@gmail.com">Email directly</a>
                        </div>
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
                          <h4>Mission</h4>
                          <p>Reduce road risk with fast, evidence-based incident coordination.</p>
                        </article>
                        <article>
                          <h4>Vision</h4>
                          <p>Build connected, AI-supported urban safety systems for smarter mobility.</p>
                        </article>
                        <article>
                          <h4>Approach</h4>
                          <p>Combine citizen signals, geospatial context, and operational analytics in one workflow.</p>
                        </article>
                      </div>
                      <div className="info-quick-mini-cards">
                        <article>
                          <h4>Risk Mapping</h4>
                          <p>Identify hotspots and incident density zones in real time.</p>
                        </article>
                        <article>
                          <h4>Alert Intelligence</h4>
                          <p>Prioritize high-impact events using severity and reliability indicators.</p>
                        </article>
                        <article>
                          <h4>Response Coordination</h4>
                          <p>Support faster field decisions with one shared operational view.</p>
                        </article>
                        <article>
                          <h4>Performance Tracking</h4>
                          <p>Measure verification and response outcomes to improve continuously.</p>
                        </article>
                      </div>
                    </div>
                  </>
                ) : null}

                {openInfoPanel === 'description' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">Service Flow</span>
                        <h3>SIARA Workflow Overview</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenInfoPanel(null)} aria-label="Close description panel">×</button>
                    </div>
                    <div className="info-quick-block">
                      <p className="info-quick-lead">
                        SIARA provides a clear operational pipeline from report intake to validated alert delivery.
                      </p>
                      <ol className="info-quick-steps info-quick-steps-pro">
                        <li><strong>Incident Intake</strong><span>Capture reports with location, media, and contextual metadata.</span></li>
                        <li><strong>Data Validation</strong><span>Normalize and verify incoming records for analysis readiness.</span></li>
                        <li><strong>Risk Assessment</strong><span>Estimate urgency and confidence using AI-assisted scoring.</span></li>
                        <li><strong>Operational Review</strong><span>Authorized teams validate incidents and assign response priorities.</span></li>
                        <li><strong>Alert Distribution</strong><span>Deliver relevant alerts to users and operational stakeholders.</span></li>
                      </ol>
                      <p className="info-quick-tech">
                        <strong>Technology stack:</strong> AI risk scoring, geospatial mapping, real-time events, and verification workflow.
                      </p>
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
