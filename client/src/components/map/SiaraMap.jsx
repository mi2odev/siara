import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Pane,
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

const FitGuidedRoute = ({ route, fitVersion }) => {
  const map = useMap();

  useEffect(() => {
    if (!fitVersion) {
      return;
    }

    const routePath = getSegmentPath({ path: route?.path });
    if (!routePath || routePath.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(routePath.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, { padding: [40, 40] });
  }, [fitVersion, map, route]);

  return null;
}

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
  mockMarkers,
  mapLayer,
  setSelectedIncident,
  userPosition,
  locationStatus = "unknown",
  locationError = "",
  locationWarning = "",
  locationRequestVersion = 0,
  requestLocation,
  onSelectedTimestampChange,
}) => {
  const [currentRisk, setCurrentRisk] = useState(null);
  const [currentRiskState, setCurrentRiskState] = useState("idle");
  const [currentRiskError, setCurrentRiskError] = useState("");
  const [overlayBySegment, setOverlayBySegment] = useState({});
  const [overlayState, setOverlayState] = useState("idle");
  const [overlayError, setOverlayError] = useState("");
  const [nearbyRoutes, setNearbyRoutes] = useState([]);
  const [nearbyRoutesState, setNearbyRoutesState] = useState("idle");
  const [nearbyRoutesError, setNearbyRoutesError] = useState("");
  const [tileError, setTileError] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationSearchState, setDestinationSearchState] = useState("idle");
  const [destinationSearchError, setDestinationSearchError] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [guidedRoute, setGuidedRoute] = useState(null);
  const [guidedRouteState, setGuidedRouteState] = useState("idle");
  const [guidedRouteError, setGuidedRouteError] = useState("");
  const [guidanceActive, setGuidanceActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [routeExplainState, setRouteExplainState] = useState("idle");
  const [routeExplainError, setRouteExplainError] = useState("");
  const [selectedRouteExplanation, setSelectedRouteExplanation] = useState(null);
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
      setCurrentRiskState(currentRisk ? "refreshing" : "loading");
      setCurrentRiskError("");
      try {
        const data = await postJson("/api/risk/current", body);
        if (cancelled) return;
        setCurrentRisk(data);
        setCurrentRiskState("success");
      } catch (error) {
        if (cancelled) return;
        console.error("Current risk error:", error);
        setCurrentRiskState(currentRisk ? "success" : "error");
        setCurrentRiskError(error.message || "Failed to refresh current risk");
      }
    };

    fetchCurrentRisk();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, selectedTimestampIso, userLocationKey]);

  useEffect(() => {
    if (!hasValidUserLocation || !userPosition || !mockMarkers?.length) {
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
      rows: mockMarkers.map((marker) => ({
        segment_id: String(marker.id),
        lat: marker.lat,
        lng: marker.lng,
      })),
    };
    let cancelled = false;
    const fetchOverlay = async () => {
      setOverlayState(Object.keys(overlayBySegment).length > 0 ? "refreshing" : "loading");
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
        setOverlayState(Object.keys(overlayBySegment).length > 0 ? "success" : "error");
        setOverlayError(error.message || "Failed to refresh overlay risk");
      }
    };

    fetchOverlay();
    return () => {
      cancelled = true;
    };
  }, [hasValidUserLocation, mapLayer, mockMarkers, selectedTimestampIso, userLocationKey]);

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
      setNearbyRoutesState(nearbyRoutes.length > 0 ? "refreshing" : "loading");
      setNearbyRoutesError("");
      try {
        const data = await postJson("/api/risk/nearby-zones", body);
        if (cancelled) return;
        setNearbyRoutes(Array.isArray(data?.routes) ? data.routes : []);
        setNearbyRoutesState("success");
        nearbyRequestKeyRef.current = requestKey;
      } catch (error) {
        if (cancelled) return;
        console.error("Nearby routes error:", error);
        setNearbyRoutesState(nearbyRoutes.length > 0 ? "success" : "error");
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
      (mockMarkers || [])
        .map((m) => {
          const pos = normalizePosition(m);
          return pos ? [pos[0], pos[1], getWeight(m.severity)] : null;
        })
        .filter(Boolean),
    [mockMarkers],
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
    setGuidedRoute(null);
    setGuidedRouteState("idle");
    setGuidedRouteError("");
    setSelectedRouteExplanation(null);
    setRouteExplainState("idle");
    setRouteExplainError("");
    setSelectedIncident(null);
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
    if (requestKey === guidanceRequestKeyRef.current) {
      return guidedRoute;
    }

    setGuidedRouteState(guidedRoute ? "refreshing" : "loading");
    setGuidedRouteError("");
    if (!preserveSelection) {
      setSelectedRouteExplanation(null);
      setRouteExplainState("idle");
      setRouteExplainError("");
      setSelectedIncident(null);
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
    };

    const data = await postJson("/api/risk/route", body);
    const path = getSegmentPath({ path: data?.path }) || [];
    const segments = (Array.isArray(data?.segments) ? data.segments : [])
      .map((segment, idx) => {
        const segmentPath = getSegmentPath({ path: segment?.path });
        if (!segmentPath) return null;
        const dangerPercent = Number(segment?.danger_percent);
        return {
          segment_id: String(segment?.segment_id || `segment_${idx}`),
          path: segmentPath,
          danger_percent: Number.isFinite(dangerPercent) ? dangerPercent : null,
          danger_level: normalizeDangerLevel(segment?.danger_level, dangerPercent),
          sample_from: Number.isFinite(Number(segment?.sample_from))
            ? Number(segment.sample_from)
            : idx,
          sample_to: Number.isFinite(Number(segment?.sample_to))
            ? Number(segment.sample_to)
            : idx + 1,
        };
      })
      .filter(Boolean);

    const nextRoute = {
      ...data,
      path,
      segments,
    };
    const previousSelection = selectedRouteExplanationRef.current;
    if (preserveSelection && previousSelection) {
      const matchedSegment = segments.find(
        (segment) =>
          segment.sample_from === previousSelection?.segment?.sample_from &&
          segment.sample_to === previousSelection?.segment?.sample_to,
      );

      if (matchedSegment) {
        setSelectedRouteExplanation({
          ...previousSelection,
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
      } else {
        setSelectedRouteExplanation(null);
        setRouteExplainState("idle");
        setRouteExplainError("");
      }
    }
    guidanceRequestKeyRef.current = requestKey;
    setGuidedRoute(nextRoute);
    setGuidedRouteState("success");
    return nextRoute;
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

      setSelectedRouteExplanation({ segment, explanation });
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
  const routeSummaryPercent = Number(guidedRoute?.summary?.danger_percent);
  const routeSummaryLevel = normalizeDangerLevel(
    guidedRoute?.summary?.danger_level,
    routeSummaryPercent,
  );
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
                mockMarkers?.length,
                nearbyRoutes.length,
                guidedRoute?.path?.length || 0,
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
          {mapLayer === "nearbyRoads" && !guidedRoute && nearbyRoutes.length > 0 && (
            <FitNearbyRoutesOnDemand
              mapLayer={mapLayer}
              nearbyRoutes={nearbyRoutes}
              fitVersion={nearbyFitVersion}
            />
          )}
          {guidedRoute && <FitGuidedRoute route={guidedRoute} fitVersion={guidedRouteFitVersion} />}

          {mapLayer === "heatmap" && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

          <Pane name="risk-layer" style={{ zIndex: 9999 }}>
            {guidedRoute?.path?.length > 1 && (
              <Polyline
                positions={guidedRoute.path}
                pathOptions={{
                  color: "#334155",
                  weight: 4,
                  opacity: 0.35,
                }}
                interactive={false}
              />
            )}

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
                  pathOptions={{ color: segmentColor, weight: 6, opacity: 0.9 }}
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
                      fillColor: "#2563eb",
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
                      fillColor: "#111827",
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
              (mockMarkers || []).map((marker) => {
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

                return (
                  <CircleMarker
                    key={`point-${marker.id}`}
                    center={position}
                    radius={isAi ? 9 : 7}
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
                    {isAi && Number.isFinite(percent) && (
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
              {currentRiskState === "refreshing" && <p>Refreshing current risk...</p>}
              <p style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>
                  {sentinelValid
                    ? `confidence: ${sentinelConfidenceLabel || "n/a"}${sentinelOodPct == null ? "" : ` (OOD ${sentinelOodPct}%)`}`
                    : `confidence: ${legacyConfidencePct == null ? "n/a" : `${legacyConfidencePct}%`}`}
                </span>
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
              </p>
              <p>quality: {qualityLabel || "n/a"}</p>
            </>
          )}
          {guidedRoute && (
            <>
              <hr />
              <p>
                Route risk:{" "}
                <strong style={{ color: getDangerColor(routeSummaryLevel) }}>
                  {formatPercent(routeSummaryPercent) ?? 0}% ({routeSummaryLevel})
                </strong>
              </p>
              {Number.isFinite(Number(guidedRoute?.distance_km)) && (
                <p>distance: {Number(guidedRoute.distance_km).toFixed(2)} km</p>
              )}
              {Number.isFinite(Number(guidedRoute?.duration_min)) && (
                <p>eta: {Number(guidedRoute.duration_min).toFixed(1)} min</p>
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

      

      {selectedRouteExplanation && (
        <div className="siara-segment-panel">
          <div className="siara-segment-panel__header">
            <h4>Segment Explanation</h4>
            <button
              type="button"
              className="siara-segment-panel__close"
              onClick={() => setSelectedRouteExplanation(null)}
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
