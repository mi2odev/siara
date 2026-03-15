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
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../../contexts/AuthContext';

/* ── Styles ── */
import "../../styles/NewsPage.css";
import "../../styles/MapPage.css";

/* ── Assets ── */
import siaraLogo from "../../assets/logos/siara-logo.png";
import profileAvatar from "../../assets/logos/siara-logo1.png";

/* ── Components ── */
import DangerForecastChart from "../../components/map/DangerForecastChart";
import SiaraMap from "../../components/map/SiaraMap";
import DrivingQuiz from "../../components/ui/DrivingQuiz";

/* ── MUI Icons ── */
import LocationOnTwoToneIcon from "@mui/icons-material/LocationOnTwoTone";
import FullscreenTwoToneIcon from "@mui/icons-material/FullscreenTwoTone";
import FullscreenExitTwoToneIcon from "@mui/icons-material/FullscreenExitTwoTone";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const WEATHER_DEBOUNCE_MS = 700;
const WEATHER_REFRESH_MS = 5 * 60 * 1000;
const LOCATION_REQUEST_TIMEOUT_MS = 12000;
const LOCATION_WATCH_WINDOW_MS = 10000;
const LOCATION_FAST_ACCEPT_MS = 2500;
const LOCATION_GOOD_ACCURACY_M = 50;
const LOCATION_POOR_ACCURACY_M = 250;
const LOCATION_IMPROVEMENT_DELTA_M = 25;
const LOCATION_STALE_READING_MS = 30000;
const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

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

function normalizeLocationReading(position) {
  if (!position?.coords) {
    return null;
  }

  const lat = toFiniteNumber(position.coords.latitude);
  const lng = toFiniteNumber(position.coords.longitude);
  if (lat == null || lng == null) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy: toFiniteNumber(position.coords.accuracy),
    altitude: toFiniteNumber(position.coords.altitude),
    altitudeAccuracy: toFiniteNumber(position.coords.altitudeAccuracy),
    heading: toFiniteNumber(position.coords.heading),
    speed: toFiniteNumber(position.coords.speed),
    timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
  };
}

function formatAccuracyLabel(accuracy) {
  const value = toFiniteNumber(accuracy);
  if (value == null) {
    return "n/a";
  }
  return `${Math.round(value)} m`;
}

function logLocation(event, details = {}) {
  console.info("[location]", event, details);
}

function isBetterLocation(candidate, currentBest) {
  if (!candidate) {
    return false;
  }
  if (!currentBest) {
    return true;
  }

  const candidateAccuracy = toFiniteNumber(candidate.accuracy);
  const currentAccuracy = toFiniteNumber(currentBest.accuracy);

  if (candidateAccuracy == null && currentAccuracy == null) {
    return candidate.timestamp > currentBest.timestamp;
  }
  if (candidateAccuracy != null && currentAccuracy == null) {
    return true;
  }
  if (candidateAccuracy == null) {
    return false;
  }
  if (candidateAccuracy + LOCATION_IMPROVEMENT_DELTA_M < currentAccuracy) {
    return true;
  }
  if (Math.abs(candidateAccuracy - currentAccuracy) <= 5) {
    return candidate.timestamp > currentBest.timestamp;
  }
  return false;
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

function mapGeolocationError(err) {
  if (!err) {
    return "Unable to get your position.";
  }
  if (err.code === GEOLOCATION_PERMISSION_DENIED) {
    return "Location permission denied.";
  }
  if (err.code === GEOLOCATION_TIMEOUT) {
    return "Location request timed out before a precise reading arrived.";
  }
  if (err.code === GEOLOCATION_POSITION_UNAVAILABLE) {
    return "Location is unavailable on this device/browser right now.";
  }
  return err.message || "Unable to get your position.";
}

function resolveContextPoint(selectedIncident, userPosition) {
  const incidentPoint = normalizePoint(selectedIncident);
  if (incidentPoint) {
    return incidentPoint;
  }

  if (Array.isArray(selectedIncident?.path) && selectedIncident.path.length > 0) {
    const firstPoint = selectedIncident.path[0];
    if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
      const lat = toFiniteNumber(firstPoint[0]);
      const lng = toFiniteNumber(firstPoint[1]);
      if (lat != null && lng != null) {
        return { lat, lng };
      }
    }
  }

  return normalizePoint(userPosition);
}

function toPointKey(point) {
  if (!point) {
    return "";
  }
  return `${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
}

function weatherIconFromCondition(condition) {
  const text = String(condition || "").toLowerCase();
  if (text.includes("orage")) return "⛈️";
  if (text.includes("pluie") || text.includes("bruine")) return "🌧️";
  if (text.includes("neige")) return "🌨️";
  if (text.includes("brouillard")) return "🌫️";
  if (text.includes("couvert")) return "☁️";
  if (text.includes("nuage")) return "⛅";
  return "☀️";
}

export default function MapPage() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  /* ──────────────────────────── State ──────────────────────────── */

  // Controls the visibility of the user-profile dropdown in the header
  const [showDropdown, setShowDropdown] = useState(false);

  // Driving quiz overlay
  const [showQuiz, setShowQuiz] = useState(false);
  const handleQuizComplete = () => {
    setShowQuiz(false);
  };

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
  const [locationStatus, setLocationStatus] = useState("unknown");
  const [locationError, setLocationError] = useState("");
  const [locationWarning, setLocationWarning] = useState("");
  const [locationRequestVersion, setLocationRequestVersion] = useState(0);
  const [selectedTimestampIso, setSelectedTimestampIso] = useState(() => new Date().toISOString());

  // Whether the map is displayed in fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastRefreshing, setForecastRefreshing] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastPoints, setForecastPoints] = useState([]);
  const [weatherRefreshTick, setWeatherRefreshTick] = useState(0);

  const contextPoint = useMemo(
    () => resolveContextPoint(selectedIncident, userPosition),
    [selectedIncident, userPosition],
  );
  const contextPointKey = useMemo(() => toPointKey(contextPoint), [contextPoint]);
  const hasGrantedLocation = useMemo(
    () => locationStatus === "granted" && normalizePoint(userPosition) != null,
    [locationStatus, userPosition],
  );

  const userPositionRef = useRef(userPosition);
  const watchIdRef = useRef(null);
  const watchWindowTimerRef = useRef(null);
  const fastAcceptTimerRef = useRef(null);
  const bestReadingRef = useRef(null);
  const acceptedReadingRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const lastErrorRef = useRef(null);
  const autoLocateAttemptedRef = useRef(false);

  useEffect(() => {
    userPositionRef.current = userPosition;
  }, [userPosition]);

  const clearLocationAttempt = useCallback(() => {
    if (watchIdRef.current != null && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchWindowTimerRef.current != null) {
      window.clearTimeout(watchWindowTimerRef.current);
      watchWindowTimerRef.current = null;
    }
    if (fastAcceptTimerRef.current != null) {
      window.clearTimeout(fastAcceptTimerRef.current);
      fastAcceptTimerRef.current = null;
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator?.geolocation) {
      setUserPosition(null);
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by this browser.");
      setLocationWarning("");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setUserPosition(null);
      setLocationStatus("error");
      setLocationError("Location requires a secure context (HTTPS).");
      setLocationWarning("");
      logLocation("unsupported_context", {
        isSecureContext: window.isSecureContext,
        hostname: window.location.hostname,
      });
      return;
    }

    clearLocationAttempt();

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    autoLocateAttemptedRef.current = true;
    bestReadingRef.current = null;
    acceptedReadingRef.current = null;
    lastErrorRef.current = null;

    setLocationRequestVersion((value) => value + 1);
    setLocationError("");
    setLocationWarning("");
    setLocationStatus(normalizePoint(userPositionRef.current) ? "granted" : "locating");

    logLocation("request_started", {
      requestId,
      strategy: "getCurrentPosition+watchPosition",
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: LOCATION_REQUEST_TIMEOUT_MS,
    });

    const finalizeRequest = (reason) => {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      clearLocationAttempt();

      const bestReading = bestReadingRef.current;
      const acceptedReading = acceptedReadingRef.current;
      const chosenReading = acceptedReading || bestReading;

      if (chosenReading) {
        setUserPosition(chosenReading);
        setLocationStatus("granted");
        setLocationError("");
        setLocationWarning(buildLocationWarning(chosenReading));
        acceptedReadingRef.current = chosenReading;
        logLocation("request_finalized", {
          requestId,
          reason,
          lat: chosenReading.lat,
          lng: chosenReading.lng,
          accuracy: chosenReading.accuracy,
          timestamp: chosenReading.timestamp,
          accepted: true,
        });
        return;
      }

      const mappedError = mapGeolocationError(lastErrorRef.current);
      setUserPosition(null);
      setLocationStatus(lastErrorRef.current?.code === GEOLOCATION_PERMISSION_DENIED ? "denied" : "error");
      setLocationError(mappedError);
      setLocationWarning("");
      logLocation("request_failed", {
        requestId,
        reason,
        error: mappedError,
        code: lastErrorRef.current?.code || null,
      });
    };

    const maybeAcceptReading = (reading, source) => {
      const ageMs = Math.max(0, Date.now() - reading.timestamp);
      const isStale = ageMs > LOCATION_STALE_READING_MS;

      if (isStale) {
        logLocation("reading_rejected", {
          requestId,
          source,
          reason: "stale",
          lat: reading.lat,
          lng: reading.lng,
          accuracy: reading.accuracy,
          timestamp: reading.timestamp,
          ageMs,
        });
        if (!bestReadingRef.current) {
          bestReadingRef.current = reading;
        }
        return;
      }

      if (isBetterLocation(reading, bestReadingRef.current)) {
        bestReadingRef.current = reading;
      }

      const currentAccepted = acceptedReadingRef.current;
      const shouldAccept =
        !currentAccepted ||
        (toFiniteNumber(reading.accuracy) != null &&
          toFiniteNumber(reading.accuracy) <= LOCATION_GOOD_ACCURACY_M) ||
        isBetterLocation(reading, currentAccepted);

      logLocation(shouldAccept ? "reading_accepted" : "reading_buffered", {
        requestId,
        source,
        lat: reading.lat,
        lng: reading.lng,
        accuracy: reading.accuracy,
        timestamp: reading.timestamp,
        ageMs,
      });

      if (!shouldAccept) {
        return;
      }

      acceptedReadingRef.current = reading;
      setUserPosition((prev) => {
        if (
          prev &&
          Math.abs(prev.lat - reading.lat) < 0.00001 &&
          Math.abs(prev.lng - reading.lng) < 0.00001 &&
          Math.abs((prev.accuracy ?? Infinity) - (reading.accuracy ?? Infinity)) < 5
        ) {
          return prev;
        }
        return reading;
      });
      setLocationStatus("granted");
      setLocationError("");
      setLocationWarning(buildLocationWarning(reading));

      if (toFiniteNumber(reading.accuracy) != null && reading.accuracy <= LOCATION_GOOD_ACCURACY_M) {
        finalizeRequest("good_accuracy_fix");
      }
    };

    const handleSuccess = (position, source) => {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      const reading = normalizeLocationReading(position);
      if (!reading) {
        logLocation("reading_rejected", {
          requestId,
          source,
          reason: "invalid_payload",
        });
        return;
      }

      maybeAcceptReading(reading, source);
    };

    const handleError = (err, source) => {
      if (requestSequenceRef.current !== requestId) {
        return;
      }

      lastErrorRef.current = err;
      logLocation("error", {
        requestId,
        source,
        code: err?.code || null,
        message: err?.message || "unknown_error",
      });

      if (err?.code === GEOLOCATION_PERMISSION_DENIED) {
        finalizeRequest("permission_denied");
      }
    };

    fastAcceptTimerRef.current = window.setTimeout(() => {
      if (requestSequenceRef.current !== requestId || acceptedReadingRef.current || !bestReadingRef.current) {
        return;
      }
      acceptedReadingRef.current = bestReadingRef.current;
      setUserPosition(bestReadingRef.current);
      setLocationStatus("granted");
      setLocationError("");
      setLocationWarning(buildLocationWarning(bestReadingRef.current));
      logLocation("fast_accept_best", {
        requestId,
        lat: bestReadingRef.current.lat,
        lng: bestReadingRef.current.lng,
        accuracy: bestReadingRef.current.accuracy,
        timestamp: bestReadingRef.current.timestamp,
      });
    }, LOCATION_FAST_ACCEPT_MS);

    watchWindowTimerRef.current = window.setTimeout(() => {
      finalizeRequest("watch_window_complete");
    }, LOCATION_WATCH_WINDOW_MS);

    const options = {
      enableHighAccuracy: true,
      timeout: LOCATION_REQUEST_TIMEOUT_MS,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => handleSuccess(position, "getCurrentPosition"),
      (err) => handleError(err, "getCurrentPosition"),
      options,
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handleSuccess(position, "watchPosition"),
      (err) => handleError(err, "watchPosition"),
      options,
    );
  }, [clearLocationAttempt]);

  useEffect(() => {
    if (!navigator?.geolocation) {
      setUserPosition(null);
      setLocationStatus("error");
      setLocationError("Geolocation is not supported by this browser.");
      setLocationWarning("");
      return undefined;
    }

    if (!navigator?.permissions?.query) {
      setLocationStatus("unknown");
      setLocationError("Enable location to load SIARA predictions.");
      return undefined;
    }

    let cancelled = false;
    let permissionStatus = null;
    const applyPermissionState = (state) => {
      if (cancelled) return;
      logLocation("permission_state", { state });
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
        setLocationError("Enable location to load SIARA predictions.");
        setLocationWarning("");
        return;
      }
      if (state === "denied") {
        autoLocateAttemptedRef.current = false;
        setUserPosition(null);
        setLocationStatus("denied");
        setLocationError("Location permission is blocked. Enable it in browser settings.");
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
        setLocationError("Enable location to load SIARA predictions.");
        setLocationWarning("");
      });

    return () => {
      cancelled = true;
      clearLocationAttempt();
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [clearLocationAttempt, requestLocation]);

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
        setWeatherError(weatherResult.reason?.message || "Meteo indisponible.");
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
        setForecastError(forecastResult.reason?.message || "Forecast indisponible.");
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
    ? "Position requise"
    : weatherLoading && !weatherData
    ? "Chargement meteo..."
    : weatherError
      ? "Meteo indisponible"
      : weatherData?.condition || "Meteo";
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
   * Triggers location flow based on permission state.
   */
  const handleLocateUser = () => {
    requestLocation();
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
      <DrivingQuiz onComplete={handleQuizComplete} forceShow={showQuiz} />

      {/* ═══════════════ TOP NAVIGATION BAR ═══════════════ */}
      <header className="siara-dashboard-header">
        <div className="dash-header-inner">

          {/* ── Left: Logo + Tab navigation ── */}
          <div className="dash-header-left">
            <div className="dash-logo-block" onClick={() => navigate("/home")} style={{ cursor: 'pointer' }}>
              <img src={siaraLogo} alt="SIARA" className="header-logo" />
            </div>

            <nav className="dash-header-tabs">
              <button className="dash-tab" onClick={() => navigate("/news")}>Feed</button>
              <button className="dash-tab dash-tab-active">Map</button>
              <button className="dash-tab" onClick={() => navigate("/alerts")}>Alerts</button>
              <button className="dash-tab" onClick={() => navigate('/report')}>Report</button>
              <button className="dash-tab" onClick={() => navigate("/dashboard")}>Dashboard</button>
              <button className="dash-tab" onClick={() => navigate('/predictions')}>Predictions</button>
            </nav>
          </div>

          {/* ── Center: Search bar ── */}
          <div className="dash-header-center">
            <input
              type="search"
              className="dash-search"
              placeholder="Search for an incident, a road, a wilaya…"
              aria-label="Search"
            />
          </div>

          {/* ── Right: Notification, messages & avatar dropdown ── */}
          <div className="dash-header-right">
            <button
              className="dash-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              🔔<span className="notification-badge"></span>
            </button>

            <button className="dash-icon-btn" aria-label="Messages">💬</button>

            {/* Avatar with dropdown menu */}
            <div className="dash-avatar-wrapper">
              <button
                className="dash-avatar"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User profile"
              >
                {user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </button>

              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/profile"); }}>
                    👤 My Profile
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowDropdown(false); navigate("/settings"); }}
                  >
                    ⚙️ Settings
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/notifications"); }}>
                    🔔 Notifications
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home'); }}>🚪 Log Out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN THREE-COLUMN LAYOUT ═══════════════ */}
      <div className="map-content">

        {/* ═══════════ LEFT SIDEBAR — Profile, Nav, Filters & Actions ═══════════ */}
        <aside className="map-sidebar-left">

          {/* ── Profile card ── */}
          <div className="card profile-summary">
            <div className="profile-avatar-container">
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large" />
              <span className="verified-badge">✓</span>
            </div>
            <div className="profile-info">
              <p className="profile-name">Zitouni Mohamed</p>
              <span className="role-badge role-citoyen">Citizen</span>
              <p className="profile-bio">Active contributor for safer roads in Algeria 🇩🇿</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* ── Navigation menu ── */}
          <nav className="card nav-menu">
            <div className="nav-section-label">NAVIGATION</div>
            <button className="nav-item" onClick={() => navigate('/news')}><span className="nav-accent"></span><span className="nav-icon">📰</span><span className="nav-label">Feed</span></button>
            <button className="nav-item nav-item-active"><span className="nav-accent"></span><span className="nav-icon">🗺️</span><span className="nav-label">Map</span></button>
            <button className="nav-item" onClick={() => navigate('/alerts')}><span className="nav-accent"></span><span className="nav-icon">🚨</span><span className="nav-label">Alerts</span></button>
            <button className="nav-item" onClick={() => navigate('/dashboard')}><span className="nav-accent"></span><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></button>
            <button className="nav-item" onClick={() => navigate('/predictions')}><span className="nav-accent"></span><span className="nav-icon">🔮</span><span className="nav-label">Predictions</span></button>
            <div className="nav-section-label">TOOLS</div>
            <button className="nav-item" onClick={() => setShowQuiz(true)}><span className="nav-accent"></span><span className="nav-icon">🚗</span><span className="nav-label">Driver Quiz</span></button>
            <button className="nav-item" onClick={() => navigate('/report')}><span className="nav-accent"></span><span className="nav-icon">📝</span><span className="nav-label">Report</span></button>
            <button className="nav-item" onClick={() => navigate('/settings')}><span className="nav-accent"></span><span className="nav-icon">⚙️</span><span className="nav-label">Settings</span></button>
          </nav>

          {/* ── Filter panel ── */}
          <div className="card filters-section">
            <div className="section-header">
              <h3>Filters</h3>
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

            {/* Severity filter chips */}
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
                  <span className="map-ctrl-label">Exit Full Map</span>
                </button>
              ) : (
                <button className="map-ctrl-btn" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
                  <FullscreenTwoToneIcon className="btn-icon" />
                  <span className="map-ctrl-label">Full Map</span>
                </button>
              )}

              {/* Geolocate user and center the map on their position */}
              <button className="map-ctrl-btn" title="My location" onClick={handleLocateUser}>
                <LocationOnTwoToneIcon className="btn-icon" />
                <span className="map-ctrl-label">My Location</span>
              </button>
            </div>

            {/* ── Map canvas — renders the SiaraMap component ── */}
            <div className="map-canvas">
              <SiaraMap
                mockMarkers={mockMarkers}
                mapLayer={mapLayer}
                setSelectedIncident={setSelectedIncident}
                userPosition={userPosition}
                locationStatus={locationStatus}
                locationError={locationError}
                locationWarning={locationWarning}
                locationRequestVersion={locationRequestVersion}
                requestLocation={requestLocation}
                onSelectedTimestampChange={setSelectedTimestampIso}
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
            <div className="weather-icon">{weatherIcon}</div>
            <div className="weather-info">

              <span className="weather-temp">{weatherTempText}</span>
              <span className="weather-desc">{weatherDescText}</span>
              {weatherUpdating && (
                <span className="weather-detail weather-detail-muted">Updating weather...</span>
              )}
              <span className="weather-detail">
                {hasGrantedLocation && contextPoint
                  ? `Visibilite: ${visibilityText} • Vent: ${windText}${windDirectionText}`
                  : "Activez votre position pour charger la meteo"}
              </span>
              <span className="weather-detail weather-detail-muted">
                Humidite: {humidityText} • Pression: {pressureText}
              </span>

            </div>
          </div>

          <div className="context-section danger-forecast-section">
            <h4 className="section-title">Danger - next 24h</h4>
            <DangerForecastChart
              points={forecastPoints}
              loading={forecastLoading && forecastPoints.length === 0}
            />
            {forecastRefreshing && forecastPoints.length > 0 && (
              <p className="chart-note">Updating forecast...</p>
            )}
            {forecastError && (
              <p className="chart-note chart-note-error">{forecastError}</p>
            )}
            {!forecastLoading && !forecastError && forecastPoints.length === 0 && (
              <p className="chart-note">Aucune prevision disponible.</p>
            )}
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
