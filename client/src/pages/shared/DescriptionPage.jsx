import React from 'react'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

const WORKFLOW_STEPS = [
  {
    title: 'Incident Intake',
    detail: 'Reports are captured with location, media, and contextual metadata from users and operators.',
  },
  {
    title: 'Data Validation',
    detail: 'Input quality checks standardize records and prepare events for downstream analysis.',
  },
  {
    title: 'Risk Assessment',
    detail: 'Scoring models estimate urgency and confidence to support prioritization decisions.',
  },
  {
    title: 'Operational Review',
    detail: 'Authorized teams verify incidents and assign the appropriate response workflow.',
  },
  {
    title: 'Alert Distribution',
    detail: 'Validated alerts are distributed to relevant users, zones, and operational channels.',
  },
]

export default function DescriptionPage() {
  return (
    <div className="info-page-root">
      <main className="info-page-shell">
        <header className="info-page-head">
          <div className="info-brand">
            <img src={siaraLogo} alt="SIARA" className="info-brand-logo" />
            <div>
              <p className="info-brand-name">SIARA</p>
              <p className="info-brand-caption">Road Safety Intelligence Platform</p>
            </div>
          </div>
          <div className="info-head-topline">
            <span className="info-head-kicker">System Workflow</span>
            <span className="info-page-badge">Operational Flow</span>
          </div>
          <h1 className="info-page-title">Platform Description</h1>
          <p className="info-page-intro">
            SIARA is an operational intelligence platform for road safety. It converts incident data
            into structured decisions, enabling faster coordination and more consistent field response.
          </p>
        </header>

        <section className="info-section-card info-description-overview">
          <h2 className="info-section-title">Overview</h2>
          <p>
            The platform combines citizen reporting, geospatial context, and AI-assisted evaluation
            to improve situational awareness across road safety operations.
          </p>
          <div className="info-description-highlights">
            <article>
              <strong>Operational clarity</strong>
              <span>One shared view of incidents, priorities, and response status.</span>
            </article>
            <article>
              <strong>Faster response cycles</strong>
              <span>Clear prioritization reduces delay between detection and action.</span>
            </article>
            <article>
              <strong>Consistent decision support</strong>
              <span>Standardized scoring helps teams align on urgency and next steps.</span>
            </article>
          </div>
        </section>

        <section className="info-section-card info-description-workflow">
          <h2 className="info-section-title">Service Workflow</h2>
          <p className="info-section-lead">A transparent end-to-end process from intake to validated communication.</p>
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
          <h2 className="info-section-title">Technology and Governance</h2>
          <p className="info-section-lead">
            SIARA balances intelligent automation with human validation to maintain reliability and accountability.
          </p>
          <div className="info-tech-tags" role="list" aria-label="Technologies">
            <span role="listitem">AI Risk Scoring</span>
            <span role="listitem">Geospatial Mapping</span>
            <span role="listitem">Real-time Event Stream</span>
            <span role="listitem">Verification Workflow</span>
            <span role="listitem">Notification Pipeline</span>
            <span role="listitem">Operational Analytics</span>
          </div>
        </section>
      </main>
    </div>
  )
}
