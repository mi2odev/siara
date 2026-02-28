/**
 * @file AdminZonesPage.jsx
 * @description Admin risk-zone geo-management page.
 *
 * Layout:
 *   - Page header with zone count, export & add-zone buttons
 *   - 4 tabs: Map | Zone Management | Wilaya Ranking | Threshold Config
 *   - Edit-zone modal overlay (form: risk level, threshold, lat/lng)
 *
 * Features:
 *   - Interactive Google Map with risk-colored circle markers
 *   - Marker size scales with incident count; InfoWindow shows zone stats
 *   - CRUD table with AI-override toggle and trend indicators
 *   - Wilaya ranking by total incidents with per-100k rate
 *   - Per-zone threshold configuration with AI-override toggles
 *
 * Data: 8 mock zones across Algerian wilayas (Algiers, Oran, Constantine, etc.)
 *       with coordinates, risk level, incident count, and population.
 *
 * Dependencies: @react-google-maps/api (GoogleMap, Marker, InfoWindow)
 */
import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api'

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA — 8 risk zones with geo-coordinates and metrics
   ═══════════════════════════════════════════════════════════════ */
const allZones = [
  { id: 'Z-01', name: 'Algiers Centre', wilaya: 'Algiers', lat: 36.7538, lng: 3.0588, risk: 'high', incidents: 18, population: 1200000, threshold: 15, aiOverride: false, trend: 'rising' },
  { id: 'Z-02', name: 'Oran Industrial', wilaya: 'Oran', lat: 35.6969, lng: -0.6331, risk: 'high', incidents: 12, population: 850000, threshold: 12, aiOverride: false, trend: 'stable' },
  { id: 'Z-03', name: 'Constantine University District', wilaya: 'Constantine', lat: 36.3650, lng: 6.6147, risk: 'medium', incidents: 7, population: 450000, threshold: 10, aiOverride: false, trend: 'declining' },
  { id: 'Z-04', name: 'Blida Highway Corridor', wilaya: 'Blida', lat: 36.4700, lng: 2.8300, risk: 'medium', incidents: 5, population: 340000, threshold: 8, aiOverride: true, trend: 'stable' },
  { id: 'Z-05', name: 'Sétif Bypass', wilaya: 'Sétif', lat: 36.1910, lng: 5.4078, risk: 'medium', incidents: 6, population: 290000, threshold: 7, aiOverride: false, trend: 'rising' },
  { id: 'Z-06', name: 'Annaba Port Road', wilaya: 'Annaba', lat: 36.8974, lng: 7.7659, risk: 'low', incidents: 3, population: 260000, threshold: 6, aiOverride: false, trend: 'declining' },
  { id: 'Z-07', name: 'Batna Mountain Pass', wilaya: 'Batna', lat: 35.5569, lng: 6.1742, risk: 'high', incidents: 9, population: 310000, threshold: 8, aiOverride: true, trend: 'rising' },
  { id: 'Z-08', name: 'Tlemcen City Ring', wilaya: 'Tlemcen', lat: 34.8784, lng: -1.3150, risk: 'low', incidents: 2, population: 180000, threshold: 5, aiOverride: false, trend: 'stable' },
]

/* ── Google Maps configuration ── */
const mapContainerStyle = { width: '100%', height: '100%', borderRadius: 8 }
const mapCenter = { lat: 36.0, lng: 3.0 }  // roughly centered on northern Algeria
const mapOptions = {
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
  disableDefaultUI: true,
  zoomControl: true,
}

/** Color map for risk-level markers and pills */
const riskColors = { high: '#EF4444', medium: '#F59E0B', low: '#22C55E' }

/** Tab definitions for the 4 zone-management views */
const tabs = [
  { key: 'map', label: 'Zone Map' },
  { key: 'table', label: 'Zone Management' },
  { key: 'ranking', label: 'Wilaya Ranking' },
  { key: 'thresholds', label: 'Threshold Config' },
]

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminZonesPage() {
  /* --- URL-driven tab state (defaults to 'map') --- */
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'map'

  /* --- Local UI state --- */
  const [selectedZone, setSelectedZone] = useState(null)  // zone whose InfoWindow is open on map
  const [editZone, setEditZone] = useState(null)          // zone being edited in modal

  /* Load Google Maps script — API key from env variable */
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY || '',
  })

  /**
   * Aggregate zones by wilaya for the ranking tab.
   * Computes total incidents, population, high-risk zone count per wilaya.
   * Sorted descending by total incidents.
   */
  const wilayaRanking = useMemo(() => {
    const map = {}
    allZones.forEach(z => {
      if (!map[z.wilaya]) map[z.wilaya] = { wilaya: z.wilaya, zones: 0, totalIncidents: 0, highRisk: 0, population: 0 }
      map[z.wilaya].zones++
      map[z.wilaya].totalIncidents += z.incidents
      map[z.wilaya].population += z.population
      if (z.risk === 'high') map[z.wilaya].highRisk++
    })
    return Object.values(map).sort((a, b) => b.totalIncidents - a.totalIncidents)
  }, [])

  /* ═══ RENDER ═══ */
  return (
    <>
      {/* ═══ PAGE HEADER — zone/wilaya counts, export & add actions ═══ */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Risk Zones & Geo Management</h1>
          <p className="admin-page-subtitle">{allZones.length} monitored zones across {wilayaRanking.length} wilayas</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="admin-btn admin-btn-ghost">Export Zones</button>
          <button className="admin-btn admin-btn-primary">+ Add Zone</button>
        </div>
      </div>

      {/* ═══ TAB BAR — Map | Table | Ranking | Thresholds ═══ */}
      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key}
            className={`admin-tab ${currentTab === t.key ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: ZONE MAP — Google Maps with risk-colored markers ═══ */}
      {currentTab === 'map' && (
        <div className="admin-card" style={{ height: 500, padding: 0, overflow: 'hidden' }}>
          {isLoaded ? (
            <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={6} options={mapOptions}>
              {/* Render a circle marker per zone; size ∝ incident count */}
              {allZones.map(zone => (
                <Marker
                  key={zone.id}
                  position={{ lat: zone.lat, lng: zone.lng }}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE,
                    scale: 8 + zone.incidents * 0.5,  // larger circle = more incidents
                    fillColor: riskColors[zone.risk],
                    fillOpacity: 0.85,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                  onClick={() => setSelectedZone(zone)}
                />
              ))}
              {/* InfoWindow tooltip for the clicked zone */}
              {selectedZone && (
                <InfoWindow
                  position={{ lat: selectedZone.lat, lng: selectedZone.lng }}
                  onCloseClick={() => setSelectedZone(null)}
                >
                  <div style={{ padding: '4px 2px', minWidth: 180, color: '#111' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>{selectedZone.name}</h4>
                    <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                      <div>Wilaya: <strong>{selectedZone.wilaya}</strong></div>
                      <div>Risk Level: <strong style={{ color: riskColors[selectedZone.risk] }}>{selectedZone.risk.toUpperCase()}</strong></div>
                      <div>Incidents (30d): <strong>{selectedZone.incidents}</strong></div>
                      <div>Population: <strong>{selectedZone.population.toLocaleString()}</strong></div>
                      <div>Trend: <strong>{selectedZone.trend}</strong></div>
                      {selectedZone.aiOverride && <div style={{ color: '#F59E0B', fontWeight: 600, marginTop: 4 }}>⚠ AI Override Active</div>}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>
              Loading map…
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: ZONE MANAGEMENT TABLE — CRUD with AI override toggle ═══ */}
      {currentTab === 'table' && (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Zone Name</th>
                  <th>Wilaya</th>
                  <th>Risk Level</th>
                  <th>Incidents (30d)</th>
                  <th>Threshold</th>
                  <th>AI Override</th>
                  <th>Trend</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allZones.map(zone => (
                  <tr key={zone.id}>
                    <td style={{ fontWeight: 600, fontSize: 11 }}>{zone.id}</td>
                    <td style={{ fontWeight: 500, fontSize: 11.5 }}>{zone.name}</td>
                    <td style={{ fontSize: 11 }}>{zone.wilaya}</td>
                    <td><span className={`admin-pill ${zone.risk}`}>{zone.risk}</span></td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{zone.incidents}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{zone.threshold}</td>
                    <td>
                      <div className={`admin-toggle small ${zone.aiOverride ? 'active' : ''}`}>
                        <div className="admin-toggle-thumb"></div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: zone.trend === 'rising' ? 'var(--admin-danger)' : zone.trend === 'declining' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                        {zone.trend === 'rising' ? '↑' : zone.trend === 'declining' ? '↓' : '—'} {zone.trend}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="admin-btn admin-btn-sm admin-btn-ghost" onClick={() => setEditZone(zone)}>Edit</button>
                        <button className="admin-btn admin-btn-sm admin-btn-danger">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: WILAYA RANKING — aggregated by province ═══ */}
      {currentTab === 'ranking' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Wilaya Risk Ranking</h3>
          <p className="admin-card-subtitle">Ranked by total incident count (last 30 days)</p>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wilaya</th>
                  <th>Zones</th>
                  <th>Total Incidents</th>
                  <th>High Risk Zones</th>
                  <th>Population</th>
                  <th>Incidents / 100k</th>
                </tr>
              </thead>
              <tbody>
                {wilayaRanking.map((w, i) => (
                  <tr key={w.wilaya}>
                    <td style={{ fontWeight: 700, fontSize: 13, color: i === 0 ? 'var(--admin-danger)' : i === 1 ? 'var(--admin-warning)' : 'var(--admin-text)' }}>
                      #{i + 1}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{w.wilaya}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{w.zones}</td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{w.totalIncidents}</td>
                    <td>
                      {w.highRisk > 0 ? (
                        <span style={{ fontWeight: 600, color: 'var(--admin-danger)' }}>{w.highRisk}</span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>0</span>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{w.population.toLocaleString()}</td>
                    {/* Incident rate normalized per 100,000 population */}
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {((w.totalIncidents / w.population) * 100000).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: THRESHOLD CONFIG — per-zone escalation settings ═══ */}
      {currentTab === 'thresholds' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Alert Threshold Configuration</h3>
          <p className="admin-card-subtitle">Set incident count thresholds that trigger automatic risk escalation per zone</p>
          <div style={{ marginTop: 14 }}>
            {allZones.map(zone => (
              <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--admin-border)' }}>
                <div style={{ width: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{zone.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>{zone.wilaya}</div>
                </div>
                <span className={`admin-pill ${zone.risk}`} style={{ width: 60, textAlign: 'center' }}>{zone.risk}</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'var(--admin-text-muted)', width: 60 }}>Threshold:</span>
                  <input className="admin-input" type="number" defaultValue={zone.threshold} min={1} max={100} style={{ width: 60, height: 28, textAlign: 'center', fontSize: 12 }} />
                  <span style={{ fontSize: 10, color: 'var(--admin-text-muted)' }}>incidents / 30 days</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: zone.aiOverride ? 'var(--admin-warning)' : 'var(--admin-text-muted)' }}>AI Override</span>
                  <div className={`admin-toggle small ${zone.aiOverride ? 'active' : ''}`}>
                    <div className="admin-toggle-thumb"></div>
                  </div>
                </div>
                <button className="admin-btn admin-btn-sm admin-btn-primary">Save</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ EDIT ZONE MODAL — overlay form for risk/threshold/coords ═══ */}
      {editZone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="admin-card" style={{ width: 440, padding: 24 }}>
            <h3 className="admin-card-title" style={{ fontSize: 15 }}>Edit Zone: {editZone.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <div>
                <label className="admin-form-label">Risk Level</label>
                <select className="admin-select" defaultValue={editZone.risk}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="admin-form-label">Threshold</label>
                <input className="admin-input" type="number" defaultValue={editZone.threshold} />
              </div>
              <div>
                <label className="admin-form-label">Latitude</label>
                <input className="admin-input" type="number" step="0.0001" defaultValue={editZone.lat} />
              </div>
              <div>
                <label className="admin-form-label">Longitude</label>
                <input className="admin-input" type="number" step="0.0001" defaultValue={editZone.lng} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditZone(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={() => { alert('Zone updated'); setEditZone(null) }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
