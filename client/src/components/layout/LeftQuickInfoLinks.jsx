import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import '../../styles/LeftQuickInfoLinks.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const INFO_LINKS = [
  { key: 'contact', label: 'Contact', icon: '📞', path: '/contact' },
  { key: 'about', label: 'About', icon: 'ℹ️', path: '/about' },
  { key: 'description', label: 'Description', icon: '📘', path: '/description' },
]

export default function LeftQuickInfoLinks({ title = 'Quick Pages', className = '' }) {
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
    <>
      <section className={`left-quick-links ${className}`.trim()}>
        <h3 className="left-quick-links-title">{title}</h3>
        <div className="left-quick-links-list">
          {INFO_LINKS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`left-quick-link-btn ${openPanel === item.key ? 'active' : ''}`}
              onClick={() => setOpenPanel(item.key)}
            >
              <span className="left-quick-link-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {openPanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="left-info-backdrop" onClick={() => setOpenPanel(null)} role="dialog" aria-modal="true" aria-label="Quick information panel">
              <div className={`left-info-modal left-info-panel-${openPanel}`} onClick={(event) => event.stopPropagation()}>
                {openPanel === 'contact' ? (
                  <>
                    <div className="left-info-head">
                      <div className="left-info-head-main">
                        <div className="left-info-brand">
                          <img src={siaraLogo} alt="SIARA" className="left-info-brand-logo" />
                          <div>
                            <span className="left-info-kicker">Support</span>
                            <h3>Contact SIARA</h3>
                          </div>
                        </div>
                        <p className="left-info-sub">Share your request and our team will get back to you quickly.</p>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label="Close contact form">×</button>
                    </div>

                    <div className="left-info-layout">
                      <form className="left-info-form" onSubmit={submitContactForm} noValidate>
                        <div className="left-info-grid">
                          <div>
                            <label htmlFor="left-info-contact-name">Name</label>
                            <input
                              id="left-info-contact-name"
                              name="name"
                              value={contactForm.name}
                              onChange={onContactChange}
                              className={contactErrors.name ? 'is-invalid' : ''}
                            />
                            {contactErrors.name ? <p className="left-info-error">{contactErrors.name}</p> : null}
                          </div>

                          <div>
                            <label htmlFor="left-info-contact-email">Email</label>
                            <input
                              id="left-info-contact-email"
                              name="email"
                              value={contactForm.email}
                              onChange={onContactChange}
                              className={contactErrors.email ? 'is-invalid' : ''}
                            />
                            {contactErrors.email ? <p className="left-info-error">{contactErrors.email}</p> : null}
                          </div>
                        </div>

                        <label htmlFor="left-info-contact-message">Message</label>
                        <textarea
                          id="left-info-contact-message"
                          name="message"
                          rows={5}
                          value={contactForm.message}
                          onChange={onContactChange}
                          className={contactErrors.message ? 'is-invalid' : ''}
                        />
                        {contactErrors.message ? <p className="left-info-error">{contactErrors.message}</p> : null}

                        <div className="left-info-actions">
                          <button type="submit" className="left-info-submit">Send Message</button>
                          <a className="left-info-mail" href="mailto:siara.ai.app@gmail.com">Email directly</a>
                        </div>
                      </form>

                      <aside className="left-info-side" aria-label="Support information">
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

                    {contactSuccess ? <p className="left-info-success" role="status">{contactSuccess}</p> : null}
                  </>
                ) : null}

                {openPanel === 'about' ? (
                  <>
                    <div className="left-info-head">
                      <div>
                        <span className="left-info-kicker">Overview</span>
                        <h3>About SIARA</h3>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label="Close about panel">×</button>
                    </div>
                    <div className="left-info-block">
                      <div className="left-info-brand">
                        <img src={siaraLogo} alt="SIARA" className="left-info-mini-logo" />
                        <div>
                          <p className="left-info-brand-name">SIARA</p>
                          <p className="left-info-brand-caption">Road Safety Intelligence Platform</p>
                        </div>
                      </div>
                      <p className="left-info-lead">
                        SIARA is a road safety intelligence platform combining live reporting, mapping, and AI insights
                        to improve incident response.
                      </p>
                      <div className="left-info-pillars">
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
                      <div className="left-info-mini-cards">
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
                    <div className="left-info-head">
                      <div>
                        <span className="left-info-kicker">Service Flow</span>
                        <h3>SIARA Workflow Overview</h3>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label="Close description panel">×</button>
                    </div>
                    <div className="left-info-block">
                      <p className="left-info-lead">
                        SIARA provides a clear operational pipeline from report intake to validated alert delivery.
                      </p>
                      <ol className="left-info-steps left-info-steps-pro">
                        <li><strong>Incident Intake</strong><span>Capture reports with location, media, and contextual metadata.</span></li>
                        <li><strong>Data Validation</strong><span>Normalize and verify incoming records for analysis readiness.</span></li>
                        <li><strong>Risk Assessment</strong><span>Estimate urgency and confidence using AI-assisted scoring.</span></li>
                        <li><strong>Operational Review</strong><span>Authorized teams validate incidents and assign response priorities.</span></li>
                        <li><strong>Alert Distribution</strong><span>Deliver relevant alerts to users and operational stakeholders.</span></li>
                      </ol>
                      <p className="left-info-tech">
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
