import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import { Divider } from '@mui/material'
import '../../styles/HomePage.css'
import logo from '../../assets/logos/siara-logo.png'
import MapPreview from '../../components/map/MapPreview'
import Footer from '../../components/layout/Footer'

export default function HomePage(){
  return (
    <div className="home-root">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section id="hero" className="hero-section">
        <div className="hero-inner">
          <div className="home-hero-logo-top">
            <img src={logo} alt="Logo SIARA" loading="lazy" className="home-hero-logo" />
          </div>
          <div className="hero-copy">
            <p className="hero-eyebrow">AI-Powered Road Safety Platform</p>
            <h1 className="hero-h1">Make roads safer <span>with AI</span></h1>
            <p className="hero-sub">Analyze, predict and prevent accidents before they happen.</p>
            <div className="hero-buttons">
              <a href="/login" className="btn hero-btn-primary">Get Started <ArrowForwardRoundedIcon fontSize="inherit" /></a>
              <a href="#services" className="btn hero-btn-secondary">Discover our services</a>
            </div>
          </div>
        </div>
      </section>

      <Divider variant="middle" sx={{ borderColor: '#e2e8f0' }} />

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how" className="how-section">
        <h2 className="home-section-title">How does SIARA work?</h2>
        <div className="how-cards">
          <div className="how-card">
            <div className="how-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
              </svg>
            </div>
            <span className="how-step">Step 01</span>
            <h3>Data Collection</h3>
            <p>Aggregated road data, accident history, weather and traffic density.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>
              </svg>
            </div>
            <span className="how-step">Step 02</span>
            <h3>Analysis & Predictive AI</h3>
            <p>Machine learning models to estimate risk zones in real time.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                <circle cx="18" cy="5" r="3" fill="#ef4444" stroke="none"/>
              </svg>
            </div>
            <span className="how-step">Step 03</span>
            <h3>Real-Time Alerts</h3>
            <p>Notifications and visualizations to anticipate and prevent accidents.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MISSION ═══════════════════ */}
      <section id="mission" className="mission-section">
        <div className="mission-inner">
          <p className="mission-eyebrow">Our Mission</p>
          <h2 className="mission-title">Zero preventable accidents.</h2>
          <p>Significantly reduce road accidents by putting the power of AI and data at the service of drivers, authorities and smart infrastructure developers.</p>
        </div>
      </section>

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="home-stat-value">1.35M</div>
            <div className="home-stat-label">deaths / year worldwide</div>
          </div>
          <div className="stat-card">
            <div className="home-stat-value">50%</div>
            <div className="home-stat-label">2030 reduction target</div>
          </div>
          <div className="stat-card">
            <div className="home-stat-value">92%</div>
            <div className="home-stat-label">Simulated accuracy</div>
          </div>
          <div className="stat-card">
            <div className="home-stat-value">+1000</div>
            <div className="home-stat-label">High-risk zones mapped</div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ SERVICES ═══════════════════ */}
      <section id="services" className="services-section">
        <h2 className="section-title">SIARA Services</h2>

        <div className="service-block alt">
          <div className="service-text">
            <span className="service-tag">Analytics</span>
            <h3>Analytics Dashboard</h3>
            <p>Aggregated visualizations, time trends and dynamic filters to understand risk evolution.</p>
            <a href="/map" className="btn small">Learn more <ArrowForwardRoundedIcon fontSize="inherit" /></a>
          </div>
          {/* ── Analytics Dashboard mock ── */}
          <div className="service-art" aria-hidden="true">
            <div className="mock-window">
              <div className="mock-window-bar">
                <span className="mw-dot"></span>
                <span className="mw-dot"></span>
                <span className="mw-dot"></span>
                <span className="mw-url">siara.app/dashboard</span>
              </div>
              <div className="mock-window-body">
                <div className="mw-sidebar">
                  <div className="mw-sb-logo">S</div>
                  <div className="mw-sb-item active"></div>
                  <div className="mw-sb-item"></div>
                  <div className="mw-sb-item"></div>
                  <div className="mw-sb-item"></div>
                </div>
                <div className="mw-content">
                  <div className="mw-topbar">
                    <span className="mw-page-title">Analytics</span>
                    <span className="mw-badge">Live</span>
                  </div>
                  <div className="mw-kpi-row">
                    <div className="mw-kpi">
                      <span className="mw-kpi-val">1,247</span>
                      <span className="mw-kpi-lbl">Incidents</span>
                    </div>
                    <div className="mw-kpi accent">
                      <span className="mw-kpi-val">−12%</span>
                      <span className="mw-kpi-lbl">vs last month</span>
                    </div>
                    <div className="mw-kpi">
                      <span className="mw-kpi-val">87%</span>
                      <span className="mw-kpi-lbl">AI accuracy</span>
                    </div>
                  </div>
                  <div className="mw-chart-area">
                    <div className="mw-chart-label">Incidents / week</div>
                    <div className="mw-chart">
                      <div className="mw-bar" style={{height:'55%'}}></div>
                      <div className="mw-bar" style={{height:'75%'}}></div>
                      <div className="mw-bar" style={{height:'42%'}}></div>
                      <div className="mw-bar hi" style={{height:'90%'}}></div>
                      <div className="mw-bar" style={{height:'68%'}}></div>
                      <div className="mw-bar" style={{height:'50%'}}></div>
                      <div className="mw-bar" style={{height:'72%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="service-block">
          {/* ── Prediction Map — real Leaflet map ── */}
          <div className="service-art">
            <div className="mock-window">
              <div className="mock-window-bar">
                <span className="mw-dot"></span>
                <span className="mw-dot"></span>
                <span className="mw-dot"></span>
                <span className="mw-url">siara.app/map</span>
              </div>
              <div className="mock-map-real">
                <MapPreview showTooltip={false} />
                <div className="mm-legend" aria-hidden="true">
                  <span className="mm-ld high"></span>High
                  <span className="mm-ld med"></span>Med
                  <span className="mm-ld low"></span>Low
                </div>
              </div>
            </div>
          </div>
          <div className="service-text">
            <span className="service-tag">Mapping</span>
            <h3>Prediction Map</h3>
            <p>Interactive map highlighting risk areas at the local level with real-time incident overlays.</p>
            <a href="/predictions" className="btn small">Learn more <ArrowForwardRoundedIcon fontSize="inherit" /></a>
          </div>
        </div>

        <div className="service-block alt">
          <div className="service-text">
            <span className="service-tag">Mobile</span>
            <h3>SIARA Mobile App</h3>
            <p>On-board alerts, risk notifications and preventive guidance at your fingertips.</p>
            <a href="/map" className="btn small">Learn more <ArrowForwardRoundedIcon fontSize="inherit" /></a>
          </div>
          {/* ── Mobile App mock ── */}
          <div className="service-art" aria-hidden="true">
            <div className="mock-phone">
              <div className="mp-notch"></div>
              <div className="mp-screen">
                <div className="mp-header">
                  <span className="mp-logo">SIARA</span>
                  <span className="mp-bell"><NotificationsOutlinedIcon fontSize="inherit" /></span>
                </div>
                <div className="mp-hero-card">
                  <span className="mp-risk-label">Current Risk</span>
                  <span className="mp-risk-val">Medium</span>
                  <span className="mp-risk-sub">Boussouf, Constantine</span>
                </div>
                <div className="mp-alerts">
                  <div className="mp-alert high">
                    <span className="mp-alert-dot"></span>
                    <span className="mp-alert-text">High severity ahead — 2 km</span>
                  </div>
                  <div className="mp-alert med">
                    <span className="mp-alert-dot"></span>
                    <span className="mp-alert-text">Wet road conditions</span>
                  </div>
                  <div className="mp-alert low">
                    <span className="mp-alert-dot"></span>
                    <span className="mp-alert-text">Speed camera in 800 m</span>
                  </div>
                </div>
                <div className="mp-nav-bar">
                  <span className="mp-nav-item active">Home</span>
                  <span className="mp-nav-item">Map</span>
                  <span className="mp-nav-item">Alerts</span>
                  <span className="mp-nav-item">Profile</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ JOIN CTA ═══════════════════ */}
      <section id="join" className="join-section">
        <div className="join-inner">
          <h2>Join the Initiative</h2>
          <p>Collaborate to make Algerian roads safer through data and artificial intelligence.</p>
          <a href="/register" className="btn join-btn">Create your account <ArrowForwardRoundedIcon fontSize="inherit" /></a>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <Footer />
    </div>
  )
}
