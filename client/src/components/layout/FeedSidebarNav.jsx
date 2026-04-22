import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import siaraLogo from '../../assets/logos/siara-logo.png'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: '🏠', path: '/home' },
  { key: 'feed', label: 'News Feed', icon: '📰', path: '/news' },
  { key: 'map', label: 'Incident Map', icon: '🗺️', path: '/map' },
  { key: 'alerts', label: 'Alerts', icon: '🚨', path: '/alerts' },
  { key: 'reports', label: 'My Reports', icon: '📝', path: '/report' },
  { key: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { key: 'predictions', label: 'Predictions', icon: '🔮', path: '/predictions' },
]

const INFO_ITEMS = [
  { key: 'contact', label: 'Contact', icon: '📞', path: '/contact' },
  { key: 'about', label: 'About', icon: 'ℹ️', path: '/about' },
  { key: 'description', label: 'Description', icon: '📘', path: '/description' },
]

const ACCOUNT_ITEMS = [
  { key: 'notifications', label: 'Notifications', icon: '🔔', path: '/notifications' },
  { key: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
  { key: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
]

export default function FeedSidebarNav({ activeKey, onOpenQuiz }) {
  const navigate = useNavigate()
  const [openPanel, setOpenPanel] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactErrors, setContactErrors] = useState({})
  const [contactSuccess, setContactSuccess] = useState('')

  useEffect(() => {
    if (!openPanel) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenPanel(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [openPanel])

  useEffect(() => {
    if (openPanel !== 'contact') {
      setContactErrors({})
      setContactSuccess('')
    }
  }, [openPanel])

  const onContactChange = (event) => {
    const { name, value } = event.target
    setContactForm((previous) => ({ ...previous, [name]: value }))
    setContactErrors((previous) => ({ ...previous, [name]: '' }))
    if (contactSuccess) setContactSuccess('')
  }

  const validateContactForm = () => {
    const nextErrors = {}
    if (contactForm.name.trim().length < 2) nextErrors.name = 'Please enter a valid name.'
    if (!EMAIL_REGEX.test(contactForm.email.trim())) nextErrors.email = 'Please enter a valid email address.'
    if (contactForm.message.trim().length < 10) nextErrors.message = 'Message must be at least 10 characters.'
    setContactErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submitContactForm = (event) => {
    event.preventDefault()
    if (!validateContactForm()) return

    setContactSuccess('Thank you. We will respond as soon as possible.')
    setContactForm({ name: '', email: '', message: '' })
  }

  const renderItem = (item, onClickOverride, extraClassName = '') => (
    <button
      key={item.key}
      className={`nav-item ${(activeKey === item.key || openPanel === item.key) ? 'nav-item-active' : ''} ${extraClassName}`.trim()}
      onClick={onClickOverride || (() => {
        if (item.key === 'contact' || item.key === 'about' || item.key === 'description') {
          setOpenPanel(item.key)
          return
        }
        navigate(item.path)
      })}
    >
      <span className="nav-accent"></span>
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </button>
  )

  return (
    <>
      <nav className="card nav-menu">
        <div className="nav-section-label">NAVIGATION</div>
        {NAV_ITEMS.map((item) => renderItem(item))}

        <div className="nav-section-label">TOOLS</div>
        {onOpenQuiz ? renderItem({ key: 'quiz', label: 'Driver Quiz', icon: '🚗' }, onOpenQuiz) : null}

        <div className="nav-section-label nav-section-label-info">INFO</div>
        <div className="nav-info-group">
          {INFO_ITEMS.map((item) => renderItem(item, undefined, 'nav-item-info'))}
        </div>

        <div className="nav-section-label">ACCOUNT</div>
        {ACCOUNT_ITEMS.map((item) => renderItem(item))}
      </nav>

      {openPanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="contact-quick-backdrop" onClick={() => setOpenPanel(null)} role="dialog" aria-modal="true" aria-label="Quick information panel">
              <div className={`contact-quick-modal panel-${openPanel}`} onClick={(event) => event.stopPropagation()}>
                {openPanel === 'contact' ? (
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
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label="Close contact form">×</button>
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
                          <a className="contact-quick-mail" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">Email directly</a>
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

                {openPanel === 'about' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">Overview</span>
                        <h3>About SIARA</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label="Close about panel">×</button>
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

                {openPanel === 'description' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">Service Flow</span>
                        <h3>SIARA Workflow Overview</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label="Close description panel">×</button>
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
    </>
  )
}
