import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined'
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined'
import siaraLogo from '../../assets/logos/siara-logo.png'
import { submitSupportMessage } from '../../services/supportMessagesService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function FeedSidebarNav({ activeKey, onOpenQuiz, triggerPanel }) {
  const navigate = useNavigate()
  const { t } = useTranslation(['pages', 'common'])
  const [openPanel, setOpenPanel] = useState(null)

  const NAV_ITEMS = [
    { key: 'feed', label: t('feedSidebarNav.nav.newsFeed'), icon: <ArticleOutlinedIcon fontSize="inherit" />, path: '/news' },
    { key: 'map', label: t('feedSidebarNav.nav.incidentMap'), icon: <MapOutlinedIcon fontSize="inherit" />, path: '/map' },
    { key: 'alerts', label: t('common:nav.alerts'), icon: <NotificationsActiveOutlinedIcon fontSize="inherit" />, path: '/alerts' },
    { key: 'reports', label: t('feedSidebarNav.nav.myReports'), icon: <EditNoteOutlinedIcon fontSize="inherit" />, path: '/report' },
    { key: 'dashboard', label: t('common:nav.dashboard'), icon: <SpeedOutlinedIcon fontSize="inherit" />, path: '/dashboard' },
    { key: 'predictions', label: t('common:nav.predictions'), icon: <AutoGraphOutlinedIcon fontSize="inherit" />, path: '/predictions' },
  ]

  const INFO_ITEMS = [
    { key: 'contact', label: t('feedSidebarNav.nav.contact'), icon: <PhoneOutlinedIcon fontSize="inherit" />, path: '/contact' },
    { key: 'about', label: t('feedSidebarNav.nav.about'), icon: <InfoOutlinedIcon fontSize="inherit" />, path: '/about' },
    { key: 'overview', label: t('feedSidebarNav.nav.overview'), icon: <MenuBookOutlinedIcon fontSize="inherit" />, path: '/overview' },
  ]

  const ACCOUNT_ITEMS = [
    { key: 'notifications', label: t('common:nav.notifications'), icon: <NotificationsOutlinedIcon fontSize="inherit" />, path: '/notifications' },
    { key: 'profile', label: t('common:nav.profile'), icon: <PersonOutlinedIcon fontSize="inherit" />, path: '/profile' },
    { key: 'settings', label: t('common:nav.settings'), icon: <SettingsOutlinedIcon fontSize="inherit" />, path: '/settings' },
  ]

  useEffect(() => {
    if (triggerPanel) {
      setOpenPanel('contact')
    }
  }, [triggerPanel])
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
    if (contactForm.name.trim().length < 2) nextErrors.name = t('feedSidebarNav.contact.errorName')
    if (!EMAIL_REGEX.test(contactForm.email.trim())) nextErrors.email = t('feedSidebarNav.contact.errorEmail')
    if (contactForm.message.trim().length < 10) nextErrors.message = t('feedSidebarNav.contact.errorMessage')
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
      setContactSuccess(t('feedSidebarNav.contact.successMessage'))
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      setContactSubmitError(error?.message || t('feedSidebarNav.contact.submitError'))
    } finally {
      setContactSubmitting(false)
    }
  }

  const renderItem = (item, onClickOverride, extraClassName = '') => (
    <button
      key={item.key}
      className={`nav-item ${(activeKey === item.key || openPanel === item.key) ? 'nav-item-active' : ''} ${extraClassName}`.trim()}
      onClick={onClickOverride || (() => {
        if (item.key === 'contact' || item.key === 'about' || item.key === 'overview') {
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
        <div className="nav-section-label">{t('feedSidebarNav.section.navigation')}</div>
        {NAV_ITEMS.map((item) => renderItem(item))}

        <div className="nav-section-label">{t('feedSidebarNav.section.tools')}</div>
        {onOpenQuiz ? renderItem({ key: 'quiz', label: t('feedSidebarNav.nav.driverQuiz'), icon: <DirectionsCarOutlinedIcon fontSize="inherit" /> }, onOpenQuiz) : null}

        <div className="nav-section-label nav-section-label-info">{t('feedSidebarNav.section.info')}</div>
        <div className="nav-info-group">
          {INFO_ITEMS.map((item) => renderItem(item, undefined, 'nav-item-info'))}
        </div>

        <div className="nav-section-label">{t('feedSidebarNav.section.account')}</div>
        {ACCOUNT_ITEMS.map((item) => renderItem(item))}
      </nav>

      {openPanel && typeof document !== 'undefined'
        ? createPortal(
            <div className="contact-quick-backdrop" onClick={() => setOpenPanel(null)} role="dialog" aria-modal="true" aria-label={t('feedSidebarNav.panel.ariaLabel')}>
              <div className={`contact-quick-modal panel-${openPanel}`} onClick={(event) => event.stopPropagation()}>
                {openPanel === 'contact' ? (
                  <>
                    <div className="contact-quick-head">
                      <div className="contact-quick-head-main">
                        <div className="contact-quick-brand">
                          <img src={siaraLogo} alt="SIARA" className="contact-quick-brand-logo" />
                          <div>
                            <span className="contact-quick-kicker">{t('feedSidebarNav.contact.kicker')}</span>
                            <h3>{t('feedSidebarNav.contact.title')}</h3>
                          </div>
                        </div>
                        <p className="contact-quick-sub">{t('feedSidebarNav.contact.subtitle')}</p>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label={t('feedSidebarNav.contact.closeAriaLabel')}>×</button>
                    </div>

                    <div className="contact-quick-layout">
                      <form className="contact-quick-form" onSubmit={submitContactForm} noValidate>
                        <div className="contact-quick-grid">
                          <div>
                            <label htmlFor="quick-contact-name">{t('feedSidebarNav.contact.labelName')}</label>
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
                            <label htmlFor="quick-contact-email">{t('feedSidebarNav.contact.labelEmail')}</label>
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

                        <label htmlFor="quick-contact-message">{t('feedSidebarNav.contact.labelMessage')}</label>
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
                            {contactSubmitting ? t('feedSidebarNav.contact.sending') : t('feedSidebarNav.contact.sendButton')}
                          </button>
                          <a className="contact-quick-mail" href="https://mail.google.com/mail/?view=cm&fs=1&to=siara.ai.app@gmail.com" target="_blank" rel="noopener noreferrer">{t('feedSidebarNav.contact.emailDirectly')}</a>
                        </div>
                        {contactSubmitError ? (
                          <p className="contact-quick-error" role="alert">{contactSubmitError}</p>
                        ) : null}
                      </form>

                      <aside className="contact-quick-side" aria-label={t('feedSidebarNav.contact.sideAriaLabel')}>
                        <article>
                          <h4>{t('feedSidebarNav.contact.responseWindowTitle')}</h4>
                          <p>{t('feedSidebarNav.contact.responseWindowText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.contact.bestForTitle')}</h4>
                          <p>{t('feedSidebarNav.contact.bestForText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.contact.directContactTitle')}</h4>
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
                        <span className="contact-quick-kicker">{t('feedSidebarNav.about.kicker')}</span>
                        <h3>{t('feedSidebarNav.about.title')}</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label={t('feedSidebarNav.about.closeAriaLabel')}>×</button>
                    </div>
                    <div className="info-quick-block">
                      <div className="info-quick-brand">
                        <img src={siaraLogo} alt="SIARA" className="info-quick-brand-logo" />
                        <div>
                          <p className="info-quick-brand-name">SIARA</p>
                          <p className="info-quick-brand-caption">{t('feedSidebarNav.about.brandCaption')}</p>
                        </div>
                      </div>
                      <p className="info-quick-lead">
                        {t('feedSidebarNav.about.lead')}
                      </p>
                      <div className="info-quick-pillars">
                        <article>
                          <h4>{t('feedSidebarNav.about.missionTitle')}</h4>
                          <p>{t('feedSidebarNav.about.missionText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.about.visionTitle')}</h4>
                          <p>{t('feedSidebarNav.about.visionText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.about.approachTitle')}</h4>
                          <p>{t('feedSidebarNav.about.approachText')}</p>
                        </article>
                      </div>
                      <div className="info-quick-mini-cards">
                        <article>
                          <h4>{t('feedSidebarNav.about.riskMappingTitle')}</h4>
                          <p>{t('feedSidebarNav.about.riskMappingText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.about.alertIntelTitle')}</h4>
                          <p>{t('feedSidebarNav.about.alertIntelText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.about.responseCoordTitle')}</h4>
                          <p>{t('feedSidebarNav.about.responseCoordText')}</p>
                        </article>
                        <article>
                          <h4>{t('feedSidebarNav.about.performanceTitle')}</h4>
                          <p>{t('feedSidebarNav.about.performanceText')}</p>
                        </article>
                      </div>
                    </div>
                  </>
                ) : null}

                {openPanel === 'overview' ? (
                  <>
                    <div className="contact-quick-head">
                      <div>
                        <span className="contact-quick-kicker">{t('feedSidebarNav.overview.kicker')}</span>
                        <h3>{t('feedSidebarNav.overview.title')}</h3>
                      </div>
                      <button type="button" className="contact-quick-close" onClick={() => setOpenPanel(null)} aria-label={t('feedSidebarNav.overview.closeAriaLabel')}>×</button>
                    </div>
                    <div className="info-quick-block">
                      <p className="info-quick-lead">
                        {t('feedSidebarNav.overview.lead')}
                      </p>
                      <ol className="info-quick-steps info-quick-steps-pro">
                        <li><strong>{t('feedSidebarNav.overview.step1Title')}</strong><span>{t('feedSidebarNav.overview.step1Text')}</span></li>
                        <li><strong>{t('feedSidebarNav.overview.step2Title')}</strong><span>{t('feedSidebarNav.overview.step2Text')}</span></li>
                        <li><strong>{t('feedSidebarNav.overview.step3Title')}</strong><span>{t('feedSidebarNav.overview.step3Text')}</span></li>
                        <li><strong>{t('feedSidebarNav.overview.step4Title')}</strong><span>{t('feedSidebarNav.overview.step4Text')}</span></li>
                        <li><strong>{t('feedSidebarNav.overview.step5Title')}</strong><span>{t('feedSidebarNav.overview.step5Text')}</span></li>
                      </ol>
                      <p className="info-quick-tech">
                        <strong>{t('feedSidebarNav.overview.techStackLabel')}</strong> {t('feedSidebarNav.overview.techStackText')}
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
