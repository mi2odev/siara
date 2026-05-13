import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import AltRouteIcon from '@mui/icons-material/AltRoute'
import BugReportIcon from '@mui/icons-material/BugReport'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import LayersIcon from '@mui/icons-material/Layers'
import NavigationIcon from '@mui/icons-material/Navigation'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

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
const NAV_PITCH = 60
const NAV_USER_OFFSET_RATIO = 0.7

const RISK_COLORS = {
  unknown: '#64748B',
  low: '#16A34A',
  medium: '#F59E0B',
  high: '#7F1D1D',
}

function riskColor(level, percent) {
  const text = String(level || '').trim().toLowerCase()
  if (text === 'unknown' || text === 'unavailable') return RISK_COLORS.unknown
  if (RISK_COLORS[text]) return RISK_COLORS[text]
  if (percent === null || percent === undefined || percent === '') return RISK_COLORS.unknown
  const numeric = Number(percent)
  if (!Number.isFinite(numeric)) return RISK_COLORS.low
  if (numeric >= 50) return RISK_COLORS.high
  if (numeric >= 25) return RISK_COLORS.medium
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

function pathBearing(path) {
  if (!Array.isArray(path) || path.length < 2) return null
  const points = path
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0])
        const lng = Number(point[1])
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
      }
      if (point && typeof point === 'object') {
        const lat = Number(point.lat)
        const lng = Number(point.lng)
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
      }
      return null
    })
    .filter(Boolean)
  if (points.length < 2) return null
  return bearingDegrees(points[0], points[1])
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
  geolocationStatus = 'unknown',
  lastLocationUpdatedAt = null,
  lastLocationError = null,
  routeOrigin = null,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const destinationMarkerRef = useRef(null)
  const previousUserPosRef = useRef(null)
  const hasAppliedInitialCameraRef = useRef(false)
  const cameraBearingRef = useRef(0)
  const [mapReady, setMapReady] = useState(false)
  const [followUser, setFollowUser] = useState(true)
  const [derivedHeading, setDerivedHeading] = useState(null)
  const [lastCameraUpdateAt, setLastCameraUpdateAt] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [routePanelOpen, setRoutePanelOpen] = useState(true)
  const [routeAlerts, setRouteAlerts] = useState([])
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => new Set())
  const [rerouting, setRerouting] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )
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

  // ---------------------------------------------------------------------
  // Camera-follow logic (rewritten clean).
  //
  // Design rules (matches the spec):
  //   1. We never set the camera through React's <Map initialViewState>;
  //      everything goes through map.easeTo() / map.jumpTo() on the
  //      MapLibre instance held in mapRef.
  //   2. Live location flows in via the `userLocation` prop (the parent
  //      runs navigator.geolocation.watchPosition with
  //      enableHighAccuracy: true, maximumAge: 0, timeout: 15000).
  //   3. A single dedicated effect — the "follow effect" below — listens
  //      to userLat/userLng/bearing/followUser/mapReady and, when
  //      followUser is true, calls map.easeTo() with the new center,
  //      NAV_ZOOM, NAV_PITCH, and the latest bearing. Nothing else moves
  //      the camera in response to position updates.
  //   4. A separate one-shot effect locks the GPS-style camera once the
  //      map is ready and a first fix exists. It does NOT re-fire when
  //      the route changes — that was overriding live tracking before.
  //   5. `handleRecenter` (the "My Location" button) re-engages follow
  //      and snaps the camera to the latest fix in one easeTo call.
  // ---------------------------------------------------------------------

  // Compute the bearing the camera should use: prefer GPS heading, fall
  // back to a heading derived from successive fixes (set in the marker
  // effect below), else `null` (= keep the map's current bearing).
  const upstreamHeadingSource = userLocation?.headingSource || null
  const hasUsableUpstreamHeading =
    Number.isFinite(Number(userLocation?.heading)) &&
    upstreamHeadingSource !== 'fallback' &&
    upstreamHeadingSource !== 'route-bearing'
  const sensorBearing = hasUsableUpstreamHeading
    ? Number(userLocation.heading)
    : Number.isFinite(Number(derivedHeading))
      ? Number(derivedHeading)
      : null

  // Imperative "snap to user" used for the My Location button and the
  // initial lock-in. Reads the latest props each call, no closure traps.
  const snapCameraToUser = useCallback(({ animate = true } = {}) => {
    const map = mapRef.current
    if (!map) return false
    const lat = Number(userLocation?.lat)
    const lng = Number(userLocation?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false

    const bearing = Number.isFinite(Number(cameraBearingRef.current))
      ? Number(cameraBearingRef.current)
      : map.getBearing() || 0
    const containerHeight = map.getContainer().clientHeight || 0
    const offsetY = containerHeight
      ? -(NAV_USER_OFFSET_RATIO - 0.5) * containerHeight
      : 0

    if (animate) {
      map.easeTo({
        center: [lng, lat],
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
        bearing,
        duration: 600,
        offset: [0, offsetY],
      })
    } else {
      map.jumpTo({ center: [lng, lat], zoom: NAV_ZOOM, pitch: NAV_PITCH, bearing })
      if (offsetY !== 0) map.panBy([0, offsetY], { animate: false })
    }
    setLastCameraUpdateAt(Date.now())
    return true
  }, [userLocation?.lat, userLocation?.lng])

  const userLat = Number(userLocation?.lat)
  const userLng = Number(userLocation?.lng)
  const hasValidUserLocation = Number.isFinite(userLat) && Number.isFinite(userLng)
  const routeOriginForScoring = useMemo(() => {
    const lat = Number(routeOrigin?.lat)
    const lng = Number(routeOrigin?.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
    return hasValidUserLocation ? { lat: userLat, lng: userLng } : null
  }, [hasValidUserLocation, routeOrigin?.lat, routeOrigin?.lng, userLat, userLng])

  const routeProgress = useMemo(() => {
    if (!hasValidUserLocation || !selectedRoute) return null
    return computeRouteProgress({ lat: userLat, lng: userLng }, selectedRoute)
  }, [hasValidUserLocation, userLat, userLng, selectedRoute])

  const currentStepIndex = useMemo(() => {
    if (!routeProgress) return 0
    return Math.max(0, findCurrentStepIndex(navigationSteps, routeProgress.distanceFromStartM))
  }, [navigationSteps, routeProgress])

  const routeBearing = useMemo(() => {
    const stepBearing = Number(navigationSteps[currentStepIndex]?.bearing)
    if (Number.isFinite(stepBearing)) return stepBearing

    const segmentBearing = pathBearing(currentNavigationSegment?.path)
    if (Number.isFinite(Number(segmentBearing))) return segmentBearing

    const routePath = Array.isArray(selectedRoute?.path) ? selectedRoute.path : []
    const routeIndex = Math.max(
      0,
      Math.min(routePath.length - 2, Number(routeProgress?.closestSegmentIndex) || 0),
    )
    return pathBearing(routePath.slice(routeIndex, routeIndex + 2))
  }, [
    currentNavigationSegment?.path,
    currentStepIndex,
    navigationSteps,
    routeProgress?.closestSegmentIndex,
    selectedRoute?.path,
  ])

  const resolvedHeading = Number.isFinite(Number(sensorBearing))
    ? Number(sensorBearing)
    : Number.isFinite(Number(routeBearing))
      ? Number(routeBearing)
      : Number.isFinite(Number(mapRef.current?.getBearing?.()))
        ? Number(mapRef.current.getBearing())
        : 0

  const resolvedHeadingSource = hasUsableUpstreamHeading
    ? upstreamHeadingSource || 'gps'
    : Number.isFinite(Number(derivedHeading))
      ? 'movement-bearing'
      : Number.isFinite(Number(routeBearing))
        ? 'route-bearing'
        : 'fallback'

  const heading = resolvedHeading

  useEffect(() => {
    cameraBearingRef.current = resolvedHeading
  }, [resolvedHeading])

  const mapOverlayPadding = useMemo(() => {
    if (viewportWidth <= 960) {
      return {
        top: 190,
        right: 16,
        bottom: routePanelOpen ? 340 : 220,
        left: 16,
      }
    }

    return {
      top: 150,
      right: routePanelOpen ? 410 : 32,
      bottom: 190,
      left: 340,
    }
  }, [routePanelOpen, viewportWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (typeof map.setPadding === 'function') {
      map.setPadding(mapOverlayPadding)
    }
  }, [mapOverlayPadding, mapReady])

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

      // Disengage follow only on real user gestures. MapLibre sets
      // `e.originalEvent` only when the move was triggered by a pointer/
      // wheel/keyboard event — programmatic easeTo/flyTo/jumpTo calls leave
      // it null. Listening on `dragstart` and `wheel` (zoom-by-scroll) is
      // enough; `rotate`/`pitch` gestures all emit `dragstart` first.
      const handleUserGesture = (e) => {
        if (e && e.originalEvent) setFollowUser(false)
      }
      map.on('dragstart', handleUserGesture)
      map.on('wheel', handleUserGesture)

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

  // -- (1) MARKER effect: position + rotation only. No camera. ----------
  // Re-runs on every fresh fix because userLat/userLng come from props.
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
      if (distance >= 5 && !hasUsableUpstreamHeading) {
        const bearing = bearingDegrees(previous, { lat: userLat, lng: userLng })
        setDerivedHeading(bearing)
      }
    }
    previousUserPosRef.current = { lat: userLat, lng: userLng }
  }, [
    mapReady,
    hasValidUserLocation,
    userLat,
    userLng,
    heading,
    hasUsableUpstreamHeading,
  ])

  // -- (2) CAMERA-FOLLOW effect: the only thing that moves the camera in
  // response to live position updates. Re-runs every time the user moves
  // (userLat/userLng change) or the bearing changes. Does nothing unless
  // followUser is true.
  useEffect(() => {
    if (!mapReady || !followUser || !hasValidUserLocation) return
    const map = mapRef.current
    if (!map) return

    const bearing = Number.isFinite(Number(resolvedHeading))
      ? Number(resolvedHeading)
      : map.getBearing() || 0
    const containerHeight = map.getContainer().clientHeight || 0
    const offsetY = containerHeight
      ? -(NAV_USER_OFFSET_RATIO - 0.5) * containerHeight
      : 0

    map.easeTo({
      center: [userLng, userLat],
      zoom: NAV_ZOOM,
      pitch: NAV_PITCH,
      bearing,
      duration: 600,
      offset: [0, offsetY],
    })
    setLastCameraUpdateAt(Date.now())
  }, [
    mapReady,
    followUser,
    hasValidUserLocation,
    userLat,
    userLng,
    resolvedHeading,
  ])

  // -- (3) ONE-SHOT initial camera lock. Runs the moment the map is ready
  // AND we have a first fix. Uses jumpTo (no animation) so the GPS-tilted
  // view is in place before the first easeTo from effect (2) runs.
  // Crucially, this effect is keyed on a flag — not on selectedRoute or
  // userLocation — so it never re-fires later and never fights the user.
  useEffect(() => {
    if (!mapReady || hasAppliedInitialCameraRef.current) return
    if (!hasValidUserLocation) return
    snapCameraToUser({ animate: false })
    hasAppliedInitialCameraRef.current = true
  }, [mapReady, hasValidUserLocation, snapCameraToUser])

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

  // "My Location" button: re-engage follow and snap to the current fix
  // immediately (effect (2) will continue tracking from the next tick).
  const handleRecenter = useCallback(() => {
    setFollowUser(true)
    snapCameraToUser({ animate: true })
  }, [snapCameraToUser])

  // Reset dismissed alerts when the active route identity changes (new
  // route = fresh evaluation).
  useEffect(() => {
    setDismissedAlertIds(new Set())
    setRouteAlerts([])
    lastAlertSinceRef.current = null
  }, [selectedRoute?.route_id, selectedRoute?.route_type])

  const routeAlertLatKey = Math.round(Number(userLocation?.lat) * 1000)
  const routeAlertLngKey = Math.round(Number(userLocation?.lng) * 1000)

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
    routeAlertLatKey,
    routeAlertLngKey,
  ])

  const visibleRouteAlerts = routeAlerts.filter((a) => a && !dismissedAlertIds.has(a.id))
  const topAlert = visibleRouteAlerts[0] || null
  const debugLocation = useMemo(() => ({
    latitude: hasValidUserLocation ? userLat : null,
    longitude: hasValidUserLocation ? userLng : null,
    accuracy: Number.isFinite(Number(userLocation?.accuracy)) ? Number(userLocation.accuracy) : null,
    heading: resolvedHeading,
    headingSource: resolvedHeadingSource,
    followUser,
    navigationActive: true,
    cameraFollowEnabled: followUser && hasValidUserLocation,
    geolocationStatus,
    lastLocationUpdatedAt,
    lastLocationError: lastLocationError?.message || '',
    lastCameraUpdateAt,
  }), [
    followUser,
    geolocationStatus,
    hasValidUserLocation,
    lastCameraUpdateAt,
    lastLocationError,
    lastLocationUpdatedAt,
    resolvedHeading,
    resolvedHeadingSource,
    userLat,
    userLng,
    userLocation?.accuracy,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV || !hasValidUserLocation) return
    console.debug('[navigation/location]', debugLocation)
  }, [debugLocation, hasValidUserLocation])

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
    <div className={`siara-mlb-shell${routePanelOpen ? ' is-route-panel-open' : ''}`}>
      <div ref={containerRef} className="siara-mlb-canvas" />

      <div className="siara-mlb-top-zone">
        <nav className="siara-mlb-tabs" aria-label="Navigation modes">
          <button type="button" className="is-active">
            <NavigationIcon />
            Drive
          </button>
          <button type="button">
            <AltRouteIcon />
            Routes
          </button>
          <button type="button">
            <WarningAmberIcon />
            Risk
          </button>
        </nav>

        <div className="siara-mlb-controls" aria-label="Navigation map controls">
          <button
            type="button"
            onClick={() => setRoutePanelOpen((open) => !open)}
            aria-pressed={routePanelOpen}
            aria-label="Toggle selected route panel"
          >
            <LayersIcon />
          </button>
          <button
            type="button"
            onClick={() => setShowDebug((open) => !open)}
            aria-pressed={showDebug}
            aria-label="Toggle navigation debug"
          >
            <BugReportIcon />
          </button>
          {hasValidUserLocation ? (
            <button
              type="button"
              className="siara-mlb-controls__locate"
              onClick={handleRecenter}
              aria-label="Center on my location"
              aria-pressed={followUser}
              data-following={followUser ? 'true' : 'false'}
            >
              <GpsFixedIcon />
              <span>My Location</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="siara-mlb-instruction-zone">
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
      </div>

      <div className="siara-mlb-left-utility-zone">
        <CurrentSegmentCard
          segment={currentNavigationSegment}
          segmentIndex={currentNavigationSegmentIndex}
          totalSegments={
            Array.isArray(selectedRoute?.segments) ? selectedRoute.segments.length : 0
          }
          searching={searchingSegment && !currentNavigationSegment}
        />

        <div className="siara-mlb-legend" aria-label="Route risk legend">
          <span><i className="risk-low" /> Low</span>
          <span><i className="risk-medium" /> Medium</span>
          <span><i className="risk-high" /> High</span>
          <span><i className="risk-unknown" /> Unknown</span>
        </div>
      </div>

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
        origin={routeOriginForScoring}
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

      <div className="siara-mlb-bottom-zone">
        <NavigationSummaryCard
          open
          destinationName={destination?.name || selectedRoute?.destination?.name || null}
          routeType={selectedRoute?.route_label || selectedRoute?.route_type || null}
          distanceRemainingM={distanceRemainingM}
          etaSeconds={etaSeconds}
          routeRiskPercent={selectedRoute?.summary?.danger_percent}
          routeRiskLevel={selectedRoute?.summary?.danger_level || null}
          progressFraction={routeProgress?.fraction ?? 0}
          onExit={onExitNavigation}
        />
      </div>

      {showDebug ? (
        <div className="siara-mlb-debug" aria-label="Live location debug">
          <span>lat {debugLocation.latitude != null ? debugLocation.latitude.toFixed(6) : 'n/a'}</span>
          <span>lng {debugLocation.longitude != null ? debugLocation.longitude.toFixed(6) : 'n/a'}</span>
          <span>accuracy {debugLocation.accuracy != null ? `${Math.round(debugLocation.accuracy)}m` : 'n/a'}</span>
          <span>heading {Number.isFinite(debugLocation.heading) ? `${Math.round(debugLocation.heading)}deg` : 'n/a'}</span>
          <span>source {debugLocation.headingSource}</span>
          <span>follow {debugLocation.followUser ? 'true' : 'false'}</span>
          <span>nav {debugLocation.navigationActive ? 'true' : 'false'}</span>
          <span>camera {debugLocation.cameraFollowEnabled ? 'follow' : 'free'}</span>
          <span>geo {debugLocation.geolocationStatus}</span>
          <span>
            fix {debugLocation.lastLocationUpdatedAt
              ? new Date(debugLocation.lastLocationUpdatedAt).toLocaleTimeString()
              : 'n/a'}
          </span>
          <span>
            camera at {debugLocation.lastCameraUpdateAt
              ? new Date(debugLocation.lastCameraUpdateAt).toLocaleTimeString()
              : 'n/a'}
          </span>
          {debugLocation.lastLocationError ? <span>last error {debugLocation.lastLocationError}</span> : null}
        </div>
      ) : null}

      {/* startedAt is exposed for analytics/debug purposes; kept hidden in UI */}
      <span style={{ display: 'none' }} data-started-at={startedAt || ''} />
    </div>
  )
}
