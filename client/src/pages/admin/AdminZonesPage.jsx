/**
 * @file AdminZonesPage.jsx
 * @description Admin risk-zone geo-management page backed by wilaya polygons.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import FancySelect from '../../components/ui/FancySelect'
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

const EMPTY_TEXT = '—'
const DEFAULT_TAB = 'map'
const BASE_CENTER = [28.0, 2.8]
const MAP_BOUNDS_PADDING = [18, 18]
const RISK_COLORS = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#991B1B',
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

function getMetricTitle(metric, t) {
  switch (metric) {
    case 'model':
      return t('adminZonesPage.metricTitle.model')
    case 'reports':
      return t('adminZonesPage.metricTitle.reports')
    case 'alerts':
      return t('adminZonesPage.metricTitle.alerts')
    case 'composite':
    default:
      return t('adminZonesPage.metricTitle.composite')
  }
}

function getLevelFromScore(score) {
  if (score >= 67) {
    return 'high'
  }

  if (score >= 34) {
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
  const { t } = useTranslation(['admin', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || DEFAULT_TAB
  const [period, setPeriod] = useState('24h')
  const [metric, setMetric] = useState('composite')
  const [mapPayload, setMapPayload] = useState({
    featureCollection: { type: 'FeatureCollection', features: [] },
    items: [],
    stats: { zoneCount: 0, low: 0, medium: 0, high: 0 },
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

  const TABS = [
    { key: 'map', label: t('adminZonesPage.tabs.map') },
    { key: 'table', label: t('adminZonesPage.tabs.table') },
    { key: 'ranking', label: t('adminZonesPage.tabs.ranking') },
    { key: 'thresholds', label: t('adminZonesPage.tabs.thresholds') },
  ]

  const PERIOD_OPTIONS = [
    { value: '24h', label: t('adminZonesPage.period.24h') },
    { value: '7d', label: t('adminZonesPage.period.7d') },
    { value: '30d', label: t('adminZonesPage.period.30d') },
  ]

  const METRIC_OPTIONS = [
    { value: 'composite', label: t('adminZonesPage.metric.composite') },
    { value: 'model', label: t('adminZonesPage.metric.model') },
    { value: 'reports', label: t('adminZonesPage.metric.reports') },
    { value: 'alerts', label: t('adminZonesPage.metric.alerts') },
  ]

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

    const preferred = mapPayload.items.find((zone) => zone.riskLevel === 'high')
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
          <span>${t('adminZonesPage.tooltip.risk')} ${Number(zone.riskScore || 0).toFixed(1)} | ${String(zone.riskLevel || 'low').toUpperCase()}</span>
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
          <h1 className="admin-page-title">{t('adminZonesPage.title')}</h1>
          <p className="admin-page-subtitle">
            {t('adminZonesPage.subtitle', { count: mapPayload.stats.zoneCount })}
            {mapPayload.generatedAt ? ` | ${t('adminZonesPage.refreshed', { time: new Date(mapPayload.generatedAt).toLocaleString() })}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FancySelect
            value={period}
            onChange={(v) => setPeriod(normalizeZonePeriod(v))}
            options={PERIOD_OPTIONS}
            label={t('adminZonesPage.periodLabel')}
          />
          <FancySelect
            value={metric}
            onChange={(v) => setMetric(normalizeZoneMetric(v))}
            options={METRIC_OPTIONS}
            label={t('adminZonesPage.metricLabel')}
          />
          <button className="admin-btn admin-btn-ghost" onClick={handleExportGeoJson}>
            {t('adminZonesPage.exportZones')}
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => { void handleRebuildSummary() }}
            disabled={rebuilding}
          >
            {rebuilding ? t('adminZonesPage.rebuilding') : t('adminZonesPage.rebuildSummary')}
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
              <h2 className="admin-card-title">{t('adminZonesPage.errorTitle')}</h2>
              <p className="admin-card-subtitle">{error.message || t('adminZonesPage.errorFallback')}</p>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t('common:actions.retry')}
            </button>
          </div>
        </div>
      )}

      {currentTab === 'map' && (
        <div className="admin-card">
          <div className="admin-card-header" style={{ marginBottom: 10 }}>
            <div>
              <h3 className="admin-card-title">{t('adminZonesPage.mapTab.title')}</h3>
              <p className="admin-card-subtitle">
                {t('adminZonesPage.mapTab.subtitle', { metric: getMetricTitle(metric, t).toLowerCase() })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="admin-mini-stat">
                <span className="admin-mini-stat-label">{t('adminZonesPage.statLabel.high')}</span>
                <span className="admin-mini-stat-value">{mapPayload.stats.high}</span>
              </div>
              <div className="admin-mini-stat">
                <span className="admin-mini-stat-label">{t('adminZonesPage.statLabel.selectedMetric')}</span>
                <span className="admin-mini-stat-value">{getMetricTitle(metric, t)}</span>
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
                    <div className="admin-zone-legend-title">{getMetricTitle(metric, t)}</div>
                    {[
                      { label: t('adminZonesPage.riskLevel.high'), tone: 'high' },
                      { label: t('adminZonesPage.riskLevel.medium'), tone: 'medium' },
                      { label: t('adminZonesPage.riskLevel.low'), tone: 'low' },
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
                  {t('adminZonesPage.mapEmpty')}
                </div>
              )}

              {loading && (
                <div className="admin-zone-map-loading">
                  {t('adminZonesPage.mapLoading')}
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
                        {t('adminZonesPage.detail.finalScore')} {formatScore(selectedZone.riskScore)}
                        {' | '}
                        <span className={`admin-pill ${selectedZone.riskLevel}`}>{selectedZone.riskLevel}</span>
                      </p>
                    </div>
                    <span className="admin-pill info">{getMetricTitle(metric, t)}</span>
                  </div>

                  <div className="admin-zone-detail-grid">
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">{t('adminZonesPage.detail.modelWeighted')}</span>
                      <span className="admin-mini-stat-value">{formatScore(selectedZone.modelWeightedScore)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">{t('adminZonesPage.detail.recentReports')}</span>
                      <span className="admin-mini-stat-value">{formatCount(selectedZone.recentReportCount)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">{t('adminZonesPage.detail.activeAlerts')}</span>
                      <span className="admin-mini-stat-value">{formatCount(selectedZone.activeAlertCount)}</span>
                    </div>
                    <div className="admin-mini-stat">
                      <span className="admin-mini-stat-label">{t('adminZonesPage.detail.confidenceAvg')}</span>
                      <span className="admin-mini-stat-value">{formatScore(selectedZone.confidenceAvg, 1, '%')}</span>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.trendVsPrevious')}</span>
                      <strong style={{ color: getTrendTone(selectedZone.trendVsPrevious) }}>
                        {formatTrend(selectedZone.trendVsPrevious)}
                      </strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.topRoad')}</span>
                      <strong>{selectedZone.topRoadName || EMPTY_TEXT}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.topRoadRisk')}</span>
                      <strong>{formatScore(selectedZone.topRoadRiskScore)}</strong>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <h4 className="admin-zone-detail-title">{t('adminZonesPage.detail.zoneBreakdown')}</h4>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.compositeScore')}</span>
                      <strong>{formatScore(selectedZone.riskScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.reportScore')}</span>
                      <strong>{formatScore(selectedZone.reportScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.alertScore')}</span>
                      <strong>{formatScore(selectedZone.alertScore)}</strong>
                    </div>
                    <div className="admin-zone-detail-row">
                      <span>{t('adminZonesPage.detail.verifiedPendingFlagged')}</span>
                      <strong>
                        {selectedZone.verifiedReportCount} / {selectedZone.pendingReportCount} / {selectedZone.flaggedReportCount}
                      </strong>
                    </div>
                  </div>

                  <div className="admin-zone-detail-section">
                    <h4 className="admin-zone-detail-title">{t('adminZonesPage.detail.selectedZoneDetails')}</h4>
                    {detailsLoading ? (
                      <p className="admin-card-subtitle">{t('adminZonesPage.detail.loadingDetails')}</p>
                    ) : selectedDetails ? (
                      <>
                        <div className="admin-zone-detail-row">
                          <span>{t('adminZonesPage.detail.topRoads')}</span>
                          <strong>{selectedDetails.topRoads.length}</strong>
                        </div>
                        <div className="admin-zone-detail-row">
                          <span>{t('adminZonesPage.detail.recentReports')}</span>
                          <strong>{selectedDetails.recentReportsSummary.total}</strong>
                        </div>
                        <div className="admin-zone-detail-row">
                          <span>{t('adminZonesPage.detail.scheduledAlerts')}</span>
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
                              <span>{t('adminZonesPage.detail.noRoads')}</span>
                              <strong>{EMPTY_TEXT}</strong>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="admin-card-subtitle">{t('adminZonesPage.detail.clickPrompt')}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="admin-map-placeholder" style={{ height: '100%' }}>
                  {t('adminZonesPage.detail.selectPrompt')}
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
              <h3 className="admin-card-title">{t('adminZonesPage.tableTab.title')}</h3>
              <p className="admin-card-subtitle">{t('adminZonesPage.tableTab.subtitle')}</p>
            </div>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminZonesPage.tableTab.colZone')}</th>
                  <th>{t('adminZonesPage.tableTab.colRisk')}</th>
                  <th>{t('adminZonesPage.tableTab.colScore')}</th>
                  <th>{t('adminZonesPage.tableTab.colModel')}</th>
                  <th>{t('adminZonesPage.tableTab.colReports')}</th>
                  <th>{t('adminZonesPage.tableTab.colAlerts')}</th>
                  <th>{t('adminZonesPage.tableTab.colTopRoad')}</th>
                  <th>{t('adminZonesPage.tableTab.colTrend')}</th>
                  <th>{t('adminZonesPage.tableTab.colAction')}</th>
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
                        {t('adminZonesPage.tableTab.viewBtn')}
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
          <h3 className="admin-card-title">{t('adminZonesPage.rankingTab.title')}</h3>
          <p className="admin-card-subtitle">{t('adminZonesPage.rankingTab.subtitle')}</p>
          <div className="admin-table-wrapper" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminZonesPage.rankingTab.colRank')}</th>
                  <th>{t('adminZonesPage.rankingTab.colWilaya')}</th>
                  <th>{t('adminZonesPage.rankingTab.colRiskLevel')}</th>
                  <th>{t('adminZonesPage.rankingTab.colFinalScore')}</th>
                  <th>{t('adminZonesPage.rankingTab.colModelScore')}</th>
                  <th>{t('adminZonesPage.rankingTab.colReports')}</th>
                  <th>{t('adminZonesPage.rankingTab.colActiveAlerts')}</th>
                  <th>{t('adminZonesPage.rankingTab.colTrend')}</th>
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
          <h3 className="admin-card-title">{t('adminZonesPage.thresholdsTab.title')}</h3>
          <p className="admin-card-subtitle">{t('adminZonesPage.thresholdsTab.subtitle')}</p>
          <div className="admin-zone-threshold-grid">
            {[
              { label: t('adminZonesPage.riskLevel.low'), value: '0 - 33.9', tone: 'low' },
              { label: t('adminZonesPage.riskLevel.medium'), value: '34 - 66.9', tone: 'medium' },
              { label: t('adminZonesPage.riskLevel.high'), value: '67 - 100', tone: 'high' },
            ].map((band) => (
              <div key={band.tone} className="admin-mini-stat">
                <span className="admin-mini-stat-label">{t('adminZonesPage.thresholdsTab.band', { level: band.label })}</span>
                <span className="admin-mini-stat-value" style={{ color: RISK_COLORS[band.tone] }}>{band.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminZonesPage.thresholdsTab.weightModel')}</span>
              <span className="admin-mini-stat-value">50%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminZonesPage.thresholdsTab.weightReport')}</span>
              <span className="admin-mini-stat-value">25%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminZonesPage.thresholdsTab.weightAlert')}</span>
              <span className="admin-mini-stat-value">20%</span>
            </div>
            <div className="admin-mini-stat">
              <span className="admin-mini-stat-label">{t('adminZonesPage.thresholdsTab.weightIncident')}</span>
              <span className="admin-mini-stat-value">5%</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
