/**
 * @file HomePage.jsx
 * @description SIARA landing / marketing page. Fully static with no component state.
 *
 * Layout (top → bottom):
 *   1. Hero — logo, headline, CTA buttons
 *   2. How It Works — 3-step cards (Collect → Analyse → Alert)
 *   3. Mission — short manifesto block
 *   4. Global Stats — 4 key metric cards
 *   5. Services Grid — alternating text/art blocks with links
 *   6. Map Preview — embedded <MapPreview /> prototype
 *   7. Join CTA — registration call-to-action
 *   8. <Footer />
 *
 * Dependencies: MapPreview, Footer, MUI Divider
 */
import '../../styles/HomePage.css'
import logo from '../../assets/logos/siara-logo.png'
import MapPreview from '../../components/map/MapPreview' // interactive map widget
import Footer from '../../components/layout/Footer'      // shared site footer
import { Divider } from '@mui/material'                   // visual separator between hero & content

export default function HomePage(){
  return (
    <div className="home-root">

      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      {/* Full-width hero with centred logo, headline, sub-text, and two CTA buttons */}
      <section id="hero" className="hero-section">
        <div className="hero-inner">
          <div className="home-hero-logo-top">
            <img src={logo} alt="Logo SIARA" loading="lazy" className="home-hero-logo" />
          </div>
          <div className="hero-copy">
            <h1 className="hero-h1">Make roads safer with AI</h1>
            <p className="hero-sub">Analyze, predict and prevent accidents before they happen.</p>
            <div className="hero-buttons">
              <a href="/login" className="btn hero-btn-primary">Get Started</a>
              <a href="#services" className="btn hero-btn-secondary">Discover our services</a>
            </div>
          </div>
        </div>
      </section>
 <Divider variant="middle"  />

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      {/* Three-card grid explaining the SIARA pipeline: data → AI → alerts */}
      <section id="how" className="how-section">
        <h2 className="home-section-title">How does SIARA work?</h2>
        <div className="how-cards">
          <div className="how-card">
            <div className="how-icon">📝</div>
            <h3>Data Collection</h3>
            <p>Aggregated road data, accident history, weather and traffic density.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">🤖</div>
            <h3>Analysis & Predictive AI</h3>
            <p>Machine learning models to estimate risk zones.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">⚠️</div>
            <h3>Real-Time Alerts</h3>
            <p>Notifications and visualizations to anticipate and prevent accidents.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MISSION STATEMENT ═══════════════════ */}
      {/* Short manifesto describing SIARA's goal */}
      <section id="mission" className="mission-section">
        <div className="mission-inner">
          <h2 className="mission-title">Our Mission <span className="mission-icon">🚦</span></h2>
          <p>Significantly reduce road accidents by putting the power of AI and data at the service of drivers, authorities and smart infrastructure developers.</p>
        </div>
      </section>

      {/* ═══════════════════ GLOBAL STATS ═══════════════════ */}
      {/* 4-column grid of key road-safety metrics */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">🌍</div><div className="home-stat-value">1.35M</div><div className="home-stat-label">deaths/year worldwide</div></div>
          <div className="stat-card"><div className="stat-icon">🎯</div><div className="home-stat-value">50%</div><div className="home-stat-label">2030 reduction target</div></div>
          <div className="stat-card"><div className="stat-icon">📊</div><div className="home-stat-value">92%</div><div className="home-stat-label">Simulated accuracy</div></div>
          <div className="stat-card"><div className="stat-icon">🗺️</div><div className="home-stat-value">+1000</div><div className="home-stat-label">High-risk zones</div></div>
        </div>
      </section>

      {/* ═══════════════════ SERVICES GRID ═══════════════════ */}
      {/* Alternating text-left / art-right blocks showcasing the 3 main products */}
      <section id="services" className="services-section">
        <h2 className="section-title">SIARA Services</h2>
        <div className="service-block alt">
          <div className="service-text">
            <h3>Analytics Dashboard</h3>
            <p>Aggregated visualizations, time trends and dynamic filters to understand risk evolution.</p>
            <a href="/map" className="btn small">Learn more</a>
          </div>
          <div className="service-art" aria-hidden="true">
            <div className="mock dash">
              <div className="mock-dash-ui">
                <div className="mock-dash-header"><span className="mock-dot red"></span><span className="mock-dot yellow"></span><span className="mock-dot green"></span><span className="mock-title-bar">SIARA Analytics</span></div>
                <div className="mock-dash-body">
                  <div className="mock-stat-row">
                    <div className="mock-stat"><span className="mock-stat-val">1,247</span><span className="mock-stat-lbl">Incidents</span></div>
                    <div className="mock-stat"><span className="mock-stat-val">-12%</span><span className="mock-stat-lbl">vs last month</span></div>
                    <div className="mock-stat"><span className="mock-stat-val">87%</span><span className="mock-stat-lbl">AI accuracy</span></div>
                  </div>
                  <div className="mock-chart">
                    <div className="mock-bar" style={{height:'60%'}}></div>
                    <div className="mock-bar" style={{height:'80%'}}></div>
                    <div className="mock-bar" style={{height:'45%'}}></div>
                    <div className="mock-bar" style={{height:'90%'}}></div>
                    <div className="mock-bar" style={{height:'70%'}}></div>
                    <div className="mock-bar" style={{height:'55%'}}></div>
                    <div className="mock-bar" style={{height:'75%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="service-block">
          <div className="service-art" aria-hidden="true">
            <div className="mock map">
              <div className="mock-map-ui">
                <div className="mock-map-canvas">
                  <div className="mock-map-road road-h"></div>
                  <div className="mock-map-road road-v"></div>
                  <div className="mock-map-road road-d"></div>
                  <div className="mock-pin high" style={{top:'25%',left:'35%'}}><span>!</span></div>
                  <div className="mock-pin med" style={{top:'50%',left:'60%'}}><span>⚠</span></div>
                  <div className="mock-pin low" style={{top:'65%',left:'25%'}}><span>✓</span></div>
                  <div className="mock-pin high" style={{top:'35%',left:'70%'}}><span>!</span></div>
                  <div className="mock-map-legend">
                    <span className="legend-dot high"></span>High
                    <span className="legend-dot med"></span>Med
                    <span className="legend-dot low"></span>Low
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="service-text">
            <h3>Prediction Map</h3>
            <p>Interactive map highlighting risk areas at the local level.</p>
            <a href="/predictions" className="btn small">Learn more</a>
          </div>
        </div>
        <div className="service-block alt">
          <div className="service-text">
            <h3>SIARA Mobile App</h3>
            <p>On-board alerts, risk notifications and preventive guidance at your fingertips.</p>
            <a href="/map" className="btn small">Learn more</a>
          </div>
          <div className="service-art" aria-hidden="true"><div className="mock mobile"><span className="mock-icon">📱</span><span className="mock-label">Mobile App</span></div></div>
        </div>
      </section>

      {/* ═══════════════════ MAP PREVIEW ═══════════════════ */}
      {/* Embedded interactive map prototype via <MapPreview /> component */}
      <section className="map-preview-section" aria-labelledby="map-preview-heading">
        <h2 id="map-preview-heading" className="section-title">Map Preview</h2>
        <div className="map-frame">
          <MapPreview />
        </div>
      </section>

      {/* ═══════════════════ JOIN CTA ═══════════════════ */}
      {/* Final call-to-action encouraging user registration */}
      <section id="join" className="join-section">
        <div className="join-inner">
          <h2>Join the Initiative</h2>
          <p>Collaborate to make Algerian roads safer through data and artificial intelligence.</p>
          <a href="/register" className="btn join-btn">Sign Up</a>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <Footer />
    </div>
  )
}
