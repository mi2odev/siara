import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import BugReportIcon from '@mui/icons-material/BugReport'
import CloseIcon from '@mui/icons-material/Close'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import LayersIcon from '@mui/icons-material/Layers'
import NavigationIcon from '@mui/icons-material/Navigation'
import ShieldIcon from '@mui/icons-material/Shield'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

import useLiveLocation from '../../hooks/useLiveLocation'
import FallbackLocationBanner from '../../components/map/FallbackLocationBanner'
import {
  bearingDegrees,
  formatDistanceMeters,
  formatDurationSeconds,
} from '../../utils/navigationHelpers'
import '../../styles/NavigationPreview.css'

const PREVIEW_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const MOCK_LOCATION = {
  lat: 36.7527,
  lng: 3.042,
  accuracy: 18,
  heading: 42,
  headingSource: 'fallback',
}

const MOCK_ROUTE = {
  route_type: 'balanced',
  route_label: 'Balanced',
  destination: { name: 'Algiers Central Hospital' },
  distance_km: 4.8,
  duration_min: 14,
  summary: { danger_percent: 38, danger_level: 'moderate' },
  path: [
    [36.7527, 3.042],
    [36.7564, 3.0484],
    [36.7622, 3.0551],
    [36.7686, 3.0606],
    [36.7736, 3.0668],
  ],
  segments: [
    { segment_id: 'seg-1', danger_level: 'low', danger_percent: 18, distance_km: 1.1, path: [[36.7527, 3.042], [36.7564, 3.0484]] },
    { segment_id: 'seg-2', danger_level: 'moderate', danger_percent: 42, distance_km: 1.2, path: [[36.7564, 3.0484], [36.7622, 3.0551]] },
    { segment_id: 'seg-3', danger_level: 'high', danger_percent: 66, distance_km: 1.3, path: [[36.7622, 3.0551], [36.7686, 3.0606]] },
    { segment_id: 'seg-4', danger_level: 'low', danger_percent: 22, distance_km: 1.2, path: [[36.7686, 3.0606], [36.7736, 3.0668]] },
  ],
}

const MOCK_ALTERNATIVES = [
  { route_type: 'fastest', route_label: 'Fastest', duration_min: 11, distance_km: 4.4, risk: 55 },
  { route_type: 'safest', route_label: 'Safest', duration_min: 17, distance_km: 5.6, risk: 21 },
  { route_type: 'balanced', route_label: 'Balanced', duration_min: 14, distance_km: 4.8, risk: 38 },
]

function toLngLat(path) {
  return path.map(([lat, lng]) => [lng, lat])
}

function buildMarkerElement() {
  const element = document.createElement('div')
  element.className = 'nav-preview-user'
  element.innerHTML = '<span class="nav-preview-user__halo"></span><span class="nav-preview-user__arrow"></span>'
  return element
}

function recenter(map, location, heading, onCameraUpdate) {
  if (!map || !location) return false
  map.easeTo({
    center: [location.lng, location.lat],
    zoom: 16.5,
    pitch: 54,
    bearing: Number.isFinite(Number(heading)) ? Number(heading) : 0,
    duration: 550,
  })
  onCameraUpdate?.(Date.now())
  return true
}

function formatClock(value) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function NavigationPreviewPage() {
  const { t } = useTranslation(['pages', 'common'])
  const mapNodeRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [followUser, setFollowUser] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [routePanelOpen, setRoutePanelOpen] = useState(true)
  const [selectedRouteType, setSelectedRouteType] = useState('balanced')
  const [lastCameraUpdateAt, setLastCameraUpdateAt] = useState(null)
  const {
    location,
    error,
    lastError,
    status,
    lastUpdatedAt,
    isFallback,
    isLoading,
    errorMessage,
    retryLocation,
    startTracking,
  } = useLiveLocation({ autoStart: false })

  const displayLocation = location || MOCK_LOCATION
  const routeBearing = useMemo(
    () => bearingDegrees(
      { lat: MOCK_ROUTE.path[0][0], lng: MOCK_ROUTE.path[0][1] },
      { lat: MOCK_ROUTE.path[1][0], lng: MOCK_ROUTE.path[1][1] },
    ),
    [],
  )
  const heading = location?.headingSource === 'fallback'
    ? routeBearing
    : location?.heading ?? routeBearing ?? 0
  const headingSource = location?.headingSource && location.headingSource !== 'fallback'
    ? location.headingSource
    : 'route-bearing'

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined

    const map = new maplibregl.Map({
      container: mapNodeRef.current,
      style: PREVIEW_STYLE,
      center: [MOCK_LOCATION.lng, MOCK_LOCATION.lat],
      zoom: 15.4,
      pitch: 54,
      bearing: routeBearing ?? 0,
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('load', () => {
      mapRef.current = map
      map.addSource('preview-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: toLngLat(MOCK_ROUTE.path) },
          properties: {},
        },
      })
      map.addLayer({
        id: 'preview-route-shadow',
        type: 'line',
        source: 'preview-route',
        paint: { 'line-width': 10, 'line-color': '#111827', 'line-opacity': 0.62 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: 'preview-route-line',
        type: 'line',
        source: 'preview-route',
        paint: { 'line-width': 6, 'line-color': '#2563eb', 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      markerRef.current = new maplibregl.Marker({
        element: buildMarkerElement(),
        rotationAlignment: 'map',
      })
        .setLngLat([MOCK_LOCATION.lng, MOCK_LOCATION.lat])
        .setRotation(routeBearing ?? 0)
        .addTo(map)
      setMapReady(true)
    })

    const disableFollow = (event) => {
      if (event?.originalEvent) setFollowUser(false)
    }
    map.on('dragstart', disableFollow)
    map.on('wheel', disableFollow)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      setMapReady(false)
    }
  }, [routeBearing])

  useEffect(() => {
    if (!mapReady || !markerRef.current) return
    markerRef.current
      .setLngLat([displayLocation.lng, displayLocation.lat])
      .setRotation(heading)
    if (followUser) {
      recenter(mapRef.current, displayLocation, heading, setLastCameraUpdateAt)
    }
  }, [displayLocation, followUser, heading, mapReady])

  const handleLocate = useCallback(() => {
    setFollowUser(true)
    startTracking()
    recenter(mapRef.current, displayLocation, heading, setLastCameraUpdateAt)
  }, [displayLocation, heading, startTracking])

  const currentSegment = MOCK_ROUTE.segments[2]
  const distanceRemaining = MOCK_ROUTE.distance_km * 1000
  const etaSeconds = MOCK_ROUTE.duration_min * 60
  const debugError = error?.message || lastError?.message || ''

  return (
    <main className={`nav-preview-page${routePanelOpen ? ' is-route-panel-open' : ''}`}>
      <div ref={mapNodeRef} className="nav-preview-map" />

      {isFallback ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
          }}
        >
          <FallbackLocationBanner
            isFallback={isFallback}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onRetry={retryLocation}
          />
        </div>
      ) : null}

      <nav className="nav-preview-tabs" aria-label={t('navigationPreviewPage.tabs.ariaLabel')}>
        <button type="button" className="is-active">
          <NavigationIcon />
          {t('navigationPreviewPage.tabs.drive')}
        </button>
        <button type="button">
          <AltRouteIcon />
          {t('navigationPreviewPage.tabs.routes')}
        </button>
        <button type="button">
          <WarningAmberIcon />
          {t('navigationPreviewPage.tabs.risk')}
        </button>
      </nav>

      <section className="nav-preview-instruction" aria-label={t('navigationPreviewPage.instruction.ariaLabel')}>
        <div className="nav-preview-instruction__icon"><NavigationIcon /></div>
        <div>
          <span>{t('navigationPreviewPage.instruction.in450m')}</span>
          <strong>{t('navigationPreviewPage.instruction.keepRight')}</strong>
          <small>{t('navigationPreviewPage.instruction.continueStraight')}</small>
        </div>
      </section>

      <div className="nav-preview-controls" aria-label={t('navigationPreviewPage.controls.ariaLabel')}>
        <button
          type="button"
          onClick={() => setRoutePanelOpen((open) => !open)}
          aria-pressed={routePanelOpen}
          aria-label={t('navigationPreviewPage.controls.toggleRoutePanel')}
        >
          <LayersIcon />
        </button>
        <button
          type="button"
          onClick={() => setShowDebug((open) => !open)}
          aria-pressed={showDebug}
          aria-label={t('navigationPreviewPage.controls.toggleDebug')}
        >
          <BugReportIcon />
        </button>
        <button
          type="button"
          className="nav-preview-controls__locate"
          onClick={handleLocate}
          aria-pressed={followUser}
          aria-label={t('navigationPreviewPage.controls.centerLocation')}
        >
          <GpsFixedIcon />
          <span>{t('navigationPreviewPage.controls.myLocation')}</span>
        </button>
      </div>

      <aside className="nav-preview-route" aria-label={t('navigationPreviewPage.routePanel.ariaLabel')}>
        <div className="nav-preview-route__scroll">
          <header className="nav-preview-route__header">
            <div>
              <span>{t('navigationPreviewPage.routePanel.selectedRoute')}</span>
              <strong>{MOCK_ROUTE.route_label}</strong>
            </div>
            <span className="nav-preview-route__badge">
              <ShieldIcon />
              {t('navigationPreviewPage.routePanel.safer')}
            </span>
          </header>

          <section className="nav-preview-route__section">
            <span>{t('navigationPreviewPage.routePanel.destination')}</span>
            <strong>{MOCK_ROUTE.destination.name}</strong>
          </section>

          <section className="nav-preview-route__metrics" aria-label={t('navigationPreviewPage.routePanel.metricsAriaLabel')}>
            <div>
              <strong>{MOCK_ROUTE.duration_min} min</strong>
              <span>{t('navigationPreviewPage.routePanel.eta')}</span>
            </div>
            <div>
              <strong>{MOCK_ROUTE.distance_km.toFixed(1)} km</strong>
              <span>{t('navigationPreviewPage.routePanel.distance')}</span>
            </div>
            <div>
              <strong>{MOCK_ROUTE.summary.danger_percent}%</strong>
              <span>{MOCK_ROUTE.summary.danger_level}</span>
            </div>
          </section>

          <section className="nav-preview-route__section">
            <span>{t('navigationPreviewPage.routePanel.whyThisRoute')}</span>
            <p>
              {t('navigationPreviewPage.routePanel.whyThisRouteText')}
            </p>
          </section>

          <section className="nav-preview-route__section">
            <span>{t('navigationPreviewPage.routePanel.segmentRiskSummary')}</span>
            <div className="nav-preview-route__segments">
              {MOCK_ROUTE.segments.map((segment, index) => (
                <div key={segment.segment_id}>
                  <strong>{t('navigationPreviewPage.routePanel.segment', { number: index + 1 })}</strong>
                  <span>{segment.danger_percent}% {segment.danger_level}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="nav-preview-route__section">
            <span>{t('navigationPreviewPage.routePanel.alternatives')}</span>
            <div className="nav-preview-route__choices">
              {MOCK_ALTERNATIVES.map((route) => (
                <button
                  key={route.route_type}
                  type="button"
                  className={selectedRouteType === route.route_type ? 'is-active' : ''}
                  onClick={() => setSelectedRouteType(route.route_type)}
                >
                  <strong>{route.route_label}</strong>
                  <span>{route.duration_min} min</span>
                  <small>{t('navigationPreviewPage.routePanel.riskPercent', { percent: route.risk })}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <section className="nav-preview-risk" aria-label={t('navigationPreviewPage.segmentRisk.ariaLabel')}>
        <WarningAmberIcon />
        <div>
          <span>{t('navigationPreviewPage.segmentRisk.currentSegment')}</span>
          <strong>{currentSegment.danger_percent}% {currentSegment.danger_level}</strong>
          <small>{t('navigationPreviewPage.segmentRisk.untilNextSegment', { distance: currentSegment.distance_km.toFixed(1) })}</small>
        </div>
      </section>

      <section className="nav-preview-legend" aria-label={t('navigationPreviewPage.legend.ariaLabel')}>
        <span><i className="risk-low" /> {t('navigationPreviewPage.legend.low')}</span>
        <span><i className="risk-moderate" /> {t('navigationPreviewPage.legend.moderate')}</span>
        <span><i className="risk-high" /> {t('navigationPreviewPage.legend.high')}</span>
      </section>

      <section className="nav-preview-summary" aria-label={t('navigationPreviewPage.summary.ariaLabel')}>
        <div>
          <strong>{formatDurationSeconds(etaSeconds)}</strong>
          <span>{t('navigationPreviewPage.summary.eta')}</span>
        </div>
        <div>
          <strong>{formatDistanceMeters(distanceRemaining)}</strong>
          <span>{t('navigationPreviewPage.summary.remaining')}</span>
        </div>
        <div>
          <strong>{MOCK_ROUTE.summary.danger_percent}%</strong>
          <span>{MOCK_ROUTE.summary.danger_level}</span>
        </div>
        <button type="button" onClick={() => setFollowUser(false)}>
          <CloseIcon />
          {t('navigationPreviewPage.summary.exitNavigation')}
        </button>
      </section>

      {showDebug ? (
        <div className="nav-preview-debug" aria-label={t('navigationPreviewPage.debug.ariaLabel')}>
          <span>lat {displayLocation.lat.toFixed(6)}</span>
          <span>lng {displayLocation.lng.toFixed(6)}</span>
          <span>accuracy {displayLocation.accuracy != null ? `${Math.round(displayLocation.accuracy)}m` : 'n/a'}</span>
          <span>heading {Number.isFinite(Number(heading)) ? `${Math.round(heading)}deg` : 'n/a'}</span>
          <span>source {headingSource}</span>
          <span>follow {followUser ? 'true' : 'false'}</span>
          <span>nav true</span>
          <span>camera {followUser ? 'follow' : 'free'}</span>
          <span>tracking {status}</span>
          <span>fix {formatClock(lastUpdatedAt)}</span>
          <span>camera at {formatClock(lastCameraUpdateAt)}</span>
          {debugError ? <span>last error {debugError}</span> : null}
        </div>
      ) : null}
    </main>
  )
}
