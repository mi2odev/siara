import React from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function DescriptionPage() {
  const { t } = useTranslation(['pages', 'common'])

  const WORKFLOW_STEPS = [
    {
      title: t('descriptionPage.workflow.steps.intake.title'),
      detail: t('descriptionPage.workflow.steps.intake.detail'),
    },
    {
      title: t('descriptionPage.workflow.steps.validation.title'),
      detail: t('descriptionPage.workflow.steps.validation.detail'),
    },
    {
      title: t('descriptionPage.workflow.steps.riskAssessment.title'),
      detail: t('descriptionPage.workflow.steps.riskAssessment.detail'),
    },
    {
      title: t('descriptionPage.workflow.steps.operationalReview.title'),
      detail: t('descriptionPage.workflow.steps.operationalReview.detail'),
    },
    {
      title: t('descriptionPage.workflow.steps.alertDistribution.title'),
      detail: t('descriptionPage.workflow.steps.alertDistribution.detail'),
    },
  ]

  return (
    <div className="info-page-root">
      <main className="info-page-shell">
        <header className="info-page-head">
          <div className="info-brand">
            <img src={siaraLogo} alt="SIARA" className="info-brand-logo" />
            <div>
              <p className="info-brand-name">SIARA</p>
              <p className="info-brand-caption">{t('descriptionPage.brandCaption')}</p>
            </div>
          </div>
          <div className="info-head-topline">
            <span className="info-head-kicker">{t('descriptionPage.kicker')}</span>
            <span className="info-page-badge">{t('descriptionPage.badge')}</span>
          </div>
          <h1 className="info-page-title">{t('descriptionPage.title')}</h1>
          <p className="info-page-intro">
            {t('descriptionPage.intro')}
          </p>
        </header>

        <section className="info-section-card info-description-overview">
          <h2 className="info-section-title">{t('descriptionPage.overview.title')}</h2>
          <p>
            {t('descriptionPage.overview.body')}
          </p>
          <div className="info-description-highlights">
            <article>
              <strong>{t('descriptionPage.overview.highlights.clarity.heading')}</strong>
              <span>{t('descriptionPage.overview.highlights.clarity.detail')}</span>
            </article>
            <article>
              <strong>{t('descriptionPage.overview.highlights.response.heading')}</strong>
              <span>{t('descriptionPage.overview.highlights.response.detail')}</span>
            </article>
            <article>
              <strong>{t('descriptionPage.overview.highlights.decision.heading')}</strong>
              <span>{t('descriptionPage.overview.highlights.decision.detail')}</span>
            </article>
          </div>
        </section>

        <section className="info-section-card info-description-workflow">
          <h2 className="info-section-title">{t('descriptionPage.workflow.title')}</h2>
          <p className="info-section-lead">{t('descriptionPage.workflow.lead')}</p>
          <ol className="info-step-list">
            {WORKFLOW_STEPS.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="info-section-card info-description-tech">
          <h2 className="info-section-title">{t('descriptionPage.tech.title')}</h2>
          <p className="info-section-lead">
            {t('descriptionPage.tech.lead')}
          </p>
          <div className="info-tech-tags" role="list" aria-label={t('descriptionPage.tech.tagsAriaLabel')}>
            <span role="listitem">{t('descriptionPage.tech.tags.aiRiskScoring')}</span>
            <span role="listitem">{t('descriptionPage.tech.tags.geospatialMapping')}</span>
            <span role="listitem">{t('descriptionPage.tech.tags.realtimeEventStream')}</span>
            <span role="listitem">{t('descriptionPage.tech.tags.verificationWorkflow')}</span>
            <span role="listitem">{t('descriptionPage.tech.tags.notificationPipeline')}</span>
            <span role="listitem">{t('descriptionPage.tech.tags.operationalAnalytics')}</span>
          </div>
        </section>
      </main>
    </div>
  )
}
