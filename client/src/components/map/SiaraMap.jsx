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

const DEFAULT_CENTER = [28.0339, 1.6596];
const DEFAULT_ZOOM = 5;
const USER_ZOOM = 15;
const NEARBY_RADIUS_KM = 25;
const NEARBY_MAX_DESTINATIONS = 4;
const ROUTE_SAMPLE_COUNT = 12;
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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

function normalizePosition(pos) {
  if (!pos) return null;
  const lat = Number(pos.lat);
  const lng = Number(pos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function toNearbyRequestKey(pos) {
  const normalized = normalizePosition(pos);
  if (!normalized) return "";
  return `${normalized[0].toFixed(3)}:${normalized[1].toFixed(3)}`;
}

function getWeight(sev) {
  if (sev === "high") return 1;
  if (sev === "medium") return 0.7;
  return 0.4;
}

function getIncidentColor(sev) {
  if (sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#22c55e";
}

function getDangerColor(level) {
  if (level === "extreme") return "#b91c1c";
  if (level === "high") return "#ef4444";
  if (level === "moderate") return "#f59e0b";
  return "#22c55e";
}

function getContrastTextColor(bgColor) {
  return bgColor === getDangerColor("low") ? "#111827" : "#ffffff";
}

function normalizeDangerLevel(level, dangerPercent = null) {
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

function getSegmentPath(marker) {
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

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function normalizeNominatimResult(item, fallbackName) {
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

const FlyToUser = ({ userPosition, mapLayer }) => {
  const map = useMap();
  useEffect(() => {
    const target = normalizePosition(userPosition);
    if (!target) return;
    if (mapLayer === "nearbyRoads") {
      map.panTo(target, { animate: true });
      return;
    }
    map.flyTo(target, USER_ZOOM, { animate: true, duration: 0.8 });
  }, [map, userPosition, mapLayer]);
  return null;
}

const FitNearbyRoutes = ({ mapLayer, nearbyRoutes }) => {
  const map = useMap();

  useEffect(() => {
    if (mapLayer !== "nearbyRoads" || !Array.isArray(nearbyRoutes) || nearbyRoutes.length === 0) {
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
  }, [map, mapLayer, nearbyRoutes]);

  return null;
}

const FitGuidedRoute = ({ route }) => {
  const map = useMap();

  useEffect(() => {
    const routePath = getSegmentPath({ path: route?.path });
    if (!routePath || routePath.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(routePath.map(([lat, lng]) => L.latLng(lat, lng)));
    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, route]);

  return null;
}

function HeatLayer({ points }) {
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

export default function SiaraMap({
  mockMarkers,
  mapLayer,
  setSelectedIncident,
  userPosition,
}) {
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpHover, setHelpHover] = useState(false);
  const [routeExplainState, setRouteExplainState] = useState("idle");
  const [routeExplainError, setRouteExplainError] = useState("");
  const [selectedRouteExplanation, setSelectedRouteExplanation] = useState(null);
  const nearbyRequestKeyRef = useRef("");

  useEffect(() => {
    console.log("[SiaraMap] selectedRouteExplanation updated:", selectedRouteExplanation);
  }, [selectedRouteExplanation]);


  const MapResizeFix = ({ deps = [] }) => {
  const map = useMap();

  useEffect(() => {
    // Run once after mount/render
    const id = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false, animate: false });
    });
    return () => cancelAnimationFrame(id);
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const ro = new ResizeObserver(() => {
      // wait one frame so layout finishes first
      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
      });
    });

    ro.observe(container);

    // also handle window resize
    const onResize = () => map.invalidateSize({ pan: false, animate: false });
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  useEffect(() => {
    // If your UI changes on layer switch / data load, force refresh too
    const id = setTimeout(() => {
      map.invalidateSize({ pan: false, animate: false });
    }, 50);
    return () => clearTimeout(id);
  }, [map, ...deps]);

  return null;
}

  useEffect(() => {
    if (!userPosition) return;

    const body = {
      lat: userPosition.lat,
      lng: userPosition.lng,
      timestamp: new Date().toISOString(),
    };
    console.log("[React -> Node] /api/risk/current body:", body);

    let cancelled = false;
    const fetchCurrentRisk = async () => {
      setCurrentRiskState("loading");
      setCurrentRiskError("");
      try {
        const data = await postJson("/api/risk/current", body);
        if (cancelled) return;
        setCurrentRisk(data);
        setCurrentRiskState("success");
      } catch (error) {
        if (cancelled) return;
        console.error("Current risk error:", error);
        setCurrentRiskState("error");
        setCurrentRiskError(error.message || "Failed to load current risk");
      }
    };

    fetchCurrentRisk();
    return () => {
      cancelled = true;
    };
  }, [userPosition]);

  useEffect(() => {
    if (!currentRisk) return;
    console.log("[React] currentRisk updated:", currentRisk);
  }, [currentRisk]);

  useEffect(() => {
    if (!mockMarkers?.length || mapLayer !== "ai") return;

    const body = {
      timestamp: new Date().toISOString(),
      rows: mockMarkers.map((marker) => ({
        segment_id: String(marker.id),
        lat: marker.lat,
        lng: marker.lng,
      })),
    };
    console.log("[React -> Node] /api/risk/overlay body:", body);

    let cancelled = false;
    const fetchOverlay = async () => {
      setOverlayState("loading");
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
        setOverlayState("error");
        setOverlayError(error.message || "Failed to load overlay risk");
      }
    };

    fetchOverlay();
    return () => {
      cancelled = true;
    };
  }, [mapLayer, mockMarkers]);

  useEffect(() => {
    if (mapLayer !== "nearbyRoads") {
      nearbyRequestKeyRef.current = "";
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return;
    }

    if (!userPosition) {
      setNearbyRoutes([]);
      setNearbyRoutesState("idle");
      setNearbyRoutesError("");
      return;
    }

    const requestKey = toNearbyRequestKey(userPosition);
    if (!requestKey || requestKey === nearbyRequestKeyRef.current) {
      return;
    }

    const body = {
      lat: userPosition.lat,
      lng: userPosition.lng,
      radius_km: NEARBY_RADIUS_KM,
      max_destinations: NEARBY_MAX_DESTINATIONS,
      timestamp: new Date().toISOString(),
    };
    console.log("[React -> Node] /api/risk/nearby-zones body:", body);

    let cancelled = false;
    const fetchNearbyRoutes = async () => {
      setNearbyRoutesState("loading");
      setNearbyRoutesError("");
      try {
        const data = await postJson("/api/risk/nearby-zones", body);
        if (cancelled) return;
        setNearbyRoutes(Array.isArray(data?.routes) ? data.routes : []);
        setNearbyRoutesState("success");
        nearbyRequestKeyRef.current = requestKey;
      
console.log("[Node -> React] nearby-zones response:", data);
      } catch (error) {
        if (cancelled) return;
        console.error("Nearby routes error:", error);
        setNearbyRoutesState("error");
        setNearbyRoutesError(error.message || "Failed to load nearby routes");
      }
    };

    fetchNearbyRoutes();
    return () => {
      cancelled = true;
    };
  }, [mapLayer, userPosition]);

  useEffect(() => {
    if (mapLayer !== "nearbyRoads" || nearbyRoutes.length === 0) return;
    console.log("[nearbyRoads] first path point:", nearbyRoutes?.[0]?.path?.[0]);
  }, [mapLayer, nearbyRoutes]);

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

    const body = {
      segment_id: String(marker.id),
      lat: marker.lat,
      lng: marker.lng,
      timestamp: new Date().toISOString(),
    };
    console.log("[React -> Node] /api/risk/explain body:", body);

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
    setGuidedRoute(null);
    setGuidedRouteState("idle");
    setGuidedRouteError("");
    setSelectedRouteExplanation(null);
    setRouteExplainState("idle");
    setRouteExplainError("");
    setSelectedIncident(null);
  };

  const startGuidance = async () => {
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

    setGuidedRouteState("loading");
    setGuidedRouteError("");
    setSelectedRouteExplanation(null);
    setRouteExplainState("idle");
    setRouteExplainError("");

    const body = {
      origin: { lat: origin[0], lng: origin[1] },
      destination: {
        name: selectedDestination.name,
        lat: selectedDestination.lat,
        lng: selectedDestination.lng,
      },
      timestamp: new Date().toISOString(),
      sample_count: ROUTE_SAMPLE_COUNT,
    };

    try {
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
          };
        })
        .filter(Boolean);

      setGuidedRoute({
        ...data,
        path,
        segments,
      });
      setGuidedRouteState("success");
    } catch (error) {
      setGuidedRouteState("error");
      setGuidedRouteError(error.message || "Failed to compute guidance route");
    }
  };

  const handleGuidedSegmentClick = async (segment) => {
    if (!segment?.segment_id) {
      return;
    }

    setRouteExplainState("loading");
    setRouteExplainError("");

    try {
      const response = await postJson("/api/risk/explain", {
        segment_id: String(segment.segment_id),
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

  const userLatLng = normalizePosition(userPosition);
  const routeSummaryPercent = Number(guidedRoute?.summary?.danger_percent);
  const routeSummaryLevel = normalizeDangerLevel(
    guidedRoute?.summary?.danger_level,
    routeSummaryPercent,
  );
  const showGuideControls = Boolean(userLatLng) || mapLayer === "nearbyRoads" || Boolean(guidedRoute);


  
  return (
    <div className="siara-map-shell">
      <div className="siara-map-error-stack">
        {tileError && (
          <div className="siara-map-error">
            Tile layer error: {tileError}
          </div>
        )}
        {overlayState === "error" && (
          <div className="siara-map-error">
            Overlay error: {overlayError}
          </div>
        )}
        {nearbyRoutesState === "error" && (
          <div className="siara-map-error">
            Nearby routes error: {nearbyRoutesError}
          </div>
        )}
        {guidedRouteState === "error" && (
          <div className="siara-map-error">
            Guidance error: {guidedRouteError}
          </div>
        )}
        {routeExplainState === "error" && (
          <div className="siara-map-error">
            Explain error: {routeExplainError}
          </div>
        )}

        
      </div>
      

      

      <MapContainer
        center={userLatLng || DEFAULT_CENTER}
        zoom={userLatLng ? USER_ZOOM : DEFAULT_ZOOM}
        className="siara-leaflet-map"
        zoomControl={true}
      >
          <MapResizeFix
            deps={[
              mapLayer,
              !!userLatLng,
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

        <FlyToUser userPosition={userPosition} mapLayer={mapLayer} />
        {mapLayer === "nearbyRoads" && !guidedRoute && nearbyRoutes.length > 0 && (
          <FitNearbyRoutes mapLayer={mapLayer} nearbyRoutes={nearbyRoutes} />
        )}
        {guidedRoute && <FitGuidedRoute route={guidedRoute} />}

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
              const routePercent = Number(route?.summary?.danger_percent);
              const routeLevel = normalizeDangerLevel(route?.summary?.danger_level, routePercent);
              const routeColor = getDangerColor(routeLevel);
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
                const segmentColor = getDangerColor(segmentLevel);
                const segmentTooltipStyle = {
                  "--risk-color": segmentColor,
                  "--risk-text-color": getContrastTextColor(segmentColor),
                };

                rendered.push(
                  <Polyline
                    key={`${route.route_id || destinationName}-seg-${index}`}
                    positions={segmentPath}
                    pathOptions={{ color: segmentColor, weight: 5, opacity: 0.9 }}
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

              if (userLatLng && destinationPos) {
                rendered.push(
                  <Polyline
                    key={`${route.route_id || destinationName}-debug-link`}
                    positions={[userLatLng, destinationPos]}
                    pathOptions={{
                      color: "#3b82f6",
                      weight: 1,
                      opacity: 0.6,
                      dashArray: "4 6",
                    }}
                    interactive={false}
                  />,
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

      <aside className="siara-map-aside">
        <div className="siara-risk-debug">
          <div className="siara-map-help-wrap">
            <h4>Current Risk</h4>
            <MuiTooltip title="Explain danger colors">
              <IconButton
                type="button"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(124, 58, 237, 0.10)',
                  color: '#7A3DF0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onClick={() => setHelpOpen((prev) => !prev)}
                onMouseEnter={() => setHelpHover(true)}
                onMouseLeave={() => setHelpHover(false)}
                aria-label="Explain danger colors"
              >
                <QuestionMarkIcon style={{ fontSize: 14 }} />
              </IconButton>
            </MuiTooltip>
          </div>
          {currentRiskState === "idle" && <p>Waiting for location...</p>}
          {currentRiskState === "loading" && <p>Loading current risk...</p>}
          {currentRiskState === "error" && <p className="risk-debug-error">{currentRiskError}</p>}
          {currentRiskState === "success" && currentRisk && (
            <>
              <p>
                <strong className="risk-debug-percent" style={{ color: getDangerColor(currentRisk.danger_level) }}>
                  {currentRisk.danger_percent}%
                </strong>
              </p>
              <p>confidence: {currentRisk.confidence}%</p>
              <p>quality: {currentRisk.quality}</p>
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
            <h4>Route Danger Guide</h4>
            <button
              type="button"
              className="siara-help-panel__close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close guide help"
            >
              x
            </button>
          </div>
          <div className="siara-help-panel__content">
            <p>Danger% = 100 * P(severe).</p>
            <p>Colors are model-estimated risk levels from weather, time, and road signals.</p>
            <p>This estimate is not a guarantee of safety.</p>
            <div className="siara-help-legend">
              {["low", "moderate", "high", "extreme"].map((level) => (
                <div key={level} className="siara-help-legend__row">
                  <span
                    className="siara-help-legend__swatch"
                    style={{ background: getDangerColor(level) }}
                    />
                  <span className="siara-help-legend__label">{level}</span>
                </div>
              ))}
            </div>
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
                    {reason.value == null ? "n/a" : typeof reason.value === "number" ? reason.value.toFixed(2) : String(reason.value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
      {showGuideControls && (
        <div className="siara-guide-controls">
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
              disabled={guidedRouteState === "loading" || !selectedDestination || !userLatLng}
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
