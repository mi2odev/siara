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
import DrivingQuiz from "../../components/ui/DrivingQuiz";
import { normalizeReportType } from "../../components/map/reportTypeMeta";
import useReportMapReports from "../../hooks/useReportMapReports";
import useLiveLocation from "../../hooks/useLiveLocation";
import { fetchAlerts } from "../../services/alertService";

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
      (locationStatus === "granted" || locationStatus === "fallback") &&
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

  const requestLocation = useCallback(() => {
    autoLocateAttemptedRef.current = true;
    setLocationRequestVersion((value) => value + 1);
    setLocationError("");
    setLocationWarning("");
    setLocationStatus(normalizePoint(userPositionRef.current) ? "granted" : "locating");
    startLiveLocationTracking();
  }, [startLiveLocationTracking]);

  useEffect(() => {
    if (!liveLocation) return;
    setUserPosition(liveLocation);
    if (liveLocation.isFallback) {
      // Keep weather/place lookups working off fallback coords, but flag it.
      setLocationStatus("fallback");
      setLocationWarning(
        "Using fallback test location because GPS is unavailable."
      );
      return;
    }
    setLocationStatus("granted");
    setLocationError("");
    setLocationWarning(buildLocationWarning(liveLocation));
  }, [liveLocation]);

  useEffect(() => {
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
      setLocationError("Location permission is blocked. Enable it in browser settings.");
      setLocationWarning("");
      return;
    }

    if (["unsupported", "insecure", "unavailable", "timeout", "error"].includes(liveLocationStatus)) {
      setLocationStatus("error");
      setLocationError(mapLiveLocationError(liveLocationError, liveLocationStatus));
      setLocationWarning("");
    }
  }, [liveLocationError, liveLocationStatus]);

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
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [requestLocation]);

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
    { id: "accident", label: "Accident", icon: <CarCrashOutlinedIcon fontSize="inherit" className="icon-danger" /> },
    { id: "traffic", label: "Traffic", icon: <TrafficOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    { id: "danger", label: "Danger", icon: <LocalFireDepartmentOutlinedIcon fontSize="inherit" className="icon-fire" /> },
    { id: "weather", label: "Weather", icon: <WaterDropOutlinedIcon fontSize="inherit" className="icon-info" /> },
    { id: "roadworks", label: "Roadworks", icon: <ConstructionOutlinedIcon fontSize="inherit" className="icon-warning" /> },
    { id: "other", label: "Other", icon: <HelpOutlineOutlinedIcon fontSize="inherit" className="icon-muted" /> },
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
            <NotificationBell />


            {/* Avatar with dropdown menu */}
            <div className="dash-avatar-wrapper">
              <button
                className={`dash-avatar ${userAvatarUrl ? 'has-image' : ''}`}
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="User profile"
              >
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User avatar" className="dash-avatar-image" loading="lazy" />
                ) : profileInitials}
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
              <img src={profileAvatarUrl} alt="Profile" className="profile-avatar-large map-profile-avatar-large" loading="lazy" />            </div>
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
              <FancySelect
                value={selectedWilaya}
                onChange={setSelectedWilaya}
                menuAlign="left"
                options={[
                  { value: 'all', label: 'All provinces' },
                  ...wilayas.map((w) => ({ value: w, label: w })),
                ]}
              />
            </div>
          </div>

          {/* Report-incident CTA pinned at sidebar bottom */}
          <div className="sidebar-action">
            <button className="btn-signal" onClick={() => navigate("/report")}>
              <AddRoundedIcon fontSize="inherit" /> Report an Incident
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

          <div className="map-container" style={fullscreenInnerStyle}>

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
              {liveLocationIsFallback ? (
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
                  <span className="cw-cell-lbl">Visibility</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{windText}{windDirectionText && <span className="cw-dir"> {windDirectionText}</span>}</span>
                  <span className="cw-cell-lbl">Wind</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{humidityText}</span>
                  <span className="cw-cell-lbl">Humidity</span>
                </div>
                <div className="cw-cell">
                  <span className="cw-cell-val">{pressureText}</span>
                  <span className="cw-cell-lbl">Pressure</span>
                </div>
              </div>
            ) : (
              <p className="cw-no-loc">Enable location for live weather</p>
            )}
            {weatherUpdating && <p className="cw-updating">Refreshing…</p>}
          </div>

          {/* CURRENT RISK panel — portaled here from SiaraMap when not in full-map mode */}
          <div ref={setRiskPanelHost} className="context-risk-slot" />

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
                    <FiberManualRecordIcon fontSize="inherit" className={`icon-severity-${zone.severity === "high" ? "high" : zone.severity === "medium" ? "medium" : "low"}`} />
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
                  <span className="map-alert-icon"><NotificationsActiveOutlinedIcon fontSize="inherit" /></span>
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
