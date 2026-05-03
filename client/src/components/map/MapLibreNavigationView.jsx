import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import NavigationBanner from './NavigationBanner'
import NavigationSummaryCard from './NavigationSummaryCard'
import NavigationDangerAlert from './NavigationDangerAlert'
import CurrentSegmentCard from './CurrentSegmentCard'
import RouteOverviewCard from './RouteOverviewCard'
import { fetchRouteAlerts } from '../../services/routeAlertsService'
import {
  bearingDegrees,
  computeRouteProgress,
  deriveStepsFromPath,
  findCurrentStepIndex,
  getCurrentSegmentForUser,
} from '../../utils/navigationHelpers'
import '../../styles/CurrentSegmentCard.css'

const CURRENT_SEGMENT_THRESHOLD_M = 100

const ROUTE_ALERTS_POLL_MS = 30 * 1000
const ROUTE_ALERTS_LOOKAHEAD_KM = 5

// MapLibre-only navigation view. The normal SIARA map stays Leaflet — this
// component is mounted only when the user starts travel and unmounted when
// they exit navigation. Style: free OSM raster (no token, no Mapbox APIs).
// We use a raster style because it requires no API key and matches the OSM
// tiles already used by the Leaflet map. Pitch/bearing camera works on
// raster styles, which gives the GPS-style tilted look.
const NAV_STYLE = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm-raster',
    },
  ],
}

const NAV_ZOOM = 17
const NAV_PITCH = 55
const NAV_USER_OFFSET_RATIO = 0.7

const RISK_COLORS = {
  low: '#16A34A',
  moderate: '#F59E0B',
  medium: '#F59E0B',
  high: '#EA580C',
  extreme: '#7F1D1D',
  critical: '#7F1D1D',
}

function riskColor(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (RISK_COLORS[text]) return RISK_COLORS[text]
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return RISK_COLORS.low
  if (numeric >= 75) return RISK_COLORS.extreme
  if (numeric >= 50) return RISK_COLORS.high
  if (numeric >= 25) return RISK_COLORS.moderate
  return RISK_COLORS.low
}

function pathToLngLat(path) {
  if (!Array.isArray(path)) return []
  return path
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0])
        const lng = Number(point[1])
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null
      }
      if (point && typeof point === 'object') {
        const lat = Number(point.lat)
        const lng = Number(point.lng)
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null
      }
      return null
    })
    .filter(Boolean)
}

function buildRouteGeoJson(route) {
  const fullPath = pathToLngLat(route?.path)
  const features = []
  if (fullPath.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { kind: 'base' },
      geometry: { type: 'LineString', coordinates: fullPath },
    })
  }

  if (Array.isArray(route?.segments)) {
    for (const segment of route.segments) {
      const segPath = pathToLngLat(segment?.path)
      if (segPath.length < 2) continue
      features.push({
        type: 'Feature',
        properties: {
          kind: 'segment',
          color: riskColor(segment?.danger_level, segment?.danger_percent),
          dangerPercent: Number(segment?.danger_percent) || 0,
          dangerLevel: segment?.danger_level || 'low',
        },
        geometry: { type: 'LineString', coordinates: segPath },
      })
    }
  }

  return { type: 'FeatureCollection', features }
}

function buildAlternativesGeoJson(routes, selectedId) {
  if (!Array.isArray(routes)) return { type: 'FeatureCollection', features: [] }
  const features = []
  for (const route of routes) {
    if (!route) continue
    if (selectedId && (route.route_id === selectedId || route.route_type === selectedId)) {
      continue
    }
    const path = pathToLngLat(route.path)
    if (path.length < 2) continue
    features.push({
      type: 'Feature',
      properties: {
        kind: 'alternative',
        routeId: route.route_id || route.route_type || 'alt',
        routeType: route.route_type || null,
      },
      geometry: { type: 'LineString', coordinates: path },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildUserMarkerElement() {
  const wrapper = document.createElement('div')
  wrapper.className = 'siara-mlb-user-marker'
  wrapper.innerHTML = `
    <div class="siara-mlb-user-marker__halo"></div>
    <div class="siara-mlb-user-marker__arrow"></div>
  `
  return wrapper
}

function buildDestinationMarkerElement(label) {
  const wrapper = document.createElement('div')
  wrapper.className = 'siara-mlb-destination-marker'
  wrapper.innerHTML = `
    <div class="siara-mlb-destination-marker__pin"></div>
    <div class="siara-mlb-destination-marker__label"></div>
  `
  const labelNode = wrapper.querySelector('.siara-mlb-destination-marker__label')
  if (labelNode) labelNode.textContent = label || 'Destination'
  return wrapper
}

export default function MapLibreNavigationView({
  userLocation,
  destination,
  selectedRoute,
  routes,
  startedAt,
  onExitNavigation,
  onChangeRouteType,
  routeExplanation = null,
  routeExplanationLoading = false,
  routeExplanationError = '',
  onGenerateAiExplanation,
  aiExplanationGenerating = false,
  onSelectDepartureTimestamp,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)
  const previousUserPosRef = useRef(null)
  const hasAppliedInitialCameraRef = useRef(false)
  const userInteractionRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [followUser, setFollowUser] = useState(true)
  const [derivedHeading, setDerivedHeading] = useState(null)
  const [routeAlerts, setRouteAlerts] = useState([])
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => new Set())
  const [rerouting, setRerouting] = useState(false)
  const lastAlertSinceRef = useRef(null)
  // Identity of the segment we last set into state, so we can ignore
  // userLocation updates that don't actually change which segment the user
  // is on. Without this guard every geolocation tick would re-render the
  // segment card.
  const lastSegmentKeyRef = useRef(null)
  const [currentNavigationSegment, setCurrentNavigationSegment] = useState(null)
  const [currentNavigationSegmentIndex, setCurrentNavigationSegmentIndex] = useState(null)
  const [searchingSegment, setSearchingSegment] = useState(false)

  // Derive nav steps once per route so banner instructions don't churn.
  const navigationSteps = useMemo(
    () => deriveStepsFromPath(selectedRoute?.path || []),
    [selectedRoute?.path],
  )

  // Stable camera helper. Always applied AFTER any fitBounds/preview so the
  // GPS-style tilted view is the final state. `force` re-engages follow mode
  // even if the user had panned earlier (used by the recenter button).
  const applyNavigationCamera = useCallback(
    ({ force = false } = {}) => {
      const map = mapRef.current
      if (!map) return
      if (force) {
        userInteractionRef.current = false
        setFollowUser(true)
      }

      const userLatNum = Number(userLocation?.lat)
      const userLngNum = Number(userLocation?.lng)
      const hasUser =
        Number.isFinite(userLatNum) && Number.isFinite(userLngNum)

      // Pick a center: live location, else first route point, else current.
      let center = null
      if (hasUser) {
        center = [userLngNum, userLatNum]
      } else {
        const routePath = pathToLngLat(selectedRoute?.path)
        if (routePath.length > 0) center = routePath[0]
      }
      if (!center) return

      const headingValue = Number.isFinite(Number(userLocation?.heading))
        ? Number(userLocation.heading)
        : Number.isFinite(Number(derivedHeading))
          ? Number(derivedHeading)
          : null

      const cameraBearing =
        headingValue != null ? headingValue : map.getBearing() || 0

      const containerHeight = map.getContainer().clientHeight || 0
      const offsetY = containerHeight
        ? -(NAV_USER_OFFSET_RATIO - 0.5) * containerHeight
        : 0

      // jumpTo on the very first apply guarantees the GPS view sticks even
      // if a previous animation is mid-flight; subsequent calls smooth via
      // easeTo for a less jumpy follow experience.
      if (!hasAppliedInitialCameraRef.current) {
        map.jumpTo({
          center,
          zoom: NAV_ZOOM,
          pitch: NAV_PITCH,
          bearing: cameraBearing,
        })
        // After jumpTo we still apply the offset via panBy in screen space
        // so the user marker sits low on the screen.
        if (offsetY !== 0) {
          map.panBy([0, offsetY], { animate: false })
        }
        hasAppliedInitialCameraRef.current = true
      } else {
        map.easeTo({
          center,
          zoom: NAV_ZOOM,
          pitch: NAV_PITCH,
          bearing: cameraBearing,
          duration: 600,
          offset: [0, offsetY],
        })
      }
    },
    [
      userLocation?.lat,
      userLocation?.lng,
      userLocation?.heading,
      derivedHeading,
      selectedRoute?.path,
    ],
  )

  const userLat = Number(userLocation?.lat)
  const userLng = Number(userLocation?.lng)
  const hasValidUserLocation = Number.isFinite(userLat) && Number.isFinite(userLng)
  const heading = Number.isFinite(Number(userLocation?.heading))
    ? Number(userLocation.heading)
    : derivedHeading

  const routeProgress = useMemo(() => {
    if (!hasValidUserLocation || !selectedRoute) return null
    return computeRouteProgress({ lat: userLat, lng: userLng }, selectedRoute)
  }, [hasValidUserLocation, userLat, userLng, selectedRoute])

  const currentStepIndex = useMemo(() => {
    if (!routeProgress) return 0
    return Math.max(0, findCurrentStepIndex(navigationSteps, routeProgress.distanceFromStartM))
  }, [navigationSteps, routeProgress])

  // Reset cached segment identity when the route itself changes, so the
  // next userLocation update is forced to recompute against the new path.
  useEffect(() => {
    lastSegmentKeyRef.current = null
    setCurrentNavigationSegment(null)
    setCurrentNavigationSegmentIndex(null)
    setSearchingSegment(false)
  }, [selectedRoute?.route_id, selectedRoute?.route_type])

  // Auto-detect the current segment. Pure geometry — no backend call. Runs
  // on every userLocation change but only triggers a re-render when the
  // segment id/index actually changes.
  useEffect(() => {
    if (!selectedRoute || !hasValidUserLocation) return
    const segments = Array.isArray(selectedRoute?.segments) ? selectedRoute.segments : []
    if (segments.length === 0) return

    const match = getCurrentSegmentForUser(
      { lat: userLat, lng: userLng },
      selectedRoute,
      CURRENT_SEGMENT_THRESHOLD_M,
    )

    if (!match) {
      // User drove off the selected route or hasn't reached it yet. Keep
      // the previously displayed segment briefly (so the card doesn't
      // flicker) and surface a subtle "searching" hint only when nothing
      // has been displayed yet.
      if (!lastSegmentKeyRef.current) {
        if (!searchingSegment) setSearchingSegment(true)
      }
      return
    }

    const key = String(
      match.segment?.segment_id != null
        ? match.segment.segment_id
        : `idx:${match.segmentIndex}`,
    )
    if (key === lastSegmentKeyRef.current) return
    lastSegmentKeyRef.current = key
    setCurrentNavigationSegment(match.segment)
    setCurrentNavigationSegmentIndex(match.segmentIndex)
    if (searchingSegment) setSearchingSegment(false)
  }, [
    selectedRoute,
    hasValidUserLocation,
    userLat,
    userLng,
    searchingSegment,
  ])

  // Initialize MapLibre once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const initialCenter =
      hasValidUserLocation
        ? [userLng, userLat]
        : Number.isFinite(Number(destination?.lng)) && Number.isFinite(Number(destination?.lat))
          ? [Number(destination.lng), Number(destination.lat)]
          : [0, 0]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: NAV_STYLE,
      center: initialCenter,
      zoom: hasValidUserLocation ? NAV_ZOOM : 13,
      pitch: NAV_PITCH,
      bearing: 0,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('load', () => {
      mapRef.current = map
      // Sources for selected route + alternatives.
      map.addSource('siara-route-base', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addSource('siara-route-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addSource('siara-route-alternatives', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'siara-route-alternatives',
        type: 'line',
        source: 'siara-route-alternatives',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#94A3B8',
          'line-opacity': 0.55,
          'line-width': 4,
          'line-dasharray': [1.5, 1.5],
        },
      })

      map.addLayer({
        id: 'siara-route-base',
        type: 'line',
        source: 'siara-route-base',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1E293B',
          'line-opacity': 0.85,
          'line-width': 9,
        },
        filter: ['==', ['get', 'kind'], 'base'],
      })

      map.addLayer({
        id: 'siara-route-segments',
        type: 'line',
        source: 'siara-route-segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#16A34A'],
          'line-width': 6,
          'line-opacity': 0.95,
        },
        filter: ['==', ['get', 'kind'], 'segment'],
      })

      // Allow the user to break "follow" by dragging — and only by dragging.
      // We track real user interactions (mouse/touch) so programmatic
      // easeTo/fitBounds calls (which also emit movestart) don't disengage
      // follow mode and leave the map flat.
      map.on('mousedown', () => { userInteractionRef.current = true })
      map.on('touchstart', () => { userInteractionRef.current = true })
      map.on('dragend', () => { userInteractionRef.current = false })
      map.on('dragstart', () => {
        if (userInteractionRef.current) {
          setFollowUser(false)
        }
      })

      setMapReady(true)
    })

    return () => {
      try {
        map.remove()
      } catch {
        // ignore cleanup race
      }
      mapRef.current = null
      userMarkerRef.current = null
      destinationMarkerRef.current = null
      hasAppliedInitialCameraRef.current = false
      userInteractionRef.current = false
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push route data into the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const baseGeo = buildRouteGeoJson(selectedRoute)
    const baseSource = map.getSource('siara-route-base')
    const segmentSource = map.getSource('siara-route-segments')
    if (baseSource) baseSource.setData(baseGeo)
    if (segmentSource) segmentSource.setData(baseGeo)

    const altGeo = buildAlternativesGeoJson(
      routes,
      selectedRoute?.route_id || selectedRoute?.route_type,
    )
    const altSource = map.getSource('siara-route-alternatives')
    if (altSource) altSource.setData(altGeo)
  }, [mapReady, selectedRoute, routes])

  // Place / update destination marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const lat = Number(destination?.lat)
    const lng = Number(destination?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove()
        destinationMarkerRef.current = null
      }
      return
    }

    if (!destinationMarkerRef.current) {
      const element = buildDestinationMarkerElement(destination?.name)
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)
      destinationMarkerRef.current = marker
    } else {
      const labelNode = destinationMarkerRef.current
        .getElement()
        .querySelector('.siara-mlb-destination-marker__label')
      if (labelNode) labelNode.textContent = destination?.name || 'Destination'
      destinationMarkerRef.current.setLngLat([lng, lat])
    }
  }, [mapReady, destination?.lat, destination?.lng, destination?.name])

  // Place / update user marker + camera follow.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!hasValidUserLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      return
    }

    if (!userMarkerRef.current) {
      const element = buildUserMarkerElement()
      const marker = new maplibregl.Marker({ element, rotationAlignment: 'map' })
        .setLngLat([userLng, userLat])
        .addTo(map)
      userMarkerRef.current = marker
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }

    if (Number.isFinite(heading)) {
      userMarkerRef.current.setRotation(heading)
    }

    // Derive heading from successive positions if browser didn't report it.
    const previous = previousUserPosRef.current
    if (previous) {
      const dx =
        (userLng - previous.lng) * 111320 * Math.cos((userLat * Math.PI) / 180)
      const dy = (userLat - previous.lat) * 111320
      const distance = Math.hypot(dx, dy)
      if (distance >= 5 && !Number.isFinite(Number(userLocation?.heading))) {
        const bearing = bearingDegrees(previous, { lat: userLat, lng: userLng })
        setDerivedHeading(bearing)
      }
    }
    previousUserPosRef.current = { lat: userLat, lng: userLng }

    if (followUser) {
      applyNavigationCamera()
    }
  }, [
    mapReady,
    hasValidUserLocation,
    userLat,
    userLng,
    heading,
    followUser,
    userLocation?.heading,
    applyNavigationCamera,
  ])

  // After map load + route layers populated, lock in the GPS-style camera.
  // We deliberately do NOT use fitBounds here because that flattens pitch
  // back to 0 and produces the "brief tilt then flat" bug. Instead we go
  // straight to the navigation camera; the route is still visible because
  // its line layers are already on the map at navigation zoom.
  useEffect(() => {
    if (!mapReady) return
    const path = pathToLngLat(selectedRoute?.path)
    if (path.length < 2) return
    // Apply now and again on the next frame to override any in-flight
    // animation triggered by source updates.
    applyNavigationCamera({ force: true })
    const raf = window.requestAnimationFrame(() => {
      applyNavigationCamera({ force: true })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [mapReady, selectedRoute, applyNavigationCamera])

  const distanceToCurrentStepM =
    routeProgress && navigationSteps[currentStepIndex]
      ? Math.max(
          0,
          navigationSteps[currentStepIndex].distanceFromStartM -
            routeProgress.distanceFromStartM,
        )
      : null

  const distanceRemainingM =
    routeProgress?.distanceRemainingM != null
      ? routeProgress.distanceRemainingM
      : Number.isFinite(Number(selectedRoute?.distance_km))
        ? Number(selectedRoute.distance_km) * 1000
        : null

  const etaSeconds =
    routeProgress?.etaSeconds != null
      ? routeProgress.etaSeconds
      : Number.isFinite(Number(selectedRoute?.duration_min))
        ? Number(selectedRoute.duration_min) * 60
        : null

  const handleRecenter = () => {
    applyNavigationCamera({ force: true })
  }

  const alternativeOptions = Array.isArray(routes)
    ? routes.filter(
        (route) =>
          route &&
          route.route_type &&
          route.route_type !== selectedRoute?.route_type,
      )
    : []

  // Reset dismissed alerts when the active route identity changes (new
  // route = fresh evaluation).
  useEffect(() => {
    setDismissedAlertIds(new Set())
    setRouteAlerts([])
    lastAlertSinceRef.current = null
  }, [selectedRoute?.route_id, selectedRoute?.route_type])

  // Poll for new danger alerts ahead on the active route. Polling is the
  // first-version transport; we can later swap to socket-pushed alerts.
  useEffect(() => {
    const path = Array.isArray(selectedRoute?.path) ? selectedRoute.path : []
    if (path.length < 2) {
      setRouteAlerts([])
      return undefined
    }
    if (
      !Number.isFinite(Number(userLocation?.lat)) ||
      !Number.isFinite(Number(userLocation?.lng))
    ) {
      return undefined
    }

    let cancelled = false
    let timer = null

    const runPoll = async () => {
      try {
        const since =
          lastAlertSinceRef.current || new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const data = await fetchRouteAlerts({
          routeSnapshot: { path, route_id: selectedRoute?.route_id || null },
          userLocation: {
            lat: Number(userLocation.lat),
            lng: Number(userLocation.lng),
          },
          destination: destination
            ? {
                lat: Number(destination?.lat),
                lng: Number(destination?.lng),
                name: destination?.name || null,
              }
            : null,
          lookAheadKm: ROUTE_ALERTS_LOOKAHEAD_KM,
          since,
        })
        if (cancelled) return
        const alerts = Array.isArray(data?.alerts) ? data.alerts : []
        setRouteAlerts(alerts)
        // Use the latest alert createdAt as the next `since` to avoid
        // re-evaluating already-seen reports.
        const latest = alerts.reduce((acc, a) => {
          const t = a?.createdAt ? new Date(a.createdAt).getTime() : 0
          return Math.max(acc, t)
        }, 0)
        if (latest > 0) {
          lastAlertSinceRef.current = new Date(latest).toISOString()
        }
      } catch (error) {
        if (cancelled) return
        if (import.meta.env.DEV) {
          console.warn('[route-alerts] poll failed', error?.message)
        }
      }
    }

    runPoll()
    timer = setInterval(runPoll, ROUTE_ALERTS_POLL_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedRoute?.route_id,
    selectedRoute?.route_type,
    Math.round(Number(userLocation?.lat) * 1000),
    Math.round(Number(userLocation?.lng) * 1000),
  ])

  const visibleRouteAlerts = routeAlerts.filter((a) => a && !dismissedAlertIds.has(a.id))
  const topAlert = visibleRouteAlerts[0] || null

  const handleDismissAlert = useCallback(
    (alert) => {
      if (!alert?.id) return
      setDismissedAlertIds((prev) => {
        const next = new Set(prev)
        next.add(alert.id)
        return next
      })
    },
    [],
  )

  const handleFindSaferRoute = useCallback(async () => {
    if (typeof onChangeRouteType !== 'function') return
    if (selectedRoute?.route_type === 'safest') return
    setRerouting(true)
    try {
      await Promise.resolve(onChangeRouteType('safest'))
    } finally {
      setRerouting(false)
    }
  }, [onChangeRouteType, selectedRoute?.route_type])

  return (
    <div className="siara-mlb-shell">
      <div ref={containerRef} className="siara-mlb-canvas" />

      {!hasValidUserLocation ? (
        <div className="siara-mlb-location-warning" role="status">
          Enable location to use live navigation. Showing route preview only.
        </div>
      ) : null}

      {topAlert ? (
        <NavigationDangerAlert
          alert={topAlert}
          totalAlerts={visibleRouteAlerts.length}
          onDismiss={handleDismissAlert}
          onFindSaferRoute={
            selectedRoute?.route_type !== 'safest' && typeof onChangeRouteType === 'function'
              ? handleFindSaferRoute
              : null
          }
          rerouting={rerouting}
        />
      ) : null}

      <NavigationBanner
        open
        currentStep={navigationSteps[currentStepIndex] || null}
        nextStep={navigationSteps[currentStepIndex + 1] || null}
        distanceToCurrentStepM={distanceToCurrentStepM}
        routeWarning={selectedRoute?.route_warning || null}
      />

      {!followUser && hasValidUserLocation ? (
        <button
          type="button"
          className="siara-mlb-recenter"
          onClick={handleRecenter}
          aria-label="Recenter on you"
        >
          Recenter
        </button>
      ) : null}

      {alternativeOptions.length > 0 && typeof onChangeRouteType === 'function' ? (
        <div className="siara-mlb-alt-routes" role="group" aria-label="Route alternatives">
          {alternativeOptions.map((route) => (
            <button
              key={route.route_type}
              type="button"
              className="siara-mlb-alt-routes__btn"
              onClick={() => onChangeRouteType(route.route_type)}
            >
              {route.route_label || route.route_type}
            </button>
          ))}
        </div>
      ) : null}

      <CurrentSegmentCard
        segment={currentNavigationSegment}
        segmentIndex={currentNavigationSegmentIndex}
        totalSegments={
          Array.isArray(selectedRoute?.segments) ? selectedRoute.segments.length : 0
        }
        searching={searchingSegment && !currentNavigationSegment}
      />

      <RouteOverviewCard
        selectedRoute={selectedRoute}
        alternatives={routes}
        destinationName={destination?.name || selectedRoute?.destination?.name || ''}
        explanation={routeExplanation}
        explanationLoading={routeExplanationLoading}
        explanationError={routeExplanationError}
        onChangeRouteType={onChangeRouteType}
        onGenerateAiExplanation={onGenerateAiExplanation}
        aiGenerating={aiExplanationGenerating}
        origin={
          hasValidUserLocation
            ? { lat: userLat, lng: userLng }
            : null
        }
        destination={
          destination && Number.isFinite(Number(destination.lat))
            && Number.isFinite(Number(destination.lng))
            ? {
                lat: Number(destination.lat),
                lng: Number(destination.lng),
                name: destination.name || null,
              }
            : null
        }
        onSelectDepartureTimestamp={onSelectDepartureTimestamp}
      />

      <NavigationSummaryCard
        open
        destinationName={destination?.name || selectedRoute?.destination?.name || null}
        routeType={selectedRoute?.route_label || selectedRoute?.route_type || null}
        distanceRemainingM={distanceRemainingM}
        etaSeconds={etaSeconds}
        routeRiskPercent={Number(selectedRoute?.summary?.danger_percent)}
        routeRiskLevel={selectedRoute?.summary?.danger_level || null}
        progressFraction={routeProgress?.fraction ?? 0}
        onExit={onExitNavigation}
      />

      {/* startedAt is exposed for analytics/debug purposes; kept hidden in UI */}
      <span style={{ display: 'none' }} data-started-at={startedAt || ''} />
    </div>
  )
}
