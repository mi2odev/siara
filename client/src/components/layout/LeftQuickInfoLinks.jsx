import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'

import '../../styles/LeftQuickInfoLinks.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import { submitSupportMessage } from '../../services/supportMessagesService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LeftQuickInfoLinks({ title, className = '' }) {
  const { t } = useTranslation(['pages', 'common'])

  const INFO_LINKS = [
    { key: 'contact', label: t('leftQuickInfoLinks.nav.contact'), icon: <PhoneOutlinedIcon fontSize="inherit" />, path: '/contact' },
    { key: 'about', label: t('leftQuickInfoLinks.nav.about'), icon: <InfoOutlinedIcon fontSize="inherit" />, path: '/about' },
    { key: 'overview', label: t('leftQuickInfoLinks.nav.overview'), icon: <MenuBookOutlinedIcon fontSize="inherit" />, path: '/overview' },
  ]

  const resolvedTitle = title ?? t('leftQuickInfoLinks.defaultTitle')
  const [openPanel, setOpenPanel] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactErrors, setContactErrors] = useState({})
  const [contactSuccess, setContactSuccess] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactSubmitError, setContactSubmitError] = useState('')

  useEffect(() => {
    if (!openPanel) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenPanel(null)
      }
    }

    document.body.classList.add('has-left-info-open')
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.body.classList.remove('has-left-info-open')
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openPanel])

  useEffect(() => {
    if (openPanel !== 'contact') {
      setContactErrors({})
      setContactSuccess('')
      setContactSubmitError('')
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
      nextErrors.name = t('leftQuickInfoLinks.contact.errors.invalidName')
    }

    if (!EMAIL_REGEX.test(contactForm.email.trim())) {
      nextErrors.email = t('leftQuickInfoLinks.contact.errors.invalidEmail')
    }

    if (contactForm.message.trim().length < 10) {
      nextErrors.message = t('leftQuickInfoLinks.contact.errors.messageTooShort')
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
      setContactSuccess(t('leftQuickInfoLinks.contact.successMessage'))
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      setContactSubmitError(error?.message || t('leftQuickInfoLinks.contact.submitError'))
    } finally {
      setContactSubmitting(false)
    }
  }

  return (
    <>
      <section className={`left-quick-links ${className}`.trim()}>
        <h3 className="left-quick-links-title">{resolvedTitle}</h3>
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
            <div className="left-info-backdrop" onClick={() => setOpenPanel(null)} role="dialog" aria-modal="true" aria-label={t('leftQuickInfoLinks.panel.ariaLabel')}>
              <div className={`left-info-modal left-info-panel-${openPanel}`} onClick={(event) => event.stopPropagation()}>
                {openPanel === 'contact' ? (
                  <>
                    <div className="left-info-head">
                      <div className="left-info-head-main">
                        <div className="left-info-brand">
                          <img src={siaraLogo} alt="SIARA" className="left-info-brand-logo" />
                          <div>
                            <span className="left-info-kicker">{t('leftQuickInfoLinks.contact.kicker')}</span>
                            <h3>{t('leftQuickInfoLinks.contact.heading')}</h3>
                          </div>
                        </div>
                        <p className="left-info-sub">{t('leftQuickInfoLinks.contact.subheading')}</p>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label={t('leftQuickInfoLinks.contact.closeAriaLabel')}>×</button>
                    </div>

                    <div className="left-info-layout">
                      <form className="left-info-form" onSubmit={submitContactForm} noValidate>
                        <div className="left-info-grid">
                          <div>
                            <label htmlFor="left-info-contact-name">{t('leftQuickInfoLinks.contact.form.nameLbl')}</label>
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
                            <label htmlFor="left-info-contact-email">{t('leftQuickInfoLinks.contact.form.emailLbl')}</label>
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

                        <label htmlFor="left-info-contact-message">{t('leftQuickInfoLinks.contact.form.messageLbl')}</label>
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
                          <button type="submit" className="left-info-submit" disabled={contactSubmitting}>
                            {contactSubmitting ? t('leftQuickInfoLinks.contact.form.sending') : t('leftQuickInfoLinks.contact.form.sendBtn')}
                          </button>
                          <a className="left-info-mail" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">{t('leftQuickInfoLinks.contact.form.emailDirectly')}</a>
                        </div>
                        {contactSubmitError ? (
                          <p className="left-info-error" role="alert">{contactSubmitError}</p>
                        ) : null}
                      </form>

                      <aside className="left-info-side" aria-label={t('leftQuickInfoLinks.contact.side.ariaLabel')}>
                        <article>
                          <h4>{t('leftQuickInfoLinks.contact.side.responseWindowTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.contact.side.responseWindowText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.contact.side.bestForTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.contact.side.bestForText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.contact.side.directContactTitle')}</h4>
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
                        <span className="left-info-kicker">{t('leftQuickInfoLinks.about.kicker')}</span>
                        <h3>{t('leftQuickInfoLinks.about.heading')}</h3>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label={t('leftQuickInfoLinks.about.closeAriaLabel')}>×</button>
                    </div>
                    <div className="left-info-block">
                      <div className="left-info-brand">
                        <img src={siaraLogo} alt="SIARA" className="left-info-mini-logo" />
                        <div>
                          <p className="left-info-brand-name">SIARA</p>
                          <p className="left-info-brand-caption">{t('leftQuickInfoLinks.about.brandCaption')}</p>
                        </div>
                      </div>
                      <p className="left-info-lead">
                        {t('leftQuickInfoLinks.about.lead')}
                      </p>
                      <div className="left-info-pillars">
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.pillars.missionTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.pillars.missionText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.pillars.visionTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.pillars.visionText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.pillars.approachTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.pillars.approachText')}</p>
                        </article>
                      </div>
                      <div className="left-info-mini-cards">
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.cards.riskMappingTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.cards.riskMappingText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.cards.alertIntelTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.cards.alertIntelText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.cards.responseCoordTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.cards.responseCoordText')}</p>
                        </article>
                        <article>
                          <h4>{t('leftQuickInfoLinks.about.cards.perfTrackingTitle')}</h4>
                          <p>{t('leftQuickInfoLinks.about.cards.perfTrackingText')}</p>
                        </article>
                      </div>
                    </div>
                  </>
                ) : null}

                {openPanel === 'overview' ? (
                  <>
                    <div className="left-info-head">
                      <div>
                        <span className="left-info-kicker">{t('leftQuickInfoLinks.overview.kicker')}</span>
                        <h3>{t('leftQuickInfoLinks.overview.heading')}</h3>
                      </div>
                      <button type="button" className="left-info-close" onClick={() => setOpenPanel(null)} aria-label={t('leftQuickInfoLinks.overview.closeAriaLabel')}>×</button>
                    </div>
                    <div className="left-info-block">
                      <p className="left-info-lead">
                        {t('leftQuickInfoLinks.overview.lead')}
                      </p>
                      <ol className="left-info-steps left-info-steps-pro">
                        <li><strong>{t('leftQuickInfoLinks.overview.steps.intakeTitle')}</strong><span>{t('leftQuickInfoLinks.overview.steps.intakeText')}</span></li>
                        <li><strong>{t('leftQuickInfoLinks.overview.steps.validationTitle')}</strong><span>{t('leftQuickInfoLinks.overview.steps.validationText')}</span></li>
                        <li><strong>{t('leftQuickInfoLinks.overview.steps.riskTitle')}</strong><span>{t('leftQuickInfoLinks.overview.steps.riskText')}</span></li>
                        <li><strong>{t('leftQuickInfoLinks.overview.steps.reviewTitle')}</strong><span>{t('leftQuickInfoLinks.overview.steps.reviewText')}</span></li>
                        <li><strong>{t('leftQuickInfoLinks.overview.steps.distributionTitle')}</strong><span>{t('leftQuickInfoLinks.overview.steps.distributionText')}</span></li>
                      </ol>
                      <p className="left-info-tech">
                        <strong>{t('leftQuickInfoLinks.overview.techStackLabel')}</strong> {t('leftQuickInfoLinks.overview.techStackText')}
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
