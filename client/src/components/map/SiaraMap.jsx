import { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import IconButton from "@mui/material/IconButton";
import MuiTooltip from "@mui/material/Tooltip";
import ReportMapMarker from "./ReportMapMarker";

const USER_ZOOM = 15;
const NEARBY_RADIUS_KM = 25;
const NEARBY_MAX_DESTINATIONS = 4;
const ROUTE_SAMPLE_COUNT = 12;
const UI_CLOCK_REFRESH_MS = 1000;
const PREDICTION_REFRESH_MS = 30 * 1000;
const NEARBY_REFRESH_MS = 60 * 1000;
const GUIDANCE_REFRESH_MS = 30 * 1000;
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
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

const postJson = async (url, body) => {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

const normalizePosition = (pos) => {
  if (!pos) return null;
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

const toNearbyRequestKey = (pos) => {
  const normalized = normalizePosition(pos);
  if (!normalized) return "";
  return `${normalized[0].toFixed(3)}:${normalized[1].toFixed(3)}`;
}

const getWeight = (sev) => {
  if (sev === "high") return 1;
  if (sev === "medium") return 0.7;
  return 0.4;
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
  if (level === "extreme") return "#b91c1c";
  if (level === "high") return "#ef4444";
  if (level === "moderate") return "#f59e0b";
  return "#22c55e";
}

const getContrastTextColor = (bgColor) => {
  return bgColor === getDangerColor("low") ? "#111827" : "#ffffff";
}

const normalizeDangerLevel = (level, dangerPercent = null) => {
  const text = String(level || "").trim().toLowerCase();
  if (text === "extreme" || text === "high" || text === "moderate" || text === "low") {
    return text;
  }

  const percent = Number(dangerPercent);
  if (!Number.isFinite(percent)) return "low";
  if (percent < 25) return "low";
  if (percent < 50) return "moderate";
  if (percent < 75) return "high";
  return "extreme";
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
      const dangerPercent = Number(segment?.danger_percent);
      return {
        segment_id: String(segment?.segment_id || `${route?.route_id || `route_${index + 1}`}:segment_${segmentIndex}`),
        path: segmentPath,
        danger_percent: Number.isFinite(dangerPercent) ? dangerPercent : null,
        danger_level: normalizeDangerLevel(segment?.danger_level, dangerPercent),
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
  const summary = {
    ...(route?.summary && typeof route.summary === "object" ? route.summary : {}),
    danger_percent: Number.isFinite(summaryDangerPercent) ? summaryDangerPercent : 0,
    danger_level: normalizeDangerLevel(route?.summary?.danger_level, summaryDangerPercent),
  };
  const distanceKm = Number(route?.distance_km);
  const durationMin = Number(route?.duration_min ?? route?.eta_min);

  return {
    ...route,
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

  const fastestRoute = routes.find((route) => route.route_type === "fastest") || routes[0];
  const fastestDuration = Number(fastestRoute?.duration_min);
  const fastestRisk = Number(fastestRoute?.summary?.danger_percent);

  return routes.map((route) => {
    const duration = Number(route?.duration_min);
    const danger = Number(route?.summary?.danger_percent);
    const durationDelta =
      Number.isFinite(duration) && Number.isFinite(fastestDuration) ? duration - fastestDuration : 0;
    const riskDelta =
      Number.isFinite(danger) && Number.isFinite(fastestRisk) ? danger - fastestRisk : 0;

    return {
      ...route,
      durationDelta,
      riskDelta,
      comparisonText:
        route.route_type === "fastest"
          ? "Baseline fastest route"
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
    if ((level === "high" || level === "extreme") && firstHighRiskDistanceKm == null) {
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
    notes.push("Moderate-risk cluster in the next 5 km");
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

const FlyToUser = ({ userPosition, mapLayer, locationRequestVersion = 0 }) => {
  const map = useMap();
  const hasCenteredRef = useRef(false);
  const lastRequestVersionRef = useRef(locationRequestVersion);

  useEffect(() => {
    const target = normalizePosition(userPosition);
    if (!target) return;

    const shouldRecenter =
      !hasCenteredRef.current || locationRequestVersion !== lastRequestVersionRef.current;
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
  }, [locationRequestVersion, map, mapLayer, userPosition]);
  return null;
}

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

const FitGuidedRoute = ({ routes, fitVersion }) => {
  const map = useMap();

  useEffect(() => {
    if (!fitVersion) {
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
  }, [fitVersion, map, routes]);

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

const HeatLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return undefined;
    const layer = L.heatLayer(points, {
      radius: 25,
      blur: 20,
      maxZoom: 17,
      minOpacity: 0.35,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

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
  onSelectedTimestampChange,
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
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [qualitySummaryOpen, setQualitySummaryOpen] = useState(false);
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
  const [nearbyRefreshTick, setNearbyRefreshTick] = useState(0);
  const [guidanceRefreshTick, setGuidanceRefreshTick] = useState(0);
  const [nearbyFitVersion, setNearbyFitVersion] = useState(0);
  const [guidedRouteFitVersion, setGuidedRouteFitVersion] = useState(0);
  const nearbyRequestKeyRef = useRef("");
  const guidanceRequestKeyRef = useRef("");
  const pendingNearbyFitRef = useRef(false);
  const selectedRouteExplanationRef = useRef(null);
  const locationRenderStateRef = useRef("");
  const currentRiskRef = useRef(null);
  const overlayBySegmentRef = useRef({});
  const nearbyRoutesRef = useRef([]);
  const userLatLng = useMemo(() => normalizePosition(userPosition), [userPosition]);
  const hasGrantedLocation = useMemo(
    () => locationStatus === "granted" && normalizePosition(userPosition) != null,
    [locationStatus, userPosition],
  );
  const hasValidUserLocation = useMemo(
    () => hasGrantedLocation && normalizePosition(userPosition) != null,
    [hasGrantedLocation, userPosition],
  );
  const userLocationKey = useMemo(() => {
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

    const intervalId = window.setInterval(() => {
      setNearbyRefreshTick((value) => value + 1);
    }, NEARBY_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [liveTimeEnabled]);

  useEffect(() => {
    if (!liveTimeEnabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setGuidanceRefreshTick((value) => value + 1);
    }, GUIDANCE_REFRESH_MS);

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
      setNearbyRefreshTick((value) => value + 1);
      setGuidanceRefreshTick((value) => value + 1);
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
    if (userLocationKey) {
      setLocationUpdatedAt(Date.now());
    }
  }, [userLocationKey]);

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

  useEffect(() => {
    if (!hasValidUserLocation || !userPosition) {
      setCurrentRisk(null);
      setCurrentRiskState("idle");
      setCurrentRiskError("");
      return;
    }

    const body = {
      lat: userPosition.lat,
      lng: userPosition.lng,
      timestamp: selectedTimestampIso,
    };
    let cancelled = false;
    const fetchCurrentRisk = async () => {
      setCurrentRiskState(currentRiskRef.current ? "refreshing" : "loading");
      setCurrentRiskError("");
      try {
        const data = await postJson("/api/risk/current", body);
        if (cancelled) return;
        setCurrentRisk(data);
        setCurrentRiskState("success");
        setCurrentRiskUpdatedAt(Date.now());
      } catch (error) {
        if (cancelled) return;
        console.error("Current risk error:", error);
        setCurrentRiskState(currentRiskRef.current ? "success" : "error");
        setCurrentRiskError(error.message || "Failed to refresh current risk");
      }
    };

    fetchCurrentRisk();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, selectedTimestampIso, userLocationKey]);

  useEffect(() => {
    if (!hasValidUserLocation || !userPosition) {
      setCurrentRiskNowBaseline(null);
      return;
    }

    const nowIso = new Date().toISOString();
    const selectedTimeMs = new Date(selectedTimestampIso).getTime();
    const nowMs = new Date(nowIso).getTime();
    if (Number.isFinite(selectedTimeMs) && Math.abs(selectedTimeMs - nowMs) < 60 * 1000) {
      setCurrentRiskNowBaseline(currentRiskRef.current);
      return;
    }

    let cancelled = false;
    const fetchCurrentRiskBaseline = async () => {
      try {
        const data = await postJson("/api/risk/current", {
          lat: userPosition.lat,
          lng: userPosition.lng,
          timestamp: nowIso,
        });
        if (cancelled) return;
        setCurrentRiskNowBaseline(data);
      } catch {
        if (cancelled) return;
        setCurrentRiskNowBaseline(null);
      }
    };

    void fetchCurrentRiskBaseline();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, selectedTimestampIso, userLocationKey]);

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

  useEffect(() => {
    if (mapLayer !== "nearbyRoads") {
      nearbyRequestKeyRef.current = "";
      pendingNearbyFitRef.current = false;
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return;
    }

    if (!hasValidUserLocation || !userPosition) {
      setNearbyRoutes([]);
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return;
    }

    const requestKey = `${toNearbyRequestKey(userPosition)}:${selectedTimestampIso}:${nearbyRefreshTick}`;
    if (!requestKey || requestKey === nearbyRequestKeyRef.current) {
      return;
    }

    const body = {
      lat: userPosition.lat,
      lng: userPosition.lng,
      radius_km: NEARBY_RADIUS_KM,
      max_destinations: NEARBY_MAX_DESTINATIONS,
      timestamp: selectedTimestampIso,
    };
    let cancelled = false;
    const fetchNearbyRoutes = async () => {
      setNearbyRoutesState(nearbyRoutesRef.current.length > 0 ? "refreshing" : "loading");
      setNearbyRoutesError("");
      try {
        const data = await postJson("/api/risk/nearby-zones", body);
        if (cancelled) return;
        setNearbyRoutes(Array.isArray(data?.routes) ? data.routes : []);
        setNearbyRoutesState("success");
        setNearbyUpdatedAt(Date.now());
        nearbyRequestKeyRef.current = requestKey;
      } catch (error) {
        if (cancelled) return;
        console.error("Nearby routes error:", error);
        setNearbyRoutesState(nearbyRoutesRef.current.length > 0 ? "success" : "error");
        setNearbyRoutesError(error.message || "Failed to refresh nearby routes");
      }
    };

    fetchNearbyRoutes();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, mapLayer, nearbyRefreshTick, selectedTimestampIso, userLocationKey]);

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

  const heatPoints = useMemo(
    () =>
      markers
        .map((m) => {
          const pos = normalizePosition(m);
          return pos ? [pos[0], pos[1], getWeight(m.severity)] : null;
        })
        .filter(Boolean),
    [markers],
  );

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
    clearRouteExplanationSelection();
  };

  const handleTimePresetChange = (event) => {
    const value = event.target.value;
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
  } = {}) => {
    if (!origin) {
      throw new Error("Location is required. Use the locate button first.");
    }
    if (!destination) {
      throw new Error("Select a destination before starting guidance.");
    }

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

    setGuidedRouteState(guidedRoute ? "refreshing" : "loading");
    setGuidedRouteError("");
    if (!preserveSelection) {
      clearRouteExplanationSelection();
    }

    const body = {
      origin: { lat: origin[0], lng: origin[1] },
      destination: {
        name: destination.name,
        lat: destination.lat,
        lng: destination.lng,
      },
      timestamp: timestampIso,
      sample_count: ROUTE_SAMPLE_COUNT,
      max_alternatives: 3,
    };

    const data = await postJson("/api/risk/route", body);
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

    guidanceRequestKeyRef.current = requestKey;
    setGuidedRoutes(nextRoutes);
    setSelectedGuidedRouteType(nextSelectedRouteType);
    syncRouteExplanationSelection({
      nextSelectedRoute,
      nextSelectedRouteType,
      preserveSelection,
    });
    setGuidedRouteState("success");
    setRoutesUpdatedAt(Date.now());
    return nextSelectedRoute;
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

    try {
      await fetchGuidedRoute({
        origin,
        destination: selectedDestination,
        timestampIso: selectedTimestampIso,
        preserveSelection: false,
      });
      setGuidedRouteFitVersion((value) => value + 1);
      setGuidanceActive(true);
    } catch (error) {
      setGuidanceActive(false);
      setGuidedRouteState("error");
      setGuidedRouteError(error.message || "Failed to compute guidance route");
    }
  };

  useEffect(() => {
    if (!guidanceActive) {
      return;
    }

    const origin = normalizePosition(userPosition);
    if (!origin || !selectedDestination) {
      return;
    }

    void fetchGuidedRoute({
      origin,
      destination: selectedDestination,
      timestampIso: selectedTimestampIso,
      preserveSelection: true,
      forceRefresh: true,
    }).catch((error) => {
      setGuidedRouteState(guidedRoute ? "success" : "error");
      setGuidedRouteError(error.message || "Failed to refresh guidance route");
    });
  }, [guidanceActive, guidanceRefreshTick, selectedDestination, selectedTimestampIso, userLocationKey]);

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
  const legacyConfidencePct = toPercentOrNull(currentRisk?.confidence);
  const qualityLabel = String(currentRisk?.quality || "").trim().toLowerCase() || null;
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
  const routeSummaryPercent = Number(guidedRoute?.summary?.danger_percent);
  const routeSummaryLevel = normalizeDangerLevel(
    guidedRoute?.summary?.danger_level,
    routeSummaryPercent,
  );
  const routeComparisonRows = useMemo(() => buildRouteComparisonRows(guidedRoutes), [guidedRoutes]);
  const selectedRouteHazards = useMemo(
    () => buildAheadRouteHazards(guidedRoute, selectedTimestampIso),
    [guidedRoute, selectedTimestampIso],
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
  const riskSourceFilters = [
    { key: "weather", label: "Weather-related risk", available: false },
    { key: "darkness", label: "Darkness / time-of-day", available: false },
    { key: "historical", label: "Historical concentration", available: false },
    { key: "road", label: "Road-context risk", available: false },
  ];
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
  const showGuideControls = hasValidUserLocation || Boolean(guidedRoute);

  useEffect(() => {
    const nextRenderState = hasValidUserLocation
      ? "render_ready"
      : locationStatus === "locating"
        ? "render_blocked_locating"
        : "render_blocked_missing_location";
    if (locationRenderStateRef.current === nextRenderState) {
      return;
    }
    locationRenderStateRef.current = nextRenderState;
    console.info("[map/location]", nextRenderState, {
      location_status: locationStatus,
      has_valid_user_location: hasValidUserLocation,
      user_position: userLatLng,
      default_center_used: false,
    });
  }, [hasValidUserLocation, locationStatus, userLatLng]);


  
  return (
    <div className="siara-map-shell">
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
            Nearby routes error: {nearbyRoutesError}
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
      

      

      {hasValidUserLocation ? (
        <MapContainer
          center={userLatLng}
          zoom={USER_ZOOM}
          className="siara-leaflet-map"
          zoomControl={true}
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

          <FlyToUser
            userPosition={userPosition}
            mapLayer={mapLayer}
            locationRequestVersion={locationRequestVersion}
          />
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
          {guidedRoute && <FitGuidedRoute routes={guidedRoutes} fitVersion={guidedRouteFitVersion} />}

          {mapLayer === "heatmap" && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

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
                      fillColor: "#7c3aed",
                      fillOpacity: 0.95,
                    }}
                  >
                    <Tooltip direction="top">Start</Tooltip>
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
                fillColor: "#7c3aed",
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top">You are here</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      ) : (
        <div className="siara-leaflet-map">
          <div className="siara-map-error-stack">
            <div className="siara-map-error">
              {locationStatus === "locating"
                ? "Locating your device..."
                : "A valid real-time location is required before the map can load."}
            </div>
            {locationWarning && (
              <div className="siara-map-warning">{locationWarning}</div>
            )}
            {locationError && (
              <div className="siara-map-error">{locationError}</div>
            )}
            {typeof requestLocation === "function" && (
              <button
                type="button"
                className="siara-guide-btn siara-guide-btn-primary"
                onClick={requestLocation}
                disabled={locationStatus === "locating"}
              >
                {locationStatus === "locating" ? "Locating..." : "Retry location"}
              </button>
            )}
          </div>
        </div>
      )}

      <aside className="siara-map-aside">
        <div className="siara-risk-debug">
          <div className="siara-map-help-wrap">
            <h4>Current Risk</h4>
            <div className="siara-status-pills">
              <span className="siara-status-pill">{locationStatusText}</span>
              <span className="siara-status-pill">{riskUpdatedText}</span>
              <span className="siara-status-pill">{navigationUpdatedText}</span>
            </div>
          </div>
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
          {hasValidUserLocation && locationAccuracyText && <p>accuracy: {locationAccuracyText}</p>}
          {hasValidUserLocation && locationWarning && <p className="risk-debug-error">{locationWarning}</p>}
          {hasValidUserLocation && currentRiskState === "idle" && <p>Loading current risk...</p>}
          {hasValidUserLocation && currentRiskState === "loading" && <p>Loading current risk...</p>}
          {hasValidUserLocation && !currentRisk && currentRiskState === "error" && <p className="risk-debug-error">{currentRiskError}</p>}
          {hasValidUserLocation &&
            (currentRiskState === "success" || currentRiskState === "refreshing") &&
            currentRisk && (
            <>
              <p>
                <strong className="risk-debug-percent" style={{ color: getDangerColor(currentRisk.danger_level) }}>
                  {currentRisk.danger_percent}%
                </strong>
              </p>
              {currentRiskError && (
                <p className="risk-debug-error">{currentRiskError}</p>
              )}
              {currentRiskState === "refreshing" && <p>Refreshing quietly in background...</p>}
              <div className="siara-badge-row">
                <span className="siara-compact-badge">Confidence: {compactConfidenceLabel}</span>
                <span className="siara-compact-badge">Data quality: {compactQualityLabel}</span>
                <button
                  type="button"
                  className="siara-inline-link"
                  onClick={() => setQualitySummaryOpen((value) => !value)}
                >
                  {qualitySummaryOpen ? "Hide notes" : "Why?"}
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
              {qualitySummaryOpen && qualitySummaryNotes.length > 0 && (
                <div className="siara-note-list">
                  {qualitySummaryNotes.map((note) => (
                    <span key={note} className="siara-note-pill">{note}</span>
                  ))}
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
                  {formatPercent(routeSummaryPercent) ?? 0}% ({routeSummaryLevel})
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
              <div className="siara-route-card-grid">
                {routeComparisonRows.map((route) => {
                  const isSelected = route.route_type === guidedRoute?.route_type;
                  const dangerPercent = formatPercent(route?.summary?.danger_percent) ?? 0;
                  return (
                    <button
                      key={`route-card-${route.route_type}`}
                      type="button"
                      className={`siara-route-card ${isSelected ? "is-selected" : ""}`}
                      style={{ "--route-accent": route.route_color }}
                      onClick={() => handleGuidedRouteSelection(route.route_type)}
                    >
                      <span className="siara-route-card__header">
                        <span>{route.route_label}</span>
                        <span className="siara-route-card__badges">
                          {route.is_recommended && (
                            <span className="siara-route-card__badge">Recommended</span>
                          )}
                          {isSelected && (
                            <span className="siara-route-card__badge is-selected">Selected</span>
                          )}
                        </span>
                      </span>
                      <span className="siara-route-card__meta">
                        risk {dangerPercent}% • eta{" "}
                        {Number.isFinite(Number(route?.duration_min))
                          ? `${Number(route.duration_min).toFixed(1)} min`
                          : "n/a"}
                      </span>
                      <span className="siara-route-card__meta siara-route-card__meta--summary">
                        ETA{" "}
                        {Number.isFinite(Number(route?.duration_min))
                          ? `${Number(route.duration_min).toFixed(1)} min`
                          : "n/a"}{" "}
                        • distance{" "}
                        {Number.isFinite(Number(route?.distance_km))
                          ? `${Number(route.distance_km).toFixed(1)} km`
                          : "n/a"}{" "}
                        • danger {dangerPercent}%
                      </span>
                      <span className="siara-route-card__meta">
                        {route.comparisonText}
                      </span>
                      {route.recommendedReason && (
                        <span className="siara-route-card__reason">{route.recommendedReason}</span>
                      )}
                    </button>
                  );
                })}
              </div>
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
              <div className="siara-route-panel">
                <div className="siara-route-panel__head">
                  <h5>Risk source layers</h5>
                  <span>Future-ready</span>
                </div>
                <div className="siara-filter-pills">
                  {riskSourceFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className="siara-filter-pill"
                      disabled={!filter.available}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <p>Per-source route attribution will appear here when backend source scoring is available.</p>
              </div>
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

      <div className={`siara-map-legend ${legendOpen ? "is-open" : "is-collapsed"}`}>
        <button
          type="button"
          className="siara-map-legend__toggle"
          onClick={() => setLegendOpen((value) => !value)}
        >
          {legendOpen ? "Hide legend" : "Legend"}
        </button>
        {legendOpen && (
          <div className="siara-map-legend__content">
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch" style={{ background: "#2563eb" }} />
              <span>Blue = Fastest</span>
            </div>
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch" style={{ background: "#16a34a" }} />
              <span>Green = Safest</span>
            </div>
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch" style={{ background: "#f97316" }} />
              <span>Orange = Balanced</span>
            </div>
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch" style={{ background: "#9ca3af" }} />
              <span>Gray = Alternative not selected</span>
            </div>
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch siara-map-legend__swatch--gradient" />
              <span>Green / Orange / Red = segment danger</span>
            </div>
            <div className="siara-map-legend__row">
              <span className="siara-map-legend__swatch" style={{ background: "#7c3aed" }} />
              <span>Purple marker = current location</span>
            </div>
          </div>
        )}
      </div>

      

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
      {showGuideControls && (
        <div className="siara-guide-controls">
          <div className="siara-guide-status-row">
            <span className="siara-status-pill">{locationStatusText}</span>
            <span className="siara-status-pill">{navigationUpdatedText}</span>
          </div>
          <div className="siara-time-row">
            <label className="siara-time-label" htmlFor="siara-time-preset">
              Prediction time
            </label>
            <select
              id="siara-time-preset"
              className="siara-time-select"
              value={timePresetMs}
              onChange={handleTimePresetChange}
            >
              {TIME_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
      )}
    </div>
  );
}


export default SiaraMap;
