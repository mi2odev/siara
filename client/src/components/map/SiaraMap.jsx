import { useEffect, useMemo, useState } from "react";
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
const DEFAULT_ZOOM = 6;
const USER_ZOOM = 15;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function postJson(url, body) {
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

function FlyToUser({ userPosition }) {
  const map = useMap();
  useEffect(() => {
    const target = normalizePosition(userPosition);
    if (!target) return;
    map.flyTo(target, USER_ZOOM, { animate: true, duration: 0.8 });
  }, [map, userPosition]);
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
  const [tileError, setTileError] = useState("");

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
      </div>

      <MapContainer
        center={userLatLng || DEFAULT_CENTER}
        zoom={userLatLng ? USER_ZOOM : DEFAULT_ZOOM}
        className="siara-leaflet-map"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{
            tileerror: () => {
              setTileError("Unable to fetch OpenStreetMap tiles.");
            },
            load: () => {
              setTileError("");
            },
          }}
        />

        <FlyToUser userPosition={userPosition} />

        {mapLayer === "heatmap" && heatPoints.length > 0 && <HeatLayer points={heatPoints} />}

        <Pane name="risk-layer" style={{ zIndex: 100 }}>
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
                      <Tooltip sticky direction="top">
                        {Math.round(percent)}% - {overlay?.danger_level || "unknown"}
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
                    <Tooltip permanent direction="top" offset={[0, -8]}>
                      {Math.round(percent)}%
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
              fillColor: "#1a73e8",
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
              <strong>{currentRisk.danger_percent}%</strong> ({currentRisk.danger_level})
            </p>
            <p>confidence: {currentRisk.confidence}%</p>
            <p>quality: {currentRisk.quality}</p>
          </>
        )}
      </aside>
    </div>
  );
}
