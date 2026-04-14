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
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from '../../contexts/AuthContext';
import PoliceModeTab from '../../components/layout/PoliceModeTab'
import FeedSidebarNav from '../../components/layout/FeedSidebarNav'
import GlobalHeaderSearch from '../../components/search/GlobalHeaderSearch'
import { getUserRoles } from '../../utils/roleUtils'

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
import useReportMapReports from "../../hooks/useReportMapReports";
import { fetchAlerts } from "../../services/alertService";

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
const SEVERITY_SCORES = {
  low: 1,
  medium: 2,
  high: 3,
};

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

function renderHeaderIcon(type) {
  if (type === "notification") return "🔔";
  return "💬";
}

function renderNavIcon(type) {
  if (type === "home") return "🏠";
  if (type === "feed") return "📰";
  if (type === "report") return "📝";
  if (type === "map") return "🗺️";
  if (type === "quiz") return "🚗";
  if (type === "stats") return "📊";
  if (type === "alerts") return "🚨";
  if (type === "settings") return "⚙️";
  return "📍";
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

function formatRelativeReportAge(value) {
  const timestamp = new Date(value || "");
  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} d`;
}

function formatZoneLastTriggered(value) {
  if (!value) {
    return "Never triggered";
  }

  const relativeAge = formatRelativeReportAge(value);
  return relativeAge === "Unknown" ? relativeAge : `${relativeAge} ago`;
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

  /* ──────────────────────────── State ──────────────────────────── */

  // Controls the visibility of the user-profile dropdown in the header
  const [showDropdown, setShowDropdown] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");

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

  // Current map visualisation layer (points, heatmap, zones, ai, nearbyRoads)
  const [mapLayer, setMapLayer] = useState(() =>
    location.state?.mapLayer === "zones" ? "zones" : "points"
  );
  const [alertZones, setAlertZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState(() => location.state?.focusAlertId || null);

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
    () => locationStatus === "granted" && normalizePoint(userPosition) != null,
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
  const watchIdRef = useRef(null);
  const watchWindowTimerRef = useRef(null);
  const fastAcceptTimerRef = useRef(null);
  const bestReadingRef = useRef(null);
  const acceptedReadingRef = useRef(null);
  const requestSequenceRef = useRef(0);
  const lastErrorRef = useRef(null);
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
      || (isResolvingPlace ? "Resolving neighborhood..." : "Current location")
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
      || "Unknown place"
    );

  /* ──────────────────────── Report Data & Derived UI Data ──────────────────────── */

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

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const severity = normalizeSeverityLevel(report?.severity);
        const reportType = String(report?.incidentType || report?.type || "").trim().toLowerCase();
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
      setZonesError("Sign in to load your alert zones.");
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

        setZonesError(error.response?.data?.message || "Unable to load alert zones.");
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
      const zoneName = String(report?.locationLabel || "Reported area").trim() || "Reported area";
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
        updated: formatRelativeReportAge(zone.updatedAt),
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
          title: alert.name || alert.zone?.displayName || alert.area?.name || "Alert",
          time: formatZoneLastTriggered(alert.lastTriggeredAt),
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
    if (mapLayer === "zones") {
      if (zonesLoading) {
        return "Loading alert zones...";
      }

      if (zonesError) {
        return "Alert zones unavailable";
      }

      return `Alert zones • ${activeAlertZones.length} zones loaded`;
    }

    if (reportsLoading) {
      return "Loading real-time reports...";
    }

    if (reportsError) {
      return "Real-time reports unavailable";
    }

    return `Real-time • ${visibleReportMarkers.length} incidents displayed`;
  }, [activeAlertZones.length, mapLayer, reportsError, reportsLoading, visibleReportMarkers.length, zonesError, zonesLoading]);

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
  const profileInitials = profileName
    ? profileName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "U";

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
              <PoliceModeTab user={user} />
            </nav>
          </div>

          {/* ── Center: Search bar ── */}
          <div className="dash-header-center">
            <GlobalHeaderSearch
              navigate={navigate}
              query={headerSearchQuery}
              setQuery={setHeaderSearchQuery}
              placeholder="Search for an incident, a road, a wilaya…"
              ariaLabel="Search"
              currentUser={user}
            />
          </div>

          {/* ── Right: Notification, messages & avatar dropdown ── */}
          <div className="dash-header-right">
            <button
              className="dash-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              {renderHeaderIcon("notification")}<span className="notification-badge"></span>
            </button>

            <button className="dash-icon-btn" aria-label="Messages">{renderHeaderIcon("message")}</button>

            {/* Avatar with dropdown menu */}
            <div className="dash-avatar-wrapper">
              <button
                className="dash-avatar"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User profile"
              >
                {profileInitials}
              </button>

              {showDropdown && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/profile"); }}>
                    My Profile
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowDropdown(false); navigate("/settings"); }}
                  >
                    Settings
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowDropdown(false); navigate("/notifications"); }}>
                    Notifications
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/home'); }}>Log Out</button>
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
              <img src={profileAvatar} alt="Profile" className="profile-avatar-large map-profile-avatar-large" />
              <span className="verified-badge map-profile-verified-badge">V</span>
            </div>
            <div className="profile-info map-profile-info">
              <p className="profile-name map-profile-name">{profileName}</p>
              <span className={`role-badge ${roleClass}`}>{roleLabel}</span>
              <p className="profile-bio">Browse live road reports and share updates from the field.</p>
              <button className="profile-view-link" onClick={() => navigate('/profile')}>View Profile</button>
            </div>
          </div>

          {/* ── Navigation menu ── */}
          <FeedSidebarNav activeKey="map" onOpenQuiz={() => setShowQuiz(true)} />

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
                  { id: "zones", label: "Zones" },
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
                reportMarkers={visibleReportMarkers}
                alertZones={activeAlertZones}
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
                onSelectedTimestampChange={setSelectedTimestampIso}
              />
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

          {/* ── Current weather widget ── */}
          <div className="context-weather">
            <div className="weather-icon">{weatherIcon}</div>
            <div className="weather-info">

              <span className="weather-temp">{weatherTempText}</span>
              <span className="weather-hour">Current hour: {currentHourText}</span>
              <span className="weather-place">Current place: {weatherPlaceText}</span>
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

          <div className="context-section">
            <h4 className="section-title">{mapLayer === "zones" ? "Alert Zones" : "Reports Feed"}</h4>
            {mapLayer === "zones" ? (
              zonesLoading ? (
                <p className="chart-note">Loading your alert zones from the database...</p>
              ) : zonesError ? (
                <p className="chart-note chart-note-error">{zonesError}</p>
              ) : (
                <p className="chart-note">
                  {activeAlertZones.length} active alert zones are ready to render on the map.
                </p>
              )
            ) : reportsLoading ? (
              <p className="chart-note">Loading reports from the database...</p>
            ) : reportsError ? (
              <p className="chart-note chart-note-error">{reportsError}</p>
            ) : (
              <p className="chart-note">
                {visibleReportMarkers.length} mapped reports match the current filters.
              </p>
            )}
          </div>

          {mapLayer === "zones" && (
            <div className="context-section zone-focus-section">
              <div className="zones-section-head">
                <h4 className="section-title">Selected Zone</h4>
                <button
                  type="button"
                  className="zone-link-btn"
                  onClick={() => navigate('/alerts')}
                >
                  Manage alerts
                </button>
              </div>
              {selectedAlertZone ? (
                <div className={`zone-focus-card severity-${selectedAlertZone.severity}`}>
                  <span className="zone-focus-name">{selectedAlertZone.name}</span>
                  <span className="zone-focus-area">
                    {selectedAlertZone.zone?.displayName || selectedAlertZone.area?.name || 'Zone'}
                  </span>
                  <div className="zone-focus-meta">
                    <span>{selectedAlertZone.severity} severity</span>
                    <span>{selectedAlertZone.timeWindow}</span>
                  </div>
                  <div className="zone-focus-meta">
                    <span>{selectedAlertZone.triggerCount} triggers</span>
                    <span>{formatZoneLastTriggered(selectedAlertZone.lastTriggeredAt)}</span>
                  </div>
                </div>
              ) : (
                <p className="chart-note">Select a zone on the map to inspect its alert rule.</p>
              )}
            </div>
          )}

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
                <span className={`legend-dot ${mapLayer === "zones" ? "zone-low" : "low"}`}></span>
                <span>Low Severity</span>
              </div>
              {mapLayer === "zones" && (
                <p className="chart-note">Zones reflect your alert rule severity and schedule.</p>
              )}
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
            <div className="zones-section-head">
              <h4 className="section-title">{mapLayer === "zones" ? "Zone Rules" : "Areas to Watch"}</h4>
              {mapLayer === "zones" ? (
                <button
                  type="button"
                  className="zone-link-btn"
                  onClick={() => navigate('/alerts')}
                >
                  Open alerts
                </button>
              ) : null}
            </div>
            <div className="trending-zones">
              {mapLayer === "zones" ? (
                zonesLoading ? (
                  <p className="chart-note">Loading active alert zones...</p>
                ) : zonesError ? (
                  <p className="chart-note chart-note-error">{zonesError}</p>
                ) : activeAlertZones.length === 0 ? (
                  <p className="chart-note">No active alert zones yet.</p>
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
                          {alert.timeWindow} • {alert.triggerCount} triggers
                        </span>
                        <span className="zone-meta zone-meta-secondary">
                          {formatZoneLastTriggered(alert.lastTriggeredAt)}
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
                <p className="chart-note">No report clusters match the current filters.</p>
              )}
              {mapLayer !== "zones" && trendingZones.map((zone) => (
                <div key={zone.name} className="zone-item">
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
              {activeAlerts.length === 0 && (
                <p className="chart-note">No active alerts right now.</p>
              )}
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="map-alert-item">
                  <span className="map-alert-icon">🚨</span>
                  <div className="map-alert-info">
                    <span className="map-alert-title">{alert.title}</span>
                    <span className="map-alert-time">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-manage-alerts" onClick={() => navigate('/alerts')}>Manage My Alerts</button>
          </div>

          {/* ── Quick statistics summary ── */}
          <div className="context-section">
            <h4 className="section-title">Statistics</h4>
            <div className="quick-stats">
              <div className="map-stat-item">
                <span className="map-stat-value">{statsTodayCount}</span>
                <span className="map-stat-label">Today</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">{averageSeverityLabel}</span>
                <span className="map-stat-label">Avg. Severity</span>
              </div>
              <div className="map-stat-item">
                <span className="map-stat-value">{verifiedRateLabel}</span>
                <span className="map-stat-label">Verified</span>
              </div>
            </div>
          </div>

        </aside>
      </div>

      
    </div>
  );
}
