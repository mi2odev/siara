/**
 * @file AdminZonesPage.jsx
 * @description Admin risk-zone geo-management page backed by wilaya polygons.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GeoJSON, MapContainer, Marker, Pane, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  fetchAdminZoneDetails,
  fetchAdminZoneMap,
  normalizeZoneMetric,
  normalizeZonePeriod,
  rebuildAdminZoneSummary,
} from '../../services/adminZonesService'

const EMPTY_TEXT = '\u2014'
const DEFAULT_TAB = 'map'
const TABS = [
  { key: 'map', label: 'Zone Map' },
  { key: 'table', label: 'Zone Management' },
  { key: 'ranking', label: 'Wilaya Ranking' },
  { key: 'thresholds', label: 'Threshold Config' },
]
const PERIOD_OPTIONS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]
const METRIC_OPTIONS = [
  { value: 'composite', label: 'Composite' },
  { value: 'model', label: 'Model' },
  { value: 'reports', label: 'Reports' },
  { value: 'alerts', label: 'Alerts' },
]
const BASE_CENTER = [28.0, 2.8]
const MAP_BOUNDS_PADDING = [18, 18]
const RISK_COLORS = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#991B1B',
}

function formatScore(value, digits = 1, suffix = '') {
  return typeof value === 'number' ? `${value.toFixed(digits)}${suffix}` : EMPTY_TEXT
}

function formatCount(value) {
  return typeof value === 'number' ? value.toLocaleString() : EMPTY_TEXT
}

function formatTrend(value) {
  if (typeof value !== 'number') {
    return EMPTY_TEXT
  }

  if (value > 0) {
    return `+${value.toFixed(1)}`
  }

  if (value < 0) {
    return value.toFixed(1)
  }

  return '0.0'
}

function getTrendTone(value) {
  if (typeof value !== 'number') {
    return 'var(--admin-text-muted)'
  }

  if (value > 0) {
    return 'var(--admin-danger)'
  }

  if (value < 0) {
    return 'var(--admin-success)'
  }

  return 'var(--admin-text-muted)'
}

function getMetricTitle(metric) {
  switch (metric) {
    case 'model':
      return 'Model weighted score'
    case 'reports':
      return 'Report score'
    case 'alerts':
      return 'Alert score'
    case 'composite':
    default:
      return 'Composite risk score'
  }
}

function getLevelFromScore(score) {
  if (score >= 75) {
    return 'critical'
  }

  if (score >= 50) {
    return 'high'
  }

  if (score >= 25) {
    return 'medium'
  }

  return 'low'
}

function getZoneColor(zone, metric) {
  const score = metric === 'composite'
    ? zone.riskScore
    : zone.metricScore

  return RISK_COLORS[getLevelFromScore(score)] || RISK_COLORS.low
}

function createZoneBadgeIcon(zone) {
  const badgeValue = Math.round(zone.metricScore)
  const riskLevel = getLevelFromScore(zone.metricScore)

  return L.divIcon({
    className: 'admin-zone-badge-shell',
    html: `<span class="admin-zone-badge admin-zone-badge-${riskLevel}">${badgeValue}</span>`,
    iconSize: [34, 22],
    iconAnchor: [17, 11],
  })
}

function ZoneBoundsController({ featureCollection }) {
  const map = useMap()

  useEffect(() => {
    const features = featureCollection?.features || []
    if (features.length === 0) {
      return
    }

    const bounds = L.geoJSON(featureCollection).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: MAP_BOUNDS_PADDING, maxZoom: 7 })
    }
  }, [featureCollection, map])

  return null
}

export default function AdminZonesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || DEFAULT_TAB
  const [period, setPeriod] = useState('24h')
  const [metric, setMetric] = useState('composite')
  const [mapPayload, setMapPayload] = useState({
    featureCollection: { type: 'FeatureCollection', features: [] },
    items: [],
    stats: { zoneCount: 0, low: 0, medium: 0, high: 0, critical: 0 },
    generatedAt: null,
    summaryRebuilt: false,
  })
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [hoveredZoneId, setHoveredZoneId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    async function loadZoneMap() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchAdminZoneMap(period, metric, { signal: controller.signal })

        if (isActive && !controller.signal.aborted) {
          setMapPayload(payload)
        }
      } catch (requestError) {
        if (isActive && !controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (isActive && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadZoneMap()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [metric, period, reloadToken])

  useEffect(() => {
    if (mapPayload.items.length === 0) {
      setSelectedZoneId(null)
      return
    }

    const existingSelection = mapPayload.items.find((zone) => zone.adminAreaId === selectedZoneId)
    if (existingSelection) {
      return
    }

    const preferred = mapPayload.items.find((zone) => zone.riskLevel === 'critical')
      || mapPayload.items.find((zone) => zone.riskLevel === 'high')
      || mapPayload.items[0]

    setSelectedZoneId(preferred?.adminAreaId || null)
  }, [mapPayload.items, selectedZoneId])

  useEffect(() => {
    if (!selectedZoneId) {
      setSelectedDetails(null)
      return
    }

    const controller = new AbortController()
    let isActive = true

    async function loadZoneDetails() {
      setDetailsLoading(true)

      try {
        const payload = await fetchAdminZoneDetails(selectedZoneId, period, {
          signal: controller.signal,
        })

        if (isActive && !controller.signal.aborted) {
          setSelectedDetails(payload)
        }
      } catch (requestError) {
        if (isActive && !controller.signal.aborted) {
          setError(requestError)
        }
      } finally {
        if (isActive && !controller.signal.aborted) {
          setDetailsLoading(false)
        }
      }
    }

    loadZoneDetails()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [period, selectedZoneId])

  const selectedZone = useMemo(
    () => mapPayload.items.find((zone) => zone.adminAreaId === selectedZoneId) || null,
    [mapPayload.items, selectedZoneId],
  )

  const rankingRows = useMemo(
    () => [...mapPayload.items].sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore
      }

      if (right.recentReportCount !== left.recentReportCount) {
        return right.recentReportCount - left.recentReportCount
      }

      return left.name.localeCompare(right.name)
    }),
    [mapPayload.items],
  )

  const zoneTableRows = useMemo(
    () => [...mapPayload.items].sort((left, right) => {
      if (right.metricScore !== left.metricScore) {
        return right.metricScore - left.metricScore
      }

      return left.name.localeCompare(right.name)
    }),
    [mapPayload.items],
  )

  function handleTabChange(nextTab) {
    setSearchParams({ tab: nextTab })
  }

  async function handleRebuildSummary() {
    setRebuilding(true)
    setError(null)

    try {
      await rebuildAdminZoneSummary(period)
      setReloadToken((value) => value + 1)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setRebuilding(false)
    }
  }

  function handleExportGeoJson() {
    if (!mapPayload.featureCollection?.features?.length) {
      return
    }

    const blob = new Blob(
      [JSON.stringify(mapPayload.featureCollection, null, 2)],
      { type: 'application/geo+json' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `siara-zone-risk-${period}-${metric}.geojson`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleZoneFeature(feature, layer) {
    const zone = feature?.properties
    if (!zone) {
      return
    }

    layer.bindTooltip(
      `
        <div class="admin-zone-tooltip-content">
          <strong>${zone.name}</strong>
          <span>Risk ${Number(zone.riskScore || 0).toFixed(1)} | ${String(zone.riskLevel || 'low').toUpperCase()}</span>
        </div>
      `,
      {
        direction: 'top',
        sticky: true,
        className: 'admin-zone-tooltip',
      },
    )

    layer.on({
      mouseover() {
        setHoveredZoneId(zone.adminAreaId)
      },
      mouseout() {
        setHoveredZoneId((current) => (current === zone.adminAreaId ? null : current))
      },
      click() {
        setSelectedZoneId(zone.adminAreaId)
      },
    })
  }

  function getFeatureStyle(feature) {
    const zone = feature?.properties
    const isSelected = zone?.adminAreaId === selectedZoneId
    const isHovered = zone?.adminAreaId === hoveredZoneId
    const fillColor = getZoneColor(zone, metric)

    return {
      color: isSelected ? '#0F172A' : '#FFFFFF',
      weight: isSelected ? 2.4 : isHovered ? 2 : 1.2,
      fillColor,
      fillOpacity: isSelected ? 0.78 : isHovered ? 0.68 : 0.58,
      opacity: 0.9,
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Risk Zones & Geo Management</h1>
          <p className="admin-page-subtitle">
            {mapPayload.stats.zoneCount} monitored wilaya zones
            {mapPayload.generatedAt ? ` | refreshed ${new Date(mapPayload.generatedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select
            className="admin-select"
            value={period}
            onChange={(event) => setPeriod(normalizeZonePeriod(event.target.value))}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="admin-select"
            value={metric}
            onChange={(event) => setMetric(normalizeZoneMetric(event.target.value))}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button className="admin-btn admin-btn-ghost" onClick={handleExportGeoJson}>
            Export Zones
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => { void handleRebuildSummary() }}
            disabled={rebuilding}
          >
            {rebuilding ? 'Rebuilding...' : 'Rebuild Summary'}
          </button>
        </div>
      </div>

      <div className="admin-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${currentTab === tab.key ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="admin-card"
          style={{
            marginBottom: 14,
            borderColor: 'rgba(239, 68, 68, 0.35)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Zone intelligence unavailable</h2>
              <p className="admin-card-subtitle">{error.message || 'Please try again.'}</p>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {currentTab === 'map' && (
        <div className="admin-card">
          <div className="admin-card-header" style={{ marginBottom: 10 }}>
            <div>
              <h3 className="admin-card-title">Zone Intelligence Map</h3>
              <p className="admin-card-subtitle">
                Polygon-first wilaya risk view colored by {getMetricTitle(metric).toLowerCase()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="admin-mini-stat">
                <span className="admin-mini-stat-label">Critical</span>
                <span className="admin-mini-stat-value">{mapPayload.stats.critical}</span>
              </div>
              <div className="admin-mini-stat">
                <span className="admin-mini-stat-label">High</span>
                <span className="admin-mini-stat-value">{mapPayload.stats.high}</span>
              </div>
              <div className="admin-mini-stat">
                <span className="admin-mini-stat-label">Selected Metric</span>
                <span className="admin-mini-stat-value">{getMetricTitle(metric)}</span>
              </div>
            </div>
          </div>

          <div className="admin-zone-map-layout">
            <div className="admin-zone-map-canvas">
              {mapPayload.featureCollection.features.length > 0 ? (
                <>
                  <MapContainer
                    center={BASE_CENTER}
                    zoom={6}
                    zoomControl={false}
                    className="admin-zone-leaflet"
                  >
                    <ZoomControl position="bottomright" />
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ZoneBoundsController featureCollection={mapPayload.featureCollection} />
                    <GeoJSON
                      key={`${metric}-${selectedZoneId || 'none'}-${hoveredZoneId || 'none'}-${mapPayload.generatedAt || 'empty'}`}
                      data={mapPayload.featureCollection}
                      style={getFeatureStyle}
                      onEachFeature={handleZoneFeature}
                    />
                    <Pane name="zone-badges" style={{ zIndex: 550 }}>
                      {mapPayload.items
                        .filter((zone) => zone.centroid)
                        .map((zone) => (
                          <Marker
                            key={`badge-${zone.adminAreaId}`}
                            position={[zone.centroid.lat, zone.centroid.lng]}
                            icon={createZoneBadgeIcon(zone)}
                            interactive={false}
                            pane="zone-badges"
                          />
                        ))}
                    </Pane>
                  </MapContainer>
                  <div className="admin-zone-legend">
                    <div className="admin-zone-legend-title">{getMetricTitle(metric)}</div>
                    {[
                      { label: 'Critical', tone: 'critical' },
                      { label: 'High', tone: 'high' },
                      { label: 'Medium', tone: 'medium' },
                      { label: 'Low', tone: 'low' },
                    ].map((entry) => (
                      <div key={entry.tone} className="admin-zone-legend-row">
                        <span
                          className="admin-zone-legend-swatch"
                          style={{ background: RISK_COLORS[entry.tone] }}
                        ></span>
                        <span>{entry.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="admin-map-placeholder" style={{ height: '100%' }}>
                  No polygon summary is available yet for this period.
                </div>
              )}

              {loading && (
                <div className="admin-zone-map-loading">
                  Loading wilaya polygons and risk summaries...
                </div>
              )}
            </div>

            <div className="admin-zone-detail-panel">
              {selectedZone ? (
                <>
                  <div className="admin-zone-detail-header">
                    <div>
                      <h3 className="admin-card-title" style={{ fontSize: 15 }}>{selectedZone.name}</h3>
                      <p className="admin-card-subtitle">
                        Final score {formatScore(selectedZone.riskScore)}
                        {' | '}
                        <span className={`admin-pill ${selectedZone.riskLevel}`}>{selectedZone.riskLevel}</span>
                      </p>
                    </div>
                    <span className="admin-pill info">{getMetricTitle(metric)}</span>
                  </div>

                  <div className="admin-zone-detail-grid">
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">Model Weighted</span>
                      <span className="admin-mini-stat-value">{formatScore(selectedZone.modelWeightedScore)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">Recent Reports</span>
                      <span className="admin-mini-stat-value">{formatCount(selectedZone.recentReportCount)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">Active Alerts</span>
                      <span className="admin-mini-stat-value">{formatCount(selectedZone.activeAlertCount)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">Confidence Avg</span>
                      <span className="admin-mini-stat-value">{formatScore(selectedZone.confidenceAvg, 1, '%')}</span>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <div className="admin-zone-detail-row">
                      <span>Trend vs previous</span>
                      <strong style={{ color: getTrendTone(selectedZone.trendVsPrevious) }}>
                        {formatTrend(selectedZone.trendVsPrevious)}
                      </strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>Top road</span>
                      <strong>{selectedZone.topRoadName || EMPTY_TEXT}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>Top road risk</span>
                      <strong>{formatScore(selectedZone.topRoadRiskScore)}</strong>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <h4 className="admin-zone-detail-title">Zone breakdown</h4>
                    <div className="admin-zone-detail-row">
                      <span>Composite score</span>
                      <strong>{formatScore(selectedZone.riskScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>Report score</span>
                      <strong>{formatScore(selectedZone.reportScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>Alert score</span>
                      <strong>{formatScore(selectedZone.alertScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>Verified / Pending / Flagged</span>
                      <strong>
                        {selectedZone.verifiedReportCount} / {selectedZone.pendingReportCount} / {selectedZone.flaggedReportCount}
                      </strong>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <h4 className="admin-zone-detail-title">Selected zone details</h4>
                    {detailsLoading ? (
                      <p className="admin-card-subtitle">Loading zone details...</p>
                    ) : selectedDetails ? (
                      <>
                        <div className="admin-zone-detail-row">
                          <span>Top roads</span>
                          <strong>{selectedDetails.topRoads.length}</strong>
                        </div>
                        <div className="admin-zone-detail-row">
                          <span>Recent reports</span>
                          <strong>{selectedDetails.recentReportsSummary.total}</strong>
                        </div>
                        <div className="admin-zone-detail-row">
                          <span>Scheduled alerts</span>
                          <strong>{selectedDetails.operationalAlertsSummary.scheduled}</strong>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          {selectedDetails.topRoads.slice(0, 3).map((road) => (
                            <div key={road.roadSegmentId} className="admin-zone-list-row">
                              <span>{road.roadName}</span>
                              <strong>{formatScore(road.riskScore)}</strong>
                            </div>
                          ))}
                          {selectedDetails.topRoads.length === 0 ? (
                            <div className="admin-zone-list-row">
                              <span>No model-covered roads in this period</span>
                              <strong>{EMPTY_TEXT}</strong>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="admin-card-subtitle">Click a zone to inspect its road and alert signals.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="admin-map-placeholder" style={{ height: '100%' }}>
                  Select a wilaya polygon to inspect its risk signals.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentTab === 'table' && (
        <div className="admin-card">
          <div className="admin-card-header">
            <div>
              <h3 className="admin-card-title">Zone Management</h3>
              <p className="admin-card-subtitle">Real wilaya summaries from the current polygon cache</p>
            </div>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Risk</th>
                  <th>Score</th>
                  <th>Model</th>
                  <th>Reports</th>
                  <th>Alerts</th>
                  <th>Top Road</th>
                  <th>Trend</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {zoneTableRows.map((zone) => (
                  <tr key={zone.adminAreaId}>
                    <td style={{ fontWeight: 600 }}>{zone.name}</td>
                    <td><span className={`admin-pill ${zone.riskLevel}`}>{zone.riskLevel}</span></td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatScore(zone.riskScore)}</td>
                    <td>{formatScore(zone.modelWeightedScore)}</td>
                    <td>{formatCount(zone.recentReportCount)}</td>
                    <td>{formatCount(zone.activeAlertCount)}</td>
                    <td>{zone.topRoadName || EMPTY_TEXT}</td>
                    <td style={{ color: getTrendTone(zone.trendVsPrevious) }}>{formatTrend(zone.trendVsPrevious)}</td>
                    <td>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-primary"
                        onClick={() => {
                          setSelectedZoneId(zone.adminAreaId)
                          handleTabChange('map')
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'ranking' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Wilaya Risk Ranking</h3>
          <p className="admin-card-subtitle">Sorted by composite risk score with current report and alert pressure</p>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Wilaya</th>
                  <th>Risk Level</th>
                  <th>Final Score</th>
                  <th>Model Score</th>
                  <th>Reports</th>
                  <th>Active Alerts</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.map((zone, index) => (
                  <tr key={zone.adminAreaId}>
                    <td style={{ fontWeight: 700 }}>#{index + 1}</td>
                    <td style={{ fontWeight: 600 }}>{zone.name}</td>
                    <td><span className={`admin-pill ${zone.riskLevel}`}>{zone.riskLevel}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatScore(zone.riskScore)}</td>
                    <td>{formatScore(zone.modelWeightedScore)}</td>
                    <td>{formatCount(zone.recentReportCount)}</td>
                    <td>{formatCount(zone.activeAlertCount)}</td>
                    <td style={{ color: getTrendTone(zone.trendVsPrevious) }}>{formatTrend(zone.trendVsPrevious)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentTab === 'thresholds' && (
        <div className="admin-card">
          <h3 className="admin-card-title">Threshold Config</h3>
          <p className="admin-card-subtitle">Current V1 score bands and composite weighting used to color the zone map</p>
          <div className="admin-zone-threshold-grid">
            {[
              { label: 'Low', value: '0 - 24.9', tone: 'low' },
              { label: 'Medium', value: '25 - 49.9', tone: 'medium' },
              { label: 'High', value: '50 - 74.9', tone: 'high' },
              { label: 'Critical', value: '75 - 100', tone: 'critical' },
            ].map((band) => (
              <div key={band.label} className="admin-mini-stat">
                <span className="admin-mini-stat-label">{band.label} band</span>
                <span className="admin-mini-stat-value" style={{ color: RISK_COLORS[band.tone] }}>{band.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Model score</span>
              <span className="admin-mini-stat-value">50%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Report score</span>
              <span className="admin-mini-stat-value">25%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Alert score</span>
              <span className="admin-mini-stat-value">20%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">Incident history</span>
              <span className="admin-mini-stat-value">5%</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

