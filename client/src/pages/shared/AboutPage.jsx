import React from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function AboutPage() {
  const { t } = useTranslation(['pages', 'common'])

  return (
    <div className="info-page-root">
      <main className="info-page-shell">
        <header className="info-page-head">
          <div className="info-brand">
            <img src={siaraLogo} alt="SIARA" className="info-brand-logo" />
            <div>
              <p className="info-brand-name">SIARA</p>
              <p className="info-brand-caption">{t('aboutPage.brandCaption')}</p>
            </div>
          </div>
          <div className="info-head-topline">
            <span className="info-head-kicker">{t('aboutPage.kicker')}</span>
            <span className="info-page-badge">{t('aboutPage.badge')}</span>
          </div>
          <h1 className="info-page-title">{t('aboutPage.title')}</h1>
          <p className="info-page-intro">
            {t('aboutPage.intro')}
          </p>
          <div className="info-about-metrics">
            <article>
              <strong>{t('aboutPage.metrics.realtime.title')}</strong>
              <span>{t('aboutPage.metrics.realtime.desc')}</span>
            </article>
            <article>
              <strong>{t('aboutPage.metrics.ai.title')}</strong>
              <span>{t('aboutPage.metrics.ai.desc')}</span>
            </article>
            <article>
              <strong>{t('aboutPage.metrics.visibility.title')}</strong>
              <span>{t('aboutPage.metrics.visibility.desc')}</span>
            </article>
          </div>
        </header>

        <section className="info-section-card info-simple-grid">
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">OV</div>
            <h3>{t('aboutPage.features.overview.title')}</h3>
            <p>
              {t('aboutPage.features.overview.desc')}
            </p>
          </article>
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">MS</div>
            <h3>{t('aboutPage.features.mission.title')}</h3>
            <p>{t('aboutPage.features.mission.desc')}</p>
          </article>
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">VS</div>
            <h3>{t('aboutPage.features.vision.title')}</h3>
            <p>{t('aboutPage.features.vision.desc')}</p>
          </article>
        </section>

        <section className="info-section-card info-about-story">
          <h2 className="info-section-title">{t('aboutPage.impact.title')}</h2>
          <p className="info-section-lead">
            {t('aboutPage.impact.lead')}
          </p>
          <div className="info-about-story-grid">
            <article>
              <h3>{t('aboutPage.impact.steps.capture.title')}</h3>
              <p>{t('aboutPage.impact.steps.capture.desc')}</p>
            </article>
            <article>
              <h3>{t('aboutPage.impact.steps.analyze.title')}</h3>
              <p>{t('aboutPage.impact.steps.analyze.desc')}</p>
            </article>
            <article>
              <h3>{t('aboutPage.impact.steps.act.title')}</h3>
              <p>{t('aboutPage.impact.steps.act.desc')}</p>
            </article>
          </div>
        </section>

        <section className="info-section-card">
          <h2 className="info-section-title">{t('aboutPage.capabilities.title')}</h2>
          <div className="info-card-grid">
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">RM</div>
              <h3>{t('aboutPage.capabilities.riskMapping.title')}</h3>
              <p>{t('aboutPage.capabilities.riskMapping.desc')}</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">AL</div>
              <h3>{t('aboutPage.capabilities.alertEngine.title')}</h3>
              <p>{t('aboutPage.capabilities.alertEngine.desc')}</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">AN</div>
              <h3>{t('aboutPage.capabilities.analytics.title')}</h3>
              <p>{t('aboutPage.capabilities.analytics.desc')}</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">CO</div>
              <h3>{t('aboutPage.capabilities.coordination.title')}</h3>
              <p>{t('aboutPage.capabilities.coordination.desc')}</p>
            </article>
          </div>
        </section>

        <section className="info-section-card">
          <h2 className="info-section-title">{t('aboutPage.values.title')}</h2>
          <div className="info-card-grid info-values-grid">
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">SV</div>
              <h3>{t('aboutPage.values.safety')}</h3>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">EF</div>
              <h3>{t('aboutPage.values.efficiency')}</h3>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">IN</div>
              <h3>{t('aboutPage.values.innovation')}</h3>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
