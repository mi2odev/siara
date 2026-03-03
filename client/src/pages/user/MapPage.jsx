/**
 * MapPage.jsx
 *
 * Interactive map page for the SIARA road-safety platform.
 * Displays real-time incidents on a map with filtering, layer switching,
 * geolocation, fullscreen mode, weather context, and AI-driven risk insights.
 *
 * Layout: Header  |  Left sidebar (filters)  |  Center map  |  Right sidebar (context)
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/* ── Styles ── */
import "../../styles/MapPage.css";

/* ── Assets ── */
import siaraLogo from "../../assets/logos/siara-logo.png";

/* ── Components ── */
import SiaraMap from "../../components/map/SiaraMap";

/* ── MUI Icons ── */
import LocationOnTwoToneIcon from "@mui/icons-material/LocationOnTwoTone";
import FullscreenTwoToneIcon from "@mui/icons-material/FullscreenTwoTone";
import FullscreenExitTwoToneIcon from "@mui/icons-material/FullscreenExitTwoTone";

export default function MapPage() {
  const navigate = useNavigate();

  /* ──────────────────────────── State ──────────────────────────── */

  // Controls the visibility of the user-profile dropdown in the header
  const [showDropdown, setShowDropdown] = useState(false);

  // Active time-range filter (24h, 7d, 30d, custom)
  const [timeFilter, setTimeFilter] = useState("7d");

  // Array of selected severity levels (e.g. ["high", "medium"])
  const [severityFilter, setSeverityFilter] = useState([]);

  // Array of selected incident types (e.g. ["accident", "traffic"])
  const [typeFilter, setTypeFilter] = useState([]);

  // Selected wilaya (province) — "all" means no geographic filter
  const [selectedWilaya, setSelectedWilaya] = useState("all");

  // Current map visualisation layer (points, heatmap, clusters, ai, nearbyRoads)
  const [mapLayer, setMapLayer] = useState("points");

  // Currently selected incident/segment for the right-sidebar detail panel
  const [selectedIncident, setSelectedIncident] = useState(null);

  // User's GPS coordinates (set via the geolocation button)
  const [userPosition, setUserPosition] = useState(null);

  // Whether the map is displayed in fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ──────────────────────── Static / Mock Data ──────────────────────── */

  // Incident categories shown as filter chips
  const incidentTypes = [
    { id: "accident", label: "Accident", icon: "🚗" },
    { id: "traffic", label: "Traffic", icon: "🚦" },
    { id: "danger", label: "Danger", icon: "⚠️" },
    { id: "weather", label: "Weather", icon: "🌧️" },
    { id: "roadworks", label: "Roadworks", icon: "🚧" },
  ];

  // List of wilayas available in the zone dropdown
  const wilayas = [
    "Alger",
    "Oran",
    "Constantine",
    "Annaba",
    "Blida",
    "Boumerdès",
  ];

  // Hot-spots displayed in the right sidebar
  const trendingZones = [
    { name: "Alger Centre", incidents: 12, severity: "high", updated: "2 min" },
    { name: "Bab Ezzouar", incidents: 8, severity: "medium", updated: "5 min" },
    { name: "El Harrach", incidents: 5, severity: "medium", updated: "12 min" },
    { name: "Hydra", incidents: 2, severity: "low", updated: "20 min" },
  ];

  // Live alerts shown in the right sidebar
  const activeAlerts = [
    { id: 1, title: "Serious accident A1", type: "accident", time: "3 min" },
    { id: 2, title: "Road flooding", type: "weather", time: "15 min" },
  ];

  // Placeholder map markers (replace with API data in production)
  const mockMarkers = [
    { id: 1, lat: 36.7538, lng: 3.0588, type: "accident", severity: "high", title: "Multi-vehicle collision" },
    { id: 2, lat: 36.7638, lng: 3.0788, type: "traffic", severity: "medium", title: "Traffic jam" },
    { id: 3, lat: 36.7438, lng: 3.0388, type: "roadworks", severity: "low", title: "Ongoing roadworks" },
    { id: 4, lat: 36.7338, lng: 3.0688, type: "danger", severity: "high", title: "Road blocked" },
  ];

  /* ──────────────────────── Event Handlers ──────────────────────── */

  /**
   * Toggle a severity level in/out of the active filter list.
   * If already selected it is removed; otherwise it is added.
   */
  const toggleSeverity = (sev) => {
    setSeverityFilter((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  /**
   * Toggle an incident type in/out of the active filter list.
   */
  const toggleType = (type) => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  /**
   * Reset every filter back to its default value.
   */
  const clearFilters = () => {
    setTimeFilter("7d");
    setSeverityFilter([]);
    setTypeFilter([]);
    setSelectedWilaya("all");
  };

  // Derived boolean — true when any filter differs from defaults
  const hasActiveFilters =
    severityFilter.length > 0 ||
    typeFilter.length > 0 ||
    selectedWilaya !== "all" ||
    timeFilter !== "7d";

  /**
   * Request the browser's geolocation API and store the user's position.
   * Shows an alert if permission is denied or unavailable.
   */
  const handleLocateUser = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.error(err);
        alert("Unable to get your position.");
      },
    );
  };

  /* ────────── Fullscreen inline styles (applied when toggled) ────────── */

  const fullscreenStyle = isFullscreen
    ? { height: "100vh", width: "100vw", top: 0, left: 0, position: "fixed", zIndex: 9999 }
    : { position: "relative" };

  const fullscreenInnerStyle = isFullscreen
    ? { height: "100vh", width: "100vw", top: 0, left: 0, position: "absolute", zIndex: 9999 }
    : { position: "relative" };

  /* ══════════════════════════ RENDER ══════════════════════════ */

  return (
    <div className="map-page">

      {/* ═══════════════ TOP NAVIGATION BAR ═══════════════ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">

          {/* ── Left: Logo + Tab navigation ── */}
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate("/home")}>
              <img src={siaraLogo} alt="SIARA" className="dash-logo" />
            </div>

            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate("/news")}>Feed</button>
              <button className="dash-tab dash-tab-active">Map</button>
              <button className="dash-tab" onClick={() => navigate("/alerts")}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate("/dashboard")}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
            </nav>
          </div>

          {/* ── Center: Search bar ── */}
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Search for an incident, a road, a province…"
              aria-label="Search map"
            />
          </div>

          {/* ── Right: Notification, messages & avatar dropdown ── */}
          <div className="dash-header-right">
            <button
              className="dash-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <span className="notification-badge"></span>
              🔔
            </button>

            <button className="dash-icon-btn" aria-label="Messages">💬</button>

            {/* Avatar with dropdown menu */}
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
                  <button className="dropdown-item" onClick={() => navigate("/profile")}>
                    👤 My Profile
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowDropdown(false); navigate("/settings"); }}
                  >
                    ⚙️ Settings
                  </button>
                  <button className="dropdown-item" onClick={() => navigate("/notifications")}>
                    🔔 Notifications
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout">🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN THREE-COLUMN LAYOUT ═══════════════ */}
      <div className="map-content">

        {/* ═══════════ LEFT SIDEBAR — Filters & Actions ═══════════ */}
        <aside className="map-sidebar-left">

          {/* Current user card */}
          <div className="sidebar-user">
            <div className="user-avatar">SA</div>
            <div className="user-info">
              <span className="user-name">Sofiane A.</span>
              <span className="user-role">Citizen</span>
            </div>
          </div>

          {/* ── Filter panel ── */}
          <div className="filters-section">
            <div className="section-header">
              <h3>Filters</h3>
              {/* Show "clear" button only when at least one filter is active */}
              {hasActiveFilters && (
                <button className="clear-btn" onClick={clearFilters}>Clear</button>
              )}
            </div>

            {/* Time-range filter chips */}
            <div className="filter-group">
              <label className="filter-label">Period</label>
              <div className="filter-chips">
                {[
                  { id: "24h", label: "24h" },
                  { id: "7d", label: "7 days" },
                  { id: "30d", label: "30 days" },
                  { id: "custom", label: "Custom" },
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

            {/* Severity filter chips — colour changes when active */}
            <div className="filter-group">
              <label className="filter-label">Severity</label>
              <div className="filter-chips">
                {[
                  { id: "high", label: "High", color: "#EF4444" },
                  { id: "medium", label: "Medium", color: "#F59E0B" },
                  { id: "low", label: "Low", color: "#10B981" },
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

            {/* Incident-type filter chips */}
            <div className="filter-group">
              <label className="filter-label">Incident Type</label>
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

            {/* Wilaya (province) dropdown selector */}
            <div className="filter-group">
              <label className="filter-label">Zone</label>
              <select
                className="filter-select"
                value={selectedWilaya}
                onChange={(e) => setSelectedWilaya(e.target.value)}
              >
                <option value="all">All provinces</option>
                {wilayas.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Report-incident CTA pinned at sidebar bottom */}
          <div className="sidebar-action">
            <button className="btn-signal" onClick={() => navigate("/report")}>
              <span>➕</span> Report an Incident
            </button>
          </div>
        </aside>

        {/* ═══════════ CENTER — Interactive Map ═══════════ */}
        <main className="map-main" style={fullscreenStyle}>
          <div className="map-container" style={fullscreenInnerStyle}>

            {/* ── Layer-switcher toolbar (top of map) ── */}
            <div className="map-controls-top">
              <div className="layer-switcher">
                {[
                  { id: "points", label: "Points" },
                  { id: "heatmap", label: "Heatmap" },
                  { id: "clusters", label: "Clusters" },
                  { id: "ai", label: "AI Risks" },
                  { id: "nearbyRoads", label: "Nearby Roads" },
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

            {/* ── Right-side map controls (fullscreen + locate me) ── */}
            <div className="map-controls-right">
              {/* Toggle fullscreen on/off */}
              {isFullscreen ? (
                <button className="map-ctrl-btn" title="Exit fullscreen" onClick={() => setIsFullscreen(false)}>
                  <FullscreenExitTwoToneIcon className="btn-icon" />
                </button>
              ) : (
                <button className="map-ctrl-btn" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
                  <FullscreenTwoToneIcon className="btn-icon" />
                </button>
              )}

              {/* Geolocate user and center the map on their position */}
              <button className="map-ctrl-btn" title="My location" onClick={handleLocateUser}>
                <LocationOnTwoToneIcon className="btn-icon" />
              </button>
            </div>

            {/* ── Map canvas — renders the SiaraMap component ── */}
            <div className="map-canvas">
              <SiaraMap
                mockMarkers={mockMarkers}
                mapLayer={mapLayer}
                setSelectedIncident={setSelectedIncident}
                userPosition={userPosition}
              />
            </div>

            {/* ── Status bar at the bottom of the map ── */}
            <div className="map-status">
              <span className="status-dot"></span>
              <span>Real-time • {mockMarkers.length} incidents displayed</span>
            </div>
          </div>
        </main>

        {/* ═══════════ RIGHT SIDEBAR — Contextual Info ═══════════ */}
        <aside className="map-sidebar-right">

          {/* ── Current weather widget ── */}
          <div className="context-weather">
            <div className="weather-icon">⛅</div>
            <div className="weather-info">
              <span className="weather-temp">18°C</span>
              <span className="weather-desc">Partly cloudy</span>
              <span className="weather-detail">Visibility: Good • Wind: 12 km/h</span>
            </div>
          </div>

          {/* ── AI Segment Insight (visible only when an AI segment is selected) ── */}
          {selectedIncident?.explanation && (
            <div className="context-section">
              <h4 className="section-title">Segment Insight</h4>

              {/* Overview: segment name + danger percentage */}
              <div className="map-alert-item">
                <span className="map-alert-icon">IA</span>
                <div className="map-alert-info">
                  <span className="map-alert-title">
                    {selectedIncident.title || `Segment ${selectedIncident.id}`}
                  </span>
                  <span className="map-alert-time">
                    Risk: {selectedIncident.explanation.danger_percent}% ({selectedIncident.explanation.danger_level})
                  </span>
                </div>
              </div>

              {/* Top 3 XAI reasons driving the risk score */}
              <div className="map-alerts-list">
                {(selectedIncident.explanation?.xai?.top_reasons || [])
                  .slice(0, 3)
                  .map((reason) => (
                    <div key={reason.feature} className="map-alert-item">
                      <span className="map-alert-icon">
                        {reason.direction === "increases_risk" ? "+" : "-"}
                      </span>
                      <div className="map-alert-info">
                        <span className="map-alert-title">{reason.feature}</span>
                        <span className="map-alert-time">
                          impact: {Number(reason.impact || 0).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Map legend ── */}
          <div className="context-section">
            <h4 className="section-title">Legend</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="legend-dot high"></span>
                <span>High Severity</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot medium"></span>
                <span>Medium Severity</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot low"></span>
                <span>Low Severity</span>
              </div>
              {/* Extra legend row when the AI risk layer is active */}
              {mapLayer === "ai" && (
                <>
                  <hr />
                  <div className="legend-item">
                    <span className="legend-gradient"></span>
                    <span>AI Risk (0-100%)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Trending / hot-spot zones ── */}
          <div className="context-section">
            <h4 className="section-title">Areas to Watch</h4>
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
                    {zone.severity === "high" ? "🔴" : zone.severity === "medium" ? "🟡" : "🟢"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active alerts list ── */}
          <div className="context-section">
            <h4 className="section-title">Active Alerts</h4>
            <div className="map-alerts-list">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="map-alert-item">
                  <span className="map-alert-icon">🚨</span>
                  <div className="map-alert-info">
                    <span className="map-alert-title">{alert.title}</span>
                    <span className="map-alert-time">{alert.time} ago</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-manage-alerts">Manage My Alerts</button>
          </div>

          {/* ── Quick statistics summary ── */}
          <div className="context-section">
            <h4 className="section-title">Statistics</h4>
            <div className="quick-stats">
              <div className="map-stat-item">
                <span className="map-stat-value">156</span>
                <span className="map-stat-label">Today</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">6.2</span>
                <span className="map-stat-label">Avg. Severity</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">94%</span>
                <span className="map-stat-label">AI Accuracy</span>
              </div>
            </div>
          </div>

        </aside>
      </div>

      
    </div>
  );
}
