import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import LeftNavLayout from '../../components/layout/LeftNavLayout'
import { submitSupportMessage } from '../../services/supportMessagesService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ContactPage() {
  const { t } = useTranslation(['pages', 'common'])
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [statusMessage, setStatusMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      nextErrors.name = t('contactPage.errors.invalidName')
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = t('contactPage.errors.invalidEmail')
    }
    if (trimmedMessage.length < 10) {
      nextErrors.message = t('contactPage.errors.messageTooShort')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm() || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      await submitSupportMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      })
      setStatusMessage(t('contactPage.successMessage'))
      setForm({ name: '', email: '', message: '' })
    } catch (error) {
      setSubmitError(error?.message || t('contactPage.errors.sendFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <LeftNavLayout activeKey="contact">
    <div className="info-page-root">
      <main className="info-page-shell">
        <header className="info-page-head info-page-head-plain">
          <div className="info-brand">
            <img src={siaraLogo} alt="SIARA" className="info-brand-logo" />
            <div>
              <p className="info-brand-name">SIARA</p>
              <p className="info-brand-caption">{t('contactPage.brandCaption')}</p>
            </div>
          </div>
          <div className="info-head-topline">
            <span className="info-head-kicker">{t('contactPage.kicker')}</span>
          </div>
          <h1 className="info-page-title">{t('contactPage.title')}</h1>
          <p className="info-page-intro">
            {t('contactPage.intro')}
          </p>
        </header>

        <section className="info-section-card">
          <h2 className="info-section-title">{t('contactPage.infoSection.title')}</h2>
          <p className="info-inline-detail">
            <strong>{t('contactPage.infoSection.emailLabel')}</strong> siara.ai.app@gmail.com
          </p>
          <div className="info-contact-actions">
            <a className="info-mail-link" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">{t('contactPage.infoSection.sendEmailLink')}</a>
            <button
              type="button"
              className="info-inline-btn"
              onClick={() => setIsFormOpen((previous) => !previous)}
              aria-expanded={isFormOpen}
              aria-controls="contact-form-panel"
            >
              {isFormOpen ? t('contactPage.form.hideForm') : t('contactPage.form.openForm')}
            </button>
          </div>
        </section>

        <section
          id="contact-form-panel"
          className={`info-section-card info-collapsible ${isFormOpen ? 'open' : ''}`}
          aria-hidden={!isFormOpen}
        >
          <h2 className="info-section-title">{t('contactPage.form.title')}</h2>
          <form className="info-form" onSubmit={handleSubmit} noValidate>
            <div className="info-form-row">
              <div className="info-field-wrap">
                <label htmlFor="contact-name">{t('contactPage.form.nameLabel')}</label>
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
                <label htmlFor="contact-email">{t('contactPage.form.emailLabel')}</label>
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

            <label htmlFor="contact-message">{t('contactPage.form.messageLabel')}</label>
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

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('contactPage.form.sending') : t('contactPage.form.submit')}
            </button>
          </form>
          <p className="info-note">{t('contactPage.responseNote')}</p>
          {statusMessage ? <p className="info-success-note" role="status" aria-live="polite">{statusMessage}</p> : null}
          {submitError ? <p className="info-field-error" role="alert">{submitError}</p> : null}
        </section>
      </main>
    </div>
    </LeftNavLayout>
  )
}
