import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FancySelect from "../ui/FancySelect";
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Pane,
  Popup,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import IconButton from "@mui/material/IconButton";
import MuiTooltip from "@mui/material/Tooltip";
import ReportMapMarker from "./ReportMapMarker";
import MapDestinationConfirmCard from "./MapDestinationConfirmCard";
import MapLibreNavigationView from "./MapLibreNavigationView";
import AccidentHeatClusterMarker from "./AccidentHeatClusterMarker";
import RouteExplanationCard from "./RouteExplanationCard";
import RouteComparisonPanel from "./RouteComparisonPanel";
import BestTimeToLeavePanel from "./BestTimeToLeavePanel";
import HeatmapClusterDetailPanel from "./HeatmapClusterDetailPanel";
import { HEATMAP_LEGEND_COLORS } from "./heatmapVisuals";
import { explainRoute } from "../../services/riskExplanationService";
import "../../styles/AccidentHeatmap.css";
import "../../styles/MapDestinationConfirmCard.css";
import "../../styles/Navigation.css";

// Hybrid map architecture: the normal SIARA map stays Leaflet (this file).
// When the user starts travel guidance, the map area is replaced by
// MapLibreNavigationView which renders a tilted/pitched MapLibre GL map for
// GPS-style navigation. The two engines never run simultaneously — Leaflet
// unmounts while the MapLibre view is shown and vice versa, so existing
// Leaflet markers / overlays are unaffected.

const USER_ZOOM = 15;
const ALGERIA_FALLBACK_CENTER = [28.0339, 1.6596];
const NEARBY_RADIUS_KM = 25;
const NEARBY_MAX_DESTINATIONS = 4;
const ROUTE_SAMPLE_COUNT = 8;
const UI_CLOCK_REFRESH_MS = 1000;
const PREDICTION_REFRESH_MS = 30 * 1000;
// Coalesce current-risk and nearby-roads requests onto a 5-minute timestamp
// bucket. Tiny clock drift / GPS jitter must not produce N duplicate calls.
const CURRENT_RISK_TIMESTAMP_BUCKET_MS = 5 * 60 * 1000;
const CURRENT_RISK_REFRESH_INTERVAL_MS = 30 * 1000;
const NEARBY_MOVEMENT_THRESHOLD_M = 100;
// (Previous GUIDANCE_REFRESH_MS removed — guided route is no longer
// re-fetched on a timer. Route updates are user-initiated only.)
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV;

const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const lat1 = Number(a[0]);
  const lng1 = Number(a[1]);
  const lat2 = Number(b[0]);
  const lng2 = Number(b[1]);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

const timestampBucket = (timestampIso, bucketMs = CURRENT_RISK_TIMESTAMP_BUCKET_MS) => {
  const ms = Date.parse(timestampIso || "");
  if (!Number.isFinite(ms)) return "now";
  return Math.floor(ms / bucketMs);
};

const occurrenceRiskColor = (level) => {
  if (level === "high") return "#b91c1c";
  if (level === "medium") return "#d97706";
  return "#15803d";
};

const occurrenceRiskLabel = (level) => {
  if (!level) return "n/a";
  return level.charAt(0).toUpperCase() + level.slice(1);
};

// Human-readable labels for occurrence_beta_v1 feature names. The trained
// model and SHAP fallback both surface raw column names like
// "num__past_segment_hourofweek_count" which mean nothing to a driver.
// Mapping is matched after stripping the sklearn preprocessor prefix
// ("num__", "cat__", "binary__") so the underlying column name is what we
// key on.
const OCCURRENCE_FEATURE_LABELS = {
  past_segment_hourofweek_count: "Previous accidents on this segment at similar hours",
  past_road_class_positive_count: "Historical risk for this road type",
  past_segment_positive_count: "Previous accidents on this road segment",
  past_segment_positive_count_7d: "Accidents on this segment in the last 7 days",
  past_segment_positive_count_30d: "Accidents on this segment in the last 30 days",
  hour: "Current hour",
  hour_of_week: "Hour-of-week pattern",
  weekday: "Day of week",
  month: "Month of year",
  is_night: "Night-time condition",
  is_weekend: "Weekend condition",
  road_class: "Road type",
  segment_length_m: "Segment length",
  oneway: "One-way road",
  bridge: "Bridge",
  tunnel: "Tunnel",
  weather_temp: "Temperature",
  weather_rhum: "Humidity",
  weather_prcp: "Precipitation",
  weather_pres: "Air pressure",
  weather_wspd: "Wind speed",
  weather_wdir: "Wind direction",
  weather_dwpt: "Dew point",
};

const FEATURE_PREFIX_STRIP = /^(num__|cat__|binary__|bool__|raw__)/;

function stripFeaturePrefix(featureName) {
  return String(featureName || "").replace(FEATURE_PREFIX_STRIP, "");
}

function humanizeOccurrenceFeature(featureName) {
  const stripped = stripFeaturePrefix(featureName);
  if (OCCURRENCE_FEATURE_LABELS[stripped]) return OCCURRENCE_FEATURE_LABELS[stripped];
  if (!stripped) return "Unknown factor";
  return stripped
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatOccurrenceFactorValue(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toFixed(2);
  }
  return String(value);
}
const TIME_PRESET_OPTIONS = [
  { value: "0", label: "Now" },
  { value: String(5 * 60 * 1000), label: "+5 min" },
  { value: String(15 * 60 * 1000), label: "+15 min" },
  { value: String(60 * 60 * 1000), label: "+1h" },
  { value: String(3 * 60 * 60 * 1000), label: "+3h" },
  { value: String(6 * 60 * 60 * 1000), label: "+6h" },
  { value: "custom", label: "Custom" },
];
const GUIDED_ROUTE_ORDER = ["fastest", "safest", "balanced"];
const GUIDED_ROUTE_META = {
  fastest: {
    label: "Fastest",
    color: "#2563eb",
    inactiveDashArray: "18 10",
  },
  safest: {
    label: "Safest",
    color: "#16a34a",
    inactiveDashArray: "8 10",
  },
  balanced: {
    label: "Balanced",
    color: "#f97316",
    inactiveDashArray: "3 10",
  },
};
const INACTIVE_GUIDED_ROUTE_COLOR = "#9ca3af";
const BALANCED_DURATION_WEIGHT = 0.55;
const BALANCED_DANGER_WEIGHT = 0.45;

const postJson = async (url, body, options = {}) => {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const getJson = async (url) => {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(fullUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

const normalizePosition = (pos) => {
  if (!pos) return null;
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

const getIncidentColor = (sev) => {
  if (sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#22c55e";
}

const getAlertZoneColor = (severity) => {
  if (severity === "high") return "#dc2626";
  if (severity === "medium") return "#f59e0b";
  return "#7c3aed";
};

const getAlertZonePathOptions = (severity, isSelected) => {
  const color = getAlertZoneColor(severity);
  return {
    color,
    weight: isSelected ? 4 : 2.5,
    opacity: isSelected ? 0.95 : 0.78,
    fillColor: color,
    fillOpacity: isSelected ? 0.16 : 0.09,
  };
};

const normalizeAlertZoneGeometry = (alertZone) => {
  if (!alertZone?.zone?.geometry || typeof alertZone.zone.geometry !== "object") {
    return null;
  }

  return alertZone.zone.geometry;
};

const normalizeAlertZoneCenter = (alertZone) => {
  const source = alertZone?.zone?.center || alertZone?.area?.center || null;
  return normalizePosition(source);
};

const getDangerColor = (level) => {
  // Accept any casing — the multiclass model emits Low/Medium/High, while
  // normalizeDangerLevel() returns lowercase. "moderate" maps to the medium hue.
  const text = String(level || "").trim().toLowerCase();
  if (text === "unknown") return "#64748b";
  if (text === "high" || text === "extreme") return "#b91c1c";
  if (text === "medium" || text === "moderate") return "#f59e0b";
  return "#22c55e";
}

const getContrastTextColor = (bgColor) => {
  return bgColor === getDangerColor("low") ? "#111827" : "#ffffff";
}

const normalizeDangerLevel = (level, dangerPercent = null) => {
  const text = String(level || "").trim().toLowerCase();
  if (text === "unknown" || text === "unavailable") return "unknown";
  if (text === "high" || text === "medium" || text === "low") {
    return text;
  }

  const percent = Number(dangerPercent);
  if (!Number.isFinite(percent)) return "low";
  if (percent < 25) return "low";
  if (percent < 50) return "medium";
  return "high";
}

const getSegmentPath = (marker) => {
  const path = marker?.path || marker?.segment || marker?.coords;
  if (!Array.isArray(path)) return null;

  const normalized = path
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        const lat = Number(p[0]);
        const lng = Number(p[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      }
      if (p && typeof p === "object") {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      }
      return null;
    })
    .filter(Boolean);

  return normalized.length >= 2 ? normalized : null;
}

const haversineDistanceKm = (start, end) => {
  const from = Array.isArray(start) ? start : null;
  const to = Array.isArray(end) ? end : null;
  if (!from || !to || from.length < 2 || to.length < 2) {
    return 0;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(Number(to[0]) - Number(from[0]));
  const dLng = toRadians(Number(to[1]) - Number(from[1]));
  const lat1 = toRadians(Number(from[0]));
  const lat2 = toRadians(Number(to[0]));
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const calculatePathDistanceKm = (path) => {
  const normalizedPath = getSegmentPath({ path });
  if (!normalizedPath || normalizedPath.length < 2) {
    return 0;
  }

  let totalDistanceKm = 0;
  for (let index = 1; index < normalizedPath.length; index += 1) {
    totalDistanceKm += haversineDistanceKm(normalizedPath[index - 1], normalizedPath[index]);
  }
  return totalDistanceKm;
};

const calculateWeightedDangerScore = (route) => {
  if (
    route?.riskAvailable === false ||
    route?.risk_available === false ||
    route?.summary?.riskAvailable === false ||
    route?.summary?.risk_available === false
  ) {
    return 100;
  }

  const segments = Array.isArray(route?.segments) ? route.segments : [];
  let weightedDangerSum = 0;
  let totalLengthKm = 0;

  for (const segment of segments) {
    const segmentPath = getSegmentPath({ path: segment?.path });
    const segmentLengthKm = calculatePathDistanceKm(segmentPath);
    const segmentDanger = Number(segment?.danger_percent);
    if (!segmentPath || segmentLengthKm <= 0 || !Number.isFinite(segmentDanger)) {
      continue;
    }

    weightedDangerSum += segmentDanger * segmentLengthKm;
    totalLengthKm += segmentLengthKm;
  }

  if (totalLengthKm > 0) {
    return weightedDangerSum / totalLengthKm;
  }

  const summaryDanger = Number(route?.summary?.danger_percent);
  if (Number.isFinite(summaryDanger)) {
    return summaryDanger;
  }

  return 0;
};

const normalizeMetric = (value, minValue, maxValue, fallbackValue = 1) => {
  if (!Number.isFinite(value)) {
    return fallbackValue;
  }
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || minValue === maxValue) {
    return 0;
  }
  return (value - minValue) / (maxValue - minValue);
};

const buildRoutePathSignature = (path) => {
  const normalizedPath = getSegmentPath({ path });
  if (!normalizedPath) {
    return "";
  }

  return normalizedPath
    .map((point) => `${point[0].toFixed(5)}:${point[1].toFixed(5)}`)
    .join("|");
};

const normalizeGuidanceRoute = (route, fallbackDestination, index) => {
  const path = getSegmentPath({ path: route?.path }) || [];
  if (path.length < 2) {
    return null;
  }

  const segments = (Array.isArray(route?.segments) ? route.segments : [])
    .map((segment, segmentIndex) => {
      const segmentPath = getSegmentPath({ path: segment?.path });
      if (!segmentPath) return null;
      const rawDangerPercent = segment?.danger_percent;
      const dangerPercent = Number(rawDangerPercent);
      const hasDangerPercent =
        rawDangerPercent !== null &&
        rawDangerPercent !== undefined &&
        rawDangerPercent !== "" &&
        Number.isFinite(dangerPercent);
      return {
        segment_id: String(segment?.segment_id || `${route?.route_id || `route_${index + 1}`}:segment_${segmentIndex}`),
        path: segmentPath,
        danger_percent: hasDangerPercent ? dangerPercent : null,
        danger_level: normalizeDangerLevel(
          segment?.danger_level,
          hasDangerPercent ? dangerPercent : null,
        ),
        sample_from: Number.isFinite(Number(segment?.sample_from))
          ? Number(segment.sample_from)
          : segmentIndex,
        sample_to: Number.isFinite(Number(segment?.sample_to))
          ? Number(segment.sample_to)
          : segmentIndex + 1,
      };
    })
    .filter(Boolean);

  const summaryDangerPercent = Number(route?.summary?.danger_percent);
  const riskAvailable =
    route?.riskAvailable ??
    route?.risk_available ??
    route?.summary?.riskAvailable ??
    route?.summary?.risk_available;
  const riskUnavailable = riskAvailable === false;
  const summary = {
    ...(route?.summary && typeof route.summary === "object" ? route.summary : {}),
    danger_percent: Number.isFinite(summaryDangerPercent)
      ? summaryDangerPercent
      : riskUnavailable
        ? null
        : 0,
    danger_level: riskUnavailable && !Number.isFinite(summaryDangerPercent)
      ? "unknown"
      : normalizeDangerLevel(route?.summary?.danger_level, summaryDangerPercent),
    riskAvailable: !riskUnavailable,
    risk_available: !riskUnavailable,
  };
  const distanceKm = Number(route?.distance_km);
  const durationMin = Number(route?.duration_min ?? route?.eta_min);

  return {
    ...route,
    riskAvailable: !riskUnavailable,
    risk_available: !riskUnavailable,
    riskMessage: route?.riskMessage || route?.message || route?.summary?.message || null,
    route_id: String(route?.route_id || `route_${index + 1}`),
    destination: route?.destination || fallbackDestination,
    path,
    segments,
    summary,
    distance_km: Number.isFinite(distanceKm) ? distanceKm : calculatePathDistanceKm(path),
    duration_min: Number.isFinite(durationMin) ? durationMin : null,
    eta_min: Number.isFinite(durationMin) ? durationMin : null,
    route_identity: [
      buildRoutePathSignature(path),
      Number.isFinite(distanceKm) ? distanceKm.toFixed(3) : "na",
      Number.isFinite(durationMin) ? durationMin.toFixed(3) : "na",
    ].join("|"),
  };
};

const pickBestUnusedRoute = (routes, valueSelector, usedRouteIds) => {
  return routes
    .filter((route) => !usedRouteIds.has(route.route_id))
    .sort((left, right) => {
      const leftValue = valueSelector(left);
      const rightValue = valueSelector(right);
      if (leftValue === rightValue) {
        return left.route_id.localeCompare(right.route_id);
      }
      return leftValue - rightValue;
    })[0] || null;
};

const classifyRouteAlternatives = (routes) => {
  if (!Array.isArray(routes) || routes.length === 0) {
    return [];
  }

  const durationValues = routes
    .map((route) => Number(route?.duration_min))
    .filter((value) => Number.isFinite(value));
  const dangerValues = routes
    .map((route) => calculateWeightedDangerScore(route))
    .filter((value) => Number.isFinite(value));
  const minDuration = durationValues.length ? Math.min(...durationValues) : 0;
  const maxDuration = durationValues.length ? Math.max(...durationValues) : 0;
  const minDanger = dangerValues.length ? Math.min(...dangerValues) : 0;
  const maxDanger = dangerValues.length ? Math.max(...dangerValues) : 0;

  const scoredRoutes = routes.map((route) => {
    const durationMin = Number(route?.duration_min);
    const weightedDangerPercent = calculateWeightedDangerScore(route);
    const normalizedDuration = normalizeMetric(durationMin, minDuration, maxDuration, 1);
    const normalizedDanger = normalizeMetric(weightedDangerPercent, minDanger, maxDanger, 1);

    return {
      ...route,
      metrics: {
        duration_min: Number.isFinite(durationMin) ? durationMin : Number.POSITIVE_INFINITY,
        weighted_danger_percent: weightedDangerPercent,
        normalized_duration: normalizedDuration,
        normalized_danger: normalizedDanger,
        balanced_score:
          BALANCED_DURATION_WEIGHT * normalizedDuration +
          BALANCED_DANGER_WEIGHT * normalizedDanger,
      },
    };
  });

  const usedRouteIds = new Set();
  const classifiedRoutes = [];
  const routeSelectors = {
    fastest: (route) => route.metrics.duration_min,
    safest: (route) => route.metrics.weighted_danger_percent,
    balanced: (route) => route.metrics.balanced_score,
  };

  for (const routeType of GUIDED_ROUTE_ORDER) {
    const selectedRoute = pickBestUnusedRoute(
      scoredRoutes,
      routeSelectors[routeType],
      usedRouteIds,
    );
    if (!selectedRoute) {
      continue;
    }
    usedRouteIds.add(selectedRoute.route_id);
    classifiedRoutes.push({
      ...selectedRoute,
      route_type: routeType,
      route_label: GUIDED_ROUTE_META[routeType].label,
      route_color: GUIDED_ROUTE_META[routeType].color,
      inactive_dash_array: GUIDED_ROUTE_META[routeType].inactiveDashArray,
    });
  }

  const recommendedRouteType = classifiedRoutes.some((route) => route.route_type === "balanced")
    ? "balanced"
    : [...classifiedRoutes].sort(
        (left, right) => left.metrics.balanced_score - right.metrics.balanced_score,
      )[0]?.route_type;

  return classifiedRoutes.map((route) => ({
    ...route,
    is_recommended: route.route_type === recommendedRouteType,
  }));
};

const normalizeGuidedRoutePayload = (data) => {
  const fallbackDestination =
    data?.destination && typeof data.destination === "object" ? data.destination : null;
  const rawRoutes =
    Array.isArray(data?.routes) && data.routes.length > 0 ? data.routes : [data];
  const seenRoutes = new Set();
  const normalizedRoutes = rawRoutes
    .map((route, index) => normalizeGuidanceRoute(route, fallbackDestination, index))
    .filter((route) => {
      if (!route || !route.route_identity || seenRoutes.has(route.route_identity)) {
        return false;
      }
      seenRoutes.add(route.route_identity);
      return true;
    });

  return classifyRouteAlternatives(normalizedRoutes);
};

const formatRelativeUpdateAge = (updatedAt) => {
  const timestamp = Number(updatedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "not updated yet";
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (ageSeconds < 5) return "just now";
  if (ageSeconds < 60) return `${ageSeconds}s ago`;

  const ageMinutes = Math.round(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;

  const ageHours = Math.round(ageMinutes / 60);
  return `${ageHours}h ago`;
};

const getRecommendedRouteReason = (routeType) => {
  if (routeType === "safest") return "Lowest predicted risk";
  if (routeType === "fastest") return "Fastest arrival";
  return "Best tradeoff between speed and safety";
};

const formatSignedMinutesDelta = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || Math.abs(minutes) < 0.1) {
    return "same ETA";
  }
  const rounded = Math.round(minutes);
  if (rounded === 0) {
    return "same ETA";
  }
  return `${rounded > 0 ? "+" : ""}${rounded} min`;
};

const formatSignedRiskDelta = (value) => {
  const riskDelta = Number(value);
  if (!Number.isFinite(riskDelta) || Math.abs(riskDelta) < 0.5) {
    return "same risk";
  }
  const rounded = Math.round(riskDelta);
  return `${rounded > 0 ? "+" : ""}${rounded} risk`;
};

const toFriendlyConfidenceLabel = ({ sentinelValid, sentinelConfidenceLabel, legacyConfidencePct }) => {
  if (sentinelValid) {
    if (sentinelConfidenceLabel === "high") return "High";
    if (sentinelConfidenceLabel === "medium") return "Medium";
    if (sentinelConfidenceLabel === "low") return "Low";
  }

  const pct = Number(legacyConfidencePct);
  if (!Number.isFinite(pct)) {
    return "Limited";
  }
  if (pct >= 75) return "High";
  if (pct >= 50) return "Medium";
  return "Low";
};

const toFriendlyQualityLabel = ({
  qualityLabel,
  sentinelHasError,
  fallbackQualityDetails,
  locationWarning,
}) => {
  const normalizedQuality = String(qualityLabel || "").trim().toLowerCase();
  if (sentinelHasError || fallbackQualityDetails.length >= 3) {
    return "Weak";
  }
  if (
    normalizedQuality === "poor" ||
    normalizedQuality === "weak" ||
    normalizedQuality === "limited" ||
    locationWarning
  ) {
    return "Limited";
  }
  return "Good";
};

const buildQualitySummaryNotes = ({
  locationWarning,
  sentinelHasError,
  sentinelReasons,
  fallbackQualityDetails,
}) => {
  const notes = [];
  if (locationWarning) {
    notes.push("GPS weak");
  }
  if (sentinelHasError) {
    notes.push("weather missing");
  }

  for (const reason of sentinelReasons) {
    const normalized = String(reason || "").toLowerCase();
    if (normalized.includes("rare") || normalized.includes("uncommon") || normalized.includes("atypical")) {
      notes.push("unusual conditions");
    }
    if (normalized.includes("weather")) {
      notes.push("weather missing");
    }
  }

  for (const line of fallbackQualityDetails) {
    const normalized = String(line || "").toLowerCase();
    if (normalized.includes("missing")) {
      notes.push("fallback inputs used");
    }
    if (normalized.includes("out of") || normalized.includes("clipped")) {
      notes.push("unusual conditions");
    }
  }

  return [...new Set(notes)].slice(0, 4);
};

const buildRouteComparisonRows = (routes) => {
  if (!Array.isArray(routes) || routes.length === 0) {
    return [];
  }

  const getAvailableRiskPercent = (route) => {
    if (
      route?.riskAvailable === false ||
      route?.risk_available === false ||
      route?.summary?.riskAvailable === false ||
      route?.summary?.risk_available === false
    ) {
      return null;
    }
    const rawPercent = route?.summary?.danger_percent;
    if (rawPercent === null || rawPercent === undefined || rawPercent === "") {
      return null;
    }
    const percent = Number(rawPercent);
    return Number.isFinite(percent) ? percent : null;
  };

  const fastestRoute = routes.find((route) => route.route_type === "fastest") || routes[0];
  const fastestDuration = Number(fastestRoute?.duration_min);
  const fastestRisk = getAvailableRiskPercent(fastestRoute);

  return routes.map((route) => {
    const duration = Number(route?.duration_min);
    const danger = getAvailableRiskPercent(route);
    const durationDelta =
      Number.isFinite(duration) && Number.isFinite(fastestDuration) ? duration - fastestDuration : 0;
    const riskDelta =
      danger != null && fastestRisk != null ? danger - fastestRisk : null;

    return {
      ...route,
      durationDelta,
      riskDelta,
      comparisonText:
        route.route_type === "fastest"
          ? "Baseline fastest route"
          : riskDelta == null
            ? `Risk unavailable, ${formatSignedMinutesDelta(durationDelta)}`
            : `${formatSignedRiskDelta(riskDelta)}, ${formatSignedMinutesDelta(durationDelta)}`,
      recommendedReason: route.is_recommended ? getRecommendedRouteReason(route.route_type) : null,
    };
  });
};

const buildRouteRiskProfile = (route) => {
  const segments = Array.isArray(route?.segments) ? route.segments : [];
  if (segments.length === 0) {
    return [];
  }

  const measuredSegments = segments.map((segment) => {
    const distanceKm = calculatePathDistanceKm(segment?.path);
    const safeDistanceKm = distanceKm > 0 ? distanceKm : 0;
    return {
      ...segment,
      distance_km: safeDistanceKm,
      color: getDangerColor(normalizeDangerLevel(segment?.danger_level, segment?.danger_percent)),
    };
  });

  const totalDistanceKm = measuredSegments.reduce((sum, segment) => sum + segment.distance_km, 0);
  const fallbackWidth = measuredSegments.length > 0 ? 100 / measuredSegments.length : 0;

  return measuredSegments.map((segment) => ({
    ...segment,
    width_percent:
      totalDistanceKm > 0 ? Math.max(4, (segment.distance_km / totalDistanceKm) * 100) : fallbackWidth,
  }));
};

const buildAheadRouteHazards = (route, timestampIso) => {
  const profile = buildRouteRiskProfile(route);
  if (profile.length < 2) {
    return [];
  }

  const notes = [];
  let distanceBeforeCurrentKm = 0;
  let firstHighRiskDistanceKm = null;

  for (const segment of profile) {
    const level = normalizeDangerLevel(segment?.danger_level, segment?.danger_percent);
    if (level === "high" && firstHighRiskDistanceKm == null) {
      firstHighRiskDistanceKm = distanceBeforeCurrentKm;
      break;
    }
    distanceBeforeCurrentKm += segment.distance_km;
  }

  if (firstHighRiskDistanceKm != null) {
    notes.push(
      firstHighRiskDistanceKm < 0.25
        ? "High-risk segment starts almost immediately"
        : `High-risk segment ahead in ${firstHighRiskDistanceKm.toFixed(1)} km`,
    );
  }

  const totalDistanceKm = profile.reduce((sum, segment) => sum + segment.distance_km, 0);
  const thirds = [
    { key: "beginning", start: 0, end: totalDistanceKm / 3, weightedRisk: 0, lengthKm: 0 },
    { key: "middle", start: totalDistanceKm / 3, end: (2 * totalDistanceKm) / 3, weightedRisk: 0, lengthKm: 0 },
    { key: "end", start: (2 * totalDistanceKm) / 3, end: totalDistanceKm, weightedRisk: 0, lengthKm: 0 },
  ];

  let traversedDistanceKm = 0;
  for (const segment of profile) {
    const segmentLengthKm = segment.distance_km > 0 ? segment.distance_km : totalDistanceKm / profile.length;
    const midpointKm = traversedDistanceKm + segmentLengthKm / 2;
    const bucket =
      thirds.find((item) => midpointKm >= item.start && midpointKm <= item.end) || thirds[2];
    bucket.weightedRisk += Number(segment?.danger_percent || 0) * segmentLengthKm;
    bucket.lengthKm += segmentLengthKm;
    traversedDistanceKm += segmentLengthKm;
  }

  const scoredThirds = thirds.map((item) => ({
    ...item,
    avgRisk: item.lengthKm > 0 ? item.weightedRisk / item.lengthKm : 0,
  }));
  const strongestThird = [...scoredThirds].sort((left, right) => right.avgRisk - left.avgRisk)[0];
  if (strongestThird && strongestThird.avgRisk >= 25) {
    notes.push(`Risk is concentrated in the ${strongestThird.key} of the route`);
  }

  const earlyRisk = scoredThirds[0]?.avgRisk ?? 0;
  const lateRisk = scoredThirds[2]?.avgRisk ?? 0;
  if (lateRisk - earlyRisk >= 8) {
    notes.push("Risk increases near destination");
  }

  const dangerWithinFiveKm = profile.filter((segment) => {
    const segmentStartKm = profile
      .slice(0, profile.indexOf(segment))
      .reduce((sum, item) => sum + item.distance_km, 0);
    return segmentStartKm <= 5 && Number(segment?.danger_percent) >= 40;
  });
  if (dangerWithinFiveKm.length >= 2) {
    notes.push("Medium-risk cluster in the next 5 km");
  }

  const hour = Number.isFinite(new Date(timestampIso).getTime()) ? new Date(timestampIso).getHours() : null;
  if (hour != null && (hour >= 18 || hour <= 5) && lateRisk >= 30) {
    notes.push("Danger rises after sunset");
  }

  return [...new Set(notes)].slice(0, 3);
};

const buildTimeImpactPreview = ({ baselinePercent, selectedPercent, selectedTimestampLabel }) => {
  const baseline = Number(baselinePercent);
  const selected = Number(selectedPercent);
  if (!Number.isFinite(baseline) || !Number.isFinite(selected)) {
    return null;
  }

  const diff = Math.round(selected - baseline);
  if (Math.abs(diff) < 1) {
    return `Risk stays close to now at ${selectedTimestampLabel}`;
  }
  if (diff > 0) {
    return `Risk rises from ${Math.round(baseline)}% now to ${Math.round(selected)}% at ${selectedTimestampLabel}`;
  }
  return `Risk drops by ${Math.abs(diff)}% at ${selectedTimestampLabel}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

const formatAccuracyMeters = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} m`;
}

const formatFeatureValue = (feature, value) => {
  if (value == null) return "n/a";

  const featureName = String(feature || "").trim().toLowerCase();
  const isWindSpeed = featureName.includes("wind_speed") || featureName.includes("wind speed");

  if (typeof value === "number") {
    const formatted = value.toFixed(2);
    return isWindSpeed ? `${formatted} mph` : formatted;
  }

  const formatted = String(value);
  return isWindSpeed ? `${formatted} mph` : formatted;
}

const toPercentOrNull = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const prettySentinelField = (fieldRaw) => {
  const field = String(fieldRaw || "").trim().toLowerCase();
  if (!field) return "value";
  const map = {
    pressure_msl: "pressure",
    relative_humidity_2m: "humidity",
    windspeed_10m: "wind speed",
    winddirection_10m: "wind direction",
    temperature_2m: "temperature",
    cloudcover: "cloud cover",
  };
  if (map[field]) return map[field];
  return field.replace(/_/g, " ");
}

const mapSentinelReason = (reasonRaw) => {
  const code = String(reasonRaw || "").trim().toLowerCase();
  if (!code) return null;

  if (code === "outside_dz") return "GPS location looks outside Algeria (or invalid).";
  if (code === "missing_weather") return "Weather data is unavailable right now.";
  if (code === "model_ood_high") return "Conditions are extremely rare compared to training data.";
  if (code === "model_ood_medium") return "Conditions are uncommon compared to training data.";
  if (code === "model_ood_low") return "Conditions are slightly atypical compared to training data.";

  if (code.startsWith("bad_")) {
    const field = prettySentinelField(code.slice(4));
    return `Weather data looks corrupted: ${field} is out of expected range.`;
  }

  return code.replace(/_/g, " ");
}

const mapSentinelReasons = (reasons) => {
  if (!Array.isArray(reasons)) return [];
  const seen = new Set();
  const mapped = [];
  for (const reason of reasons) {
    const text = mapSentinelReason(reason);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    mapped.push(text);
  }
  return mapped;
}

const prettyQualityFeature = (featureRaw) => {
  const text = String(featureRaw || "").trim();
  if (!text) return "value";
  return prettySentinelField(text.replace(/[()]/g, "").replace(/\//g, "_").replace(/\s+/g, "_"));
}

const mapQualityOodFeature = (item) => {
  if (!item || typeof item !== "object") return null;
  const feature = prettyQualityFeature(item.feature);
  const reason = String(item.reason || "").trim().toLowerCase();

  if (reason === "clipped_to_training_range") return `Value was clipped to training range: ${feature}`;
  if (reason === "unknown_category") return `Unknown category mapped to default: ${feature}`;
  if (reason === "mapped_to_other") return `Category mapped to Other: ${feature}`;
  if (reason === "out_of_range") return `Value out of valid range: ${feature}`;
  if (!reason) return `Input quality issue detected: ${feature}`;
  return `${reason.replace(/_/g, " ")}: ${feature}`;
}

const normalizeNominatimResult = (item, fallbackName) => {
  if (!item || typeof item !== "object") return null;

  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const displayName = String(item.display_name || "").trim();
  const parts = displayName ? displayName.split(",").map((part) => part.trim()) : [];
  const name = String(item.name || parts[0] || fallbackName || "Destination").trim();
  const country = item?.address?.country || parts[parts.length - 1] || "";
  const region =
    item?.address?.state ||
    item?.address?.county ||
    (parts.length > 1 ? parts[parts.length - 2] : "");

  return {
    id: String(item.place_id || `${lat}:${lng}`),
    name,
    subtitle: [region, country].filter(Boolean).join(", "),
    full_name: displayName || name,
    lat,
    lng,
  };
}

const toDateTimeLocalValue = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const FlyToUser = ({
  userPosition,
  mapLayer,
  locationRequestVersion = 0,
  followUser = true,
}) => {
  const map = useMap();
  const hasCenteredRef = useRef(false);
  const lastRequestVersionRef = useRef(locationRequestVersion);

  useEffect(() => {
    const target = normalizePosition(userPosition);
    if (!target) return;

    const requestChanged = locationRequestVersion !== lastRequestVersionRef.current;
    const shouldRecenter =
      followUser || !hasCenteredRef.current || requestChanged;
    lastRequestVersionRef.current = locationRequestVersion;
    if (!shouldRecenter) {
      return;
    }

    hasCenteredRef.current = true;
    if (mapLayer === "nearbyRoads") {
      map.panTo(target, { animate: true });
      return;
    }
    map.flyTo(target, USER_ZOOM, { animate: true, duration: 0.8 });
  }, [followUser, locationRequestVersion, map, mapLayer, userPosition]);
  return null;
}

const LeafletFollowGestureHandler = ({ onUserGesture }) => {
  useMapEvents({
    dragstart: (event) => {
      if (event?.originalEvent) onUserGesture?.();
    },
    zoomstart: (event) => {
      if (event?.originalEvent) onUserGesture?.();
    },
  });
  return null;
};

const FitNearbyRoutesOnDemand = ({ mapLayer, nearbyRoutes, fitVersion }) => {
  const map = useMap();

  useEffect(() => {
    if (
      mapLayer !== "nearbyRoads" ||
      !fitVersion ||
      !Array.isArray(nearbyRoutes) ||
      nearbyRoutes.length === 0
    ) {
      return;
    }

    const allPoints = [];
    for (const route of nearbyRoutes) {
      const segments = Array.isArray(route?.segments) ? route.segments : [];
      if (segments.length > 0) {
        for (const segment of segments) {
          const segmentPath = getSegmentPath({ path: segment?.path });
          if (segmentPath) {
            allPoints.push(...segmentPath);
          }
        }
        continue;
      }

      const routePath = getSegmentPath({ path: route?.path });
      if (routePath) {
        allPoints.push(...routePath);
      }
    }

    if (allPoints.length < 2) return;
    const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [fitVersion, map, mapLayer, nearbyRoutes]);

  return null;
}

const FitGuidedRoute = ({ routes, fitVersion, enabled = true }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !fitVersion) {
      return;
    }

    const allPoints = [];
    for (const route of Array.isArray(routes) ? routes : []) {
      const routePath = getSegmentPath({ path: route?.path });
      if (routePath) {
        allPoints.push(...routePath);
      }
    }

    if (allPoints.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, { padding: [40, 40] });
  }, [enabled, fitVersion, map, routes]);

  return null;
}

const FocusAlertZone = ({ mapLayer, selectedAlertZone }) => {
  const map = useMap();
  const lastZoneIdRef = useRef(null);

  useEffect(() => {
    if (mapLayer !== "zones") {
      lastZoneIdRef.current = null;
      return;
    }

    if (!selectedAlertZone?.id || lastZoneIdRef.current === selectedAlertZone.id) {
      return;
    }

    lastZoneIdRef.current = selectedAlertZone.id;

    const zoneGeometry = normalizeAlertZoneGeometry(selectedAlertZone);
    if (zoneGeometry) {
      const bounds = L.geoJSON(zoneGeometry).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18), {
          padding: [24, 24],
          maxZoom: 11,
        });
        return;
      }
    }

    const radius = Number(selectedAlertZone?.zone?.radiusM);
    const zoneCenter = normalizeAlertZoneCenter(selectedAlertZone);
    if (zoneCenter && Number.isFinite(radius) && radius > 0) {
      const bounds = L.circle(zoneCenter, { radius }).getBounds();
      map.fitBounds(bounds.pad(0.22), {
        padding: [24, 24],
        maxZoom: 12,
      });
      return;
    }

    if (zoneCenter) {
      map.flyTo(zoneCenter, 11, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [map, mapLayer, selectedAlertZone]);

  return null;
};

const MapResizeFix = ({ deps = [] }) => {
  const map = useMap();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false });
    });
    return () => cancelAnimationFrame(id);
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
      });
    });

    ro.observe(container);

    const onResize = () => map.invalidateSize({ pan: false, animate: false });
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  useEffect(() => {
    const id = setTimeout(() => {
      map.invalidateSize({ pan: false, animate: false });
    }, 50);
    return () => clearTimeout(id);
  }, [map, ...deps]);

  return null;
}

/* ---- Custom canvas heatmap — no dependency on leaflet.heat ---- */
function drawHeat(ctx, W, H, pts, r, map) {
  ctx.clearRect(0, 0, W, H);
  if (!pts.length) return;

  // offscreen shadow canvas for accumulation
  const shadow = document.createElement('canvas');
  shadow.width = W;
  shadow.height = H;
  const sCtx = shadow.getContext('2d');

  pts.forEach(([lat, lng, intensity = 1]) => {
    const p = map.latLngToContainerPoint([lat, lng]);
    const rad = r * (0.6 + intensity * 0.4);
    const grad = sCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
    const alpha = Math.min(1, 0.25 + intensity * 0.65);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    sCtx.fill();
  });

  // colorize via gradient LUT
  const imgData = sCtx.getImageData(0, 0, W, H);
  const data = imgData.data;
  const palette = buildPalette();
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i + 3];
    if (v === 0) continue;
    const idx = v * 4;
    data[i]     = palette[idx];
    data[i + 1] = palette[idx + 1];
    data[i + 2] = palette[idx + 2];
    data[i + 3] = Math.round(v * 0.9);
  }
  ctx.putImageData(imgData, 0, 0);
}

function buildPalette() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.00, '#1e40af');
  g.addColorStop(0.25, '#3b82f6');
  g.addColorStop(0.50, '#10b981');
  g.addColorStop(0.70, '#f59e0b');
  g.addColorStop(0.85, '#ef4444');
  g.addColorStop(1.00, '#7f1d1d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

const HeatLayer = ({ points, radius = 40 }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;

    /* ── Try leaflet.heat first ── */
    if (typeof L.heatLayer === 'function' && points.length > 0) {
      const layer = L.heatLayer(points, {
        radius,
        blur: Math.round(radius * 0.75),
        minOpacity: 0.45,
        max: 1.0,
        gradient: {
          0.00: '#1e40af',
          0.25: '#3b82f6',
          0.50: '#10b981',
          0.70: '#f59e0b',
          0.85: '#ef4444',
          1.00: '#7f1d1d',
        },
      });
      layer.addTo(map);
      return () => { map.removeLayer(layer); };
    }

    /* ── Canvas fallback ── */
    const pane = map.getPanes().overlayPane;
    const canvas = document.createElement('canvas');
    canvas.className = 'siara-heat-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:400;';
    pane.appendChild(canvas);

    const resize = () => {
      const s = map.getSize();
      canvas.width = s.x;
      canvas.height = s.y;
    };
    resize();

    const redraw = () => {
      resize();
      const mapPos = map.containerPointToLayerPoint([0, 0]);
      canvas.style.transform = `translate(${mapPos.x}px,${mapPos.y}px)`;
      const ctx = canvas.getContext('2d');
      drawHeat(ctx, canvas.width, canvas.height, points, radius, map);
    };

    map.on('moveend zoomend resize viewreset', redraw);
    redraw();

    return () => {
      map.off('moveend zoomend resize viewreset', redraw);
      canvas.remove();
    };
  }, [map, points, radius]);

  return null;
};

// Heatmap fetches show every accident report by default; no built-in time
// window. A future filter UI can pass `?hours=24` / `?range=7d` if needed.
const HEATMAP_BOUNDS_DEBOUNCE_MS = 350;

const MapBoundsTracker = ({ enabled, onBoundsChange }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !map) return undefined;
    let timer = null;

    const emit = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      onBoundsChange?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: typeof zoom === "number" ? zoom : null,
      });
    };

    const handleMoveEnd = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(emit, HEATMAP_BOUNDS_DEBOUNCE_MS);
    };

    // Emit current bounds once on mount so the first fetch can include them.
    emit();
    map.on("moveend", handleMoveEnd);
    map.on("zoomend", handleMoveEnd);
    return () => {
      if (timer) window.clearTimeout(timer);
      map.off("moveend", handleMoveEnd);
      map.off("zoomend", handleMoveEnd);
    };
  }, [enabled, map, onBoundsChange]);

  return null;
};

const MapClickHandler = ({ enabled, onMapClick }) => {
  useMapEvents({
    click: (event) => {
      if (!enabled) return;
      const target = event?.originalEvent?.target;
      if (target && typeof target.closest === "function") {
        if (
          target.closest(
            ".leaflet-interactive, .leaflet-marker-icon, .leaflet-control, .siara-map-destination-card",
          )
        ) {
          return;
        }
      }
      const lat = Number(event?.latlng?.lat);
      const lng = Number(event?.latlng?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        onMapClick({ lat, lng });
      }
    },
  });
  return null;
};

const SiaraMap = ({
  alertZones = [],
  reportMarkers,
  mockMarkers,
  mapLayer,
  onAlertZoneSelect,
  selectedAlertZoneId = null,
  setSelectedIncident,
  userPosition,
  locationStatus = "unknown",
  locationError = "",
  locationWarning = "",
  locationRequestVersion = 0,
  requestLocation,
  liveLocationStatus = "idle",
  liveLocationUpdatedAt = null,
  liveLocationLastError = null,
  liveLocationIsFallback = false,
  onSelectedTimestampChange,
  weatherData = null,
  placeName = "",
  riskPanelTarget = null,
  guideControlsTarget = null,
}) => {
  const markers = useMemo(() => {
    if (Array.isArray(reportMarkers)) {
      return reportMarkers;
    }
    if (Array.isArray(mockMarkers)) {
      return mockMarkers;
    }
    return [];
  }, [mockMarkers, reportMarkers]);
  const selectedAlertZone = useMemo(
    () => alertZones.find((alertZone) => alertZone.id === selectedAlertZoneId) || null,
    [alertZones, selectedAlertZoneId],
  );

  useEffect(() => {
    if (mapLayer === "zones") {
      setSelectedIncident(null);
    }
  }, [mapLayer, setSelectedIncident]);

  const [currentRisk, setCurrentRisk] = useState(null);
  const [currentRiskState, setCurrentRiskState] = useState("idle");
  const [currentRiskError, setCurrentRiskError] = useState("");
  const [overlayBySegment, setOverlayBySegment] = useState({});
  const [, setOverlayState] = useState("idle");
  const [overlayError, setOverlayError] = useState("");
  const [nearbyRoutes, setNearbyRoutes] = useState([]);
  const [, setNearbyRoutesState] = useState("idle");
  const [nearbyRoutesError, setNearbyRoutesError] = useState("");
  const [tileError, setTileError] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationSearchState, setDestinationSearchState] = useState("idle");
  const [destinationSearchError, setDestinationSearchError] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [guidedRoutes, setGuidedRoutes] = useState([]);
  const [selectedGuidedRouteType, setSelectedGuidedRouteType] = useState(null);
  const [guidedRouteState, setGuidedRouteState] = useState("idle");
  const [guidedRouteError, setGuidedRouteError] = useState("");
  const [routeExplanation, setRouteExplanation] = useState(null);
  const [routeExplanationLoading, setRouteExplanationLoading] = useState(false);
  const [routeExplanationError, setRouteExplanationError] = useState("");
  const [routeExplanationAiGenerating, setRouteExplanationAiGenerating] = useState(false);
  const [selectedHeatCluster, setSelectedHeatCluster] = useState(null);
  const [heatClusterPanelOpen, setHeatClusterPanelOpen] = useState(false);
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [pendingMapDestination, setPendingMapDestination] = useState(null);
  const [pendingMapDestinationName, setPendingMapDestinationName] = useState("");
  const [pendingDestinationLoading, setPendingDestinationLoading] = useState(false);
  const [pendingDestinationError, setPendingDestinationError] = useState("");
  const [pendingTravelStarting, setPendingTravelStarting] = useState(false);
  const [pendingTravelError, setPendingTravelError] = useState("");
  const [mapMode, setMapMode] = useState("normal");
  const [normalFollowUser, setNormalFollowUser] = useState(true);
  const [activeNavigationRoute, setActiveNavigationRoute] = useState(null);
  const [activeNavigationRoutes, setActiveNavigationRoutes] = useState([]);
  const [activeNavigationDestination, setActiveNavigationDestination] = useState(null);
  const [activeNavigationStartedAt, setActiveNavigationStartedAt] = useState(null);
  const [routeScoringTimestampIso, setRouteScoringTimestampIso] = useState(null);
  const [routeScoringOrigin, setRouteScoringOrigin] = useState(null);
  // navigationError is reserved for surfacing future MapLibre runtime errors
  // (e.g. style/tile load failures); MapLibreNavigationView currently
  // self-handles these.
  // eslint-disable-next-line no-unused-vars
  const [navigationError, setNavigationError] = useState("");
  // Accident heatmap layer state (used when mapLayer === "heatmap").
  // We deliberately do NOT track bounds here: the heatmap shows every
  // accident report in the database, not just what's in the current
  // viewport. We only track zoom so the backend can size DBSCAN clusters
  // appropriately for the current scale.
  const [heatClusters, setHeatClusters] = useState([]);
  const [heatClustersState, setHeatClustersState] = useState("idle");
  const [heatClustersError, setHeatClustersError] = useState("");
  const [heatZoom, setHeatZoom] = useState(null);
  const heatRequestIdRef = useRef(0);
  // Monotonic request id for route calculations. Each new attempt bumps it;
  // any in-flight response whose captured id no longer matches is silently
  // discarded. This prevents stale errors after the user cancels a starting
  // trip, exits navigation, or clicks a new destination while a previous
  // route request is still resolving.
  const routeRequestIdRef = useRef(0);
  // Guards for /api/risk/route to stop the request flood that was causing
  // 429 / timeout errors. The earlier code refetched the route on every
  // userLocation tick + on a periodic refresh interval — both removed.
  // routeFetchInflightRef:    map cacheKey → pending promise (dedupe)
  // routeFetchCacheRef:       map cacheKey → { result, expiresAt }
  // routeFetchCooldownUntilRef: epoch-ms; while now < cooldown, all calls
  //                             reject immediately with a friendly message
  //                             instead of hammering a struggling backend.
  const routeFetchInflightRef = useRef(new Map());
  const routeFetchCacheRef = useRef(new Map());
  const routeFetchCooldownUntilRef = useRef(0);
  const routeFetchAbortRef = useRef(null);
  // Current-risk request guards. Tiny GPS jitter / 30s refresh tick used to
  // produce duplicate POST /api/risk/current calls. We now:
  //   • abort the previous request when a meaningful new one is issued
  //   • dedupe identical requests by (rounded lat, rounded lng, ts bucket)
  //   • cache the last response per key so a re-render doesn't re-fetch
  //   • keep the previously-loaded risk visible if refresh fails
  const currentRiskAbortRef = useRef(null);
  const currentRiskInflightRef = useRef(new Map());
  const currentRiskCacheRef = useRef(new Map());
  const currentRiskLastKeyRef = useRef("");
  // Nearby-roads guards: only refetch on meaningful movement, timestamp
  // bucket change, manual refresh, or first activation of the layer. The
  // 60s interval no longer participates in the request key.
  const nearbyAbortRef = useRef(null);
  const nearbyLastOriginRef = useRef(null);
  const nearbyRequestIdRef = useRef(0);
  const [nearbyManualRefreshTick, setNearbyManualRefreshTick] = useState(0);
  // In-memory cache + in-flight map for the "Why this route?" explanation.
  // The auto-fetch effect was removed; the cache is now only used by the
  // manual "Generate AI explanation" button and the local template effect
  // (which reads the cache so an AI response sticks across re-renders).
  const routeExplanationCacheRef = useRef(new Map());
  const routeExplanationInflightRef = useRef(new Map());
  const [helpOpen, setHelpOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationText, setExplanationText] = useState("");
  const [explanationError, setExplanationError] = useState("");
  const [explanationSource, setExplanationSource] = useState("");
  const [occurrenceRisk, setOccurrenceRisk] = useState(null);
  const [occurrenceRiskLoading, setOccurrenceRiskLoading] = useState(false);
  const [occurrenceRiskError, setOccurrenceRiskError] = useState("");
  const [routeExplainState, setRouteExplainState] = useState("idle");
  const [routeExplainError, setRouteExplainError] = useState("");
  const [selectedRouteExplanation, setSelectedRouteExplanation] = useState(null);
  const [currentRiskNowBaseline, setCurrentRiskNowBaseline] = useState(null);
  const [currentRiskUpdatedAt, setCurrentRiskUpdatedAt] = useState(0);
  const [nearbyUpdatedAt, setNearbyUpdatedAt] = useState(0);
  const [routesUpdatedAt, setRoutesUpdatedAt] = useState(0);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(0);
  const [timePresetMs, setTimePresetMs] = useState("0");
  const [customTimestampLocal, setCustomTimestampLocal] = useState("");
  const [uiClockTick, setUiClockTick] = useState(0);
  const [predictionRefreshTick, setPredictionRefreshTick] = useState(0);
  // Guided-route auto-refresh state was removed: the route is fetched on
  // user action (Start travel / change destination / change time), not on
  // a periodic timer. See the guarded fetchGuidedRoute / cooldown logic.
  const [nearbyFitVersion, setNearbyFitVersion] = useState(0);
  const [guidedRouteFitVersion, setGuidedRouteFitVersion] = useState(0);
  const [reportTooltipVisible, setReportTooltipVisible] = useState(false);
  const nearbyRequestKeyRef = useRef("");
  const guidanceRequestKeyRef = useRef("");
  const pendingNearbyFitRef = useRef(false);
  const selectedRouteExplanationRef = useRef(null);
  const locationRenderStateRef = useRef("");
  const currentRiskRef = useRef(null);
  const overlayBySegmentRef = useRef({});
  const nearbyRoutesRef = useRef([]);
  const userLatLng = useMemo(() => normalizePosition(userPosition), [userPosition]);
  const isFallbackPosition = useMemo(
    () => Boolean(liveLocationIsFallback || userPosition?.isFallback || locationStatus === "fallback"),
    [liveLocationIsFallback, locationStatus, userPosition?.isFallback],
  );
  const hasGrantedLocation = useMemo(
    () =>
      (locationStatus === "granted" || locationStatus === "fallback") &&
      normalizePosition(userPosition) != null,
    [locationStatus, userPosition],
  );
  const hasValidUserLocation = useMemo(
    () => hasGrantedLocation && normalizePosition(userPosition) != null,
    [hasGrantedLocation, userPosition],
  );
  // Coarse location key (~11m precision). Tiny GPS jitter no longer
  // re-triggers /api/risk/current or other location-keyed effects.
  const userLocationKey = useMemo(() => {
    if (!userLatLng) {
      return "";
    }
    return `${userLatLng[0].toFixed(4)}:${userLatLng[1].toFixed(4)}`;
  }, [userLatLng]);
  // Fine key kept only for non-network UI (e.g. updating "last seen" badge).
  const userLocationFineKey = useMemo(() => {
    if (!userLatLng) {
      return "";
    }
    return `${userLatLng[0].toFixed(6)}:${userLatLng[1].toFixed(6)}`;
  }, [userLatLng]);
  const liveTimeEnabled = timePresetMs !== "custom";
  const predictionAnchorMs = useMemo(
    () => Date.now(),
    [timePresetMs, customTimestampLocal, predictionRefreshTick],
  );
  const previewAnchorMs = useMemo(
    () => Date.now(),
    [timePresetMs, customTimestampLocal, uiClockTick, predictionRefreshTick],
  );
  const selectedTimestampIso = useMemo(() => {
    if (timePresetMs === "custom") {
      const customDate = new Date(customTimestampLocal);
      if (!Number.isNaN(customDate.getTime())) {
        return customDate.toISOString();
      }
      return new Date(predictionAnchorMs).toISOString();
    }

    const offsetMs = Number(timePresetMs);
    const safeOffsetMs = Number.isFinite(offsetMs) ? offsetMs : 0;
    return new Date(predictionAnchorMs + safeOffsetMs).toISOString();
  }, [timePresetMs, customTimestampLocal, predictionAnchorMs]);

  const selectedTimestampPreview = useMemo(() => {
    let dt = null;
    if (timePresetMs === "custom") {
      dt = new Date(customTimestampLocal);
    } else {
      const offsetMs = Number(timePresetMs);
      const safeOffsetMs = Number.isFinite(offsetMs) ? offsetMs : 0;
      dt = new Date(previewAnchorMs + safeOffsetMs);
    }
    if (Number.isNaN(dt.getTime())) {
      return "Invalid time";
    }
    return dt.toLocaleString();
  }, [customTimestampLocal, previewAnchorMs, timePresetMs]);
  const routeAnalysisTimestampIso = routeScoringTimestampIso || selectedTimestampIso;

  useEffect(() => {
    if (locationRequestVersion > 0) {
      setNormalFollowUser(true);
    }
  }, [locationRequestVersion]);

  const guidedRoute = useMemo(() => {
    if (!Array.isArray(guidedRoutes) || guidedRoutes.length === 0) {
      return null;
    }

    return (
      guidedRoutes.find((route) => route.route_type === selectedGuidedRouteType) ||
      guidedRoutes[0] ||
      null
    );
  }, [guidedRoutes, selectedGuidedRouteType]);

  // Whenever guidance flips on/off, switch between Leaflet (normal) and the
  // MapLibre navigation view by setting mapMode and snapshotting the route
  // payload for MapLibreNavigationView. Per-frame progress tracking and step
  // detection are handled inside MapLibreNavigationView itself.
  useEffect(() => {
    if (guidanceActive && guidedRoute) {
      setMapMode("navigation");
      setActiveNavigationRoute(guidedRoute);
      setActiveNavigationRoutes(Array.isArray(guidedRoutes) ? guidedRoutes : []);
      setActiveNavigationDestination(
        guidedRoute?.destination || selectedDestination || null,
      );
      setActiveNavigationStartedAt(new Date().toISOString());
      setNavigationError("");
    } else if (!guidanceActive && mapMode === "navigation") {
      setMapMode("normal");
      setActiveNavigationRoute(null);
      setActiveNavigationRoutes([]);
      setActiveNavigationDestination(null);
      setActiveNavigationStartedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidanceActive, guidedRoute?.route_id]);

  // Keep active navigation route in sync if the user picks a different
  // alternative (e.g. fastest → safest) without exiting nav mode.
  useEffect(() => {
    if (mapMode !== "navigation" || !guidedRoute) return;
    setActiveNavigationRoute(guidedRoute);
    setActiveNavigationRoutes(Array.isArray(guidedRoutes) ? guidedRoutes : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, guidedRoute?.route_type, guidedRoutes]);

  // Build a local "template" route explanation immediately when the
  // recommended route identity changes. This used to auto-call
  // /api/risk/route/explain (Ollama) on every new route, which was wasteful
  // and slow. The AI version is now opt-in via
  // handleGenerateAiRouteExplanation. The local template surfaces enough
  // detail (ETA, distance, danger %, comparison row) for the user to act on
  // immediately; the manual AI button still uses the existing cache /
  // dedupe / watchdog pipeline.
  useEffect(() => {
    if (!guidedRoute || !Array.isArray(guidedRoute?.path) || guidedRoute.path.length < 2) {
      setRouteExplanation(null);
      setRouteExplanationLoading(false);
      setRouteExplanationError("");
      return undefined;
    }

    const cacheKey = [
      guidedRoute?.route_identity || guidedRoute?.route_id || "route",
      guidedRoute?.route_type || "type",
      guidedRoute?.destination?.lat != null
        ? `${Number(guidedRoute.destination.lat).toFixed(4)},${Number(guidedRoute.destination.lng).toFixed(4)}`
        : "no-dest",
      routeAnalysisTimestampIso || "no-ts",
      Number.isFinite(Number(guidedRoute?.summary?.danger_percent))
        ? Math.round(Number(guidedRoute.summary.danger_percent))
        : "na",
    ].join("|");

    // If the user already triggered the AI explanation for this route, that
    // response is in the cache — keep it visible instead of overwriting
    // with the template.
    const cached = routeExplanationCacheRef.current.get(cacheKey);
    if (cached) {
      setRouteExplanation(cached);
      setRouteExplanationLoading(false);
      setRouteExplanationError("");
      return undefined;
    }

    const recommendedType = guidedRoute?.route_type || "balanced";
    const label = recommendedType.charAt(0).toUpperCase() + recommendedType.slice(1);
    const risk = Number(guidedRoute?.summary?.danger_percent);
    const distanceKm = Number(guidedRoute?.distance_km);
    const durationMin = Number(guidedRoute?.duration_min ?? guidedRoute?.eta_min);
    const facts = [];
    if (Number.isFinite(distanceKm)) facts.push(`${distanceKm.toFixed(1)} km`);
    if (Number.isFinite(durationMin)) facts.push(`${durationMin.toFixed(0)} min ETA`);
    if (Number.isFinite(risk)) facts.push(`relative danger ${Math.round(risk)}%`);
    const factsText = facts.length ? ` (${facts.join(", ")})` : "";

    const template = {
      ok: true,
      summary: `SIARA picked this ${label.toLowerCase()} route based on distance, ETA and segment danger scores${factsText}. Tap "Generate AI explanation" for a deeper write-up.`,
      reasons: [],
      comparison: null,
      recommendedRouteType: recommendedType,
      recommendedRiskLevel: guidedRoute?.summary?.danger_level || null,
      recommendedRiskPercent: Number.isFinite(risk) ? Math.round(risk) : null,
      source: "template",
    };
    setRouteExplanation(template);
    setRouteExplanationLoading(false);
    setRouteExplanationError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedRoute?.route_identity, routeAnalysisTimestampIso]);

  useEffect(() => {
    if (typeof onSelectedTimestampChange === "function") {
      if (timePresetMs === "custom") {
        onSelectedTimestampChange(selectedTimestampIso);
        return;
      }
      const offsetMs = Number(timePresetMs);
      const safeOffsetMs = Number.isFinite(offsetMs) ? offsetMs : 0;
      onSelectedTimestampChange(new Date(Date.now() + safeOffsetMs).toISOString());
    }
  }, [customTimestampLocal, onSelectedTimestampChange, timePresetMs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setUiClockTick((value) => value + 1);
    }, UI_CLOCK_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!liveTimeEnabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPredictionRefreshTick((value) => value + 1);
    }, PREDICTION_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [liveTimeEnabled]);

  useEffect(() => {
    if (!liveTimeEnabled) {
      return undefined;
    }

    const forceRefresh = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return;
      }
      setUiClockTick((value) => value + 1);
      setPredictionRefreshTick((value) => value + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceRefresh();
      }
    };

    window.addEventListener("focus", forceRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", forceRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [liveTimeEnabled]);

  useEffect(() => {
    selectedRouteExplanationRef.current = selectedRouteExplanation;
  }, [selectedRouteExplanation]);

  useEffect(() => {
    currentRiskRef.current = currentRisk;
  }, [currentRisk]);

  useEffect(() => {
    overlayBySegmentRef.current = overlayBySegment;
  }, [overlayBySegment]);

  useEffect(() => {
    nearbyRoutesRef.current = nearbyRoutes;
  }, [nearbyRoutes]);

  useEffect(() => {
    if (userLocationFineKey) {
      setLocationUpdatedAt(Date.now());
    }
  }, [userLocationFineKey]);

  useEffect(() => {
    if (mapLayer !== "points") {
      setReportTooltipVisible(false);
    }
  }, [mapLayer]);

  const clearRouteExplanationSelection = () => {
    setSelectedRouteExplanation(null);
    setRouteExplainState("idle");
    setRouteExplainError("");
    setSelectedIncident(null);
  };

  const syncRouteExplanationSelection = ({
    nextSelectedRoute,
    nextSelectedRouteType,
    preserveSelection = false,
  }) => {
    const previousSelection = selectedRouteExplanationRef.current;
    if (!previousSelection) {
      return;
    }

    if (!preserveSelection || previousSelection.route_type !== nextSelectedRouteType) {
      clearRouteExplanationSelection();
      return;
    }

    const matchedSegment = (Array.isArray(nextSelectedRoute?.segments) ? nextSelectedRoute.segments : [])
      .find(
        (segment) =>
          segment.sample_from === previousSelection?.segment?.sample_from &&
          segment.sample_to === previousSelection?.segment?.sample_to,
      );

    if (!matchedSegment) {
      clearRouteExplanationSelection();
      return;
    }

    setSelectedRouteExplanation({
      ...previousSelection,
      route_type: nextSelectedRouteType,
      segment: {
        ...previousSelection.segment,
        ...matchedSegment,
      },
      explanation: {
        ...previousSelection.explanation,
        danger_percent:
          matchedSegment.danger_percent ?? previousSelection?.explanation?.danger_percent,
        danger_level:
          matchedSegment.danger_level || previousSelection?.explanation?.danger_level,
      },
    });
  };

  const handleGuidedRouteSelection = (routeType) => {
    if (!routeType || routeType === selectedGuidedRouteType) {
      return;
    }

    setSelectedGuidedRouteType(routeType);
    if (selectedRouteExplanationRef.current?.route_type !== routeType) {
      clearRouteExplanationSelection();
    }
  };

  // Current risk fetch — guarded against GPS jitter and rapid re-renders.
  // The effect key (userLocationKey, selectedTimestampIso, predictionRefreshTick)
  // produces a `requestKey` containing the rounded lat/lng + 5-min timestamp
  // bucket. Re-runs with the same key are no-ops; meaningful new requests
  // abort the previous in-flight call and cache the result for 5 minutes.
  useEffect(() => {
    if (!hasValidUserLocation || !userPosition) {
      // Drop any in-flight request when location goes away.
      if (currentRiskAbortRef.current) {
        currentRiskAbortRef.current.abort();
        currentRiskAbortRef.current = null;
      }
      setCurrentRisk(null);
      setCurrentRiskState("idle");
      setCurrentRiskError("");
      currentRiskLastKeyRef.current = "";
      return undefined;
    }

    const lat = Number(userPosition.lat);
    const lng = Number(userPosition.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }

    const roundedLat = lat.toFixed(4);
    const roundedLng = lng.toFixed(4);
    const bucket = timestampBucket(selectedTimestampIso);
    const requestKey = `${roundedLat}:${roundedLng}:${bucket}`;

    // Cache hit: hydrate state and skip the network call.
    const cached = currentRiskCacheRef.current.get(requestKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (currentRiskLastKeyRef.current !== requestKey) {
        currentRiskLastKeyRef.current = requestKey;
        setCurrentRisk(cached.data);
        setCurrentRiskState("success");
        setCurrentRiskError("");
        setCurrentRiskUpdatedAt(cached.fetchedAt);
        if (DEV) console.debug("[risk/current] cache_hit", { key: requestKey });
      }
      return undefined;
    }

    // Already executing this exact request from a parallel effect run.
    if (currentRiskInflightRef.current.has(requestKey)) {
      if (DEV) console.debug("[risk/current] dedupe", { key: requestKey });
      return undefined;
    }

    // Mark this as the latest request so a parallel cache hit doesn't fight.
    currentRiskLastKeyRef.current = requestKey;

    // Cancel the previously in-flight call — it is stale relative to the new
    // request key.
    if (currentRiskAbortRef.current) {
      currentRiskAbortRef.current.abort();
    }
    const controller = new AbortController();
    currentRiskAbortRef.current = controller;

    const body = { lat, lng, timestamp: selectedTimestampIso };
    setCurrentRiskState(currentRiskRef.current ? "refreshing" : "loading");
    setCurrentRiskError("");

    const startedAt = DEV ? performance.now() : 0;
    const promise = (async () => {
      const data = await postJson("/api/risk/current", body, { signal: controller.signal });
      return data;
    })();
    currentRiskInflightRef.current.set(requestKey, promise);

    promise
      .then((data) => {
        if (controller.signal.aborted) return;
        currentRiskCacheRef.current.set(requestKey, {
          data,
          fetchedAt: Date.now(),
          expiresAt: Date.now() + CURRENT_RISK_TIMESTAMP_BUCKET_MS,
        });
        setCurrentRisk(data);
        setCurrentRiskState("success");
        setCurrentRiskError("");
        setCurrentRiskUpdatedAt(Date.now());
        if (DEV) {
          console.debug("[risk/current] success", {
            key: requestKey,
            duration_ms: Math.round(performance.now() - startedAt),
          });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === "AbortError") {
          if (DEV) console.debug("[risk/current] aborted", { key: requestKey });
          return;
        }
        console.error("Current risk error:", error);
        // Preserve the previously-loaded risk; only flip to "error" if there
        // is nothing to show yet.
        setCurrentRiskState(currentRiskRef.current ? "success" : "error");
        setCurrentRiskError(error.message || "Failed to refresh current risk");
      })
      .finally(() => {
        currentRiskInflightRef.current.delete(requestKey);
        if (currentRiskAbortRef.current === controller) {
          currentRiskAbortRef.current = null;
        }
      });

    return () => {
      // Effect cleanup intentionally does NOT abort: the request may still
      // be valid for the next render. We only abort when a *different* key
      // supersedes this one (handled above) or when location is lost.
    };
  }, [hasValidUserLocation, selectedTimestampIso, userLocationKey, predictionRefreshTick, userPosition]);

  useEffect(() => {
    const segmentId = currentRisk?.road_segment_id;
    if (!segmentId) {
      setOccurrenceRisk(null);
      setOccurrenceRiskError("");
      return undefined;
    }
    let cancelled = false;
    setOccurrenceRiskLoading(true);
    setOccurrenceRiskError("");
    import("../../services/occurrenceRiskService")
      .then(({ predictOccurrenceForSegment }) =>
        predictOccurrenceForSegment({
          roadSegmentId: segmentId,
          timeBucket: selectedTimestampIso,
          personalize: true,
        }),
      )
      .then((data) => {
        if (cancelled) return;
        setOccurrenceRisk(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setOccurrenceRiskError(error?.message || "Could not load occurrence risk");
      })
      .finally(() => {
        if (!cancelled) setOccurrenceRiskLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRisk?.road_segment_id, selectedTimestampIso]);

  useEffect(() => {
    if (!hasValidUserLocation || !userPosition) {
      setCurrentRiskNowBaseline(null);
      return undefined;
    }

    const nowIso = new Date().toISOString();
    const selectedTimeMs = new Date(selectedTimestampIso).getTime();
    const nowMs = new Date(nowIso).getTime();
    if (Number.isFinite(selectedTimeMs) && Math.abs(selectedTimeMs - nowMs) < 60 * 1000) {
      setCurrentRiskNowBaseline(currentRiskRef.current);
      return undefined;
    }

    // Reuse the same cache the primary effect populates so the baseline call
    // doesn't double-hit the backend for the "now" bucket.
    const lat = Number(userPosition.lat);
    const lng = Number(userPosition.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    const nowBucket = timestampBucket(nowIso);
    const cacheKey = `${lat.toFixed(4)}:${lng.toFixed(4)}:${nowBucket}`;
    const cached = currentRiskCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setCurrentRiskNowBaseline(cached.data);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    const fetchCurrentRiskBaseline = async () => {
      try {
        const data = await postJson(
          "/api/risk/current",
          { lat, lng, timestamp: nowIso },
          { signal: controller.signal },
        );
        if (cancelled) return;
        currentRiskCacheRef.current.set(cacheKey, {
          data,
          fetchedAt: Date.now(),
          expiresAt: Date.now() + CURRENT_RISK_TIMESTAMP_BUCKET_MS,
        });
        setCurrentRiskNowBaseline(data);
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        setCurrentRiskNowBaseline(null);
      }
    };

    void fetchCurrentRiskBaseline();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasValidUserLocation, selectedTimestampIso, userLocationKey, userPosition]);

  useEffect(() => {
    if (!hasValidUserLocation || !userPosition || !markers.length) {
      setOverlayBySegment({});
      setOverlayState("idle");
      setOverlayError("");
      return;
    }

    if (mapLayer !== "ai") {
      setOverlayState("idle");
      setOverlayError("");
      return;
    }

    const body = {
      timestamp: selectedTimestampIso,
      rows: markers.map((marker) => ({
        segment_id: String(marker.id),
        lat: marker.lat,
        lng: marker.lng,
      })),
    };
    let cancelled = false;
    const fetchOverlay = async () => {
      setOverlayState(Object.keys(overlayBySegmentRef.current).length > 0 ? "refreshing" : "loading");
      setOverlayError("");
      try {
        const data = await postJson("/api/risk/overlay", body);
        if (cancelled) return;

        const bySegment = {};
        for (const item of data?.results || []) {
          bySegment[String(item.segment_id ?? item.index)] = item;
        }
        setOverlayBySegment(bySegment);
        setOverlayState("success");
      } catch (error) {
        if (cancelled) return;
        console.error("Overlay risk error:", error);
        setOverlayState(Object.keys(overlayBySegmentRef.current).length > 0 ? "success" : "error");
        setOverlayError(error.message || "Failed to refresh overlay risk");
      }
    };

    fetchOverlay();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, mapLayer, markers, selectedTimestampIso, userLocationKey]);

  // Nearby roads — refetch only when the *layer is active* AND one of:
  //   a) first activation (cached origin missing)
  //   b) user moved > 100 m
  //   c) timestamp bucket changed
  //   d) manual refresh tick bumped
  // The previous 60s timer used to force a refetch even if nothing changed,
  // and userLocationKey was part of the request key so tiny GPS jitter
  // would re-hit the backend.
  useEffect(() => {
    if (mapLayer !== "nearbyRoads") {
      nearbyRequestKeyRef.current = "";
      nearbyLastOriginRef.current = null;
      pendingNearbyFitRef.current = false;
      if (nearbyAbortRef.current) {
        nearbyAbortRef.current.abort();
        nearbyAbortRef.current = null;
      }
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return undefined;
    }

    if (!hasValidUserLocation || !userPosition) {
      setNearbyRoutes([]);
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return undefined;
    }

    const lat = Number(userPosition.lat);
    const lng = Number(userPosition.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    const previousOrigin = nearbyLastOriginRef.current;
    const distanceMoved = previousOrigin
      ? haversineMeters(previousOrigin.origin, [lat, lng])
      : Infinity;
    const bucket = timestampBucket(selectedTimestampIso);
    const movedEnough = distanceMoved >= NEARBY_MOVEMENT_THRESHOLD_M;
    const bucketChanged = !previousOrigin || previousOrigin.bucket !== bucket;
    const manualBump = !previousOrigin || previousOrigin.manualTick !== nearbyManualRefreshTick;
    const isFirstLoad = !previousOrigin;
    if (!isFirstLoad && !movedEnough && !bucketChanged && !manualBump) {
      if (DEV) {
        console.debug("[risk/nearby-zones] skip", {
          distance_m: Math.round(distanceMoved),
          bucket,
        });
      }
      return undefined;
    }

    const requestId = ++nearbyRequestIdRef.current;
    const requestKey = `${lat.toFixed(4)}:${lng.toFixed(4)}:${bucket}:${nearbyManualRefreshTick}`;

    // Abort any older request — its response is now stale.
    if (nearbyAbortRef.current) {
      nearbyAbortRef.current.abort();
    }
    const controller = new AbortController();
    nearbyAbortRef.current = controller;

    const body = {
      lat,
      lng,
      radius_km: NEARBY_RADIUS_KM,
      max_destinations: NEARBY_MAX_DESTINATIONS,
      timestamp: selectedTimestampIso,
    };

    setNearbyRoutesState(nearbyRoutesRef.current.length > 0 ? "refreshing" : "loading");
    setNearbyRoutesError("");

    const startedAt = DEV ? performance.now() : 0;
    (async () => {
      try {
        const data = await postJson("/api/risk/nearby-zones", body, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestId !== nearbyRequestIdRef.current) {
          if (DEV) console.debug("[risk/nearby-zones] stale_ignored");
          return;
        }
        setNearbyRoutes(Array.isArray(data?.routes) ? data.routes : []);
        setNearbyRoutesState("success");
        setNearbyUpdatedAt(Date.now());
        nearbyRequestKeyRef.current = requestKey;
        nearbyLastOriginRef.current = {
          origin: [lat, lng],
          bucket,
          manualTick: nearbyManualRefreshTick,
        };
        if (DEV) {
          console.debug("[risk/nearby-zones] success", {
            key: requestKey,
            duration_ms: Math.round(performance.now() - startedAt),
          });
        }
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError") return;
        if (requestId !== nearbyRequestIdRef.current) return;
        console.error("Nearby routes error:", error);
        setNearbyRoutesState(nearbyRoutesRef.current.length > 0 ? "success" : "error");
        setNearbyRoutesError(error.message || "Failed to refresh nearby routes");
      } finally {
        if (nearbyAbortRef.current === controller) {
          nearbyAbortRef.current = null;
        }
      }
    })();

    return undefined;
  }, [
    hasValidUserLocation,
    mapLayer,
    nearbyManualRefreshTick,
    selectedTimestampIso,
    userLocationKey,
    userPosition,
  ]);

  useEffect(() => {
    if (mapLayer === "nearbyRoads" && !guidedRoute) {
      pendingNearbyFitRef.current = true;
    }
  }, [guidedRoute, mapLayer]);

  useEffect(() => {
    if (
      mapLayer !== "nearbyRoads" ||
      guidedRoute ||
      !pendingNearbyFitRef.current ||
      nearbyRoutes.length === 0
    ) {
      return;
    }

    pendingNearbyFitRef.current = false;
    setNearbyFitVersion((value) => value + 1);
  }, [guidedRoute, mapLayer, nearbyRoutes.length]);

  // The MapBoundsTracker still emits the full bounds payload, but for the
  // heatmap we only care about zoom changes — pans must NOT cause a refetch
  // that would otherwise hide reports outside the viewport.
  const handleHeatmapBoundsChange = useCallback((next) => {
    if (!next) return;
    const nextZoom = Number.isFinite(Number(next.zoom))
      ? Math.round(Number(next.zoom))
      : null;
    setHeatZoom((prev) => (prev === nextZoom ? prev : nextZoom));
  }, []);

  // Fetch accident heatmap clusters when the heatmap tab is selected.
  // Default behaviour intentionally sends NO time filter and NO bounds —
  // the user wants every accident report in the database to contribute to
  // a cluster. Zoom is the only thing forwarded (the backend uses it to
  // size DBSCAN). Stale responses from earlier fetches are discarded via
  // heatRequestIdRef.
  useEffect(() => {
    if (mapLayer !== "heatmap") {
      setHeatClustersState("idle");
      setHeatClustersError("");
      return undefined;
    }

    const requestId = ++heatRequestIdRef.current;
    setHeatClustersState((prev) => (prev === "success" ? "refreshing" : "loading"));
    setHeatClustersError("");

    const params = new URLSearchParams();
    if (Number.isFinite(Number(heatZoom))) {
      params.set("zoom", String(heatZoom));
    }
    const query = params.toString();
    const url = query
      ? `/api/map/report-danger-heatmap?${query}`
      : "/api/map/report-danger-heatmap";

    let cancelled = false;
    (async () => {
      try {
        const data = await getJson(url);
        if (cancelled || requestId !== heatRequestIdRef.current) return;
        setHeatClusters(Array.isArray(data?.clusters) ? data.clusters : []);
        setHeatClustersState("success");
      } catch (error) {
        if (cancelled || requestId !== heatRequestIdRef.current) return;
        setHeatClustersError(error?.message || "Could not load accident heatmap.");
        setHeatClustersState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapLayer, heatZoom]);

  const handleFeatureClick = async (marker) => {
    if (mapLayer !== "ai") {
      setSelectedIncident(marker);
      return;
    }
    if (!hasValidUserLocation || !userPosition) {
      setSelectedIncident(marker);
      return;
    }

    const body = {
      segment_id: String(marker.id),
      lat: marker.lat,
      lng: marker.lng,
      timestamp: selectedTimestampIso,
    };
    try {
      const explanation = await postJson("/api/risk/explain", body);
      setSelectedIncident({
        ...marker,
        risk: overlayBySegment[String(marker.id)] || null,
        explanation,
      });
    } catch (error) {
      console.error("Explain error:", error);
      setSelectedIncident(marker);
    }
  };

  const runDestinationSearch = async () => {
    const query = destinationQuery.trim();
    if (!query) {
      setDestinationSearchState("idle");
      setDestinationResults([]);
      setDestinationSearchError("Type a destination first.");
      return;
    }

    setDestinationSearchState("loading");
    setDestinationResults([]);
    setDestinationSearchError("");

    try {
      const url = new URL(NOMINATIM_SEARCH_URL);
      url.searchParams.set("format", "json");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "5");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(`Destination search failed (${response.status})`);
      }

      const normalized = (Array.isArray(data) ? data : [])
        .map((item) => normalizeNominatimResult(item, query))
        .filter(Boolean);

      setDestinationResults(normalized);
      setDestinationSearchState("success");
      if (normalized.length === 0) {
        setDestinationSearchError("No destination found for that query.");
      }
    } catch (error) {
      setDestinationSearchState("error");
      setDestinationSearchError(error.message || "Failed to search destination");
    }
  };

  const selectDestination = (destination) => {
    setSelectedDestination(destination);
    setDestinationQuery(destination?.full_name || destination?.name || "");
    setDestinationResults([]);
    setDestinationSearchError("");
  };

  const clearGuidance = () => {
    guidanceRequestKeyRef.current = "";
    setGuidanceActive(false);
    setGuidedRoutes([]);
    setSelectedGuidedRouteType(null);
    setGuidedRouteState("idle");
    setGuidedRouteError("");
    setRouteScoringTimestampIso(null);
    setRouteScoringOrigin(null);
    clearRouteExplanationSelection();
  };

  // Manual "Generate AI explanation" trigger from the RouteOverviewCard.
  // Bypasses the per-route cache for a single call so the user can opt
  // into Ollama on demand. Background segment updates and automatic
  // re-fetches stay template-only.
  const handleGenerateAiRouteExplanation = async () => {
    if (routeExplanationAiGenerating) return;
    if (!guidedRoute || !Array.isArray(guidedRoute?.path) || guidedRoute.path.length < 2) {
      return;
    }

    const path = guidedRoute.path;
    const clustersNearRoute = (Array.isArray(heatClusters) ? heatClusters : [])
      .filter((cluster) => {
        const clat = Number(cluster?.lat ?? cluster?.latitude);
        const clng = Number(cluster?.lng ?? cluster?.longitude);
        if (!Number.isFinite(clat) || !Number.isFinite(clng)) return false;
        for (let i = 0; i < path.length; i += 1) {
          const point = path[i];
          const plat = Array.isArray(point) ? Number(point[0]) : Number(point?.lat);
          const plng = Array.isArray(point) ? Number(point[1]) : Number(point?.lng);
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
          if (haversineDistanceKm([plat, plng], [clat, clng]) <= 1.5) return true;
        }
        return false;
      })
      .slice(0, 10);

    const payload = {
      selectedRoute: {
        route_type: guidedRoute.route_type,
        route_id: guidedRoute.route_id,
        summary: guidedRoute.summary,
        duration_min: guidedRoute.duration_min,
        eta_min: guidedRoute.eta_min,
        distance_km: guidedRoute.distance_km,
        segments: guidedRoute.segments,
        is_recommended: guidedRoute.is_recommended,
      },
      alternatives: (Array.isArray(guidedRoutes) ? guidedRoutes : []).map((route) => ({
        route_type: route.route_type,
        route_id: route.route_id,
        summary: route.summary,
        duration_min: route.duration_min,
        eta_min: route.eta_min,
        distance_km: route.distance_km,
        segments: route.segments,
        is_recommended: route.is_recommended,
      })),
      destination: guidedRoute.destination || selectedDestination || null,
      timestamp: routeAnalysisTimestampIso,
      heatmapClustersNearRoute: clustersNearRoute,
    };

    const cacheKey = [
      guidedRoute?.route_identity || guidedRoute?.route_id || "route",
      guidedRoute?.route_type || "type",
      guidedRoute?.destination?.lat != null
        ? `${Number(guidedRoute.destination.lat).toFixed(4)},${Number(guidedRoute.destination.lng).toFixed(4)}`
        : "no-dest",
      routeAnalysisTimestampIso || "no-ts",
      Number.isFinite(Number(guidedRoute?.summary?.danger_percent))
        ? Math.round(Number(guidedRoute.summary.danger_percent))
        : "na",
    ].join("|");

    // Watchdog so the AI button can never get stuck on "Generating…".
    const FRONTEND_MAX_WAIT_MS = 12000;
    const controller = new AbortController();
    let timedOut = false;
    const watchdog = window.setTimeout(() => {
      timedOut = true;
      try { controller.abort(); } catch { /* ignore */ }
    }, FRONTEND_MAX_WAIT_MS);

    setRouteExplanationAiGenerating(true);
    try {
      // Dedupe: reuse an in-flight identical request if present.
      const existing = routeExplanationInflightRef.current.get(cacheKey);
      const promise = existing || explainRoute(payload, { signal: controller.signal });
      if (!existing) routeExplanationInflightRef.current.set(cacheKey, promise);
      const response = await promise;
      if (response && response.ok !== false) {
        routeExplanationCacheRef.current.set(cacheKey, response);
        setRouteExplanation(response);
        setRouteExplanationError("");
      }
    } catch (error) {
      if (DEV) {
        console.warn("[explain-route] manual AI fetch failed", {
          message: error?.message,
          timedOut,
        });
      }
      // Don't overwrite the template — the user still sees a useful summary.
    } finally {
      window.clearTimeout(watchdog);
      routeExplanationInflightRef.current.delete(cacheKey);
      setRouteExplanationAiGenerating(false);
    }
  };

  // When the user picks a departure window from the in-navigation
  // BestTimeToLeaveCompact, prompt them before silently restarting the
  // route. Outside navigation we just apply (matches Leaflet behaviour).
  const handleNavSelectDepartureTimestamp = (timestampIso) => {
    if (!timestampIso) return;
    if (guidanceActive) {
      const proceed = window.confirm(
        "Use this departure time and recalculate route?",
      );
      if (!proceed) return;
    }
    const origin = normalizePosition(userPosition);
    if (origin) {
      setRouteScoringOrigin({ lat: origin[0], lng: origin[1] });
    }
    setRouteScoringTimestampIso(timestampIso);
    setTimePresetMs("custom");
    setCustomTimestampLocal(toDateTimeLocalValue(new Date(timestampIso)));
  };

  const abortGuidedRouteRequest = () => {
    if (routeFetchAbortRef.current) {
      routeFetchAbortRef.current.abort();
      routeFetchAbortRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (routeFetchAbortRef.current) {
        routeFetchAbortRef.current.abort();
        routeFetchAbortRef.current = null;
      }
    };
  }, []);

  const exitNavigation = () => {
    // Invalidate any in-flight route response so it can't toggle guidance
    // back on or surface an error after the user has left navigation.
    routeRequestIdRef.current += 1;
    abortGuidedRouteRequest();
    setMapMode("normal");
    setActiveNavigationRoute(null);
    setActiveNavigationRoutes([]);
    setActiveNavigationDestination(null);
    setActiveNavigationStartedAt(null);
    setRouteScoringTimestampIso(null);
    setRouteScoringOrigin(null);
    setPendingTravelStarting(false);
    setPendingTravelError("");
    setPendingDestinationError("");
    setGuidedRouteError("");
    clearGuidance();
  };

  const handleTimePresetChange = (value) => {
    setTimePresetMs(value);
    if (value === "custom" && !customTimestampLocal) {
      setCustomTimestampLocal(toDateTimeLocalValue(new Date()));
    }
  };

  const fetchGuidedRoute = async ({
    origin = normalizePosition(userPosition),
    destination = selectedDestination,
    timestampIso = selectedTimestampIso,
    preserveSelection = false,
    forceRefresh = false,
    requestId = routeRequestIdRef.current,
  } = {}) => {
    if (!origin) {
      throw new Error("Location is required. Use the locate button first.");
    }
    if (!destination) {
      throw new Error("Select a destination before starting guidance.");
    }

    // Cooldown after a 429/timeout: refuse new calls for a window so we
    // don't keep hammering the backend. UI surfaces a friendly fallback.
    const now = Date.now();
    if (now < routeFetchCooldownUntilRef.current) {
      const remaining = Math.ceil((routeFetchCooldownUntilRef.current - now) / 1000);
      throw new Error(
        `SIARA route service is busy. Try again in ${remaining}s.`,
      );
    }

    // Bucket origin/destination/timestamp so two near-identical requests
    // collapse onto the same cache + dedupe key.
    const TIMESTAMP_BUCKET_MS = 5 * 60 * 1000; // 5-minute bucket
    const bucketCoord = (n) => Number(n).toFixed(4); // ~11 m precision
    const tsMs = Date.parse(timestampIso || "");
    const tsBucket = Number.isFinite(tsMs)
      ? Math.floor(tsMs / TIMESTAMP_BUCKET_MS)
      : "now";
    const cacheKey = [
      bucketCoord(origin[0]),
      bucketCoord(origin[1]),
      bucketCoord(destination.lat),
      bucketCoord(destination.lng),
      tsBucket,
      ROUTE_SAMPLE_COUNT,
    ].join("|");

    // Fine-grained "exact same request" key, used so the existing
    // guidanceRequestKeyRef short-circuit still works for re-renders that
    // pass the exact same args.
    const requestKey = [
      origin[0].toFixed(6),
      origin[1].toFixed(6),
      Number(destination.lat).toFixed(6),
      Number(destination.lng).toFixed(6),
      timestampIso,
    ].join("|");
    if (!forceRefresh && requestKey === guidanceRequestKeyRef.current) {
      return guidedRoute;
    }

    // Cache hit: reuse a recent route-risk response instead of recomputing.
    // Even forced starts can use the same geometry/timestamp bucket because
    // live GPS ticks must not repeatedly score an unchanged route.
    const cached = routeFetchCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      if (DEV) console.debug("[risk/route] cache_hit", { key: cacheKey });
      if (requestId === routeRequestIdRef.current) {
        applyGuidedRouteResult(cached.result, {
          requestKey,
          preserveSelection,
        });
      }
      return cached.result.nextSelectedRoute;
    }

    // In-flight dedupe: if an identical request is mid-flight, await it.
    const existingInflight = routeFetchInflightRef.current.get(cacheKey);
    if (existingInflight) {
      if (DEV) console.debug("[risk/route] dedupe", { key: cacheKey });
      const result = await existingInflight;
      if (requestId === routeRequestIdRef.current) {
        applyGuidedRouteResult(result, {
          requestKey,
          preserveSelection,
        });
      }
      return result.nextSelectedRoute;
    }

    // A different route/timestamp supersedes the older risk request. Cancel
    // it at the network layer so slow scoring cannot keep piling up.
    abortGuidedRouteRequest();
    const controller = new AbortController();
    routeFetchAbortRef.current = controller;

    setGuidedRouteState(guidedRoute ? "refreshing" : "loading");
    setGuidedRouteError("");
    if (!preserveSelection) {
      clearRouteExplanationSelection();
    }

    // Note: sample_count intentionally omitted so the backend chooses an
    // adaptive count based on origin→destination distance (5 / 8 / 12).
    // The legacy ROUTE_SAMPLE_COUNT constant is kept only for the cache key.
    const body = {
      origin: { lat: origin[0], lng: origin[1] },
      destination: {
        name: destination.name,
        lat: destination.lat,
        lng: destination.lng,
      },
      timestamp: timestampIso,
      max_alternatives: 3,
    };

    const startedAtMs = DEV ? performance.now() : 0;
    const promise = (async () => {
      const data = await postJson("/api/risk/route", body, {
        signal: controller.signal,
      });
      if (DEV) {
        console.debug("[risk/route] success", {
          key: cacheKey,
          duration_ms: Math.round(performance.now() - startedAtMs),
          risk_available:
            data?.riskAvailable !== false && data?.risk_available !== false,
        });
      }
      const nextRoutes = normalizeGuidedRoutePayload(data);
      if (nextRoutes.length === 0) {
        throw new Error("No valid route alternatives were returned");
      }

      const nextSelectedRouteType =
        (preserveSelection &&
          nextRoutes.some((route) => route.route_type === selectedGuidedRouteType) &&
          selectedGuidedRouteType) ||
        nextRoutes.find((route) => route.is_recommended)?.route_type ||
        nextRoutes[0]?.route_type ||
        null;
      const nextSelectedRoute =
        nextRoutes.find((route) => route.route_type === nextSelectedRouteType) ||
        nextRoutes[0] ||
        null;

      const result = {
        nextRoutes,
        nextSelectedRouteType,
        nextSelectedRoute,
        riskMessage: data?.message || null,
        riskAvailable: data?.riskAvailable !== false && data?.risk_available !== false,
      };

      // Cache for 5 minutes. Same origin/destination/timestamp-bucket
      // re-renders reuse this without a network call.
      routeFetchCacheRef.current.set(cacheKey, {
        result,
        expiresAt: Date.now() + TIMESTAMP_BUCKET_MS,
      });

      return result;
    })();

    routeFetchInflightRef.current.set(cacheKey, promise);

    try {
      const result = await promise;
      if (requestId === routeRequestIdRef.current && !controller.signal.aborted) {
        applyGuidedRouteResult(result, { requestKey, preserveSelection });
      }
      return result.nextSelectedRoute;
    } catch (error) {
      // Trip a 30 s cooldown on overload signals so the next user action
      // does not immediately retry and re-fail.
      if (error?.name === "AbortError") {
        throw error;
      }
      const status = Number(error?.status);
      const message = String(error?.message || "");
      const isOverloaded =
        status === 429 ||
        status === 503 ||
        /timeout/i.test(message) ||
        /failed to fetch/i.test(message) ||
        /networkerror/i.test(message);
      if (isOverloaded) {
        routeFetchCooldownUntilRef.current = Date.now() + 30 * 1000;
      }
      throw error;
    } finally {
      routeFetchInflightRef.current.delete(cacheKey);
      if (routeFetchAbortRef.current === controller) {
        routeFetchAbortRef.current = null;
      }
    }
  };

  // Helper used by both the cache-hit and the network-success branches of
  // fetchGuidedRoute so state updates stay identical.
  const applyGuidedRouteResult = (
    { nextRoutes, nextSelectedRouteType, nextSelectedRoute, riskAvailable = true, riskMessage = "" },
    { requestKey, preserveSelection },
  ) => {
    guidanceRequestKeyRef.current = requestKey;
    setGuidedRoutes(nextRoutes);
    setSelectedGuidedRouteType(nextSelectedRouteType);
    syncRouteExplanationSelection({
      nextSelectedRoute,
      nextSelectedRouteType,
      preserveSelection,
    });
    setGuidedRouteState("success");
    setGuidedRouteError(
      riskAvailable === false
        ? riskMessage || "Route loaded, but risk scoring is unavailable."
        : "",
    );
    setRoutesUpdatedAt(Date.now());
  };

  const startGuidance = async () => {
    if (!hasValidUserLocation) {
      setGuidedRouteState("error");
      setGuidedRouteError("Location is required. Use the locate button first.");
      return;
    }

    const origin = normalizePosition(userPosition);
    if (!origin) {
      setGuidedRouteState("error");
      setGuidedRouteError("Location is required. Use the locate button first.");
      return;
    }

    if (!selectedDestination) {
      setGuidedRouteState("error");
      setGuidedRouteError("Select a destination before starting guidance.");
      return;
    }

    const scoringTimestampIso = selectedTimestampIso;
    const myRequestId = ++routeRequestIdRef.current;
    setRouteScoringTimestampIso(scoringTimestampIso);
    setRouteScoringOrigin({ lat: origin[0], lng: origin[1] });

    try {
      await fetchGuidedRoute({
        origin,
        destination: selectedDestination,
        timestampIso: scoringTimestampIso,
        preserveSelection: false,
        requestId: myRequestId,
      });
      if (myRequestId !== routeRequestIdRef.current) {
        return;
      }
      setGuidedRouteFitVersion((value) => value + 1);
      setGuidanceActive(true);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      if (myRequestId !== routeRequestIdRef.current) {
        return;
      }
      setGuidanceActive(false);
      setGuidedRouteState("error");
      setGuidedRouteError(error.message || "Failed to compute guidance route");
    }
  };

  const reverseGeocodeDestination = async (lat, lng) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    const data = await getJson(`/api/location/reverse?${params.toString()}`);
    const displayName =
      typeof data?.display_name === "string" ? data.display_name.trim() : "";
    if (displayName) return displayName;
    const namedetails = data?.namedetails || {};
    const fallback =
      typeof namedetails?.name === "string" && namedetails.name.trim()
        ? namedetails.name.trim()
        : typeof data?.name === "string" && data.name.trim()
          ? data.name.trim()
          : "";
    return fallback;
  };

  const clearPendingMapDestination = () => {
    // Bump the request id so any in-flight route calculation will be
    // discarded silently (no error toast, no guidance switch).
    routeRequestIdRef.current += 1;
    abortGuidedRouteRequest();
    setPendingMapDestination(null);
    setPendingMapDestinationName("");
    setPendingDestinationLoading(false);
    setPendingDestinationError("");
    setPendingTravelStarting(false);
    setPendingTravelError("");
    setGuidedRouteError("");
  };

  const handleMapDestinationClick = async (latlng) => {
    if (guidanceActive) return;
    if (!latlng) return;
    const lat = Number(latlng.lat);
    const lng = Number(latlng.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Picking a new destination invalidates any previous in-flight request.
    routeRequestIdRef.current += 1;
    abortGuidedRouteRequest();
    setPendingMapDestination({ lat, lng });
    setPendingMapDestinationName("");
    setPendingDestinationError("");
    setPendingTravelError("");
    setPendingTravelStarting(false);
    setGuidedRouteError("");
    setPendingDestinationLoading(true);

    try {
      const placeName = await reverseGeocodeDestination(lat, lng);
      setPendingMapDestinationName(placeName || "");
    } catch (error) {
      setPendingDestinationError(
        error?.message || "Could not look up a place name for this point",
      );
    } finally {
      setPendingDestinationLoading(false);
    }
  };

  const startTravelFromPending = async () => {
    if (!pendingMapDestination) return;
    if (!hasValidUserLocation) {
      setPendingTravelError(
        "Location is required. Enable location to start travel from this point.",
      );
      return;
    }
    const origin = normalizePosition(userPosition);
    if (!origin) {
      setPendingTravelError(
        "Location is required. Enable location to start travel from this point.",
      );
      return;
    }

    const destination = {
      name: pendingMapDestinationName || "Selected destination",
      lat: pendingMapDestination.lat,
      lng: pendingMapDestination.lng,
    };

    // Capture this request's id; any later cancel/exit/new-click bumps the
    // global ref and we discard our own response.
    const myRequestId = ++routeRequestIdRef.current;
    setPendingTravelStarting(true);
    setPendingTravelError("");
    setGuidedRouteError("");
    setSelectedDestination(destination);

    // Always use a fresh "now" timestamp so a stale selectedTimestampIso
    // from a previous navigation session can't poison the request.
    const freshTimestampIso = new Date().toISOString();
    setRouteScoringTimestampIso(freshTimestampIso);
    setRouteScoringOrigin({ lat: origin[0], lng: origin[1] });

    try {
      await fetchGuidedRoute({
        origin,
        destination,
        timestampIso: freshTimestampIso,
        preserveSelection: false,
        forceRefresh: true,
        requestId: myRequestId,
      });
      if (myRequestId !== routeRequestIdRef.current) {
        // Superseded — silently drop the result.
        return;
      }
      setGuidedRouteFitVersion((value) => value + 1);
      setGuidanceActive(true);
      setPendingMapDestination(null);
      setPendingMapDestinationName("");
      setPendingDestinationError("");
      setPendingTravelError("");
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      if (myRequestId !== routeRequestIdRef.current) {
        // Aborted by the user or replaced by a newer request — don't surface
        // the error.
        return;
      }
      setGuidedRouteState("error");
      setGuidedRouteError(error.message || "Failed to compute guidance route");
      setPendingTravelError(error.message || "Failed to compute guidance route");
    } finally {
      if (myRequestId === routeRequestIdRef.current) {
        setPendingTravelStarting(false);
      }
    }
  };

  // Re-fetch the guided route ONLY on user-driven changes:
  //   • guidance turning on (Start travel)
  //   • destination changing (different lat/lng)
  //   • departure timestamp changing intentionally (custom time)
  // Geolocation ticks and the periodic guidanceRefreshTick used to be in
  // this dep list — that caused /api/risk/route to be hit constantly,
  // producing 429s and 8/15s timeouts. We deliberately do NOT depend on
  // userLocationKey or guidanceRefreshTick anymore. The route cache /
  // dedupe / cooldown in fetchGuidedRoute also catches accidental
  // duplicate calls.
  useEffect(() => {
    if (!guidanceActive) {
      return;
    }

    const origin = routeScoringOrigin
      ? [Number(routeScoringOrigin.lat), Number(routeScoringOrigin.lng)]
      : normalizePosition(userPosition);
    if (!origin || !selectedDestination) {
      return;
    }

    const timestampIso = routeScoringTimestampIso || selectedTimestampIso;
    const myRequestId = ++routeRequestIdRef.current;
    void fetchGuidedRoute({
      origin,
      destination: selectedDestination,
      timestampIso,
      preserveSelection: true,
      forceRefresh: false,
      requestId: myRequestId,
    }).catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }
      if (myRequestId !== routeRequestIdRef.current) {
        return;
      }
      setGuidedRouteState(guidedRoute ? "success" : "error");
      setGuidedRouteError(error.message || "Failed to refresh guidance route");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    guidanceActive,
    routeScoringOrigin?.lat,
    routeScoringOrigin?.lng,
    routeScoringTimestampIso,
    selectedDestination?.lat,
    selectedDestination?.lng,
  ]);

  const handleGuidedSegmentClick = async (segment) => {
    if (!segment?.segment_id) {
      return;
    }
    if (!hasValidUserLocation || !userPosition) {
      setRouteExplainState("error");
      setRouteExplainError("Location is required before requesting explanations.");
      return;
    }

    setRouteExplainState("loading");
    setRouteExplainError("");

    try {
      const response = await postJson("/api/risk/explain", {
        segment_id: String(segment.segment_id),
        timestamp: selectedTimestampIso,
        top_k: 8,
      });
      const explanation = {
        ...response,
        danger_percent: Number.isFinite(Number(response?.danger_percent))
          ? Number(response.danger_percent)
          : segment.danger_percent,
        danger_level: response?.danger_level || segment.danger_level,
      };

      setSelectedRouteExplanation({
        route_type: selectedGuidedRouteType,
        segment,
        explanation,
      });
      setRouteExplainState("success");
      setSelectedIncident({
        id: segment.segment_id,
        title: `Guided segment ${segment.segment_id}`,
        explanation,
      });
    } catch (error) {
      setRouteExplainState("error");
      setRouteExplainError(error.message || "Failed to load segment explanation");
    }
  };

  const locationAccuracyText = formatAccuracyMeters(userPosition?.accuracy);
  const sentinel = currentRisk?.sentinel ?? null;
  const sentinelHasError = Boolean(sentinel?.error);
  const sentinelValid = Boolean(
    sentinel && !sentinelHasError && Number.isFinite(Number(sentinel?.ood_percent)),
  );
  const sentinelOodPct = sentinelValid ? toPercentOrNull(Number(sentinel?.ood_percent)) : null;
  const sentinelConfidenceLabel = sentinelValid
    ? String(sentinel?.confidence || "").trim().toLowerCase() || null
    : null;
  const sentinelIsOod = sentinelValid ? Boolean(sentinel?.is_ood) : null;
  // The multiclass model exposes the numeric data-quality score as
  // `data_quality_confidence`; `confidence` is now the model-confidence label
  // (High/Medium/Low). Read the numeric field first, falling back to a legacy
  // numeric `confidence` if present.
  const legacyConfidencePct = toPercentOrNull(
    currentRisk?.data_quality_confidence ?? currentRisk?.confidence,
  );
  const qualityLabel = String(currentRisk?.quality || "").trim().toLowerCase() || null;
  const severityConfidenceLabel =
    typeof currentRisk?.confidence === "string"
      ? currentRisk.confidence.trim() || null
      : null;
  const severityProbabilities =
    currentRisk?.severity_probabilities && typeof currentRisk.severity_probabilities === "object"
      ? currentRisk.severity_probabilities
      : null;
  const mostLikelySeverity = Number.isFinite(Number(currentRisk?.most_likely_severity))
    ? Number(currentRisk.most_likely_severity)
    : null;
  const expectedSeverity = Number.isFinite(Number(currentRisk?.expected_severity))
    ? Number(currentRisk.expected_severity)
    : null;
  // Headline risk = the OCCURRENCE model's calibrated probability of an accident
  // (personalized if a driver profile is applied, else model-only). The big
  // number, badge and gauge read this; the severity outlook below stays as the
  // "if it happens, how bad" detail. Falls back to the severity danger score
  // only while the occurrence result is still loading/unavailable.
  const occurrenceHeadline = useMemo(() => {
    const occ = occurrenceRisk;
    if (!occ) return null;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const personalizedProb =
      num(occ.personalizedRisk?.score) ??
      num(occ.personalized?.calibrated_probability) ??
      num(occ.personalized?.risk_score) ??
      num(occ.personalized_occurrence_score);
    const modelProb =
      num(occ.occurrenceRisk?.calibratedProbability) ??
      num(occ.occurrenceRisk?.score) ??
      num(occ.modelOnly?.calibrated_probability) ??
      num(occ.modelOnly?.risk_score) ??
      num(occ.global_occurrence_score);
    const prob = personalizedProb != null ? personalizedProb : modelProb;
    if (prob == null) return null;
    const rawLevel =
      (personalizedProb != null
        ? occ.personalizedRisk?.riskLevel || occ.personalized?.risk_level || occ.personalized_risk_level
        : null) ||
      occ.occurrenceRisk?.riskLevel ||
      occ.modelOnly?.risk_level ||
      occ.global_risk_level ||
      "low";
    const level = String(rawLevel).toLowerCase();
    const color =
      level === "critical" ? "#7f1d1d"
        : level === "high" ? "#b91c1c"
          : level === "moderate" || level === "medium" ? "#d97706"
            : "#15803d";
    const gaugePct =
      level === "critical" ? 92 : level === "high" ? 72 : level === "moderate" || level === "medium" ? 45 : 15;
    const modelVersion =
      occ.model_version || occ.modelOnly?.model_version || occ.occurrenceRisk?.modelVersion || "occurrence_beta_v1";
    return {
      percent: Math.round(Math.max(0, Math.min(1, prob)) * 1000) / 10,
      level,
      label: level.charAt(0).toUpperCase() + level.slice(1),
      color,
      gaugePct,
      personalized: personalizedProb != null,
      modelVersion,
    };
  }, [occurrenceRisk]);
  const sentinelReasons = mapSentinelReasons(sentinel?.reasons);
  const sentinelBannerTitle = String(sentinel?.banner?.title || "").trim();
  const sentinelBannerDetail = String(sentinel?.banner?.detail || "").trim();
  const sentinelErrorText = String(sentinel?.error || "").trim();
  const sentinelErrorDetails = String(sentinel?.details || "").trim();
  const qualitySignals = currentRisk?.quality_signals && typeof currentRisk.quality_signals === "object"
    ? currentRisk.quality_signals
    : null;
  const legacyMissingCount = Number.isFinite(Number(currentRisk?.quality_signals?.missing_count))
    ? Number(currentRisk.quality_signals.missing_count)
    : null;
  const legacyOodCount = Number.isFinite(Number(currentRisk?.quality_signals?.ood_count))
    ? Number(currentRisk.quality_signals.ood_count)
    : null;
  const fallbackQualityDetails = useMemo(() => {
    if (!qualitySignals) return [];
    const lines = [];

    const missingFeatures = Array.isArray(qualitySignals.missing_features)
      ? qualitySignals.missing_features
      : [];
    for (const feature of missingFeatures) {
      lines.push(`Missing input defaulted: ${prettyQualityFeature(feature)}`);
    }

    const clippedFeatures = Array.isArray(qualitySignals.clipped_features)
      ? qualitySignals.clipped_features
      : [];
    for (const feature of clippedFeatures) {
      lines.push(`Value clipped to expected range: ${prettyQualityFeature(feature)}`);
    }

    const oodFeatures = Array.isArray(qualitySignals.ood_features)
      ? qualitySignals.ood_features
      : [];
    for (const item of oodFeatures) {
      const mapped = mapQualityOodFeature(item);
      if (mapped) lines.push(mapped);
    }

    if (qualitySignals.invalid_start_time) {
      lines.push("Provided timestamp is invalid; model used fallback time features.");
    }

    const deduped = [];
    const seen = new Set();
    for (const line of lines) {
      if (!line || seen.has(line)) continue;
      seen.add(line);
      deduped.push(line);
    }
    return deduped;
  }, [qualitySignals]);
  const compactConfidenceLabel = useMemo(
    () =>
      toFriendlyConfidenceLabel({
        sentinelValid,
        sentinelConfidenceLabel,
        legacyConfidencePct,
      }),
    [legacyConfidencePct, sentinelConfidenceLabel, sentinelValid],
  );
  const compactQualityLabel = useMemo(
    () =>
      toFriendlyQualityLabel({
        qualityLabel,
        sentinelHasError,
        fallbackQualityDetails,
        locationWarning,
      }),
    [fallbackQualityDetails, locationWarning, qualityLabel, sentinelHasError],
  );
  const qualitySummaryNotes = useMemo(
    () =>
      buildQualitySummaryNotes({
        locationWarning,
        sentinelHasError,
        sentinelReasons,
        fallbackQualityDetails,
      }),
    [fallbackQualityDetails, locationWarning, sentinelHasError, sentinelReasons],
  );

  useEffect(() => {
    if (!currentRisk) return;
    setExplanationOpen(false);
    setExplanationText("");
    setExplanationError("");
  }, [currentRisk?.danger_percent, currentRisk?.danger_level]);

  const handleExplainRiskClick = useCallback(async () => {
    if (explanationOpen) {
      setExplanationOpen(false);
      return;
    }

    if (!currentRisk) {
      setExplanationOpen(true);
      setExplanationLoading(false);
      setExplanationText("");
      setExplanationSource("");
      setExplanationError("No risk prediction is available yet.");
      return;
    }

    setExplanationOpen(true);
    setExplanationLoading(true);
    setExplanationError("");
    setExplanationText("");
    setExplanationSource("");

    let enrichedRisk = currentRisk;

    if (!Array.isArray(currentRisk?.xai?.top_reasons) && userPosition) {
      try {
        const explainBody = {
          lat: userPosition.lat,
          lng: userPosition.lng,
          timestamp: selectedTimestampIso,
          top_k: 8,
        };
        const explainData = await postJson("/api/risk/explain", explainBody);
        if (explainData && typeof explainData === "object") {
          enrichedRisk = { ...currentRisk, ...explainData };
        }
      } catch (explainError) {
        if (import.meta.env.DEV) {
          console.warn("[explain-risk] explain fetch failed:", explainError?.message);
        }
      }
    }

    const payload = {
      risk: {
        score: Number(enrichedRisk?.danger_percent) || null,
        percent: Number(enrichedRisk?.danger_percent) || null,
        riskScore: Number(enrichedRisk?.danger_percent) || null,
        level: enrichedRisk?.danger_level || null,
        riskLevel: enrichedRisk?.danger_level || null,
        confidence: compactConfidenceLabel || enrichedRisk?.confidence || null,
        dataQuality: compactQualityLabel || enrichedRisk?.quality || null,
        // Multiclass severity breakdown (4-class model) for richer explanations.
        severityProbabilities: enrichedRisk?.severity_probabilities || null,
        mostLikelySeverity: enrichedRisk?.most_likely_severity ?? null,
        expectedSeverity: enrichedRisk?.expected_severity ?? null,
        severeProbability: enrichedRisk?.severe_probability ?? null,
        baselinePercent: enrichedRisk?.baseline_percent ?? null,
        deltaVsBaseline: enrichedRisk?.delta_vs_baseline ?? null,
        accuracyMeters: Number.isFinite(Number(userPosition?.accuracy))
          ? Number(userPosition.accuracy)
          : null,
        predictionTime: selectedTimestampIso || null,
        locationLabel: placeName || null,
        lat: Number.isFinite(Number(userPosition?.lat)) ? Number(userPosition.lat) : null,
        lng: Number.isFinite(Number(userPosition?.lng)) ? Number(userPosition.lng) : null,
        qualityNotes: qualitySummaryNotes,
      },
      weather: weatherData || null,
      xai:
        enrichedRisk?.xai ||
        enrichedRisk?.explanation ||
        enrichedRisk?.factors ||
        enrichedRisk?.featureImportance ||
        null,
      rawPrediction: enrichedRisk,
    };

    if (import.meta.env.DEV) {
      console.debug("[explain-risk] frontend payload", payload);
    }

    try {
      const response = await postJson(
        "/api/predictions/explain-risk",
        payload,
      );
      if (response?.ok && response.explanation) {
        setExplanationText(response.explanation);
        setExplanationSource(response.source || "fallback");
      } else {
        setExplanationError(
          "SIARA could not generate an explanation right now. Please try again.",
        );
      }
    } catch (error) {
      console.error("Explain risk error:", error);
      setExplanationError(
        "SIARA could not generate an explanation right now. Please try again.",
      );
    } finally {
      setExplanationLoading(false);
    }
  }, [
    compactConfidenceLabel,
    compactQualityLabel,
    currentRisk,
    explanationOpen,
    placeName,
    qualitySummaryNotes,
    selectedTimestampIso,
    userPosition,
    weatherData,
  ]);

  const routeSummaryRawPercent = guidedRoute?.summary?.danger_percent;
  const routeSummaryPercent = Number(routeSummaryRawPercent);
  const routeSummaryHasPercent =
    routeSummaryRawPercent !== null &&
    routeSummaryRawPercent !== undefined &&
    routeSummaryRawPercent !== "" &&
    Number.isFinite(routeSummaryPercent);
  const routeSummaryLevel = normalizeDangerLevel(
    guidedRoute?.summary?.danger_level,
    routeSummaryHasPercent ? routeSummaryPercent : null,
  );
  const routeComparisonRows = useMemo(() => buildRouteComparisonRows(guidedRoutes), [guidedRoutes]);
  const clustersNearbyByRouteType = useMemo(() => {
    if (!Array.isArray(heatClusters) || heatClusters.length === 0) return null;
    const result = {};
    for (const route of Array.isArray(guidedRoutes) ? guidedRoutes : []) {
      if (!route?.route_type) continue;
      const path = Array.isArray(route?.path) ? route.path : [];
      if (path.length < 2) {
        result[route.route_type] = 0;
        continue;
      }
      let count = 0;
      for (const cluster of heatClusters) {
        const clat = Number(cluster?.lat ?? cluster?.latitude);
        const clng = Number(cluster?.lng ?? cluster?.longitude);
        if (!Number.isFinite(clat) || !Number.isFinite(clng)) continue;
        let near = false;
        for (let i = 0; i < path.length; i += 1) {
          const point = path[i];
          const plat = Array.isArray(point) ? Number(point[0]) : Number(point?.lat);
          const plng = Array.isArray(point) ? Number(point[1]) : Number(point?.lng);
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
          if (haversineDistanceKm([plat, plng], [clat, clng]) <= 1.5) {
            near = true;
            break;
          }
        }
        if (near) count += 1;
      }
      result[route.route_type] = count;
    }
    return result;
  }, [guidedRoutes, heatClusters]);
  const selectedRouteHazards = useMemo(
    () => buildAheadRouteHazards(guidedRoute, routeAnalysisTimestampIso),
    [guidedRoute, routeAnalysisTimestampIso],
  );
  const selectedRouteRiskProfile = useMemo(() => buildRouteRiskProfile(guidedRoute), [guidedRoute]);
  const currentRiskTimePreview = useMemo(
    () =>
      buildTimeImpactPreview({
        baselinePercent: currentRiskNowBaseline?.danger_percent,
        selectedPercent: currentRisk?.danger_percent,
        selectedTimestampLabel: selectedTimestampPreview,
      }),
    [currentRisk?.danger_percent, currentRiskNowBaseline?.danger_percent, selectedTimestampPreview],
  );
  const locationStatusText = hasValidUserLocation
    ? `Location live${locationUpdatedAt ? ` • ${formatRelativeUpdateAge(locationUpdatedAt)}` : ""}`
    : "Location unavailable";
  const riskUpdatedText = currentRiskUpdatedAt
    ? `Risk updated ${formatRelativeUpdateAge(currentRiskUpdatedAt)}`
    : "Risk not updated yet";
  const routesUpdatedText = routesUpdatedAt
    ? `Routes updated ${formatRelativeUpdateAge(routesUpdatedAt)}`
    : "Routes not updated yet";
  const nearbyUpdatedText = nearbyUpdatedAt
    ? `Nearby updated ${formatRelativeUpdateAge(nearbyUpdatedAt)}`
    : "Nearby not updated yet";
  const navigationUpdatedText = guidedRoute
    ? routesUpdatedText
    : mapLayer === "nearbyRoads"
      ? nearbyUpdatedText
      : "Navigation ready";
  // Per-source attribution (weather / darkness / historical / road) is not
  // yet implemented end-to-end on the backend. We surface a single
  // "Coming soon" notice instead of four fake buttons so the UI does not
  // suggest the feature is shipped.
  const showRiskSourceFilters = false;
  const nearbyRouteWarnings = useMemo(() => {
    if (mapLayer !== "nearbyRoads" || guidedRoute || !Array.isArray(nearbyRoutes)) {
      return [];
    }

    return nearbyRoutes
      .filter(
        (route) =>
          route?.routing_source === "straight_line" || String(route?.route_warning || "").trim(),
      )
      .map((route) => {
        const destinationName =
          route?.destination?.name || route?.destination?.id || route?.route_id || "route";
        return `${destinationName}: Routing fallback (not snapped to road)`;
      })
      .slice(0, 4);
  }, [mapLayer, guidedRoute, nearbyRoutes]);
  // Show search/destination controls always so the user can browse, but the
  // Start-guidance action still requires a live location (gated below).
  const showGuideControls = true;

  // The map canvas always renders. When live GPS is missing we centre on the
  // best available fallback so that report markers, heatmap, zones and the
  // layer switcher stay usable. Order:
  //   1. live user position (or fallback location reading)
  //   2. selected alert zone centre
  //   3. Algeria default centre
  const mapDisplayCenter = useMemo(() => {
    if (userLatLng) return userLatLng;
    const zoneCenter = normalizeAlertZoneCenter(selectedAlertZone);
    if (zoneCenter) return zoneCenter;
    return ALGERIA_FALLBACK_CENTER;
  }, [selectedAlertZone, userLatLng]);
  const mapDisplayZoom = userLatLng ? USER_ZOOM : 6;
  const usingFallbackCenter = !userLatLng;

  useEffect(() => {
    const nextRenderState = hasValidUserLocation
      ? "render_ready"
      : locationStatus === "locating"
        ? "render_locating_fallback_center"
        : "render_fallback_center";
    if (locationRenderStateRef.current === nextRenderState) {
      return;
    }
    locationRenderStateRef.current = nextRenderState;
    if (DEV) {
      console.info("[map/location]", nextRenderState, {
        location_status: locationStatus,
        has_valid_user_location: hasValidUserLocation,
        user_position: userLatLng,
        default_center_used: usingFallbackCenter,
      });
    }
  }, [hasValidUserLocation, locationStatus, userLatLng, usingFallbackCenter]);


  
  return (
    <div className={`siara-map-shell${mapMode === "navigation" ? " is-navigation" : ""}`}>
      <div className="siara-map-error-stack">
        {tileError && (
          <div className="siara-map-error">
            Tile layer error: {tileError}
          </div>
        )}
        {overlayError && (
          <div className="siara-map-error">
            Overlay error: {overlayError}
          </div>
        )}
        {nearbyRoutesError && (
          <div className="siara-map-error">
            Nearby routes error: {nearbyRoutesError}{" "}
            <button
              type="button"
              className="siara-inline-link"
              onClick={() => setNearbyManualRefreshTick((value) => value + 1)}
              style={{ marginLeft: 6 }}
            >
              Retry
            </button>
          </div>
        )}
        {guidedRouteError && (
          <div className="siara-map-error">
            Guidance error: {guidedRouteError}
          </div>
        )}
        {routeExplainState === "error" && (
          <div className="siara-map-error">
            Explain error: {routeExplainError}
          </div>
        )}
        {nearbyRouteWarnings.map((warningText, index) => (
          <div key={`${warningText}-${index}`} className="siara-map-warning">
            {warningText}
          </div>
        ))}

        
      </div>
      

      

      {mapMode === "navigation" && activeNavigationRoute ? (
        <MapLibreNavigationView
          userLocation={
            hasValidUserLocation && userPosition
              ? {
                  lat: Number(userPosition.lat),
                  lng: Number(userPosition.lng),
                  heading: Number.isFinite(Number(userPosition.heading))
                    ? Number(userPosition.heading)
                    : null,
                  accuracy: Number.isFinite(Number(userPosition.accuracy))
                    ? Number(userPosition.accuracy)
                    : null,
                  headingSource: userPosition.headingSource || "fallback",
                }
              : null
          }
          destination={activeNavigationDestination}
          selectedRoute={activeNavigationRoute}
          routes={activeNavigationRoutes}
          startedAt={activeNavigationStartedAt}
          onExitNavigation={exitNavigation}
          onChangeRouteType={(routeType) => {
            if (routeType) setSelectedGuidedRouteType(routeType);
          }}
          routeExplanation={routeExplanation}
          routeExplanationLoading={routeExplanationLoading}
          routeExplanationError={routeExplanationError}
          aiExplanationGenerating={routeExplanationAiGenerating}
          onGenerateAiExplanation={handleGenerateAiRouteExplanation}
          onSelectDepartureTimestamp={handleNavSelectDepartureTimestamp}
          geolocationStatus={liveLocationStatus || locationStatus}
          lastLocationUpdatedAt={liveLocationUpdatedAt || locationUpdatedAt || null}
          lastLocationError={liveLocationLastError || null}
          routeOrigin={routeScoringOrigin}
        />
      ) : (
        <MapContainer
          center={mapDisplayCenter}
          zoom={mapDisplayZoom}
          className="siara-leaflet-map"
          zoomControl={true}
          worldCopyJump={true}
        >
            <MapResizeFix
              deps={[
                mapLayer,
                hasValidUserLocation,
                markers.length,
                nearbyRoutes.length,
                guidedRoutes.length,
                helpOpen,
              ]}
            />

    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      eventHandlers={{
        tileerror: () => setTileError("Unable to fetch OpenStreetMap tiles."),
        load: () => setTileError(""),
      }}
    />

          {hasValidUserLocation && (
            <FlyToUser
              userPosition={userPosition}
              mapLayer={mapLayer}
              locationRequestVersion={locationRequestVersion}
              followUser={normalFollowUser}
            />
          )}
          <LeafletFollowGestureHandler onUserGesture={() => setNormalFollowUser(false)} />
          <MapClickHandler
            enabled={!guidanceActive}
            onMapClick={handleMapDestinationClick}
          />
          {/* Navigation rendering is delegated to MapLibreNavigationView when
              mapMode === "navigation". Leaflet stays mounted only for normal
              mode, so no in-Leaflet navigation overlays are required here. */}
          {pendingMapDestination && !guidanceActive && (
            <CircleMarker
              center={[pendingMapDestination.lat, pendingMapDestination.lng]}
              radius={9}
              pathOptions={{
                color: "#FFFFFF",
                weight: 3,
                fillColor: "#2563EB",
                fillOpacity: 0.95,
              }}
            >
              <Tooltip direction="top" sticky>
                {pendingMapDestinationName || "Selected destination"}
              </Tooltip>
            </CircleMarker>
          )}
          {mapLayer === "zones" && selectedAlertZone ? (
            <FocusAlertZone
              mapLayer={mapLayer}
              selectedAlertZone={selectedAlertZone}
            />
          ) : null}
          {mapLayer === "nearbyRoads" && !guidedRoute && nearbyRoutes.length > 0 && (
            <FitNearbyRoutesOnDemand
              mapLayer={mapLayer}
              nearbyRoutes={nearbyRoutes}
              fitVersion={nearbyFitVersion}
            />
          )}
          {guidedRoute && !guidanceActive && mapMode !== "navigation" ? (
            <FitGuidedRoute
              routes={guidedRoutes}
              fitVersion={guidedRouteFitVersion}
              enabled={!guidanceActive && mapMode !== "navigation"}
            />
          ) : null}

          {mapLayer === "heatmap" && (
            <>
              <MapBoundsTracker
                enabled
                onBoundsChange={handleHeatmapBoundsChange}
              />
              {heatClusters.map((cluster) => (
                <AccidentHeatClusterMarker
                  key={cluster.id}
                  cluster={cluster}
                  onExplain={(c) => {
                    setSelectedHeatCluster(c || cluster);
                    setHeatClusterPanelOpen(true);
                  }}
                />
              ))}
            </>
          )}

          {mapLayer === "zones" && alertZones.length > 0 && (
            <Pane name="alert-zone-layer" style={{ zIndex: 650 }}>
              {alertZones.map((alertZone) => {
                const isSelected = alertZone.id === selectedAlertZoneId;
                const zoneGeometry = normalizeAlertZoneGeometry(alertZone);
                const zoneCenter = normalizeAlertZoneCenter(alertZone);
                const zonePathOptions = getAlertZonePathOptions(alertZone.severity, isSelected);

                const handleZoneSelect = () => {
                  if (typeof onAlertZoneSelect === "function") {
                    onAlertZoneSelect(alertZone.id);
                  }
                };

                if (alertZone.zone?.zoneType === "radius" && zoneCenter && Number.isFinite(Number(alertZone.zone.radiusM))) {
                  return (
                    <Circle
                      key={`alert-zone-radius-${alertZone.id}`}
                      center={zoneCenter}
                      radius={Number(alertZone.zone.radiusM)}
                      pathOptions={zonePathOptions}
                      eventHandlers={{
                        click: handleZoneSelect,
                      }}
                    >
                      <Tooltip direction="top" className="siara-risk-tooltip">
                        <span
                          className="siara-risk-tooltip__pill"
                          style={{
                            "--risk-color": getAlertZoneColor(alertZone.severity),
                            "--risk-text-color": "#ffffff",
                          }}
                        >
                          {alertZone.zone?.displayName || alertZone.area?.name || alertZone.name}
                        </span>
                      </Tooltip>
                      <Popup>
                        <div className="siara-zone-popup">
                          <strong className="siara-zone-popup-title">{alertZone.name}</strong>
                          <span className="siara-zone-popup-subtitle">
                            {alertZone.zone?.displayName || alertZone.area?.name || "Alert zone"}
                          </span>
                          <div className="siara-zone-popup-row"><span>Severity</span><strong>{alertZone.severity}</strong></div>
                          <div className="siara-zone-popup-row"><span>Schedule</span><strong>{alertZone.timeWindow}</strong></div>
                          <div className="siara-zone-popup-row"><span>Triggers</span><strong>{alertZone.triggerCount}</strong></div>
                          <div className="siara-zone-popup-row"><span>Last trigger</span><strong>{alertZone.lastTriggered || "Never"}</strong></div>
                        </div>
                      </Popup>
                    </Circle>
                  );
                }

                if (!zoneGeometry) {
                  return null;
                }

                return (
                  <GeoJSON
                    key={`alert-zone-geom-${alertZone.id}`}
                    data={zoneGeometry}
                    style={zonePathOptions}
                    eventHandlers={{
                      click: handleZoneSelect,
                    }}
                  >
                    <Tooltip direction="top" className="siara-risk-tooltip">
                      <span
                        className="siara-risk-tooltip__pill"
                        style={{
                          "--risk-color": getAlertZoneColor(alertZone.severity),
                          "--risk-text-color": "#ffffff",
                        }}
                      >
                        {alertZone.zone?.displayName || alertZone.area?.name || alertZone.name}
                      </span>
                    </Tooltip>
                    <Popup>
                      <div className="siara-zone-popup">
                        <strong className="siara-zone-popup-title">{alertZone.name}</strong>
                        <span className="siara-zone-popup-subtitle">
                          {alertZone.zone?.displayName || alertZone.area?.name || "Alert zone"}
                        </span>
                        <div className="siara-zone-popup-row"><span>Severity</span><strong>{alertZone.severity}</strong></div>
                        <div className="siara-zone-popup-row"><span>Schedule</span><strong>{alertZone.timeWindow}</strong></div>
                        <div className="siara-zone-popup-row"><span>Triggers</span><strong>{alertZone.triggerCount}</strong></div>
                        <div className="siara-zone-popup-row"><span>Last trigger</span><strong>{alertZone.lastTriggered || "Never"}</strong></div>
                      </div>
                    </Popup>
                  </GeoJSON>
                );
              })}
            </Pane>
          )}

          <Pane name="risk-layer" style={{ zIndex: 9999 }}>
            {guidedRoutes
              .slice()
              .sort((left, right) => {
                const leftSelected = left.route_type === guidedRoute?.route_type ? 1 : 0;
                const rightSelected = right.route_type === guidedRoute?.route_type ? 1 : 0;
                return leftSelected - rightSelected;
              })
              .map((route) => {
                const routePath = getSegmentPath({ path: route?.path });
                if (!routePath) {
                  return null;
                }

                const isSelected = route.route_type === guidedRoute?.route_type;
                const routePercent = formatPercent(route?.summary?.danger_percent);
                const routeLevel = normalizeDangerLevel(
                  route?.summary?.danger_level,
                  route?.summary?.danger_percent,
                );
                const tooltipColor = isSelected ? route.route_color : INACTIVE_GUIDED_ROUTE_COLOR;
                const routeTooltipStyle = {
                  "--risk-color": tooltipColor,
                  "--risk-text-color": getContrastTextColor(tooltipColor),
                };

                return (
                  <Polyline
                    key={`guided-route-${route.route_type}`}
                    positions={routePath}
                    pathOptions={{
                      color: isSelected ? route.route_color : INACTIVE_GUIDED_ROUTE_COLOR,
                      weight: isSelected ? 8 : 5,
                      opacity: isSelected ? 0.88 : 0.82,
                      dashArray: isSelected ? undefined : route.inactive_dash_array,
                    }}
                    eventHandlers={{
                      click: () => handleGuidedRouteSelection(route.route_type),
                    }}
                  >
                    <Tooltip sticky direction="top" className="siara-risk-tooltip">
                      <span className="siara-risk-tooltip__pill" style={routeTooltipStyle}>
                        {route.route_label}
                        {routePercent != null ? ` - ${routePercent}% (${routeLevel})` : ""}
                        {Number.isFinite(Number(route?.duration_min))
                          ? ` - ${Number(route.duration_min).toFixed(1)} min`
                          : ""}
                      </span>
                    </Tooltip>
                  </Polyline>
                );
              })}

            {guidedRoute?.segments?.map((segment) => {
              const segmentPath = getSegmentPath({ path: segment?.path });
              if (!segmentPath) return null;

              const segmentPercent = formatPercent(segment?.danger_percent);
              const segmentLevel = normalizeDangerLevel(segment?.danger_level, segment?.danger_percent);
              const segmentColor = getDangerColor(segmentLevel);
              const segmentTooltipStyle = {
                "--risk-color": segmentColor,
                "--risk-text-color": getContrastTextColor(segmentColor),
              };

              return (
                <Polyline
                  key={segment.segment_id}
                  positions={segmentPath}
                  pathOptions={{ color: segmentColor, weight: 6, opacity: 0.95 }}
                  eventHandlers={{
                    click: () => handleGuidedSegmentClick(segment),
                  }}
                >
                  {segmentPercent != null && (
                    <Tooltip sticky direction="top" className="siara-risk-tooltip">
                      <span className="siara-risk-tooltip__pill" style={segmentTooltipStyle}>
                        {segmentPercent}% ({segmentLevel})
                      </span>
                    </Tooltip>
                  )}
                </Polyline>
              );
            })}

            {guidedRoute && (
              <>
                {userLatLng && (
                  <CircleMarker
                    center={userLatLng}
                    radius={7}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: isFallbackPosition ? "#f59e0b" : "#7c3aed",
                      fillOpacity: 0.95,
                      dashArray: isFallbackPosition ? "4 3" : undefined,
                    }}
                  >
                    <Tooltip direction="top">
                      {isFallbackPosition ? "Fallback test start" : "Start"}
                    </Tooltip>
                  </CircleMarker>
                )}
                {normalizePosition(guidedRoute?.destination) && (
                  <CircleMarker
                    center={normalizePosition(guidedRoute.destination)}
                    radius={7}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: guidedRoute.route_color || "#111827",
                      fillOpacity: 0.95,
                    }}
                  >
                    <Tooltip direction="top">
                      {guidedRoute?.destination?.name || "Destination"}
                    </Tooltip>
                  </CircleMarker>
                )}
              </>
            )}

            {mapLayer === "nearbyRoads" && !guidedRoute &&
              nearbyRoutes.flatMap((route) => {
                const destinationPos = normalizePosition(route?.destination);
                const destinationName =
                  route?.destination?.name || route?.destination?.id || "Nearby route";
                const isFallbackRoute =
                  route?.routing_source === "straight_line" || route?.route_warning === "osrm_failed";
                const routePercent = Number(route?.summary?.danger_percent);
                const routeLevel = normalizeDangerLevel(route?.summary?.danger_level, routePercent);
                const routeColor = isFallbackRoute ? "#64748b" : getDangerColor(routeLevel);
                const routeTooltipStyle = {
                  "--risk-color": routeColor,
                  "--risk-text-color": getContrastTextColor(routeColor),
                };

                const candidateSegments =
                  Array.isArray(route?.segments) && route.segments.length > 0
                    ? route.segments
                    : [
                        {
                          path: route?.path,
                          danger_percent: route?.summary?.danger_percent,
                          danger_level: route?.summary?.danger_level,
                        },
                      ];

                const rendered = [];

                candidateSegments.forEach((segment, index) => {
                  const segmentPath = getSegmentPath({ path: segment?.path });
                  if (!segmentPath) return;

                  const segmentPercent = Number(segment?.danger_percent);
                  const segmentLevel = normalizeDangerLevel(segment?.danger_level, segmentPercent);
                  const segmentColor = isFallbackRoute ? "#64748b" : getDangerColor(segmentLevel);
                  const segmentTooltipStyle = {
                    "--risk-color": segmentColor,
                    "--risk-text-color": getContrastTextColor(segmentColor),
                  };

                  rendered.push(
                    <Polyline
                      key={`${route.route_id || destinationName}-seg-${index}`}
                      positions={segmentPath}
                      pathOptions={{
                        color: segmentColor,
                        weight: isFallbackRoute ? 4 : 5,
                        opacity: 0.9,
                        dashArray: isFallbackRoute ? "8 8" : undefined,
                      }}
                    >
                      {Number.isFinite(segmentPercent) && (
                        <Tooltip sticky direction="top" className="siara-risk-tooltip">
                          <span className="siara-risk-tooltip__pill" style={segmentTooltipStyle}>
                            {destinationName} - {Math.round(segmentPercent)}% ({segmentLevel})
                          </span>
                        </Tooltip>
                      )}
                    </Polyline>,
                  );
                });

                if (destinationPos) {
                  rendered.push(
                    <CircleMarker
                      key={`${route.route_id || destinationName}-dest`}
                      center={destinationPos}
                      radius={6}
                      pathOptions={{
                        color: "#ffffff",
                        weight: 2,
                        fillColor: routeColor,
                        fillOpacity: 0.95,
                      }}
                    >
                      {Number.isFinite(routePercent) && (
                        <Tooltip direction="top" className="siara-risk-tooltip">
                          <span className="siara-risk-tooltip__pill" style={routeTooltipStyle}>
                            {destinationName} - {Math.round(routePercent)}% ({routeLevel})
                          </span>
                        </Tooltip>
                      )}
                    </CircleMarker>,
                  );
                }

                return rendered;
              })}

            {(mapLayer === "points" || mapLayer === "ai") &&
              markers.map((marker) => {
                const position = normalizePosition(marker);
                if (!position) return null;

                const overlay = overlayBySegment[String(marker.id)];
                const segmentPath = getSegmentPath(marker);
                const isAi = mapLayer === "ai";
                const color = isAi
                  ? getDangerColor(overlay?.danger_level)
                  : getIncidentColor(marker.severity);
                const percent = overlay?.danger_percent;
                const aiTooltipStyle = isAi
                  ? {
                      "--risk-color": color,
                      "--risk-text-color": getContrastTextColor(color),
                    }
                  : undefined;

                if (isAi && segmentPath) {
                  return (
                    <Polyline
                      key={`segment-${marker.id}`}
                      positions={segmentPath}
                      pathOptions={{ color, weight: 6, opacity: 0.85 }}
                      eventHandlers={{
                        click: () => handleFeatureClick(marker),
                      }}
                    >
                      {Number.isFinite(percent) && (
                        <Tooltip sticky direction="top" className="siara-risk-tooltip">
                          <span className="siara-risk-tooltip__pill" style={aiTooltipStyle}>
                            {Math.round(percent)}% - {overlay?.danger_level || "unknown"}
                          </span>
                        </Tooltip>
                      )}
                    </Polyline>
                  );
                }

                if (!isAi) {
                  return (
                    <ReportMapMarker
                      key={`report-${marker.id}`}
                      report={marker}
                      tooltipPane="risk-layer"
                      onClick={() => handleFeatureClick(marker)}
                      onTooltipVisibilityChange={setReportTooltipVisible}
                    />
                  );
                }

                return (
                  <CircleMarker
                    key={`point-${marker.id}`}
                    center={position}
                    radius={9}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: color,
                      fillOpacity: 0.95,
                    }}
                    eventHandlers={{
                      click: () => handleFeatureClick(marker),
                    }}
                  >
                    {Number.isFinite(percent) && (
                      <Tooltip
                        permanent
                        direction="top"
                        offset={[0, -8]}
                        className="siara-risk-tooltip"
                      >
                        <span className="siara-risk-tooltip__pill" style={aiTooltipStyle}>
                          {Math.round(percent)}%
                        </span>
                      </Tooltip>
                    )}
                  </CircleMarker>
                );
              })}
          </Pane>

          {userLatLng && !guidedRoute && (
            <CircleMarker
              center={userLatLng}
              radius={8}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: isFallbackPosition ? "#f59e0b" : "#7c3aed",
                fillOpacity: 1,
                dashArray: isFallbackPosition ? "4 3" : undefined,
              }}
            >
              <Tooltip direction="top">
                {isFallbackPosition ? "Fallback test location" : "You are here"}
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      )}

      {mapLayer === "heatmap" && mapMode !== "navigation" ? (
        <>
          {heatClustersState === "loading" ? (
            <div className="accident-heat-status" role="status">
              <span className="accident-heat-status__spinner" aria-hidden="true" />
              Loading accident heatmap…
            </div>
          ) : null}
          {heatClustersState === "error" ? (
            <div
              className="accident-heat-status accident-heat-status--error"
              role="alert"
            >
              {heatClustersError || "Could not load accident heatmap."}
            </div>
          ) : null}
          {heatClustersState === "success" && heatClusters.length === 0 ? (
            <div className="accident-heat-status" role="status">
              No accident reports in this area for the selected period.
            </div>
          ) : null}
          <div className="accident-heat-legend" role="region" aria-label="Heatmap legend">
            <p className="accident-heat-legend__title">Accident heatmap</p>
            <p className="accident-heat-legend__sub">
              Circle size = number of reports. Rings = severity mix.
            </p>
            <div className="accident-heat-legend__row">
              <span
                className="accident-heat-legend__dot"
                style={{ background: HEATMAP_LEGEND_COLORS.high }}
              />
              <span>High</span>
            </div>
            <div className="accident-heat-legend__row">
              <span
                className="accident-heat-legend__dot"
                style={{ background: HEATMAP_LEGEND_COLORS.medium }}
              />
              <span>Medium</span>
            </div>
            <div className="accident-heat-legend__row">
              <span
                className="accident-heat-legend__dot"
                style={{ background: HEATMAP_LEGEND_COLORS.low }}
              />
              <span>Low</span>
            </div>
          </div>
        </>
      ) : null}

      <MapDestinationConfirmCard
        open={Boolean(pendingMapDestination) && !guidanceActive}
        destination={pendingMapDestination}
        destinationName={pendingMapDestinationName}
        loading={pendingDestinationLoading}
        error={pendingDestinationError}
        starting={pendingTravelStarting}
        startError={pendingTravelError}
        onConfirm={startTravelFromPending}
        onCancel={clearPendingMapDestination}
      />

      {/* NavigationBanner and NavigationSummaryCard are rendered inside
          MapLibreNavigationView while in navigation mode. */}

      {!hasValidUserLocation && mapMode !== "navigation" && (
        <div
          className="siara-map-warning siara-map-location-hint"
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(17, 24, 39, 0.78)",
            color: "#ffffff",
            fontSize: 13,
            boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
          }}
        >
          <LocationOnOutlinedIcon fontSize="inherit" />
          <span>
            {locationStatus === "locating"
              ? "Locating your device..."
              : "Enable location for live risk and navigation."}
          </span>
          {typeof requestLocation === "function" &&
            locationStatus !== "locating" && (
              <button
                type="button"
                className="siara-guide-btn"
                onClick={requestLocation}
                style={{ marginLeft: 6 }}
              >
                Enable
              </button>
            )}
        </div>
      )}

      {(() => {
      const riskAside = (
      <aside className={`siara-map-aside${riskPanelTarget ? " siara-map-aside--docked" : ""}${reportTooltipVisible ? " siara-overlay-dimmed" : ""}`}>
        <div className="siara-risk-debug">
          <div className="srd-header">
            <div className="srd-title-row">
              <span className="srd-live-dot" />
              <h4>Current SIARA risk</h4>
            </div>
            <div className="siara-status-pills">
              <span className="siara-status-pill">{locationStatusText}</span>
              <span className="siara-status-pill">{riskUpdatedText}</span>
              <span className="siara-status-pill">{navigationUpdatedText}</span>
            </div>
          </div>
          <div
            className="srd-subtitle"
            style={{ fontSize: 12, opacity: 0.85, marginTop: 4, fontWeight: 600 }}
          >
            {occurrenceHeadline
              ? "Accident occurrence risk"
              : "Relative danger — severity-informed model"}
          </div>
          <p style={{ fontSize: 11, opacity: 0.7, marginTop: 2, marginBottom: 8 }}>
            {occurrenceHeadline ? (
              <>
                Calibrated probability that an accident occurs here
                {occurrenceHeadline.personalized ? ", personalized to your driver profile" : ""}.
                {' '}· Model: <strong>{occurrenceHeadline.modelVersion}</strong>
              </>
            ) : (
              <>
                {currentRisk?.dangerZoneRisk?.warning
                  || "Severity-informed relative danger score. This is not a calibrated accident-occurrence probability."}
                {currentRisk?.dangerZoneRisk?.modelVersion ? (
                  <>
                    {' '}· Model: <strong>{currentRisk.dangerZoneRisk.modelVersion}</strong>
                  </>
                ) : null}
              </>
            )}
          </p>
          {!hasValidUserLocation && (
            <>
              <p>Location is required for SIARA risk prediction.</p>
              {locationStatus === "locating" && <p>Locating your device...</p>}
              {(locationStatus === "prompt" || locationStatus === "unknown") &&
                typeof requestLocation === "function" && (
                  <button
                    type="button"
                    className="siara-guide-btn siara-guide-btn-primary"
                    onClick={requestLocation}
                  >
                    Enable location
                  </button>
                )}
              {locationStatus === "denied" && (
                <p>
                  Location access is blocked. Enable location permissions in your browser settings,
                  then refresh this page.
                </p>
              )}
              {locationError && <p className="risk-debug-error">{locationError}</p>}
            </>
          )}
          {hasValidUserLocation && locationAccuracyText && <p className="srd-accuracy"><LocationOnOutlinedIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />accuracy: {locationAccuracyText}</p>}
          {hasValidUserLocation && locationWarning && <p className="risk-debug-error">{locationWarning}</p>}
          {hasValidUserLocation && currentRiskState === "idle" && <p>Loading current risk...</p>}
          {hasValidUserLocation && currentRiskState === "loading" && <p>Loading current risk...</p>}
          {hasValidUserLocation && !currentRisk && currentRiskState === "error" && <p className="risk-debug-error">{currentRiskError}</p>}
          {hasValidUserLocation &&
            (currentRiskState === "success" || currentRiskState === "refreshing") &&
            currentRisk && (
            <>
              {(() => {
                const heroColor = occurrenceHeadline
                  ? occurrenceHeadline.color
                  : getDangerColor(currentRisk.danger_level);
                const heroPercent = occurrenceHeadline
                  ? occurrenceHeadline.percent
                  : currentRisk.danger_percent;
                const heroLabel = occurrenceHeadline
                  ? occurrenceHeadline.label
                  : currentRisk.danger_level;
                const gaugeLeft = occurrenceHeadline
                  ? occurrenceHeadline.gaugePct
                  : Math.min(100, Math.max(0, Number(currentRisk.danger_percent) || 0));
                return (
                  <>
                    <div className="srd-risk-hero">
                      <strong className="risk-debug-percent" style={{ color: heroColor }}>
                        {heroPercent}%
                      </strong>
                      <span
                        className="srd-danger-level-badge"
                        style={{ background: heroColor + '18', color: heroColor, border: `1px solid ${heroColor}30` }}
                      >
                        {heroLabel}
                      </span>
                    </div>
                    <div className="srd-gauge">
                      <div className="srd-gauge-track" />
                      <div
                        className="srd-gauge-thumb"
                        style={{ left: `calc(${gaugeLeft}% - 7px)`, borderColor: heroColor }}
                      />
                      <div className="srd-gauge-labels">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                      </div>
                    </div>
                  </>
                );
              })()}
              {currentRiskError && (
                <p className="risk-debug-error">{currentRiskError}</p>
              )}
              {currentRiskState === "refreshing" && <p className="srd-refreshing">Refreshing…</p>}
              <div className="siara-badge-row">
                <span className="siara-compact-badge">Confidence: {compactConfidenceLabel}</span>
                <span className="siara-compact-badge">Data quality: {compactQualityLabel}</span>
                <button
                  type="button"
                  className="siara-inline-link"
                  onClick={handleExplainRiskClick}
                  disabled={explanationLoading}
                >
                  {explanationOpen ? "Hide" : "Why?"}
                </button>
                <MuiTooltip title="Confidence details">
                  <IconButton
                    type="button"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(124, 58, 237, 0.10)",
                      color: "#7A3DF0",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.15s",
                      padding: 0,
                      flexShrink: 0,
                    }}
                    onClick={() => setHelpOpen((prev) => !prev)}
                    aria-label="Show confidence details"
                  >
                    <QuestionMarkIcon style={{ fontSize: 13 }} />
                  </IconButton>
                </MuiTooltip>
              </div>
              {severityProbabilities && (
                <div className="siara-occurrence-card" role="group" aria-label="Severity outlook">
                  <div className="siara-occurrence-card__title">
                    Severity outlook{severityConfidenceLabel ? ` · ${severityConfidenceLabel} confidence` : ""}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    {[1, 2, 3, 4].map((k) => {
                      const pct = Number(severityProbabilities[`severity_${k}`]) || 0;
                      const isTop = mostLikelySeverity === k;
                      const barColor =
                        k >= 3 ? getDangerColor("high") : k === 2 ? getDangerColor("medium") : getDangerColor("low");
                      return (
                        <div
                          key={k}
                          style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: isTop ? 700 : 400 }}
                        >
                          <span style={{ width: 38, fontSize: 11, color: "#475569" }}>Sev {k}</span>
                          <span
                            style={{
                              position: "relative",
                              flex: 1,
                              height: 7,
                              background: "rgba(148,163,184,0.25)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                insetBlock: 0,
                                left: 0,
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                background: barColor,
                                borderRadius: 4,
                              }}
                            />
                          </span>
                          <span style={{ width: 44, textAlign: "right", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {expectedSeverity != null && (
                    <p className="siara-occurrence-card__line" style={{ marginTop: 6 }}>
                      Most likely: Severity {mostLikelySeverity} · Expected: {expectedSeverity} / 4
                    </p>
                  )}
                </div>
              )}
              {(occurrenceRiskLoading || occurrenceRisk || occurrenceRiskError) && (
                <div className="siara-occurrence-card" role="status">
                  <div className="siara-occurrence-card__title">
                    Occurrence Risk
                  </div>
                  {occurrenceRiskLoading && (
                    <p className="siara-occurrence-card__line">Computing occurrence risk...</p>
                  )}
                  {!occurrenceRiskLoading && occurrenceRiskError && (
                    <p className="siara-occurrence-card__line siara-occurrence-card__error">
                      {occurrenceRiskError}
                    </p>
                  )}
                  {!occurrenceRiskLoading && !occurrenceRiskError && occurrenceRisk && (
                    (() => {
                      // Preferred source: the new explicit `occurrenceRisk` /
                      // `personalizedRisk` wrappers added on the backend. Fall
                      // back to the older `modelOnly` / `personalized` shape,
                      // and ultimately to the legacy rule-fusion fields, so the
                      // card never blanks out during a partial deploy.
                      const occurrenceWrap = occurrenceRisk.occurrenceRisk || null;
                      const personalizedWrap = occurrenceRisk.personalizedRisk || null;
                      const modelOnlyBlock = occurrenceRisk.modelOnly || null;
                      const personalizedBlock = occurrenceRisk.personalized || null;
                      const driverMeta = occurrenceRisk.driver_meta || {};
                      const scoringSource = occurrenceRisk.scoring_source
                        || occurrenceWrap?.source
                        || (modelOnlyBlock ? 'trained_model' : 'rule_fusion');
                      const modelProbability =
                        occurrenceWrap?.calibratedProbability != null
                          ? Number(occurrenceWrap.calibratedProbability)
                          : occurrenceWrap?.score != null
                            ? Number(occurrenceWrap.score)
                            : modelOnlyBlock?.calibrated_probability != null
                              ? Number(modelOnlyBlock.calibrated_probability)
                              : modelOnlyBlock?.risk_score != null
                                ? Number(modelOnlyBlock.risk_score)
                                : Number(occurrenceRisk.global_occurrence_score || 0);
                      const personalizedProbability =
                        personalizedWrap?.score != null
                          ? Number(personalizedWrap.score)
                          : personalizedBlock?.calibrated_probability != null
                            ? Number(personalizedBlock.calibrated_probability)
                            : personalizedBlock?.risk_score != null
                              ? Number(personalizedBlock.risk_score)
                              : Number(occurrenceRisk.personalized_occurrence_score || 0);
                      const modelLevel = occurrenceWrap?.riskLevel
                        || modelOnlyBlock?.risk_level
                        || occurrenceRisk.global_risk_level
                        || 'low';
                      const personalizedLevel = personalizedWrap?.riskLevel
                        || personalizedBlock?.risk_level
                        || occurrenceRisk.personalized_risk_level
                        || modelLevel;
                      const driverApplied = Boolean(personalizedWrap)
                        || personalizedBlock?.driver_behavior_applied
                        || occurrenceRisk.driver_behavior?.has_driver_profile
                        || false;
                      const behaviorMultiplier = Number(
                        personalizedWrap?.driverMultiplier
                        ?? personalizedBlock?.behavior_multiplier
                        ?? occurrenceRisk.driver_behavior?.multiplier
                        ?? 1,
                      );
                      const behaviorDelta = Number(
                        personalizedWrap?.behaviorDelta
                        ?? personalizedBlock?.behavior_delta
                        ?? 0,
                      );
                      const driverScore = personalizedWrap?.driverRiskScore
                        ?? personalizedBlock?.driver_risk_score
                        ?? driverMeta.latest_risk_score
                        ?? occurrenceRisk.driver_behavior?.latest_risk_score
                        ?? null;
                      const driverLabel = personalizedWrap?.driverResultLabel
                        ?? personalizedBlock?.driver_result_label
                        ?? driverMeta.latest_result_label
                        ?? occurrenceRisk.driver_behavior?.latest_result_label
                        ?? null;
                      const driverTitle = personalizedBlock?.driver_result_title
                        ?? driverMeta.latest_result_title
                        ?? null;
                      const baseExplanation = personalizedBlock?.explanation?.base_model
                        || 'Road/time risk from the trained occurrence model (road, weather, time, history).';
                      const driverEffectExplanation = personalizedBlock?.explanation?.driver_effect
                        || (driverApplied
                          ? 'Personalized using your latest driver quiz result.'
                          : 'No driver behavior profile available — personalized score equals the model score.');
                      const probabilityWarning =
                        occurrenceRisk.probability_warning
                        || modelOnlyBlock?.probability_warning
                        || (scoringSource === 'trained_model'
                          ? 'Probabilities should be interpreted as relative operational risk (model trained with sampled negatives).'
                          : 'Relative occurrence-risk estimate. Not a calibrated probability yet.');
                      const modelVersion = occurrenceRisk.model_version
                        || modelOnlyBlock?.model_version
                        || 'occurrence_beta_v1';
                      const showAsProbability = scoringSource === 'trained_model';
                      return (
                        <>
                          <div className="siara-occurrence-card__section">
                            <div className="siara-occurrence-card__section-title">
                              Occurrence risk — road/time model
                            </div>
                            <div className="siara-occurrence-card__row">
                              <span>{showAsProbability ? 'Calibrated probability' : 'Score'}</span>
                              <strong style={{ color: occurrenceRiskColor(modelLevel) }}>
                                {Math.round((modelProbability || 0) * 100)}% ·{' '}
                                {occurrenceRiskLabel(modelLevel)}
                              </strong>
                            </div>
                            <div className="siara-occurrence-card__meta">
                              Model: <strong>{modelVersion}</strong> · source: {scoringSource}
                            </div>
                            <div className="siara-occurrence-card__meta" style={{ fontSize: 11, opacity: 0.75 }}>
                              Trained occurrence model output. Treat as relative operational risk per hour bucket — not a calibrated probability — until calibration is shipped.
                            </div>
                            {Array.isArray(modelOnlyBlock?.top_factors)
                              && modelOnlyBlock.top_factors.length > 0 && (
                                <ul className="siara-occurrence-card__factors">
                                  {modelOnlyBlock.top_factors.slice(0, 3).map((factor, index) => {
                                    const featureKey = stripFeaturePrefix(factor?.feature);
                                    const label = humanizeOccurrenceFeature(factor?.feature);
                                    const direction = factor?.direction === 'decreases_risk' ? '↓' : '↑';
                                    const directionLabel = factor?.direction === 'decreases_risk'
                                      ? 'lowers risk'
                                      : 'raises risk';
                                    const valueDisplay = formatOccurrenceFactorValue(factor?.value);
                                    return (
                                      <li key={`${featureKey || 'factor'}-${index}`}>
                                        <strong>{label}</strong>{' '}
                                        <span style={{ opacity: 0.8 }}>
                                          {direction} {directionLabel}
                                        </span>
                                        {valueDisplay != null ? (
                                          <span style={{ opacity: 0.65 }}> · value {valueDisplay}</span>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                          </div>

                          <div className="siara-occurrence-card__section">
                            <div className="siara-occurrence-card__section-title">
                              Personalized risk — adjusted by driver profile
                            </div>
                            <div className="siara-occurrence-card__row">
                              <span>{showAsProbability ? 'Calibrated probability' : 'Score'}</span>
                              <strong style={{ color: occurrenceRiskColor(personalizedLevel) }}>
                                {Math.round((personalizedProbability || 0) * 100)}% ·{' '}
                                {occurrenceRiskLabel(personalizedLevel)}
                              </strong>
                            </div>
                            <div className="siara-occurrence-card__meta">
                              {driverApplied
                                ? `Driver quiz applied · ×${behaviorMultiplier.toFixed(2)}${
                                    Number.isFinite(behaviorDelta) && behaviorDelta !== 0
                                      ? ` · Δ ${behaviorDelta > 0 ? '+' : ''}${Math.round(behaviorDelta * 100)}pp`
                                      : ''
                                  }${driverScore != null ? ` · score ${Math.round(driverScore)}/100` : ''}`
                                : 'No driver behavior profile is available yet. Complete the driver quiz to personalize this risk.'}
                            </div>
                            {(driverTitle || driverLabel) && (
                              <div className="siara-occurrence-card__meta">
                                Latest quiz: {driverTitle || driverLabel}
                              </div>
                            )}
                            <div className="siara-occurrence-card__meta">
                              {baseExplanation}
                            </div>
                            <div className="siara-occurrence-card__meta">
                              {driverEffectExplanation}
                            </div>
                          </div>

                          <div className="siara-occurrence-card__warning">
                            {probabilityWarning}
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              )}
              {explanationOpen && (
                <div className="siara-explain-card" role="status">
                  {explanationLoading && (
                    <p className="siara-explain-card__text">
                      SIARA is preparing an explanation...
                    </p>
                  )}
                  {!explanationLoading && explanationError && (
                    <p className="siara-explain-card__text siara-explain-card__text--error">
                      {explanationError}
                    </p>
                  )}
                  {!explanationLoading && !explanationError && explanationText && (
                    <>
                      <p className="siara-explain-card__text">{explanationText}</p>
                      {explanationSource && (
                        <span
                          className={`siara-explain-card__badge${
                            explanationSource === "ollama"
                              ? " siara-explain-card__badge--ai"
                              : ""
                          }`}
                        >
                          {explanationSource === "ollama"
                            ? "AI explanation"
                            : "Generated from available factors"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
          {guidedRoute && (
            <>
              <hr />
              <p>
                {guidedRoute.route_label} risk:{" "}
                <strong style={{ color: guidedRoute.route_color || getDangerColor(routeSummaryLevel) }}>
                  {routeSummaryHasPercent
                    ? `${formatPercent(routeSummaryPercent)}% (${routeSummaryLevel})`
                    : "risk unavailable"}
                </strong>
              </p>
              {Number.isFinite(Number(guidedRoute?.distance_km)) && (
                <p>distance: {Number(guidedRoute.distance_km).toFixed(2)} km</p>
              )}
              {Number.isFinite(Number(guidedRoute?.duration_min)) && (
                <p>eta: {Number(guidedRoute.duration_min).toFixed(1)} min</p>
              )}
              {timePresetMs !== "0" && (
                <p>Route forecast time: {selectedTimestampPreview}</p>
              )}
              <div className="siara-route-explanation-slot">
                <RouteExplanationCard
                  loading={routeExplanationLoading}
                  error={routeExplanationError}
                  summary={routeExplanation?.summary || ""}
                  reasons={routeExplanation?.reasons || []}
                  comparison={routeExplanation?.comparison || null}
                  recommendedRouteType={
                    routeExplanation?.recommendedRouteType || guidedRoute?.route_type || ""
                  }
                  recommendedRiskLevel={
                    routeExplanation?.recommendedRiskLevel ||
                    guidedRoute?.summary?.danger_level ||
                    ""
                  }
                  recommendedRiskPercent={
                    routeExplanation?.recommendedRiskPercent ??
                    guidedRoute?.summary?.danger_percent ??
                    null
                  }
                  details={
                    routeExplanation?.source === "ollama"
                      ? "Generated by SIARA AI explainer (Ollama). Sources: route risk samples, alternative comparison, nearby heat clusters, and time-of-day."
                      : routeExplanation?.source === "fallback"
                        ? "Template explanation generated from route risk samples and alternative comparison."
                        : ""
                  }
                />
              </div>
              <RouteComparisonPanel
                routes={routeComparisonRows}
                selectedRouteType={guidedRoute?.route_type}
                onSelect={handleGuidedRouteSelection}
                clustersNearbyByRouteType={clustersNearbyByRouteType}
              />
              <BestTimeToLeavePanel
                enabled={mapMode !== "navigation"}
                origin={normalizePosition(userPosition)
                  ? { lat: Number(userPosition.lat), lng: Number(userPosition.lng) }
                  : null}
                destination={
                  guidedRoute?.destination
                    ? { lat: Number(guidedRoute.destination.lat), lng: Number(guidedRoute.destination.lng) }
                    : selectedDestination
                      ? { lat: Number(selectedDestination.lat), lng: Number(selectedDestination.lng) }
                      : null
                }
                onSelectTimestamp={(timestampIso) => {
                  if (!timestampIso) return;
                  setTimePresetMs("custom");
                  setCustomTimestampLocal(toDateTimeLocalValue(new Date(timestampIso)));
                }}
              />
              <div className="siara-route-panel">
                <div className="siara-route-panel__head">
                  <h5>Risk along route</h5>
                  <span>Selected route profile</span>
                </div>
                {selectedRouteRiskProfile.length > 0 ? (
                  <>
                    <div className="siara-route-profile">
                      {selectedRouteRiskProfile.map((segment) => (
                        <span
                          key={`profile-${segment.segment_id}`}
                          className="siara-route-profile__segment"
                          style={{
                            width: `${segment.width_percent}%`,
                            background: segment.color,
                          }}
                        />
                      ))}
                    </div>
                    <div className="siara-route-profile__labels">
                      <span>Start</span>
                      <span>End</span>
                    </div>
                  </>
                ) : (
                  <p>No route profile available yet.</p>
                )}
              </div>
              <div className="siara-route-panel">
                <div className="siara-route-panel__head">
                  <h5>Ahead on your route</h5>
                  <span>Selected route only</span>
                </div>
                {selectedRouteHazards.length > 0 ? (
                  <ul className="siara-route-panel__list">
                    {selectedRouteHazards.map((hazard) => (
                      <li key={hazard}>{hazard}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No strong hazard concentration detected on the selected route.</p>
                )}
              </div>
              {showRiskSourceFilters && (
                <div className="siara-route-panel">
                  <div className="siara-route-panel__head">
                    <h5>Risk source layers</h5>
                    <span>Coming soon</span>
                  </div>
                  <p>Per-source attribution (weather, darkness, history, road) will be available once backend source scoring is live.</p>
                </div>
              )}
            </>
          )}
        </div>

        {helpOpen && (
        <div className="siara-help-panel">
          <div className="siara-help-panel__header">
            <h4>Confidence details</h4>
            <button
              type="button"
              className="siara-help-panel__close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close confidence details"
            >
              x
            </button>
          </div>
          <div className="siara-help-panel__content">
            {sentinelValid ? (
              <>
                {(sentinelBannerTitle || sentinelBannerDetail) && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(124, 58, 237, 0.06)",
                      border: "1px solid rgba(124, 58, 237, 0.14)",
                    }}
                  >
                    {sentinelBannerTitle && (
                      <p style={{ marginBottom: sentinelBannerDetail ? 4 : 0 }}>
                        <strong>{sentinelBannerTitle}</strong>
                      </p>
                    )}
                    {sentinelBannerDetail && <p style={{ marginBottom: 0 }}>{sentinelBannerDetail}</p>}
                  </div>
                )}
                {sentinelReasons.length > 0 ? (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {sentinelReasons.map((reason, idx) => (
                      <li key={`${reason}-${idx}`} style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {sentinelIsOod === false
                      ? `No anomaly rules triggered. Sentinel confidence: ${(sentinelConfidenceLabel || "n/a").toUpperCase()}. OOD percentile: ${sentinelOodPct == null ? "n/a" : `${sentinelOodPct}%`} (somewhat unusual but acceptable).`
                      : "Unusual conditions detected but no specific reason was returned."}
                  </p>
                )}
              </>
            ) : sentinelHasError ? (
              <>
                <p>Sentinel unavailable: {sentinelErrorText || "unknown error"}</p>
                {sentinelErrorDetails && (
                  <p style={{ fontSize: 11, color: "#94A3B8" }}>{sentinelErrorDetails}</p>
                )}
                <p>Showing fallback input-quality checks.</p>
                {(legacyMissingCount != null || legacyOodCount != null) && (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {legacyMissingCount != null && (
                      <li style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        missing inputs: {legacyMissingCount}
                      </li>
                    )}
                    {legacyOodCount != null && (
                      <li style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        out-of-distribution checks: {legacyOodCount}
                      </li>
                    )}
                  </ul>
                )}
                {fallbackQualityDetails.length > 0 && (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {fallbackQualityDetails.map((line, idx) => (
                      <li key={`${line}-${idx}`} style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p>Sentinel confidence is unavailable. Showing basic input-quality checks.</p>
                {(legacyMissingCount != null || legacyOodCount != null) && (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {legacyMissingCount != null && (
                      <li style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        missing inputs: {legacyMissingCount}
                      </li>
                    )}
                    {legacyOodCount != null && (
                      <li style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        out-of-distribution checks: {legacyOodCount}
                      </li>
                    )}
                  </ul>
                )}
                {fallbackQualityDetails.length > 0 && (
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {fallbackQualityDetails.map((line, idx) => (
                      <li key={`${line}-${idx}`} style={{ marginBottom: 6, fontSize: 12, color: "#6B7280" }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </aside>
      );
      return riskPanelTarget ? createPortal(riskAside, riskPanelTarget) : riskAside;
      })()}

      {selectedRouteExplanation && (
        <div className="siara-segment-panel">
          <div className="siara-segment-panel__header">
            <h4>Segment Explanation</h4>
            <button
              type="button"
              className="siara-segment-panel__close"
              onClick={clearRouteExplanationSelection}
              aria-label="Close segment explanation"
            >
              x
            </button>
          </div>
          <div className="siara-segment-panel__meta">
            <p>
              danger:{" "}
              <strong
                style={{
                  color: getDangerColor(
                    selectedRouteExplanation?.explanation?.danger_level ||
                      selectedRouteExplanation?.segment?.danger_level,
                  ),
                }}
              >
                {formatPercent(selectedRouteExplanation?.explanation?.danger_percent) ??
                  formatPercent(selectedRouteExplanation?.segment?.danger_percent) ??
                  0}
                % (
                {selectedRouteExplanation?.explanation?.danger_level ||
                  selectedRouteExplanation?.segment?.danger_level ||
                  "low"}
                )
              </strong>
            </p>
            <p>confidence: {selectedRouteExplanation?.explanation?.confidence ?? "n/a"}</p>
            <p>quality: {selectedRouteExplanation?.explanation?.quality ?? "n/a"}</p>
          </div>
          <div className="siara-segment-panel__reasons">
            <h5>Top SHAP reasons</h5>
            {(selectedRouteExplanation?.explanation?.xai?.top_reasons || [])
              .slice(0, 8)
              .map((reason, index) => (
                <div key={`${reason.feature || "feature"}-${index}`} className="siara-segment-reason">
                  <span className="siara-segment-reason__feature">{reason.feature}</span>
                  <span className={`siara-segment-reason__direction ${reason.direction === "increases_risk" ? "siara-segment-reason__direction--increases" : "siara-segment-reason__direction--decreases"}`}>
                    {reason.direction === "increases_risk" ? "increases" : "decreases"}
                  </span>
                  <span className="siara-segment-reason__value">
                    {formatFeatureValue(reason.feature, reason.value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
      {showGuideControls && (() => {
        const guideControlsNode = (
        <div className={`siara-guide-controls${guideControlsTarget ? " siara-guide-controls--docked" : ""}${reportTooltipVisible ? " siara-overlay-dimmed" : ""}`}>
          <div className="siara-guide-status-row">
            <span className="siara-status-pill">{locationStatusText}</span>
            <span className="siara-status-pill">{navigationUpdatedText}</span>
          </div>
          <div className="siara-time-row">
            <label className="siara-time-label" htmlFor="siara-time-preset">
              Prediction time
            </label>
            <FancySelect
              value={String(timePresetMs)}
              onChange={(value) => handleTimePresetChange(value === 'custom' ? 'custom' : (Number(value) || value))}
              menuAlign="left"
              size="sm"
              options={TIME_PRESET_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
            />
            {timePresetMs === "custom" && (
              <input
                type="datetime-local"
                className="siara-time-custom"
                value={customTimestampLocal}
                onChange={(event) => setCustomTimestampLocal(event.target.value)}
              />
            )}
            <div className="siara-time-hint">Using: {selectedTimestampPreview}</div>
            {timePresetMs !== "0" && currentRiskTimePreview && (
              <div className="siara-time-preview">
                <strong>Time impact</strong>
                <p>{currentRiskTimePreview}</p>
              </div>
            )}
          </div>

          <div className="siara-guide-row">
            <input
              type="text"
              className="siara-guide-input"
              placeholder="Destination..."
              value={destinationQuery}
              onChange={(e) => setDestinationQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runDestinationSearch();
                }
              }}
            />
            <button
              type="button"
              className="siara-guide-btn"
              onClick={runDestinationSearch}
              disabled={destinationSearchState === "loading"}
            >
              {destinationSearchState === "loading" ? "Searching..." : "Search"}
            </button>
          </div>

          {destinationSearchError && (
            <div className="siara-guide-note siara-guide-note-error">{destinationSearchError}</div>
          )}

          {destinationResults.length > 0 && (
            <div className="siara-guide-results">
              {destinationResults.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  className="siara-guide-result"
                  onClick={() => selectDestination(destination)}
                >
                  <span className="siara-guide-result-name">{destination.name}</span>
                  {destination.subtitle && (
                    <span className="siara-guide-result-subtitle">{destination.subtitle}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedDestination && (
            <div className="siara-guide-note">
              Destination: <strong>{selectedDestination.name}</strong>
              {selectedDestination.subtitle ? ` (${selectedDestination.subtitle})` : ""}
            </div>
          )}

          <div className="siara-guide-actions">
            <button
              type="button"
              className="siara-guide-btn siara-guide-btn-primary"
              onClick={startGuidance}
              disabled={guidedRouteState === "loading" || !selectedDestination || !hasValidUserLocation}
            >
              {guidedRouteState === "loading" ? "Computing route..." : "Start guidance"}
            </button>
            {guidedRoute && (
              <button type="button" className="siara-guide-btn" onClick={clearGuidance}>
                Clear
              </button>
            )}
          </div>
        </div>
        );
        return guideControlsTarget
          ? createPortal(guideControlsNode, guideControlsTarget)
          : guideControlsNode;
      })()}
      <HeatmapClusterDetailPanel
        open={heatClusterPanelOpen}
        cluster={selectedHeatCluster}
        onClose={() => {
          setHeatClusterPanelOpen(false);
          setSelectedHeatCluster(null);
        }}
      />
    </div>
  );
}


export default SiaraMap;
