import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/MapPage.css";
import siaraLogo from "../../assets/logos/siara-logo.png";
import SiaraMap from "../../components/map/SiaraMap";

export default function MapPage() {
  const navigate = useNavigate();

  // State
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeFilter, setTimeFilter] = useState("7d");
  const [severityFilter, setSeverityFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [selectedWilaya, setSelectedWilaya] = useState("all");
  const [mapLayer, setMapLayer] = useState("points");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [userPosition, setUserPosition] = useState(null);


  // Mock data
  const incidentTypes = [
    { id: "accident", label: "Accident", icon: "🚗" },
    { id: "traffic", label: "Trafic", icon: "🚦" },
    { id: "danger", label: "Danger", icon: "⚠️" },
    { id: "weather", label: "Météo", icon: "🌧️" },
    { id: "roadworks", label: "Travaux", icon: "🚧" },
  ];

  const wilayas = [
    "Alger",
    "Oran",
    "Constantine",
    "Annaba",
    "Blida",
    "Boumerdès",
  ];

  const trendingZones = [
    { name: "Alger Centre", incidents: 12, severity: "high", updated: "2 min" },
    { name: "Bab Ezzouar", incidents: 8, severity: "medium", updated: "5 min" },
    { name: "El Harrach", incidents: 5, severity: "medium", updated: "12 min" },
    { name: "Hydra", incidents: 2, severity: "low", updated: "20 min" },
  ];

  const activeAlerts = [
    { id: 1, title: "Accident grave A1", type: "accident", time: "3 min" },
    { id: 2, title: "Inondation route", type: "weather", time: "15 min" },
  ];

  const mockMarkers = [
    {
      id: 1,
      lat: 36.7538,
      lng: 3.0588,
      type: "accident",
      severity: "high",
      title: "Collision multiple",
    },
    {
      id: 2,
      lat: 36.7638,
      lng: 3.0788,
      type: "traffic",
      severity: "medium",
      title: "Embouteillage",
    },
    {
      id: 3,
      lat: 36.7438,
      lng: 3.0388,
      type: "roadworks",
      severity: "low",
      title: "Travaux en cours",
    },
    {
      id: 4,
      lat: 36.7338,
      lng: 3.0688,
      type: "danger",
      severity: "high",
      title: "Route barrée",
    },
  ];

  // Handlers
  const toggleSeverity = (sev) => {
    setSeverityFilter((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  const toggleType = (type) => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const clearFilters = () => {
    setTimeFilter("7d");
    setSeverityFilter([]);
    setTypeFilter([]);
    setSelectedWilaya("all");
  };

  const hasActiveFilters =
    severityFilter.length > 0 ||
    typeFilter.length > 0 ||
    selectedWilaya !== "all" ||
    timeFilter !== "7d";

  return (
    <div className="map-page">
      {/* ========== TOP NAVIGATION (same as Dashboard) ========== */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate("/home")}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>
            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate("/news")}>
                Feed
              </button>
              <button className="dash-tab dash-tab-active">Map</button>
              <button className="dash-tab" onClick={() => navigate("/alerts")}>
                Alerts
              </button>
              <button
                className="dash-tab"
                onClick={() => navigate("/admin/dashboard")}
              >
                Dashboard
              </button>
            </nav>
          </div>
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Rechercher un incident, une route, une wilaya…"
              aria-label="Search map"
            />
          </div>
          <div className="dash-header-right">
            <button
              className="dash-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <span className="notification-badge"></span>
              🔔
            </button>
            <button className="dash-icon-btn" aria-label="Messages">
              💬
            </button>
            <div className="dash-avatar-wrapper">
              <button
                className="dash-avatar"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User profile"
              >
                SA
              </button>
              {showDropdown && (
                <div className="user-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => navigate("/profile")}
                  >
                    👤 Mon profil
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate('/settings') }}>⚙️ Paramètres</button>
                  <button
                    className="dropdown-item"
                    onClick={() => navigate("/notifications")}
                  >
                    🔔 Notifications
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">
                    🚪 Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========== MAIN CONTENT ========== */}
      <div className="map-content">
        {/* ========== LEFT SIDEBAR - CONTROLS ========== */}
        <aside className="map-sidebar-left">
          {/* User Context */}
          <div className="sidebar-user">
            <div className="user-avatar">SA</div>
            <div className="user-info">
              <span className="user-name">Sofiane A.</span>
              <span className="user-role">Citoyen</span>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <div className="section-header">
              <h3>Filtres</h3>
              {hasActiveFilters && (
                <button className="clear-btn" onClick={clearFilters}>
                  Effacer
                </button>
              )}
            </div>

            {/* Time Filter */}
            <div className="filter-group">
              <label className="filter-label">Période</label>
              <div className="filter-chips">
                {[
                  { id: "24h", label: "24h" },
                  { id: "7d", label: "7 jours" },
                  { id: "30d", label: "30 jours" },
                  { id: "custom", label: "Personnalisé" },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`chip ${timeFilter === t.id ? "active" : ""}`}
                    onClick={() => setTimeFilter(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div className="filter-group">
              <label className="filter-label">Gravité</label>
              <div className="filter-chips">
                {[
                  { id: "high", label: "Élevée", color: "#EF4444" },
                  { id: "medium", label: "Moyenne", color: "#F59E0B" },
                  { id: "low", label: "Faible", color: "#10B981" },
                ].map((s) => (
                  <button
                    key={s.id}
                    className={`chip severity-chip ${severityFilter.includes(s.id) ? "active" : ""}`}
                    style={
                      severityFilter.includes(s.id)
                        ? { background: s.color, borderColor: s.color }
                        : {}
                    }
                    onClick={() => toggleSeverity(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div className="filter-group">
              <label className="filter-label">Type d'incident</label>
              <div className="filter-chips">
                {incidentTypes.map((t) => (
                  <button
                    key={t.id}
                    className={`chip ${typeFilter.includes(t.id) ? "active" : ""}`}
                    onClick={() => toggleType(t.id)}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Area Filter */}
            <div className="filter-group">
              <label className="filter-label">Zone</label>
              <select
                className="filter-select"
                value={selectedWilaya}
                onChange={(e) => setSelectedWilaya(e.target.value)}
              >
                <option value="all">Toutes les wilayas</option>
                {wilayas.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Action - Sticky Bottom */}
          <div className="sidebar-action">
            <button className="btn-signal">
              <span>➕</span> Signaler un incident
            </button>
          </div>
        </aside>

        {/* ========== CENTER - MAP ========== */}
        <main className="map-main">
          {/* Map Container */}
          <div className="map-container">
            {/* Floating Map Controls */}
            <div className="map-controls-top">
              <div className="layer-switcher">
                {[
                  { id: "points", label: "Points" },
                  { id: "heatmap", label: "Heatmap" },
                  { id: "clusters", label: "Clusters" },
                  { id: "ai", label: "IA Risques" },
                ].map((l) => (
                  <button
                    key={l.id}
                    className={`layer-btn ${mapLayer === l.id ? "active" : ""}`}
                    onClick={() => setMapLayer(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="map-controls-right">
            <button
  className="map-ctrl-btn"
  title="Ma position"
  onClick={() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        console.error(err);
        alert("Impossible d'obtenir votre position.");
      }
    );
  }}
/>
              <button className="map-ctrl-btn" title="Zoom +">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button className="map-ctrl-btn" title="Zoom −">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button className="map-ctrl-btn" title="Recentrer">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                </svg>
              </button>
            </div>

            {/* Map Canvas (Placeholder - replace with real map library) */}
            <div className="map-canvas">
              <SiaraMap
                mockMarkers={mockMarkers}
                mapLayer={mapLayer}
                setSelectedIncident={setSelectedIncident}
                userPosition={userPosition}
              />
            </div>

            {/* Map Status */}
            <div className="map-status">
              <span className="status-dot"></span>
              <span>Temps réel • {mockMarkers.length} incidents affichés</span>
            </div>
          </div>
        </main>

        {/* ========== RIGHT SIDEBAR - CONTEXT ========== */}
        <aside className="map-sidebar-right">
          {/* Weather Context */}
          <div className="context-weather">
            <div className="weather-icon">⛅</div>
            <div className="weather-info">
              <span className="weather-temp">18°C</span>
              <span className="weather-desc">Partiellement nuageux</span>
              <span className="weather-detail">
                Visibilité: Bonne • Vent: 12 km/h
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="context-section">
            <h4 className="section-title">Légende</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="legend-dot high"></span>
                <span>Gravité élevée</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot medium"></span>
                <span>Gravité moyenne</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot low"></span>
                <span>Gravité faible</span>
              </div>
              {mapLayer === "ai" && (
                <>
                  <hr />
                  <div className="legend-item">
                    <span className="legend-gradient"></span>
                    <span>Risque IA (0-100%)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Trending Zones */}
          <div className="context-section">
            <h4 className="section-title">Zones à surveiller</h4>
            <div className="trending-zones">
              {trendingZones.map((zone, i) => (
                <div key={i} className="zone-item">
                  <div className="zone-info">
                    <span className="zone-name">{zone.name}</span>
                    <span className="zone-meta">
                      {zone.incidents} incidents • {zone.updated}
                    </span>
                  </div>
                  <span className={`zone-badge severity-${zone.severity}`}>
                    {zone.severity === "high"
                      ? "🔴"
                      : zone.severity === "medium"
                        ? "🟡"
                        : "🟢"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="context-section">
            <h4 className="section-title">Alertes actives</h4>
            <div className="map-alerts-list">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="map-alert-item">
                  <span className="map-alert-icon">🚨</span>
                  <div className="map-alert-info">
                    <span className="map-alert-title">{alert.title}</span>
                    <span className="map-alert-time">Il y a {alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-manage-alerts">Gérer mes alertes</button>
          </div>

          {/* Quick Stats */}
          <div className="context-section">
            <h4 className="section-title">Statistiques</h4>
            <div className="quick-stats">
              <div className="map-stat-item">
                <span className="map-stat-value">156</span>
                <span className="map-stat-label">Aujourd'hui</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">6.2</span>
                <span className="map-stat-label">Gravité moy.</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">94%</span>
                <span className="map-stat-label">Précision IA</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
