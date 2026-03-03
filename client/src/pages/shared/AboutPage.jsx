/**
 * @file AboutPage.jsx
 * @description "About" page — presents the SIARA project, its objectives,
 *   its key features and the current status of the prototype.
 */

// Import React, styles and project logo
import React from 'react'
import '../../styles/AboutPage.css'
import logo from '../../assets/logos/siara-logo.png'

/**
 * About page component.
 * Displays a descriptive card with header, sections and footer.
 */
export default function AboutPage(){
  return (
    <div className="about-root">
      <div className="about-card">
        {/* --- Header: logo, tagline and short description --- */}
        <header className="about-header">
          <img src={logo} alt="SIARA" className="about-logo" />
          <div className="about-kicker">Road Risk Prediction — Prototype</div>
          <h1 className="about-title">About SIARA</h1>
          <p className="about-subtitle">
            SIARA is an experimental platform that uses artificial intelligence and road data
            to visualize and anticipate accident risks in Algeria.
          </p>
        </header>

        {/* --- Section: project motivation --- */}
        <section className="about-section">
          <h2>Why SIARA?</h2>
          <p>
            SIARA's objective is to provide road safety stakeholders (local authorities, decision-makers, researchers)
            with a modern tool to explore risk areas, track accident trends and test prevention scenarios.
          </p>
        </section>

        {/* --- Grid: key features + project status --- */}
        <section className="about-section about-grid">
          <div>
            <h3>Key Features</h3>
            <ul>
              <li>Interactive maps with road risk zones.</li>
              <li>Predictions based on AI models.</li>
              <li>Temporal visualization of incidents and trends.</li>
            </ul>
          </div>
          <div>
            <h3>Project Status</h3>
            <p>
              This interface is a frontend prototype. Some data and services are simulated to illustrate
              the user experience and key workflows of the platform.
            </p>
          </div>
        </section>

        {/* --- Footer: legal disclaimer --- */}
        <footer className="about-footer">
          <p>
            This prototype was designed for educational experimentation and demonstration purposes. It does not replace
            official accident monitoring and prevention systems.
          </p>
        </footer>
      </div>
    </div>
  )
}
