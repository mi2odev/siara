import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../styles/NewsPage.css'
import '../../styles/DashboardPage.css'
import '../../styles/PredictionsPage.css'
import siaraLogo from '../../assets/logos/siara-logo.png'
import profileAvatar from '../../assets/logos/siara-logo1.png'
import DrivingQuiz from '../../components/ui/DrivingQuiz'

/* ── Mock data ── */
const riskZones = [
  { rank: 1, name: 'Alger Centre', wilaya: 'Alger',    score: 92, trend: '+8',  severity: 'high' },
  { rank: 2, name: 'Bab Ezzouar',  wilaya: 'Alger',    score: 84, trend: '+3',  severity: 'high' },
  { rank: 3, name: 'Es-Sénia',     wilaya: 'Oran',     score: 71, trend: '-2',  severity: 'medium' },
  { rank: 4, name: 'El Khroub',    wilaya: 'Constantine', score: 65, trend: '+1', severity: 'medium' },
  { rank: 5, name: 'Hydra',        wilaya: 'Alger',    score: 48, trend: '-5',  severity: 'low' },
]

const activityFeed = [
  { id: 1, icon: '🔴', text: 'Pic de risque détecté – RN5 Alger', time: 'Il y a 2 min', type: 'critical' },
  { id: 2, icon: '🟡', text: 'Modèle recalibré – zone Bab Ezzouar', time: 'Il y a 15 min', type: 'warning' },
  { id: 3, icon: '🟢', text: 'Risque réduit – Hydra après travaux', time: 'Il y a 32 min', type: 'success' },
  { id: 4, icon: '🔵', text: 'Nouveau jeu de données météo intégré', time: 'Il y a 1h', type: 'info' },
  { id: 5, icon: '🟡', text: 'Alerte scolaire – Bir Mourad Raïs 08h', time: 'Il y a 1h 20', type: 'warning' },
]

const dataSources = [
  { name: 'Signalements citoyens', count: '12 847', status: 'live', icon: '👥' },
  { name: 'Capteurs météo (ONM)',  count: '48 stations', status: 'live', icon: '🌤️' },
  { name: 'Flux trafic DGRSDT',    count: '340 capteurs', status: 'live', icon: '🚦' },
  { name: 'Historique DGSN',       count: '5 ans', status: 'synced', icon: '📋' },
]

export default function PredictionsPage() {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [vizTab, setVizTab] = useState('heatmap')
  const [liveTime, setLiveTime] = useState(new Date())

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const handleQuizComplete = (result) => {
    console.log('Quiz completed:', result)
    setShowQuiz(false)
  }

  const fmtTime = (d) => d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="siara-news-root">
      {/* DRIVING QUIZ POPUP */}
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ── 1. FLOATING HEADER ── */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate('/news')}>Feed</button>
              <button className="dash-tab" onClick={() => navigate('/map')}>Map</button>
              <button className="dash-tab" onClick={() => navigate('/alerts')}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="dash-tab dash-tab-active">Prédictions</button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input type="search" className="dash-search" placeholder="Rechercher un incident, une route, une wilaya…" aria-label="Search" />
          </div>
          <div className="dash-header-right">
            <button className="dash-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>🔔<span className="notification-badge"></span></button>
            <button className="dash-icon-btn" aria-label="Messages">💬</button>
            <div className="dash-avatar-wrapper">
              <button className="dash-avatar" onClick={() => setShowDropdown(!showDropdown)} aria-label="User profile">SA</button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/profile') }}>👤 Mon profil</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Paramètres</button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/notifications') }}>🔔 Notifications</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN LAYOUT – 3 Columns ── */}
      <div className="siara-news-layout">

        {/* ── 2. LEFT SIDEBAR ── */}
        <aside className="sidebar-left">
          {/* Profile Summary */}
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">Sofiane Ahmed</p>
              <span className="role-badge role-citoyen">Citoyen</span>
              <p className="profile-bio">Contributeur actif pour une route plus sûre en Algérie 🇩🇿</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>Voir le profil</button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/home')}><span className="nav-accent"></span><span className="nav-icon">🏠</span><span className="nav-label">Accueil</span></button>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">Fil d'actualité</span></button>
            <button className="nav-item" onClick={() => navigate('/map')}><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Carte des incidents</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">🔮</span><span className="nav-label">Prédictions</span></button>

            <div className="nav-section-label">OUTILS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Quiz Conducteur</span></button>
            <button className="nav-item" onClick={() => navigate('/dashboard')}><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Statistiques</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alertes</span></button>

            <div className="nav-section-label">PARAMÈTRES</div>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Paramètres</span></button>
          </nav>

          {/* Model Summary Widget */}
          <div className="card pred-model-sidebar">
            <h3 className="card-title">🧠 Modèle IA</h3>
            <div className="pred-model-rows">
              <div className="pred-model-row"><span>Version</span><span className="pred-model-val">v1.2</span></div>
              <div className="pred-model-row"><span>Algorithme</span><span className="pred-model-val">LightGBM + CatBoost</span></div>
              <div className="pred-model-row"><span>Dernière MAJ</span><span className="pred-model-val">Aujourd'hui</span></div>
              <div className="pred-model-row"><span>Statut</span><span className="pred-model-val green">● Actif</span></div>
              <div className="pred-model-row"><span>Précision</span><span className="pred-model-val blue">89.2%</span></div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="card pred-sources-sidebar">
            <h3 className="card-title">📡 Sources de données</h3>
            <div className="pred-sources-list">
              {dataSources.map((s, i) => (
                <div key={i} className="pred-source-item">
                  <span className="pred-source-icon">{s.icon}</span>
                  <div className="pred-source-info">
                    <span className="pred-source-name">{s.name}</span>
                    <span className="pred-source-count">{s.count}</span>
                  </div>
                  <span className={`pred-source-dot ${s.status}`}></span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── 3. CENTER FEED ── */}
        <main className="feed-center">

          {/* A. Hero Section */}
          <div className="pred-hero">
            <div className="pred-hero-top">
              <div className="pred-hero-badge">
                <span className="pulse-dot"></span>
                Modèle IA Actif
              </div>
              <span className="pred-hero-clock">🕐 {fmtTime(liveTime)}</span>
            </div>
            <h1>Prédictions <span>Avancées</span></h1>
            <p className="pred-hero-subtitle">
              Exploitez la puissance de notre moteur prédictif basé sur le machine learning pour anticiper les zones à risque,
              analyser les tendances temporelles et prendre des décisions éclairées en temps réel.
            </p>
            {/* Hero KPI Strip */}
            <div className="pred-hero-kpis">
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">12 847</span>
                <span className="pred-hero-kpi-label">Données analysées</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">48</span>
                <span className="pred-hero-kpi-label">Wilayas couvertes</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">89.2%</span>
                <span className="pred-hero-kpi-label">Précision</span>
              </div>
              <div className="pred-hero-kpi-divider"></div>
              <div className="pred-hero-kpi">
                <span className="pred-hero-kpi-value">&lt; 2s</span>
                <span className="pred-hero-kpi-label">Temps de réponse</span>
              </div>
            </div>
          </div>

          {/* B. Feature Preview Cards */}
          <div className="pred-features-grid">
            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon heatmap">🗺️</div>
                <span className="pred-feature-status ready">● Prêt</span>
              </div>
              <h3>Cartes thermiques</h3>
              <p>Visualisation des zones de densité d'accidents avec superposition de couches de risque dynamique sur 48 wilayas.</p>
              <div className="pred-feature-meta">
                <span>🔄 Mise à jour : 5 min</span>
                <span>📍 48 wilayas</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon timeseries">📈</div>
                <span className="pred-feature-status beta">◐ Bêta</span>
              </div>
              <h3>Séries temporelles</h3>
              <p>Analyse prédictive par créneau horaire et saisonnalité avec modèles LSTM et LightGBM entraînés sur 5 ans.</p>
              <div className="pred-feature-meta">
                <span>⏱️ Horizon : 24h</span>
                <span>📊 RMSE : 0.12</span>
              </div>
            </div>

            <div className="pred-feature-card">
              <div className="pred-feature-top-row">
                <div className="pred-feature-icon export">📤</div>
                <span className="pred-feature-status coming">○ Bientôt</span>
              </div>
              <h3>Export &amp; Rapports</h3>
              <p>Génération automatique de rapports PDF et export CSV / GeoJSON pour les autorités et chercheurs.</p>
              <div className="pred-feature-meta">
                <span>📄 PDF, CSV, GeoJSON</span>
                <span>🔐 Certifié</span>
              </div>
            </div>
          </div>

          {/* C. Mock Visualization */}
          <div className="pred-viz-card">
            <div className="pred-viz-header">
              <h3>📊 Aperçu prédictif — Distribution du risque par zone</h3>
              <div className="pred-viz-tabs">
                <button className={`pred-viz-tab ${vizTab === 'heatmap' ? 'active' : ''}`} onClick={() => setVizTab('heatmap')}>Heatmap</button>
                <button className={`pred-viz-tab ${vizTab === 'timeline' ? 'active' : ''}`} onClick={() => setVizTab('timeline')}>Timeline</button>
                <button className={`pred-viz-tab ${vizTab === 'clusters' ? 'active' : ''}`} onClick={() => setVizTab('clusters')}>Clusters</button>
              </div>
            </div>
            <div className="pred-viz-body">
              <div className="pred-mock-chart">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="pred-mock-bar" />
                ))}
              </div>
              <div className="pred-viz-x-axis">
                {['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'].map(m => (
                  <span key={m}>{m}</span>
                ))}
              </div>
              <div className="pred-viz-overlay">
                <span className="pred-viz-overlay-icon">🔒</span>
                <span className="pred-viz-overlay-text">Visualisation complète bientôt disponible</span>
                <span className="pred-viz-overlay-sub">Le modèle est en cours de calibration sur vos données régionales</span>
              </div>
            </div>
          </div>

          {/* D. Top Risk Zones Table */}
          <div className="pred-zones-card">
            <div className="pred-zones-header">
              <h3>🏙️ Classement des zones à risque</h3>
              <span className="pred-zones-updated">Mis à jour : {fmtTime(liveTime)}</span>
            </div>
            <table className="pred-zones-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Zone</th>
                  <th>Wilaya</th>
                  <th>Score</th>
                  <th>Tendance</th>
                  <th>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {riskZones.map((z) => (
                  <tr key={z.rank}>
                    <td className="pred-zone-rank">{z.rank}</td>
                    <td className="pred-zone-name">{z.name}</td>
                    <td className="pred-zone-wilaya">{z.wilaya}</td>
                    <td>
                      <div className="pred-zone-score-wrap">
                        <div className="pred-zone-score-bar">
                          <div className={`pred-zone-score-fill ${z.severity}`} style={{ width: `${z.score}%` }}></div>
                        </div>
                        <span className="pred-zone-score-num">{z.score}</span>
                      </div>
                    </td>
                    <td className={`pred-zone-trend ${z.trend.startsWith('+') ? 'up' : 'down'}`}>{z.trend.startsWith('+') ? '↑' : '↓'} {z.trend}</td>
                    <td><span className={`pred-severity-badge ${z.severity}`}>{z.severity === 'high' ? 'Élevé' : z.severity === 'medium' ? 'Modéré' : 'Faible'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* E. How it Works */}
          <div className="pred-how-card">
            <h3>💡 Comment ça fonctionne ?</h3>
            <div className="pred-how-steps">
              <div className="pred-how-step">
                <div className="pred-how-num">1</div>
                <div className="pred-how-content">
                  <h4>Collecte de données</h4>
                  <p>Signalements citoyens, capteurs météo ONM, historique DGSN (5 ans) et flux de trafic DGRSDT en temps réel combinés dans un pipeline unifié.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">2</div>
                <div className="pred-how-content">
                  <h4>Ingénierie des features</h4>
                  <p>Extraction de 120+ variables : conditions météo, densité routière, heure/jour/saison, proximité écoles/hôpitaux, historique par zone.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">3</div>
                <div className="pred-how-content">
                  <h4>Modèle prédictif</h4>
                  <p>Ensemble LightGBM + CatBoost avec validation croisée temporelle. Score de risque 0–100 généré par zone géographique et créneau horaire.</p>
                </div>
              </div>
              <div className="pred-how-connector"></div>
              <div className="pred-how-step">
                <div className="pred-how-num">4</div>
                <div className="pred-how-content">
                  <h4>Alertes intelligentes</h4>
                  <p>Notifications push proactives envoyées aux usagers avant d'entrer dans une zone à risque élevé, avec itinéraire alternatif suggéré.</p>
                </div>
              </div>
            </div>
          </div>

          {/* F. Tech Stack Banner */}
          <div className="pred-tech-card">
            <h3>🛠️ Stack technologique</h3>
            <div className="pred-tech-grid">
              <div className="pred-tech-item"><span className="pred-tech-logo">🐍</span><span>Python</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">⚡</span><span>LightGBM</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🐱</span><span>CatBoost</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🧠</span><span>Scikit-learn</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">📊</span><span>Pandas</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">⚛️</span><span>React</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🗺️</span><span>Leaflet</span></div>
              <div className="pred-tech-item"><span className="pred-tech-logo">🟢</span><span>Node.js</span></div>
            </div>
          </div>

        </main>

        {/* ── 4. RIGHT SIDEBAR ── */}
        <aside className="sidebar-right">

          {/* A. Prediction Status */}
          <div className="pred-status-card">
            <h3>⚡ État du modèle</h3>
            <div className="pred-status-row">
              <span className="pred-status-label">Version</span>
              <span className="pred-status-value">SIARA v1.2</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Algorithme</span>
              <span className="pred-status-value">LightGBM</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Dernière mise à jour</span>
              <span className="pred-status-value blue">Aujourd'hui, 08:30</span>
            </div>
            <div className="pred-status-row">
              <span className="pred-status-label">Confiance globale</span>
              <span className="pred-status-value green">89%</span>
            </div>
            <div className="pred-confidence-bar">
              <div className="pred-confidence-fill" style={{ width: '89%' }}></div>
            </div>
            <div className="pred-status-metrics">
              <div className="pred-metric"><span className="pred-metric-label">Précision</span><span className="pred-metric-val">89.2%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">Rappel</span><span className="pred-metric-val">85.7%</span></div>
              <div className="pred-metric"><span className="pred-metric-label">F1-Score</span><span className="pred-metric-val">87.4%</span></div>
            </div>
          </div>

          {/* B. Forecast Snapshot */}
          <div className="pred-forecast-card">
            <h3>📅 Prévision du risque</h3>
            <div className="pred-forecast-items">
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">6h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '25%' }}></div></div>
                <span className="pred-forecast-label low">Faible</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">12h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '60%' }}></div></div>
                <span className="pred-forecast-label medium">Modéré</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">18h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill high" style={{ width: '85%' }}></div></div>
                <span className="pred-forecast-label high">Élevé</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">24h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill medium" style={{ width: '50%' }}></div></div>
                <span className="pred-forecast-label medium">Modéré</span>
              </div>
              <div className="pred-forecast-row">
                <span className="pred-forecast-time">48h</span>
                <div className="pred-forecast-level"><div className="pred-forecast-fill low" style={{ width: '30%' }}></div></div>
                <span className="pred-forecast-label low">Faible</span>
              </div>
            </div>
          </div>

          {/* C. Model Transparency */}
          <div className="pred-transparency-card">
            <h3>🔍 Importance des features</h3>
            <div className="pred-factor">
              <span className="pred-factor-name">Météo</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '78%' }}></div></div>
              <span className="pred-factor-pct">78%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Heure</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '65%' }}></div></div>
              <span className="pred-factor-pct">65%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Trafic</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '52%' }}></div></div>
              <span className="pred-factor-pct">52%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Historique</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '44%' }}></div></div>
              <span className="pred-factor-pct">44%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Infra. routière</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '38%' }}></div></div>
              <span className="pred-factor-pct">38%</span>
            </div>
            <div className="pred-factor">
              <span className="pred-factor-name">Jour/Saison</span>
              <div className="pred-factor-bar-bg"><div className="pred-factor-bar-fill" style={{ width: '31%' }}></div></div>
              <span className="pred-factor-pct">31%</span>
            </div>
          </div>

          {/* D. Live Activity Feed */}
          <div className="pred-activity-card">
            <h3>📡 Activité en direct</h3>
            <div className="pred-activity-list">
              {activityFeed.map((a) => (
                <div key={a.id} className={`pred-activity-item ${a.type}`}>
                  <span className="pred-activity-icon">{a.icon}</span>
                  <div className="pred-activity-info">
                    <span className="pred-activity-text">{a.text}</span>
                    <span className="pred-activity-time">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* E. CTA */}
          <div className="pred-cta-card">
            <h4>🚀 Accès anticipé</h4>
            <p>Soyez parmi les premiers à tester les prédictions en temps réel sur votre itinéraire quotidien.</p>
            <button className="pred-cta-btn" onClick={() => navigate('/map')}>Voir sur la carte</button>
          </div>

          {/* F. Predictive Alerts */}
          <div className="card widget-alerts">
            <h3 className="widget-title">Alertes prédictives</h3>
            <div className="alert-item">• Pic de risque prévu à 17h – Alger Centre</div>
            <div className="alert-item">• Pluie forte attendue demain matin</div>
            <div className="alert-item">• Zone scolaire – risque accru 08h-09h</div>
            <div className="alert-item">• Brouillard prévu A1 – visibilité réduite</div>
            <button className="btn-activate-alerts" onClick={() => navigate('/alerts')}>Gérer les alertes</button>
          </div>

        </aside>
      </div>
    </div>
  )
}