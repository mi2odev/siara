/**
 * MapPage.jsx
 *
 * Interactive map page for the SIARA road-safety platform.
 * Displays real-time incidents on a map with filtering, layer switching,
 * geolocation, fullscreen mode, weather context, and AI-driven risk insights.
 *
 * Layout: Header  |  Left sidebar (filters)  |  Center map  |  Right sidebar (context)
 */

import React, { useEffect, useMemo, useState, useContext, useCallback, useRef } from "react";
import { useTranslation } from 'react-i18next';
import FancySelect from '../../components/ui/FancySelect';
import { useLocation, useNavigate } from "react-router-dom";
import ThunderstormOutlinedIcon from '@mui/icons-material/ThunderstormOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import AcUnitOutlinedIcon from '@mui/icons-material/AcUnitOutlined';
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import CloudQueueOutlinedIcon from '@mui/icons-material/CloudQueueOutlined';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import NotificationBell from '../../components/notifications/NotificationBell';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import CarCrashOutlinedIcon from '@mui/icons-material/CarCrashOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import TrafficOutlinedIcon from '@mui/icons-material/TrafficOutlined';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { AuthContext } from '../../contexts/AuthContext';
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'
import { getInitialsFromName, getUserAvatarUrl } from '../../utils/avatarUtils'

/* ── Styles ── */
import "../../styles/NewsPage.css";
import "../../styles/MapPage.css";

/* ── Assets ── */
import siaraLogo from "../../assets/logos/siara-logo.png";
import profileAvatar from "../../assets/logos/siara-logo1.png";

/* ── Components ── */
import DangerForecastChart from "../../components/map/DangerForecastChart";
import SiaraMap from "../../components/map/SiaraMap";
import FallbackLocationBanner from "../../components/map/FallbackLocationBanner";
import ManualLocationControl from "../../components/map/ManualLocationControl";
import DrivingQuiz from "../../components/ui/DrivingQuiz";
import { normalizeReportType } from "../../components/map/reportTypeMeta";
import useReportMapReports from "../../hooks/useReportMapReports";
import useLiveLocation from "../../hooks/useLiveLocation";
import { fetchAlerts } from "../../services/alertService";
import { getSafetyOverlay } from "../../services/safetyOverlayService";

/* ── MUI Icons ── */
import LocationOnTwoToneIcon from "@mui/icons-material/LocationOnTwoTone";
import FullscreenTwoToneIcon from "@mui/icons-material/FullscreenTwoTone";
import FullscreenExitTwoToneIcon from "@mui/icons-material/FullscreenExitTwoTone";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const WEATHER_DEBOUNCE_MS = 700;
const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const LOCATION_POOR_ACCURACY_M = 250;
const SEVERITY_SCORES = {
  low: 1,
  medium: 2,
  high: 3,
};

// Persist the map's filter/layer selections so a refresh or returning to the
// page keeps the user's view instead of resetting to defaults.
const MAP_FILTERS_STORAGE_KEY = "siara_map_filters_v1";
const ALLOWED_TIME_FILTERS = ["24h", "7d", "30d", "custom"];
const ALLOWED_MAP_LAYERS = ["points", "heatmap", "zones", "ai", "nearbyRoads", "safety"];

function readStoredMapFilters() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MAP_FILTERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function storedTimeFilter(fallback = "7d") {
  const value = readStoredMapFilters().timeFilter;
  return ALLOWED_TIME_FILTERS.includes(value) ? value : fallback;
}

function storedStringArray(key) {
  const value = readStoredMapFilters()[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function storedWilaya(fallback = "all") {
  const value = readStoredMapFilters().selectedWilaya;
  return typeof value === "string" && value ? value : fallback;
}

function storedMapLayer(fallback = "points") {
  const value = readStoredMapFilters().mapLayer;
  return ALLOWED_MAP_LAYERS.includes(value) ? value : fallback;
}

// Manual location the user picked when GPS is unavailable. Persisted so it
// survives refreshes ("remember last-known location").
const MANUAL_LOCATION_STORAGE_KEY = "siara_manual_location_v1";

function readStoredManualLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MANUAL_LOCATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(Number(parsed.lat)) && Number.isFinite(Number(parsed.lng))) {
      return { lat: Number(parsed.lat), lng: Number(parsed.lng), label: String(parsed.label || "") };
    }
  } catch {
    /* ignore parse/storage errors */
  }
  return null;
}

async function getJson(path, signal) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") {
    return null;
  }

  const lat = toFiniteNumber(point.lat);
  const lng = toFiniteNumber(point.lng);
  if (lat == null || lng == null) {
    return null;
  }

  return { lat, lng };
}

function formatAccuracyLabel(accuracy) {
  const value = toFiniteNumber(accuracy);
  if (value == null) {
    return "n/a";
  }
  return `${Math.round(value)} m`;
}

function buildLocationWarning(reading) {
  const accuracy = toFiniteNumber(reading?.accuracy);
  if (accuracy == null) {
    return "Location accuracy is unavailable.";
  }
  if (accuracy > LOCATION_POOR_ACCURACY_M) {
    return `Approximate location only (accuracy ${formatAccuracyLabel(accuracy)}).`;
  }
  return "";
}

function mapLiveLocationError(err, status) {
  if (status === "unsupported") {
    return "Geolocation is not supported by this browser.";
  }
  if (status === "insecure") {
    return "Location requires HTTPS in production. Localhost is allowed for testing.";
  }
  if (!err) {
    if (status === "timeout") return "Location request timed out.";
    if (status === "unavailable") return "Location is unavailable on this device/browser right now.";
    return "";
  }
  if (err.code === 1) {
    return "Location permission denied.";
  }
  if (err.code === 3 || status === "timeout") {
    return "Location request timed out.";
  }
  if (err.code === 2 || status === "unavailable") {
    return "Location is unavailable on this device/browser right now.";
  }
  return err.message || "Unable to get your position.";
}

function toPointKey(point) {
  if (!point) {
    return "";
  }
  return `${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
}

function weatherIconFromCondition(condition) {
  const text = String(condition || "").toLowerCase();
  if (text.includes("orage")) return <ThunderstormOutlinedIcon fontSize="inherit" />;
  if (text.includes("pluie") || text.includes("bruine")) return <WaterDropOutlinedIcon fontSize="inherit" />;
  if (text.includes("neige")) return <AcUnitOutlinedIcon fontSize="inherit" />;
  if (text.includes("brouillard")) return <FilterDramaOutlinedIcon fontSize="inherit" />;
  if (text.includes("couvert")) return <CloudOutlinedIcon fontSize="inherit" />;
  if (text.includes("nuage")) return <CloudQueueOutlinedIcon fontSize="inherit" />;
  return <WbSunnyOutlinedIcon fontSize="inherit" />;
}

function renderHeaderIcon(type) {
  if (type === "notification") return <NotificationsOutlinedIcon fontSize="inherit" />;
  return <ChatBubbleOutlineOutlinedIcon fontSize="inherit" />;
}

function renderNavIcon(type) {
  if (type === "home") return <HomeOutlinedIcon fontSize="inherit" />;
  if (type === "feed") return <ArticleOutlinedIcon fontSize="inherit" />;
  if (type === "report") return <EditNoteOutlinedIcon fontSize="inherit" />;
  if (type === "map") return <MapOutlinedIcon fontSize="inherit" />;
  if (type === "quiz") return <DirectionsCarOutlinedIcon fontSize="inherit" />;
  if (type === "stats") return <InsightsOutlinedIcon fontSize="inherit" />;
  if (type === "alerts") return <NotificationsActiveOutlinedIcon fontSize="inherit" />;
  if (type === "settings") return <SettingsOutlinedIcon fontSize="inherit" />;
  return <LocationOnOutlinedIcon fontSize="inherit" />;
}

function resolveContextPoint(selectedIncident, userPosition) {
  const incidentPoint = normalizePoint(selectedIncident);
  if (incidentPoint) {
    return incidentPoint;
  }

  const userPoint = normalizePoint(userPosition);
  if (userPoint) {
    return userPoint;
  }

  return null;
}

function normalizeSeverityLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "low";
}

function getReportTimestamp(report) {
  const candidate = report?.occurredAt || report?.createdAt || report?.updatedAt;
  const timestamp = new Date(candidate || "");
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function matchesTimeFilter(report, timeFilter) {
  if (timeFilter === "custom") {
    return true;
  }

  const reportTimestamp = getReportTimestamp(report);
  if (!reportTimestamp) {
    return false;
  }

  const thresholds = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const maxAgeMs = thresholds[timeFilter];
  if (!maxAgeMs) {
    return true;
  }

  return Date.now() - reportTimestamp.getTime() <= maxAgeMs;
}

function formatRelativeReportAge(value, tFn) {
  const timestamp = new Date(value || "");
  if (Number.isNaN(timestamp.getTime())) {
    return tFn ? tFn('mapPage.time.unknown') : "Unknown";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp.getTime()) / 60000));
  if (diffMinutes < 1) return tFn ? tFn('mapPage.time.justNow') : "Just now";
  if (diffMinutes < 60) return tFn ? tFn('mapPage.time.minutes', { count: diffMinutes }) : `${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return tFn ? tFn('mapPage.time.hours', { count: diffHours }) : `${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  return tFn ? tFn('mapPage.time.days', { count: diffDays }) : `${diffDays} d`;
}

function formatZoneLastTriggered(value, tFn) {
  if (!value) {
    return tFn ? tFn('mapPage.time.neverTriggered') : "Never triggered";
  }

  const relativeAge = formatRelativeReportAge(value, tFn);
  const unknownLabel = tFn ? tFn('mapPage.time.unknown') : "Unknown";
  return relativeAge === unknownLabel ? relativeAge : (tFn ? tFn('mapPage.time.ago', { age: relativeAge }) : `${relativeAge} ago`);
}

function formatCurrentHourLabel(dateValue = new Date()) {
  return dateValue.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeReversePlace(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const address = payload.address && typeof payload.address === "object"
    ? payload.address
    : {};

  const displayParts = String(payload.display_name || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const locality =
    address.city
    || address.town
    || address.village
    || address.municipality
    || address.county
    || "";
  const quartier =
    address.suburb
    || address.neighbourhood
    || address.neighborhood
    || address.city_district
    || address.quarter
    || address.hamlet
    || address.residential
    || address.borough
    || "";
  const street =
    address.road
    || address.pedestrian
    || address.footway
    || address.path
    || "";
  const region =
    address.state
    || address.province
    || address.region
    || address.state_district
    || "";

  const normalizedLocality = String(locality || "").toLowerCase();
  const normalizedRegion = String(region || "").toLowerCase();
  const displayDetail = displayParts.find((part) => {
    const normalizedPart = String(part || "").toLowerCase();
    return normalizedPart
      && normalizedPart !== normalizedLocality
      && normalizedPart !== normalizedRegion;
  }) || "";
  const preciseDetail = quartier || street || displayDetail;

  const composed = [
    preciseDetail,
    locality,
    region,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(", ");

  if (composed) {
    return composed;
  }

  return String(payload.display_name || "").split(",").slice(0, 3).join(",").trim();
}

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const { t } = useTranslation(['map', 'common']);

  /* ──────────────────────────── State ──────────────────────────── */

  // Controls the visibility of the user-profile dropdown in the header
  const [showDropdown, setShowDropdown] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");

  // Driving quiz overlay
  const [showQuiz, setShowQuiz] = useState(false);
  const handleQuizComplete = () => {
    setShowQuiz(false);
  };

  // Active time-range filter (24h, 7d, 30d, custom) — restored from last visit.
  const [timeFilter, setTimeFilter] = useState(() => storedTimeFilter("7d"));

  // Array of selected severity levels (e.g. ["high", "medium"])
  const [severityFilter, setSeverityFilter] = useState(() => storedStringArray("severityFilter"));

  // Array of selected incident types (e.g. ["accident", "traffic"])
  const [typeFilter, setTypeFilter] = useState(() => storedStringArray("typeFilter"));

  // Selected wilaya (province) — "all" means no geographic filter
  const [selectedWilaya, setSelectedWilaya] = useState(() => storedWilaya("all"));

  // Current map visualisation layer (points, heatmap, zones, ai, nearbyRoads).
  // Explicit navigation state (e.g. "open zones") wins over the restored layer.
  const [mapLayer, setMapLayer] = useState(() =>
    location.state?.mapLayer === "zones" ? "zones" : storedMapLayer("points")
  );
  const [alertZones, setAlertZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState("");

  // Phase 2 — public safety overlay (driver-facing infrastructure measures).
  const [safetyItems, setSafetyItems] = useState([]);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState(() => location.state?.focusAlertId || null);

  // Currently selected incident/segment for the right-sidebar detail panel
  const [selectedIncident, setSelectedIncident] = useState(null);

  // User's GPS coordinates (set via the geolocation button)
  const [userPosition, setUserPosition] = useState(null);
  const [locationStatus, setLocationStatus] = useState("unknown");
  const [locationError, setLocationError] = useState("");
  const [locationWarning, setLocationWarning] = useState("");
  const [locationRequestVersion, setLocationRequestVersion] = useState(0);
  // Manually-picked location (place search) used when GPS is unavailable.
  const [manualLocation, setManualLocation] = useState(() => readStoredManualLocation());
  const [selectedTimestampIso, setSelectedTimestampIso] = useState(() => new Date().toISOString());
  const {
    location: liveLocation,
    error: liveLocationError,
    lastError: liveLocationLastError,
    status: liveLocationStatus,
    lastUpdatedAt: liveLocationUpdatedAt,
    isFallback: liveLocationIsFallback,
    isLoading: liveLocationIsLoading,
    errorMessage: liveLocationErrorMessage,
    startWatching: startLiveLocationTracking,
    retryLocation: retryLiveLocation,
  } = useLiveLocation({
    autoStart: false,
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  });

  // Whether the map is displayed in fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [riskPanelHost, setRiskPanelHost] = useState(null);
  // Host for the search / prediction-time / guidance panel. On compact
  // (stacked) layouts the panel is portaled out of the map into this slot
  // below it, so the map stays clean and tall instead of being covered by a
  // floating overlay. On desktop the panel stays overlaid on the map.
  const [guideControlsHost, setGuideControlsHost] = useState(null);
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023.98px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const update = (event) => setIsCompactLayout(event.matches);
    setIsCompactLayout(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastRefreshing, setForecastRefreshing] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastPoints, setForecastPoints] = useState([]);
  const [weatherRefreshTick, setWeatherRefreshTick] = useState(0);
  const [currentHourText, setCurrentHourText] = useState(() => formatCurrentHourLabel(new Date()));
  const [resolvedPlaceName, setResolvedPlaceName] = useState("");
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  const contextPoint = useMemo(
    () => resolveContextPoint(selectedIncident, userPosition),
    [selectedIncident, userPosition],
  );

  useEffect(() => {
    const updateTime = () => setCurrentHourText(formatCurrentHourLabel(new Date()));
    updateTime();

    const intervalId = window.setInterval(updateTime, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const contextPointKey = useMemo(() => toPointKey(contextPoint), [contextPoint]);
  const hasGrantedLocation = useMemo(
    () =>
      (locationStatus === "granted" || locationStatus === "fallback" || locationStatus === "manual") &&
      normalizePoint(userPosition) != null,
    [locationStatus, userPosition],
  );
  const {
    reports,
    mapReadyReports,
    isLoading: reportsLoading,
    error: reportsError,
  } = useReportMapReports({
    limit: 100,
    feed: "latest",
    sort: "recent",
  });

  const userPositionRef = useRef(userPosition);
  const autoLocateAttemptedRef = useRef(false);
  const placeCacheRef = useRef(new Map());

  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  useEffect(() => {
    if (location.state?.mapLayer === "zones") {
      setMapLayer("zones");
    }

    if (location.state?.focusAlertId) {
      setSelectedZoneId(location.state.focusAlertId);
    }
  }, [location.state]);

  // Remember filter/layer choices for the next visit (best-effort; ignores
  // storage errors in private mode).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        MAP_FILTERS_STORAGE_KEY,
        JSON.stringify({ timeFilter, severityFilter, typeFilter, selectedWilaya, mapLayer }),
      );
    } catch {
      /* ignore storage quota / privacy-mode errors */
    }
  }, [timeFilter, severityFilter, typeFilter, selectedWilaya, mapLayer]);

  const requestLocation = useCallback(() => {
    autoLocateAttemptedRef.current = true;
    setLocationRequestVersion((value) => value + 1);
    setLocationError("");
    setLocationWarning("");
    setLocationStatus(normalizePoint(userPositionRef.current) ? "granted" : "locating");
    startLiveLocationTracking();
  }, [startLiveLocationTracking]);

  // A manually-picked location drives risk/weather/safety exactly like a GPS fix.
  useEffect(() => {
    if (!manualLocation) return;
    setUserPosition({ lat: manualLocation.lat, lng: manualLocation.lng });
    setLocationStatus("manual");
    setLocationError("");
    setLocationWarning("");
    if (manualLocation.label) setResolvedPlaceName(manualLocation.label);
  }, [manualLocation]);

  // Persist the manual location so it survives refreshes (best-effort).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (manualLocation) {
        window.localStorage.setItem(MANUAL_LOCATION_STORAGE_KEY, JSON.stringify(manualLocation));
      } else {
        window.localStorage.removeItem(MANUAL_LOCATION_STORAGE_KEY);
      }
    } catch {
      /* ignore storage quota / privacy-mode errors */
    }
  }, [manualLocation]);

  const handleSetManualLocation = useCallback((place) => {
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setManualLocation({ lat, lng, label: String(place?.label || "").trim() });
  }, []);

  const handleClearManualLocation = useCallback(() => {
    setManualLocation(null);
    setResolvedPlaceName("");
    requestLocation(); // resume GPS
  }, [requestLocation]);

  useEffect(() => {
    if (manualLocation) return; // manual override wins over GPS/fallback
    if (!liveLocation) return;
    setUserPosition(liveLocation);
    if (liveLocation.isFallback) {
      // Keep weather/place lookups working off fallback coords, but flag it.
      setLocationStatus("fallback");
      setLocationWarning(
        t('mapPage.location.fallbackWarning')
      );
      return;
    }
    setLocationStatus("granted");
    setLocationError("");
    setLocationWarning(buildLocationWarning(liveLocation));
  }, [liveLocation, manualLocation]);

  useEffect(() => {
    if (manualLocation) return; // manual override wins over GPS status changes
    if (liveLocationStatus === "requesting") {
      setLocationStatus(normalizePoint(userPositionRef.current) ? "granted" : "locating");
      setLocationError("");
      return;
    }

    if (liveLocationStatus === "watching") {
      if (normalizePoint(userPositionRef.current)) {
        setLocationStatus("granted");
      }
      return;
    }

    if (liveLocationStatus === "denied") {
      setUserPosition(null);
      setLocationStatus("denied");
      setLocationError(t('mapPage.location.permissionBlocked'));
      setLocationWarning("");
      return;
    }

    if (["unsupported", "insecure", "unavailable", "timeout", "error"].includes(liveLocationStatus)) {
      setLocationStatus("error");
      setLocationError(mapLiveLocationError(liveLocationError, liveLocationStatus));
      setLocationWarning("");
    }
  }, [liveLocationError, liveLocationStatus, manualLocation]);

  useEffect(() => {
    if (manualLocation) return undefined; // don't auto-request GPS while manual is active
    if (!navigator?.geolocation) {
      setUserPosition(null);
      setLocationStatus("error");
      setLocationError(t('mapPage.location.notSupported'));
      setLocationWarning("");
      return undefined;
    }

    if (!navigator?.permissions?.query) {
      setLocationStatus("unknown");
      setLocationError(t('mapPage.location.enableForPredictions'));
      return undefined;
    }

    let cancelled = false;
    let permissionStatus = null;
    const applyPermissionState = (state) => {
      if (cancelled) return;
      if (state === "granted") {
        if (normalizePoint(userPositionRef.current)) {
          setLocationStatus("granted");
          setLocationError("");
          return;
        }
        if (!autoLocateAttemptedRef.current) {
          requestLocation();
        }
        return;
      }
      if (state === "prompt") {
        autoLocateAttemptedRef.current = false;
        setLocationStatus("prompt");
        setLocationError(t('mapPage.location.enableForPredictions'));
        setLocationWarning("");
        return;
      }
      if (state === "denied") {
        autoLocateAttemptedRef.current = false;
        setUserPosition(null);
        setLocationStatus("denied");
        setLocationError(t('mapPage.location.permissionBlocked'));
        setLocationWarning("");
        return;
      }
      setLocationStatus("unknown");
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        applyPermissionState(status.state);
        status.onchange = () => applyPermissionState(status.state);
      })
      .catch(() => {
        if (cancelled) return;
        setLocationStatus("unknown");
        setLocationError(t('mapPage.location.enableForPredictions'));
        setLocationWarning("");
      });

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [requestLocation, manualLocation]);

  useEffect(() => {
    const forceWeatherRefresh = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      setWeatherRefreshTick((value) => value + 1);
    };

    const intervalId = window.setInterval(() => {
      forceWeatherRefresh();
    }, WEATHER_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceWeatherRefresh();
      }
    };

    window.addEventListener("focus", forceWeatherRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", forceWeatherRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!hasGrantedLocation || !contextPoint) {
      setResolvedPlaceName("");
      setIsResolvingPlace(false);
      return undefined;
    }

    const cacheKey = `${contextPoint.lat.toFixed(4)}:${contextPoint.lng.toFixed(4)}`;
    const cached = placeCacheRef.current.get(cacheKey);
    if (cached) {
      setResolvedPlaceName(cached);
      setIsResolvingPlace(false);
      return undefined;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setIsResolvingPlace(true);
      try {
        const payload = await getJson(
          `/api/location/reverse?lat=${encodeURIComponent(contextPoint.lat)}&lng=${encodeURIComponent(contextPoint.lng)}`,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }

        const place = normalizeReversePlace(payload);
        if (place) {
          placeCacheRef.current.set(cacheKey, place);
          setResolvedPlaceName(place);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingPlace(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [contextPoint, hasGrantedLocation]);

  useEffect(() => {
    if (!hasGrantedLocation || !userPosition || !contextPoint) {
      setWeatherLoading(false);
      setWeatherRefreshing(false);
      setWeatherError("");
      setWeatherData(null);
      setForecastLoading(false);
      setForecastRefreshing(false);
      setForecastError("");
      setForecastPoints([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const hasWeatherData = Boolean(weatherData);
      const hasForecastData = forecastPoints.length > 0;

      setWeatherLoading(!hasWeatherData);
      setWeatherRefreshing(hasWeatherData);
      setWeatherError("");
      setForecastLoading(!hasForecastData);
      setForecastRefreshing(hasForecastData);
      setForecastError("");

      const query = `lat=${encodeURIComponent(contextPoint.lat)}&lng=${encodeURIComponent(contextPoint.lng)}&timestamp=${encodeURIComponent(selectedTimestampIso)}`;
      const [weatherResult, forecastResult] = await Promise.allSettled([
        getJson(`/api/weather/current?${query}`, controller.signal),
        getJson(`/api/risk/forecast24h?${query}`, controller.signal),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      if (weatherResult.status === "fulfilled") {
        setWeatherData(weatherResult.value || null);
        setWeatherError("");
      } else if (weatherResult.reason?.name !== "AbortError") {
        setWeatherError(weatherResult.reason?.message || t('mapPage.weather.weatherUnavailable'));
      }
      

      if (forecastResult.status === "fulfilled") {
        const payload = forecastResult.value || {};
        const basePoints = Array.isArray(payload?.points) ? payload.points : [];
        const nowPoint = payload?.now_point && typeof payload.now_point === "object"
          ? payload.now_point
          : null;
        const points = nowPoint
          ? [nowPoint, ...basePoints.slice(1)]
          : basePoints;
        setForecastPoints(points);
        setForecastError("");
      } else if (forecastResult.reason?.name !== "AbortError") {
        setForecastError(forecastResult.reason?.message || t('mapPage.forecast.unavailable'));
      }

      setWeatherLoading(false);
      setWeatherRefreshing(false);
      setForecastLoading(false);
      setForecastRefreshing(false);
    }, WEATHER_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    contextPoint,
    contextPointKey,
    hasGrantedLocation,
    selectedTimestampIso,
    weatherRefreshTick,
  ]);

  const weatherIcon = weatherIconFromCondition(weatherData?.condition);
  const weatherUpdating = weatherRefreshing || forecastRefreshing;
  const weatherTempText = weatherData?.temperature_c == null
    ? "--°C"
    : `${Math.round(Number(weatherData.temperature_c))}°C`;
  const weatherDescText = !hasGrantedLocation
    ? t('mapPage.weather.positionRequired')
    : weatherLoading && !weatherData
    ? t('mapPage.weather.loadingWeather')
    : weatherError
      ? t('mapPage.weather.weatherUnavailable')
      : weatherData?.condition || t('mapPage.weather.weather');
  const visibilityText = weatherData?.visibility_km == null
    ? "n/a"
    : `${Number(weatherData.visibility_km).toFixed(1)} km`;
  const windText = weatherData?.wind_kmh == null
    ? "n/a"
    : `${Number(weatherData.wind_kmh).toFixed(1)} km/h`;
  const windDirectionText = weatherData?.wind_direction
    && weatherData.wind_direction !== "Unknown"
    && weatherData.wind_direction !== "CALM"
    ? ` (${weatherData.wind_direction})`
    : "";
  const humidityText = weatherData?.humidity_pct == null
    ? "n/a"
    : `${Math.round(Number(weatherData.humidity_pct))}%`;
  const pressureText = weatherData?.pressure_hpa == null
    ? "n/a"
    : `${Number(weatherData.pressure_hpa).toFixed(0)} hPa`;
  const weatherPlaceText = hasGrantedLocation
    ? (
      String(
        resolvedPlaceName
        || weatherData?.location_name
        || weatherData?.locationLabel
        || weatherData?.place
        || weatherData?.city
        || weatherData?.wilaya
        || (selectedWilaya !== "all" ? selectedWilaya : ""),
      ).trim()
      || (isResolvingPlace ? t('mapPage.weather.resolvingNeighborhood') : t('mapPage.weather.currentLocation'))
    )
    : (
      String(
        selectedIncident?.locationLabel
        || weatherData?.location_name
        || weatherData?.locationLabel
        || weatherData?.place
        || weatherData?.city
        || weatherData?.wilaya
        || (selectedWilaya !== "all" ? selectedWilaya : ""),
      ).trim()
      || t('mapPage.weather.unknownPlace')
    );

  /* ──────────────────────── Report Data & Derived UI Data ──────────────────────── */

  // Incident categories shown as filter chips
  const incidentTypes = [
    { id: "accident", label: t('mapPage.incidentTypes.accident'), icon: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" /> },
    { id: "traffic", label: t('mapPage.incidentTypes.traffic'), icon: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    { id: "danger", label: t('mapPage.incidentTypes.danger'), icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" /> },
    { id: "weather", label: t('mapPage.incidentTypes.weather'), icon: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" /> },
    { id: "roadworks", label: t('mapPage.incidentTypes.roadworks'), icon: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    { id: "other", label: t('mapPage.incidentTypes.other'), icon: <HelpOutlineOutlinedIcon fontSize="inherit" className="icon-muted" /> },
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

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const severity = normalizeSeverityLevel(report?.severity);
        const reportType = normalizeReportType(report?.incidentType || report?.type);
        const locationLabel = String(report?.locationLabel || "").trim().toLowerCase();

        if (severityFilter.length > 0 && !severityFilter.includes(severity)) {
          return false;
        }

        if (typeFilter.length > 0 && !typeFilter.includes(reportType)) {
          return false;
        }

        if (selectedWilaya !== "all" && !locationLabel.includes(String(selectedWilaya).trim().toLowerCase())) {
          return false;
        }

        return matchesTimeFilter(report, timeFilter);
      }),
    [reports, selectedWilaya, severityFilter, timeFilter, typeFilter],
  );

  const visibleReportMarkers = useMemo(
    () => filteredReports.filter((report) => mapReadyReports.some((marker) => marker.id === report.id)),
    [filteredReports, mapReadyReports],
  );

  useEffect(() => {
    if (!user) {
      setAlertZones([]);
      setZonesLoading(false);
      setZonesError(t('mapPage.zones.signInToLoad'));
      return undefined;
    }

    let cancelled = false;

    setZonesLoading(true);
    setZonesError("");

    fetchAlerts({ includeGeometry: true })
      .then((items) => {
        if (cancelled) {
          return;
        }

        setAlertZones(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setZonesError(error.response?.data?.message || t('mapPage.zones.unableToLoad'));
      })
      .finally(() => {
        if (!cancelled) {
          setZonesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.state?.focusAlertId, mapLayer, user, weatherRefreshTick]);

  // Load the public safety overlay only while its layer is active. When the user
  // has shared a position we bias the query to nearby measures; otherwise we
  // fetch the most recent ones platform-wide.
  useEffect(() => {
    if (mapLayer !== "safety") {
      return undefined;
    }

    let cancelled = false;
    setSafetyLoading(true);
    setSafetyError("");

    const params = {};
    const point = normalizePoint(userPosition);
    if (point) {
      params.lat = point.lat;
      params.lng = point.lng;
      params.radiusKm = 75;
    }

    getSafetyOverlay(params)
      .then((result) => {
        if (cancelled) return;
        setSafetyItems(Array.isArray(result?.items) ? result.items : []);
      })
      .catch((error) => {
        if (cancelled) return;
        setSafetyItems([]);
        setSafetyError(error?.message || t('mapPage.safety.unavailable'));
      })
      .finally(() => {
        if (!cancelled) setSafetyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mapLayer, userPosition, weatherRefreshTick]);

  const activeAlertZones = useMemo(
    () =>
      alertZones.filter((alert) => {
        if (alert.status !== "active" || !alert.zone) {
          return false;
        }

        if (alert.zone.zoneType === "radius") {
          return Boolean(alert.zone.center && alert.zone.radiusM);
        }

        return Boolean(alert.zone.geometry || alert.zone.center || alert.area?.center);
      }),
    [alertZones],
  );

  const selectedAlertZone = useMemo(
    () => activeAlertZones.find((alert) => alert.id === selectedZoneId) || null,
    [activeAlertZones, selectedZoneId],
  );

  useEffect(() => {
    if (activeAlertZones.length === 0) {
      setSelectedZoneId(null);
      return;
    }

    if (location.state?.focusAlertId && activeAlertZones.some((alert) => alert.id === location.state.focusAlertId)) {
      setSelectedZoneId(location.state.focusAlertId);
      return;
    }

    if (selectedZoneId && activeAlertZones.some((alert) => alert.id === selectedZoneId)) {
      return;
    }

    if (mapLayer === "zones") {
      setSelectedZoneId(activeAlertZones[0].id);
    }
  }, [activeAlertZones, location.state?.focusAlertId, mapLayer, selectedZoneId]);

  const trendingZones = useMemo(() => {
    const zoneMap = new Map();

    for (const report of filteredReports) {
      const zoneName = String(report?.locationLabel || t('mapPage.trending.reportedArea')).trim() || t('mapPage.trending.reportedArea');
      const severity = normalizeSeverityLevel(report?.severity);
      const severityScore = SEVERITY_SCORES[severity] || 0;
      const updatedAt =
        getReportTimestamp(report)?.toISOString() || report?.createdAt || report?.updatedAt || null;
      const existing = zoneMap.get(zoneName);

      if (!existing) {
        zoneMap.set(zoneName, {
          name: zoneName,
          incidents: 1,
          severity,
          severityScore,
          updatedAt,
        });
        continue;
      }

      zoneMap.set(zoneName, {
        ...existing,
        incidents: existing.incidents + 1,
        severity: severityScore > existing.severityScore ? severity : existing.severity,
        severityScore: Math.max(existing.severityScore, severityScore),
        updatedAt:
          !existing.updatedAt || (updatedAt && new Date(updatedAt) > new Date(existing.updatedAt))
            ? updatedAt
            : existing.updatedAt,
      });
    }

    return Array.from(zoneMap.values())
      .sort((left, right) => {
        if (right.incidents !== left.incidents) {
          return right.incidents - left.incidents;
        }
        return right.severityScore - left.severityScore;
      })
      .slice(0, 4)
      .map((zone) => ({
        ...zone,
        updated: formatRelativeReportAge(zone.updatedAt, t),
      }));
  }, [filteredReports]);

  const activeAlerts = useMemo(
    () =>
      [...activeAlertZones]
        .sort((left, right) => {
          const severityDelta =
            (SEVERITY_SCORES[normalizeSeverityLevel(right?.severity)] || 0) -
            (SEVERITY_SCORES[normalizeSeverityLevel(left?.severity)] || 0);
          if (severityDelta !== 0) {
            return severityDelta;
          }

          const rightTime = new Date(right?.lastTriggeredAt || right?.updatedAt || right?.createdAt || 0).getTime();
          const leftTime = new Date(left?.lastTriggeredAt || left?.updatedAt || left?.createdAt || 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 4)
        .map((alert) => ({
          id: alert.id,
          title: alert.name || alert.zone?.displayName || alert.area?.name || t('mapPage.activeAlerts.alertLabel'),
          time: formatZoneLastTriggered(alert.lastTriggeredAt, t),
        })),
    [activeAlertZones],
  );

  const statsTodayCount = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return filteredReports.filter((report) => {
      const reportTimestamp = getReportTimestamp(report);
      return reportTimestamp && reportTimestamp >= startOfDay;
    }).length;
  }, [filteredReports]);

  const averageSeverityLabel = useMemo(() => {
    if (filteredReports.length === 0) {
      return "n/a";
    }

    const total = filteredReports.reduce(
      (sum, report) => sum + (SEVERITY_SCORES[normalizeSeverityLevel(report?.severity)] || 0),
      0,
    );

    return (total / filteredReports.length).toFixed(1);
  }, [filteredReports]);

  const verifiedRateLabel = useMemo(() => {
    if (filteredReports.length === 0) {
      return "0%";
    }

    const verifiedCount = filteredReports.filter((report) => report.status === "verified").length;
    return `${Math.round((verifiedCount / filteredReports.length) * 100)}%`;
  }, [filteredReports]);

  const reportStatusLabel = useMemo(() => {
    if (mapLayer === "safety") {
      if (safetyLoading) {
        return t('mapPage.safety.loading');
      }
      if (safetyError) {
        return t('mapPage.safety.unavailable');
      }
      return t('mapPage.safety.measuresShown', { count: safetyItems.length });
    }

    if (mapLayer === "zones") {
      if (zonesLoading) {
        return t('mapPage.status.loadingAlertZones');
      }

      if (zonesError) {
        return t('mapPage.status.alertZonesUnavailable');
      }

      return t('mapPage.status.alertZonesLoaded', { count: activeAlertZones.length });
    }

    if (reportsLoading) {
      return t('mapPage.status.loadingReports');
    }

    if (reportsError) {
      return t('mapPage.status.reportsUnavailable');
    }

    return t('mapPage.status.reportsDisplayed', { count: visibleReportMarkers.length });
  }, [activeAlertZones.length, mapLayer, reportsError, reportsLoading, safetyError, safetyItems.length, safetyLoading, visibleReportMarkers.length, zonesError, zonesLoading]);

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
   * Triggers location flow based on permission state.
   */
  const handleLocateUser = () => {
    requestLocation();
  };

  const handleRetryGps = useCallback(() => {
    setLocationError("");
    retryLiveLocation();
  }, [retryLiveLocation]);

  /* ────────── Fullscreen inline styles (applied when toggled) ────────── */

  const fullscreenStyle = isFullscreen
    ? { height: "100vh", width: "100vw", top: 0, left: 0, position: "fixed", zIndex: 9999 }
    : { position: "relative" };

  const fullscreenInnerStyle = isFullscreen
    ? { height: "100vh", width: "100vw", top: 0, left: 0, position: "absolute", zIndex: 9999 }
    : { position: "relative" };

  const profileName = String(
    user?.name
      || user?.fullName
      || user?.full_name
      || [user?.first_name, user?.last_name].filter(Boolean).join(" ")
      || user?.email
      || "SIARA User",
  ).trim();
  const normalizedRoles = getUserRoles(user)
  const primaryRole = normalizedRoles.includes('admin')
    ? 'admin'
    : normalizedRoles.includes('police') || normalizedRoles.includes('policeofficer')
      ? 'police'
      : normalizedRoles[0] || 'citizen'
  const roleLabel = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1)
  const roleClass = primaryRole === 'admin'
    ? 'role-admin'
    : primaryRole === 'police'
      ? 'role-police'
      : 'role-citoyen'
  const userAvatarUrl = getUserAvatarUrl(user)
  const profileAvatarUrl = userAvatarUrl || profileAvatar
  const profileInitials = getInitialsFromName(profileName)

  /* ══════════════════════════ RENDER ══════════════════════════ */

  return (
    <div className="map-page">
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══════════════ TOP NAVIGATION BAR ═══════════════ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">

          {/* ── Left: Logo + Tab navigation ── */}
          <div className="dash-header-left">
            <div className="dash-logo-block">
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>

            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate("/news")}>{t('common:nav.feed')}</button>
              <button className="dash-tab dash-tab-active">{t('common:nav.map')}</button>
              <button className="dash-tab" onClick={() => navigate("/alerts")}>{t('common:nav.alerts')}</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>{t('common:nav.reports')}</button>
              <button className="dash-tab" onClick={() => navigate("/dashboard")}>{t('mapPage.nav.dashboard')}</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>{t('common:nav.predictions')}</button>
              <PoliceModeTab user={user} />
            </nav>
          </div>

          {/* ── Center: Search bar ── */}
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder={t('mapPage.search.placeholder')}
              ariaLabel={t('common:actions.search')}
              currentUser={user}
            />
          </div>

          {/* ── Right: Notification, messages & avatar dropdown ── */}
          <div className="dash-header-right">
            <NotificationBell />


            {/* Avatar with dropdown menu */}
            <div className="dash-avatar-wrapper">
              <button
                className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`}
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label={t('mapPage.header.userProfile')}
              >
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={t('mapPage.header.userAvatar')} className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
              </button>

              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/profile"); }}>
                    {t('mapPage.dropdown.myProfile')}
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowDropdown(false); navigate("/settings"); }}
                  >
                    {t('common:nav.settings')}
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/notifications"); }}>
                    {t('common:nav.notifications')}
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home'); }}>{t('common:nav.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN THREE-COLUMN LAYOUT ═══════════════ */}
      <div className="map-content">

        {/* ═══════════ LEFT SIDEBAR — Profile, Nav, Filters & Actions ═══════════ */}
        <aside className="sidebar-left">

          {/* ── Profile card ── */}
          <div className="card profile-summary map-profile-summary">
            <div className="profile-avatar-container map-profile-avatar-container">
              <img src={profileAvatarUrl} alt={t('common:nav.profile')} className="profile-avatar-large map-profile-avatar-large" loading="lazy" />            </div>
            <div className="profile-info map-profile-info">
              <p className="profile-name map-profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">{t('mapPage.profile.bio')}</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>{t('mapPage.profile.viewProfile')}</button>
            </div>
          </div>

          {/* ── Navigation menu ── */}
          <FeedSidebarNav activeKey="map" onOpenQuiz={() => setShowQuiz(true)} />

          {/* ── Filter panel ── */}
          <div className="card filters-section">
            <div className="section-header">
              <h3>{t('mapPage.filters.title')}</h3>
              {hasActiveFilters && (
                <button className="clear-btn" onClick={clearFilters}>{t('mapPage.filters.clear')}</button>
              )}
            </div>

            {/* Time-range filter chips */}
            <div className="filter-group">
              <label className="filter-label">{t('mapPage.filters.period')}</label>
              <div className="filter-chips">
                {[
                  { id: "24h", label: t('mapPage.filters.period24h') },
                  { id: "7d", label: t('mapPage.filters.period7d') },
                  { id: "30d", label: t('mapPage.filters.period30d') },
                  { id: "custom", label: t('mapPage.filters.periodCustom') },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    className={`chip ${timeFilter === chip.id ? "active" : ""}`}
                    onClick={() => setTimeFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity filter chips */}
            <div className="filter-group">
              <label className="filter-label">{t('mapPage.filters.severity')}</label>
              <div className="filter-chips">
                {[
                  { id: "high", label: t('mapPage.filters.severityHigh'), color: "#EF4444" },
                  { id: "medium", label: t('mapPage.filters.severityMedium'), color: "#F59E0B" },
                  { id: "low", label: t('mapPage.filters.severityLow'), color: "#10B981" },
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
              <label className="filter-label">{t('mapPage.filters.incidentType')}</label>
              <div className="filter-chips">
                {incidentTypes.map((inc) => (
                  <button
                    key={inc.id}
                    className={`chip ${typeFilter.includes(inc.id) ? "active" : ""}`}
                    onClick={() => toggleType(inc.id)}
                  >
                    <span>{inc.icon}</span> {inc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wilaya (province) dropdown selector */}
            <div className="filter-group">
              <label className="filter-label">{t('mapPage.filters.zone')}</label>
              <FancySelect
                value={selectedWilaya}
                onChange={setSelectedWilaya}
                menuAlign="left"
                options={[
                  { value: 'all', label: t('mapPage.filters.allProvinces') },
                  ...wilayas.map((w) => ({ value: w, label: w })),
                ]}
              />
            </div>
          </div>

          {/* Report-incident CTA pinned at sidebar bottom */}
          <div className="sidebar-action">
            <button className="btn-signal" onClick={() => navigate("/report")}>
              <AddRoundedIcon fontSize="inherit" /> {t('mapPage.actions.reportIncident')}
            </button>
          </div>
        </aside>

        {/* ═══════════ CENTER — Interactive Map ═══════════ */}
        <main className="map-main" style={fullscreenStyle}>

          {/* ── Layer-switcher as a real toolbar ABOVE the map (normal flow) ──
              Pulled out of the map overlay so it can never overlap the on-map
              search / guidance panel. */}
          <div className="map-toolbar">
            <div className="layer-switcher">
              {[
                { id: "points", label: t('mapPage.layers.points') },
                { id: "heatmap", label: t('mapPage.layers.heatmap') },
                { id: "zones", label: t('mapPage.layers.zones') },
                { id: "ai", label: t('mapPage.layers.aiRisks') },
                { id: "nearbyRoads", label: t('mapPage.layers.nearbyRoads') },
                { id: "safety", label: t('mapPage.layers.safety') },
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

          <div className="map-container" style={fullscreenInnerStyle}>

            {/* ── Right-side map controls (fullscreen + locate me) ── */}
            <div className="map-controls-right">
              {/* Toggle fullscreen on/off */}
              {isFullscreen ? (
                <button className="map-ctrl-btn" title={t('mapPage.map.exitFullscreen')} onClick={() => setIsFullscreen(false)}>
                  <FullscreenExitTwoToneIcon className="btn-icon" />
                  <span className="map-ctrl-label">{t('mapPage.map.exitFullMap')}</span>
                </button>
              ) : (
                <button className="map-ctrl-btn" title={t('mapPage.map.fullscreen')} onClick={() => setIsFullscreen(true)}>
                  <FullscreenTwoToneIcon className="btn-icon" />
                  <span className="map-ctrl-label">{t('mapPage.map.fullMap')}</span>
                </button>
              )}

              {/* Geolocate user and center the map on their position */}
              <button className="map-ctrl-btn" title={t('mapPage.map.myLocation')} onClick={handleLocateUser}>
                <LocationOnTwoToneIcon className="btn-icon" />
                <span className="map-ctrl-label">{t('mapPage.map.myLocation')}</span>
              </button>
            </div>

            {/* ── Map canvas — renders the SiaraMap component ── */}
            <div className="map-canvas">
              <SiaraMap
                reportMarkers={visibleReportMarkers}
                alertZones={activeAlertZones}
                safetyInterventions={safetyItems}
                mapLayer={mapLayer}
                onAlertZoneSelect={setSelectedZoneId}
                selectedAlertZoneId={selectedZoneId}
                setSelectedIncident={setSelectedIncident}
                userPosition={userPosition}
                locationStatus={locationStatus}
                locationError={locationError}
                locationWarning={locationWarning}
                locationRequestVersion={locationRequestVersion}
                requestLocation={requestLocation}
                liveLocationStatus={liveLocationStatus}
                liveLocationUpdatedAt={liveLocationUpdatedAt}
                liveLocationLastError={liveLocationLastError}
                liveLocationIsFallback={liveLocationIsFallback}
                onSelectedTimestampChange={setSelectedTimestampIso}
                weatherData={weatherData}
                placeName={resolvedPlaceName}
                riskPanelTarget={isFullscreen ? null : riskPanelHost}
                guideControlsTarget={!isFullscreen && isCompactLayout ? guideControlsHost : null}
              />
              {liveLocationIsFallback && !manualLocation ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                  }}
                >
                  <FallbackLocationBanner
                    isFallback={liveLocationIsFallback}
                    isLoading={liveLocationIsLoading}
                    errorMessage={liveLocationErrorMessage}
                    onRetry={handleRetryGps}
                  />
                </div>
              ) : null}
            </div>

            {/* ── Status bar at the bottom of the map ── */}
            <div className="map-status">
              <span className="status-dot"></span>
              <span>{reportStatusLabel}</span>
            </div>
          </div>
        </main>

        {/* ═══════════ RIGHT SIDEBAR — Contextual Info ═══════════ */}
        <aside className="map-sidebar-right">

          {/* Guidance/search controls — portaled here from SiaraMap on compact
              (stacked) layouts so they sit in a clean card below the map.
              Stays empty (and hidden) on desktop, where the panel overlays the map. */}
          <div ref={setGuideControlsHost} className="context-guide-slot" />

          {/* ── Manual location picker (works when GPS is unavailable) ── */}
          <ManualLocationControl
            currentLocation={manualLocation}
            locationStatus={locationStatus}
            onSet={handleSetManualLocation}
            onClear={handleClearManualLocation}
          />

          {/* ── Current weather widget ── */}
          <div className="context-weather">
            <div className="cw-top">
              <div className="cw-left">
                <span className="cw-icon">{weatherIcon}</span>
                <div className="cw-main">
                  <span className="cw-temp">{weatherTempText}</span>
                  <span className="cw-desc">{weatherDescText}</span>
                </div>
              </div>
              <span className="cw-time">{currentHourText}</span>
            </div>
            <p className="cw-place">
              <span className="cw-place-dot"><LocationOnOutlinedIcon fontSize="inherit" /></span>
              <span className="cw-place-text">{weatherPlaceText}</span>
            </p>
            {hasGrantedLocation && contextPoint ? (
              <div className="cw-grid">
                <div className="cw-cell">
                  <span className="cw-cell-val">{visibilityText}</span>
                  <span className="cw-cell-lbl">{t('mapPage.weather.visibility')}</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{windText}{windDirectionText && <span className="cw-dir"> {windDirectionText}</span>}</span>
                  <span className="cw-cell-lbl">{t('mapPage.weather.wind')}</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{humidityText}</span>
                  <span className="cw-cell-lbl">{t('mapPage.weather.humidity')}</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{pressureText}</span>
                  <span className="cw-cell-lbl">{t('mapPage.weather.pressure')}</span>
                </div>
              </div>
            ) : (
              <p className="cw-no-loc">{t('mapPage.weather.enableLocation')}</p>
            )}
            {weatherUpdating && <p className="cw-updating">{t('mapPage.weather.refreshing')}</p>}
          </div>

          {/* CURRENT RISK panel — portaled here from SiaraMap when not in full-map mode */}
          <div ref={setRiskPanelHost} className="context-risk-slot" />

          <div className="context-section danger-forecast-section">
            <h4 className="section-title">{t('mapPage.forecast.title')}</h4>
            <DangerForecastChart
              points={forecastPoints}
              loading={forecastLoading && forecastPoints.length === 0}
            />
            {forecastRefreshing && forecastPoints.length > 0 && (
              <p className="chart-note">{t('mapPage.forecast.updating')}</p>
            )}
            {forecastError && (
              <p className="chart-note chart-note-error">{forecastError}</p>
            )}
            {!forecastLoading && !forecastError && forecastPoints.length === 0 && (
              <p className="chart-note">{t('mapPage.forecast.noData')}</p>
            )}
          </div>

          <div className="context-section">
            <h4 className="section-title">{mapLayer === "zones" ? t('mapPage.context.alertZones') : t('mapPage.context.reportsFeed')}</h4>
            {mapLayer === "zones" ? (
              zonesLoading ? (
                <p className="chart-note">{t('mapPage.context.loadingAlertZonesDb')}</p>
              ) : zonesError ? (
                <p className="chart-note chart-note-error">{zonesError}</p>
              ) : (
                <p className="chart-note">
                  {t('mapPage.context.activeAlertZonesReady', { count: activeAlertZones.length })}
                </p>
              )
            ) : reportsLoading ? (
              <p className="chart-note">{t('mapPage.context.loadingReportsDb')}</p>
            ) : reportsError ? (
              <p className="chart-note chart-note-error">{reportsError}</p>
            ) : (
              <p className="chart-note">
                {t('mapPage.context.mappedReportsMatch', { count: visibleReportMarkers.length })}
              </p>
            )}
          </div>

          {mapLayer === "zones" && (
            <div className="context-section zone-focus-section">
              <div className="zones-section-head">
                <h4 className="section-title">{t('mapPage.zones.selectedZone')}</h4>
                <button
                  type="button"
                  className="zone-link-btn"
                  onClick={() => navigate('/alerts')}
                >
                  {t('mapPage.zones.manageAlerts')}
                </button>
              </div>
              {selectedAlertZone ? (
                <div className={`zone-focus-card severity-${selectedAlertZone.severity}`}>
                  <span className="zone-focus-name">{selectedAlertZone.name}</span>
                  <span className="zone-focus-area">
                    {selectedAlertZone.zone?.displayName || selectedAlertZone.area?.name || t('mapPage.zones.zoneLabel')}
                  </span>
                  <div className="zone-focus-meta">
                    <span>{t('mapPage.zones.severityLabel', { severity: selectedAlertZone.severity })}</span>
                    <span>{selectedAlertZone.timeWindow}</span>
                  </div>
                  <div className="zone-focus-meta">
                    <span>{t('mapPage.zones.triggersCount', { count: selectedAlertZone.triggerCount })}</span>
                    <span>{formatZoneLastTriggered(selectedAlertZone.lastTriggeredAt, t)}</span>
                  </div>
                </div>
              ) : (
                <p className="chart-note">{t('mapPage.zones.selectZoneHint')}</p>
              )}
            </div>
          )}

          {/* ── AI Segment Insight (visible only when an AI segment is selected) ── */}
          {selectedIncident?.explanation && (
            <div className="context-section">
              <h4 className="section-title">{t('mapPage.segmentInsight.title')}</h4>

              {/* Overview: segment name + danger percentage */}
              <div className="map-alert-item">
                <span className="map-alert-icon">IA</span>
                <div className="map-alert-info">
                  <span className="map-alert-title">
                    {selectedIncident.title || t('mapPage.segmentInsight.segmentLabel', { id: selectedIncident.id })}
                  </span>
                  <span className="map-alert-time">
                    {t('mapPage.segmentInsight.risk', { percent: selectedIncident.explanation.danger_percent, level: selectedIncident.explanation.danger_level })}
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
                          {t('mapPage.segmentInsight.impact', { value: Number(reason.impact || 0).toFixed(4) })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Map legend ── */}
          <div className="context-section">
            <h4 className="section-title">{t('mapPage.legend.title')}</h4>
            <div className="legend">
              <div className="legend-item">
                <span className="legend-dot high"></span>
                <span>{t('mapPage.legend.highSeverity')}</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot medium"></span>
                <span>{t('mapPage.legend.mediumSeverity')}</span>
              </div>
              <div className="legend-item">
                <span className={`legend-dot ${mapLayer === "zones" ? "zone-low" : "low"}`}></span>
                <span>{t('mapPage.legend.lowSeverity')}</span>
              </div>
              {mapLayer === "zones" && (
                <p className="chart-note">{t('mapPage.legend.zonesNote')}</p>
              )}
              {/* Extra legend row when the AI risk layer is active */}
              {mapLayer === "ai" && (
                <>
                  <hr />
                  <div className="legend-item">
                    <span className="legend-gradient"></span>
                    <span>{t('mapPage.legend.aiRisk')}</span>
                  </div>
                </>
              )}
              {/* Safety-overlay legend: infrastructure counter-measures */}
              {mapLayer === "safety" && (
                <>
                  <hr />
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#0ea5e9" }}></span>
                    <span>{t('mapPage.legend.safetyMeasure')}</span>
                  </div>
                  <p className="chart-note">{t('mapPage.safety.legendNote')}</p>
                </>
              )}
            </div>
          </div>

          {/* ── Trending / hot-spot zones ── */}
          <div className="context-section">
            <div className="zones-section-head">
              <h4 className="section-title">{mapLayer === "zones" ? t('mapPage.trending.zoneRules') : t('mapPage.trending.areasToWatch')}</h4>
              {mapLayer === "zones" ? (
                <button
                  type="button"
                  className="zone-link-btn"
                  onClick={() => navigate('/alerts')}
                >
                  {t('mapPage.trending.openAlerts')}
                </button>
              ) : null}
            </div>
            <div className="trending-zones">
              {mapLayer === "zones" ? (
                zonesLoading ? (
                  <p className="chart-note">{t('mapPage.trending.loadingActiveZones')}</p>
                ) : zonesError ? (
                  <p className="chart-note chart-note-error">{zonesError}</p>
                ) : activeAlertZones.length === 0 ? (
                  <p className="chart-note">{t('mapPage.trending.noActiveZones')}</p>
                ) : (
                  activeAlertZones.map((alert) => (
                    <div
                      key={alert.id}
                      className={`zone-item ${selectedZoneId === alert.id ? 'selected' : ''}`}
                      onClick={() => {
                        setMapLayer("zones");
                        setSelectedZoneId(alert.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setMapLayer("zones");
                          setSelectedZoneId(alert.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="zone-info">
                        <span className="zone-name">{alert.zone?.displayName || alert.area?.name || alert.name}</span>
                        <span className="zone-meta">
                          {alert.timeWindow} • {t('mapPage.zones.triggersMeta', { count: alert.triggerCount })}
                        </span>
                        <span className="zone-meta zone-meta-secondary">
                          {formatZoneLastTriggered(alert.lastTriggeredAt, t)}
                        </span>
                      </div>
                      <span className={`zone-badge severity-${alert.severity}`}>
                        {alert.severity === "high" ? "H" : alert.severity === "medium" ? "M" : "L"}
                      </span>
                    </div>
                  ))
                )
              ) : null}
              {mapLayer !== "zones" && trendingZones.length === 0 && (
                <p className="chart-note">{t('mapPage.trending.noReportClusters')}</p>
              )}
              {mapLayer !== "zones" && trendingZones.map((zone) => (
                <div key={zone.name} className="zone-item">
                  <div className="zone-info">
                    <span className="zone-name">{zone.name}</span>
                    <span className="zone-meta">
                      {t('mapPage.trending.incidentsMeta', { count: zone.incidents, updated: zone.updated })}
                    </span>
                  </div>
                  <span className={`zone-badge severity-${zone.severity}`}>
                    <FiberManualRecordIcon fontSize="inherit" className={`icon-severity-${zone.severity === "high" ? "high" : zone.severity === "medium" ? "medium" : "low"}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Active alerts list ── */}
          <div className="context-section">
            <h4 className="section-title">{t('mapPage.activeAlerts.title')}</h4>
            <div className="map-alerts-list">
              {activeAlerts.length === 0 && (
                <p className="chart-note">{t('mapPage.activeAlerts.noAlerts')}</p>
              )}
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="map-alert-item">
                  <span className="map-alert-icon"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
                  <div className="map-alert-info">
                    <span className="map-alert-title">{alert.title}</span>
                    <span className="map-alert-time">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-manage-alerts" onClick={() => navigate('/alerts')}>{t('mapPage.activeAlerts.manageMyAlerts')}</button>
          </div>

          {/* ── Quick statistics summary ── */}
          <div className="context-section">
            <h4 className="section-title">{t('mapPage.stats.title')}</h4>
            <div className="quick-stats">
              <div className="map-stat-item">
                <span className="map-stat-value">{statsTodayCount}</span>
                <span className="map-stat-label">{t('mapPage.stats.today')}</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">{averageSeverityLabel}</span>
                <span className="map-stat-label">{t('mapPage.stats.avgSeverity')}</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">{verifiedRateLabel}</span>
                <span className="map-stat-label">{t('mapPage.stats.verified')}</span>
              </div>
            </div>
          </div>

        </aside>
      </div>

      
    </div>
  );
}
