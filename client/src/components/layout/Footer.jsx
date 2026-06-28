import React from 'react'
import { useTranslation } from 'react-i18next'
import logo from '../../assets/logos/siara-logo.png'

export default function Footer() {
  const { t } = useTranslation(['pages', 'common'])
  return (
    <footer className="siara-footer" aria-label={t('footer.ariaLabel')}>
      <div className="footer-max">
        <div className="footer-col">
          <img src={logo} alt={t('footer.logoAlt')} className="footer-logo" loading="lazy" />
          <address className="footer-address">{t('footer.address')}<br/>contact@siara.dz</address>
          <div className="footer-copy">© {new Date().getFullYear()} SIARA</div>
        </div>
        <div className="footer-col">
          <h5>{t('footer.linksHeading')}</h5>
          <ul className="footer-links">
            <li><a href="/home">{t('common:nav.home')}</a></li>
            <li><a href="/about">{t('footer.about')}</a></li>
            <li><a href="/predictions">{t('common:nav.predictions')}</a></li>
            <li><a href="/contact">{t('footer.contact')}</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h5>{t('footer.contactHeading')}</h5>
            <a className="footer-mail" href="mailto:contact@siara.dz">contact@siara.dz</a>
            <div className="social-row">
              <a href="#" aria-label={t('footer.socialLinkedIn')} className="social-circle">in</a>
              <a href="#" aria-label={t('footer.socialTwitter')} className="social-circle">t</a>
              <a href="#" aria-label={t('footer.socialGitHub')} className="social-circle">gh</a>
            </div>
        </div>
      </div>
    </footer>
  )
}
