/**
 * @file DescriptionPage.jsx
 * @description SIARA project description page — presents the purpose,
 *   key features, and getting-started instructions.
 */

// Import React and associated stylesheet
import React from 'react'
import '../../styles/DescriptionPage.css'

/**
 * Description page component.
 * Provides a textual overview of the project, its features, and how to get started.
 */
export default function DescriptionPage(){
  return (
    <div className="description-root">
      <main className="description-container">
        {/* --- Header with title and subtitle --- */}
        <header className="description-header">
          <h1>SIARA — Description</h1>
          <p className="lead">Visualization and road risk prediction prototype — project overview and objectives.</p>
        </header>

        {/* --- Section: main project objective --- */}
        <section className="description-section">
          <h2>Project Purpose</h2>
          <p>
            SIARA is a prototype designed to provide an interface for visualizing risk zones
            and simulating road accident predictions. The goal is to help
            decision-makers and technical teams identify risk corridors
            and test preventive measures.
          </p>
        </section>

        {/* --- Section: key features list --- */}
        <section className="description-section">
          <h2>Key Features</h2>
          <ul>
            <li>Interactive maps with risk layers and markers</li>
            <li>Simulated predictions and parameter controls</li>
            <li>Administrative dashboards for monitoring</li>
            <li>Simple exports and snapshot sharing</li>
          </ul>
        </section>

        {/* --- Section: getting-started instructions --- */}
        <section className="description-section">
          <h2>Getting Started</h2>
          <p>Log in via the login page to access the maps and simulation tools.</p>
        </section>
      </main>
    </div>
  )
}
