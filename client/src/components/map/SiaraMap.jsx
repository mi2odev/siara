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

const DEFAULT_CENTER = [28.0339, 1.6596];
const DEFAULT_ZOOM = 5;
const USER_ZOOM = 15;
const NEARBY_RADIUS_KM = 25;
const NEARBY_MAX_DESTINATIONS = 4;
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
  const nearbyRequestKeyRef = useRef("");


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

  const userLatLng = normalizePosition(userPosition);


  
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
      </div>

      <MapContainer
        center={userLatLng || DEFAULT_CENTER}
        zoom={userLatLng ? USER_ZOOM : DEFAULT_ZOOM}
        className="siara-leaflet-map"
        zoomControl={true}
      >
          <MapResizeFix deps={[mapLayer, !!userLatLng, mockMarkers?.length, nearbyRoutes.length]} />

  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    eventHandlers={{
      tileerror: () => setTileError("Unable to fetch OpenStreetMap tiles."),
      load: () => setTileError(""),
    }}
  />

        <FlyToUser userPosition={userPosition} mapLayer={mapLayer} />
        {mapLayer === "nearbyRoads" && nearbyRoutes.length > 0 && (
          <FitNearbyRoutes mapLayer={mapLayer} nearbyRoutes={nearbyRoutes} />
        )}

        {mapLayer === "heatmap" && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

        <Pane name="risk-layer" style={{ zIndex: 9999 }}>
          {mapLayer === "nearbyRoads" &&
            nearbyRoutes.flatMap((route) => {
              const destinationPos = normalizePosition(route?.destination);
              const destinationName =
                route?.destination?.name || route?.destination?.id || "Nearby route";
              const routePercent = Number(route?.summary?.danger_percent);
              const routeLevel = route?.summary?.danger_level || "low";
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
                const segmentLevel = segment?.danger_level || routeLevel;
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

        {userLatLng && (
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

      <aside className="siara-risk-debug">
        <h4>Current Risk</h4>
        {currentRiskState === "idle" && <p>Waiting for location...</p>}
        {currentRiskState === "loading" && <p>Loading current risk...</p>}
        {currentRiskState === "error" && <p className="risk-debug-error">{currentRiskError}</p>}
        {currentRiskState === "success" && currentRisk && (
          <>
            <p>
              <strong className="risk-debug-percent" style={{ color: getDangerColor(currentRisk.danger_level) }}>{currentRisk.danger_percent}%</strong> 
            </p>
            <p>confidence: {currentRisk.confidence}%</p>
            <p>quality: {currentRisk.quality}</p>
          </>
        )}
      </aside>
    </div>
  );
}
