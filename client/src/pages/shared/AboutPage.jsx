import React from 'react'
import '../../styles/InfoPages.css'
import siaraLogo from '../../assets/logos/siara-logo.png'

export default function AboutPage() {
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
            <span className="info-head-kicker">Project Identity</span>
            <span className="info-page-badge">SIARA Vision</span>
          </div>
          <h1 className="info-page-title">About SIARA</h1>
          <p className="info-page-intro">
            SIARA is a smart road safety platform that combines reports, maps, and AI to support
            safer mobility and faster incident response.
          </p>
          <div className="info-about-metrics">
            <article>
              <strong>Real-time coordination</strong>
              <span>Live map intelligence for field teams and road users.</span>
            </article>
            <article>
              <strong>AI-assisted prioritization</strong>
              <span>Severity and reliability scoring for better response decisions.</span>
            </article>
            <article>
              <strong>Operational visibility</strong>
              <span>Unified alerts, reports, and analytics in one SIARA workspace.</span>
            </article>
          </div>
        </header>

        <section className="info-section-card info-simple-grid">
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">OV</div>
            <h3>What is SIARA</h3>
            <p>
              SIARA centralizes incident reporting, monitoring, and operational visibility in one unified platform.
            </p>
          </article>
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">MS</div>
            <h3>Mission</h3>
            <p>Improve road safety and incident response with accurate, timely, and actionable information.</p>
          </article>
          <article className="info-feature-card">
            <div className="info-feature-icon" aria-hidden="true">VS</div>
            <h3>Vision</h3>
            <p>Support smart city integration using AI and connected data for proactive public safety.</p>
          </article>
        </section>

        <section className="info-section-card info-about-story">
          <h2 className="info-section-title">How SIARA Creates Impact</h2>
          <p className="info-section-lead">
            SIARA is built to turn fragmented incident data into coordinated action. Instead of relying on isolated
            reports, it connects citizens, responders, and supervisors through one decision-ready platform.
          </p>
          <div className="info-about-story-grid">
            <article>
              <h3>1. Capture</h3>
              <p>Citizens submit incidents with location, media, and context from the field.</p>
            </article>
            <article>
              <h3>2. Analyze</h3>
              <p>AI models classify risk, detect anomalies, and rank urgency for operators.</p>
            </article>
            <article>
              <h3>3. Act</h3>
              <p>Police and teams validate events, trigger alerts, and coordinate interventions quickly.</p>
            </article>
          </div>
        </section>

        <section className="info-section-card">
          <h2 className="info-section-title">SIARA Core Capabilities</h2>
          <div className="info-card-grid">
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">RM</div>
              <h3>Risk Mapping</h3>
              <p>Visualize dangerous corridors and hotspot zones with incident density and severity layers.</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">AL</div>
              <h3>Alert Engine</h3>
              <p>Generate targeted alerts by location, incident type, and priority level in real time.</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">AN</div>
              <h3>Operational Analytics</h3>
              <p>Track trends, response performance, and verification throughput across the network.</p>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">CO</div>
              <h3>Cross-Team Coordination</h3>
              <p>Support consistent decision-making between field agents, dispatch, and supervisors.</p>
            </article>
          </div>
        </section>

        <section className="info-section-card">
          <h2 className="info-section-title">Key Values</h2>
          <div className="info-card-grid info-values-grid">
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">SV</div>
              <h3>Safety</h3>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">EF</div>
              <h3>Efficiency</h3>
            </article>
            <article className="info-feature-card">
              <div className="info-feature-icon" aria-hidden="true">IN</div>
              <h3>Innovation</h3>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
