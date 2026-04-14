import React, { useState } from 'react'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: '' }))
    if (statusMessage) {
      setStatusMessage('')
    }
  }

  const validateForm = () => {
    const nextErrors = {}
    const trimmedName = form.name.trim()
    const trimmedEmail = form.email.trim()
    const trimmedMessage = form.message.trim()

    if (trimmedName.length < 2) {
      nextErrors.name = 'Please enter a valid name.'
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.'
    }
    if (trimmedMessage.length < 10) {
      nextErrors.message = 'Message must be at least 10 characters.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validateForm()) {
      return
    }

    setStatusMessage('Thank you. We will respond as soon as possible.')
    setForm({ name: '', email: '', message: '' })
  }

  return (
    <div className="info-page-root">
      <main className="info-page-shell">
        <header className="info-page-head info-page-head-plain">
          <div className="info-brand">
            <img src={siaraLogo} alt="SIARA" className="info-brand-logo" />
            <div>
              <p className="info-brand-name">SIARA</p>
              <p className="info-brand-caption">Road Safety Intelligence Platform</p>
            </div>
          </div>
          <div className="info-head-topline">
            <span className="info-head-kicker">Support Center</span>
          </div>
          <h1 className="info-page-title">Contact</h1>
          <p className="info-page-intro">
            Reach out to SIARA for support, questions, or partnership opportunities.
          </p>
        </header>

        <section className="info-section-card">
          <h2 className="info-section-title">Contact Information</h2>
          <p className="info-inline-detail">
            <strong>Email:</strong> siara.ai.app@gmail.com
          </p>
          <div className="info-contact-actions">
            <a className="info-mail-link" href="mailto:siara.ai.app@gmail.com">Send email directly</a>
            <button
              type="button"
              className="info-inline-btn"
              onClick={() => setIsFormOpen((previous) => !previous)}
              aria-expanded={isFormOpen}
              aria-controls="contact-form-panel"
            >
              {isFormOpen ? 'Hide contact form' : 'Open contact form'}
            </button>
          </div>
        </section>

        <section
          id="contact-form-panel"
          className={`info-section-card info-collapsible ${isFormOpen ? 'open' : ''}`}
          aria-hidden={!isFormOpen}
        >
          <h2 className="info-section-title">Contact Form</h2>
          <form className="info-form" onSubmit={handleSubmit} noValidate>
            <div className="info-form-row">
              <div className="info-field-wrap">
                <label htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={errors.name ? 'is-invalid' : ''}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'contact-name-error' : undefined}
                />
                {errors.name ? <p id="contact-name-error" className="info-field-error">{errors.name}</p> : null}
              </div>

              <div className="info-field-wrap">
                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={errors.email ? 'is-invalid' : ''}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'contact-email-error' : undefined}
                />
                {errors.email ? <p id="contact-email-error" className="info-field-error">{errors.email}</p> : null}
              </div>
            </div>

            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={form.message}
              onChange={handleChange}
              required
              className={errors.message ? 'is-invalid' : ''}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'contact-message-error' : undefined}
            />
            {errors.message ? <p id="contact-message-error" className="info-field-error">{errors.message}</p> : null}

            <button type="submit">Submit</button>
          </form>
          <p className="info-note">We will respond as soon as possible.</p>
          {statusMessage ? <p className="info-success-note" role="status" aria-live="polite">{statusMessage}</p> : null}
        </section>
      </main>
    </div>
  )
}
