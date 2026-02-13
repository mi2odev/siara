import { GoogleMap, Marker, HeatmapLayer, useLoadScript } from "@react-google-maps/api";
import { useEffect, useRef } from "react";

const libraries = ["visualization"];

export default function SiaraMap({
  mockMarkers,
  mapLayer,
  setSelectedIncident,
  userPosition
}) {
  const mapRef = useRef(null);

useEffect(() => {
  if (userPosition && mapRef.current) {
    mapRef.current.panTo(userPosition);
    mapRef.current.setZoom(15);
  }
}, [userPosition]);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAP_KEY,
    libraries
  });

  if (!isLoaded) return null;

  return (
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
      mapContainerClassName="map-canvas"
      center={{ lat: 36.7525, lng: 3.04197 }}   // Alger
      zoom={12}
      options={{
        disableDefaultUI: true
      }}
    >

      {/* INCIDENT POINTS */}
      {mapLayer === "points" && mockMarkers.map(m => (
        <Marker
          key={m.id}
          position={{ lat: m.lat, lng: m.lng }}
          onClick={() => setSelectedIncident(m)}
          icon={getIconBySeverity(m.severity)}
        />
      ))}

      {/* HEATMAP */}
      {mapLayer === "heatmap" && (
        <HeatmapLayer
          data={mockMarkers.map(m => ({
            location: new window.google.maps.LatLng(m.lat, m.lng),
            weight: getWeight(m.severity)
          }))}
        />
      )}

      {userPosition && (
        <Marker
          position={userPosition}
          clickable={false}
          zIndex={999}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#1a73e8",
            fillOpacity: 1,
            scale: 6,
            strokeWeight: 2,
            strokeColor: "#ffffff"
          }}
        />
      )}

    </GoogleMap>
  );
}

function getWeight(sev) {
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  return 1;
}

function getIconBySeverity(sev) {

  const color =
    sev === "high" ? "#ff3b30" :
    sev === "medium" ? "#ff9500" :
    "#34c759";

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    scale: 7,
    strokeWeight: 1,
    strokeColor: "#ffffff"
  };
}
