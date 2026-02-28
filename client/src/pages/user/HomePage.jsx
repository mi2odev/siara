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
            <h1 className="hero-h1">Rendez les routes plus sûres grâce à l’IA</h1>
            <p className="hero-sub">Analysez, prédisez et prévenez les accidents avant qu’ils ne se produisent.</p>
            <div className="hero-buttons">
              <a href="/login" className="btn hero-btn-primary">Commencer</a>
              <a href="#services" className="btn hero-btn-secondary">Découvrir nos services</a>
            </div>
          </div>
        </div>
      </section>
 <Divider variant="middle"  />

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      {/* Three-card grid explaining the SIARA pipeline: data → AI → alerts */}
      <section id="how" className="how-section">
        <h2 className="home-section-title">Comment fonctionne SIARA ?</h2>
        <div className="how-cards">
          <div className="how-card">
            <div className="how-icon">📝</div>
            <h3>Collecte des données</h3>
            <p>Données routières, historiques d'accidents, météo et densité de trafic agrégées.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">🤖</div>
            <h3>Analyse & IA prédictive</h3>
            <p>Modèles d’apprentissage automatique pour estimer les zones de risque.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">⚠️</div>
            <h3>Alerte temps réel</h3>
            <p>Notifications et visualisations pour anticiper et prévenir les accidents.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MISSION STATEMENT ═══════════════════ */}
      {/* Short manifesto describing SIARA's goal */}
      <section id="mission" className="mission-section">
        <div className="mission-inner">
          <h2 className="mission-title">Notre mission <span className="mission-icon">🚦</span></h2>
          <p>Réduire significativement les accidents routiers en mettant la puissance de l’IA et des données au service des conducteurs, des autorités et des développeurs d’infrastructures intelligentes.</p>
        </div>
      </section>

      {/* ═══════════════════ GLOBAL STATS ═══════════════════ */}
      {/* 4-column grid of key road-safety metrics */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">🌍</div><div className="home-stat-value">1,35M</div><div className="home-stat-label">décès/an dans le monde</div></div>
          <div className="stat-card"><div className="stat-icon">🎯</div><div className="home-stat-value">50%</div><div className="home-stat-label">Objectif de réduction 2030</div></div>
          <div className="stat-card"><div className="stat-icon">📊</div><div className="home-stat-value">92%</div><div className="home-stat-label">Précision simulée</div></div>
          <div className="stat-card"><div className="stat-icon">🗺️</div><div className="home-stat-value">+1000</div><div className="home-stat-label">Zones à haut risque</div></div>
        </div>
      </section>

      {/* ═══════════════════ SERVICES GRID ═══════════════════ */}
      {/* Alternating text-left / art-right blocks showcasing the 3 main products */}
      <section id="services" className="services-section">
        <h2 className="section-title">Services SIARA</h2>
        <div className="service-block alt">
          <div className="service-text">
            <h3>Dashboard d'analyse</h3>
            <p>Visualisations agrégées, tendances temporelles et filtres dynamiques pour comprendre l'évolution des risques.</p>
            <a href="/map" className="btn small">Voir plus</a>
          </div>
          <div className="service-art" aria-hidden="true"><div className="mock dash" /></div>
        </div>
        <div className="service-block">
          <div className="service-art" aria-hidden="true"><div className="mock map" /></div>
          <div className="service-text">
            <h3>Carte de prédiction</h3>
            <p>Carte interactive mettant en évidence les secteurs à risque à l’échelle locale.</p>
            <a href="/predictions" className="btn small">Voir plus</a>
          </div>
        </div>
        <div className="service-block alt">
          <div className="service-text">
            <h3>Application mobile SIARA</h3>
            <p>Alertes embarquées, notifications de risque et guidage préventif à portée de main.</p>
            <a href="/map" className="btn small">Voir plus</a>
          </div>
          <div className="service-art" aria-hidden="true"><div className="mock mobile" /></div>
        </div>
      </section>

      {/* ═══════════════════ MAP PREVIEW ═══════════════════ */}
      {/* Embedded interactive map prototype via <MapPreview /> component */}
      <section className="map-preview-section" aria-labelledby="map-preview-heading">
        <h2 id="map-preview-heading" className="section-title">Aperçu de carte (prototype)</h2>
        <div className="map-frame">
          <MapPreview />
        </div>
      </section>

      {/* ═══════════════════ JOIN CTA ═══════════════════ */}
      {/* Final call-to-action encouraging user registration */}
      <section id="join" className="join-section">
        <div className="join-inner">
          <h2>Rejoignez l’initiative</h2>
          <p>Collaborez pour rendre les routes algériennes plus sûres grâce aux données et à l’intelligence artificielle.</p>
          <a href="/register" className="btn join-btn">S'inscrire</a>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <Footer />
    </div>
  )
}
