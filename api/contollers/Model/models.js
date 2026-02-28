const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LEGACY_ML_SERVICE_URL = process.env.ML_SERVICE_URL;
const ML_SERVICE_BASE_URL =
  process.env.ML_SERVICE_BASE_URL ||
  (LEGACY_ML_SERVICE_URL
    ? LEGACY_ML_SERVICE_URL.replace(/\/predict\/?$/, "")
    : "http://localhost:8000");

const TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 15000);
const WEATHER_TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS || 8000);
const SUN_TIMEOUT_MS = Number(process.env.SUN_TIMEOUT_MS || 8000);
const RISK_TIMEZONE = process.env.RISK_TIMEZONE || "Africa/Algiers";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const SUN_API_URL = "https://api.sunrise-sunset.org/json";
const OSRM_ROUTE_URL =
  process.env.OSRM_ROUTE_URL || "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS || 8000);
const DEFAULT_NEARBY_RADIUS_KM = Number(process.env.NEARBY_RADIUS_KM || 25);
const DEFAULT_MAX_DESTINATIONS = Number(process.env.NEARBY_MAX_DESTINATIONS || 4);
const MAX_NEARBY_DESTINATIONS = Number(process.env.NEARBY_MAX_DESTINATIONS_CAP || 8);
const DEFAULT_ROUTE_SAMPLES = Number(process.env.NEARBY_ROUTE_SAMPLES || 5);
const MAX_ROUTE_SAMPLES = Number(process.env.NEARBY_ROUTE_SAMPLES_CAP || 12);
const DEFAULT_GUIDE_SAMPLE_COUNT = Number(process.env.ROUTE_GUIDE_SAMPLE_COUNT || 12);
const MAX_GUIDE_SAMPLE_COUNT = Number(process.env.ROUTE_GUIDE_SAMPLE_COUNT_CAP || 40);
const DEBUG_WEATHER_UNITS = String(process.env.DEBUG_WEATHER_UNITS || "0") === "1";
const DEBUG_OSM_FLAGS = String(process.env.DEBUG_OSM_FLAGS || "0") === "1";
const DANGER_METADATA_PATH =
  process.env.DANGER_METADATA_PATH ||
  path.join(__dirname, "../../danger-zone-model/siara_v1_artifacts/siara_severe_metadata.json");
const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || 7000);
const OVERPASS_GRID_DECIMALS = Number(process.env.OVERPASS_GRID_DECIMALS || 3);
const OVERPASS_SLEEP_MS = Number(process.env.OVERPASS_SLEEP_MS || 150);
const ROAD_CACHE_MAX = Number(process.env.ROAD_CACHE_MAX || 5000);
const ENABLE_OSM_FLAGS = String(process.env.ENABLE_OSM_FLAGS || "1") === "1";

const ROAD_FLAG_KEYS = [
  "Amenity",
  "Bump",
  "Crossing",
  "Give_Way",
  "Junction",
  "No_Exit",
  "Railway",
  "Roundabout",
  "Station",
  "Stop",
  "Traffic_Calming",
  "Traffic_Signal",
  "Turning_Loop",
];

const ROAD_FLAG_ZEROES = Object.freeze(
  ROAD_FLAG_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {}),
);

const weatherCache = new Map();
const twilightCache = new Map();
const roadCache = new Map();
const segmentRowCache = new Map();
const MAX_SEGMENT_CACHE = 2000;
const EARTH_RADIUS_KM = 6371;
let roadCacheHits = 0;
let roadCacheMisses = 0;

const FALLBACK_DESTINATIONS = Object.freeze([
  { id: "alger", name: "Alger", lat: 36.7538, lng: 3.0588 },
  { id: "oran", name: "Oran", lat: 35.6981, lng: -0.6348 },
  { id: "constantine", name: "Constantine", lat: 36.365, lng: 6.6147 },
  { id: "annaba", name: "Annaba", lat: 36.9, lng: 7.7669 },
  { id: "blida", name: "Blida", lat: 36.4701, lng: 2.8277 },
  { id: "setif", name: "Setif", lat: 36.1911, lng: 5.4137 },
  { id: "batna", name: "Batna", lat: 35.5559, lng: 6.1741 },
  { id: "bejaia", name: "Bejaia", lat: 36.7525, lng: 5.0556 },
  { id: "tebessa", name: "Tebessa", lat: 35.4042, lng: 8.1242 },
  { id: "jijel", name: "Jijel", lat: 36.8219, lng: 5.7667 },
  { id: "skikda", name: "Skikda", lat: 36.8775, lng: 6.9092 },
  { id: "tlemcen", name: "Tlemcen", lat: 34.8783, lng: -1.315 },
  { id: "sidi_bel_abbes", name: "Sidi Bel Abbes", lat: 35.1899, lng: -0.6308 },
  { id: "mostaganem", name: "Mostaganem", lat: 35.9371, lng: 0.0901 },
  { id: "tipaza", name: "Tipaza", lat: 36.5897, lng: 2.4475 },
  { id: "boumerdes", name: "Boumerdes", lat: 36.7564, lng: 3.4764 },
  { id: "tizi_ouzou", name: "Tizi Ouzou", lat: 36.7118, lng: 4.0459 },
  { id: "ghardaia", name: "Ghardaia", lat: 32.4909, lng: 3.6735 },
  { id: "biskra", name: "Biskra", lat: 34.8504, lng: 5.7281 },
  { id: "msila", name: "M'Sila", lat: 35.7047, lng: 4.5451 },
  { id: "chlef", name: "Chlef", lat: 36.1653, lng: 1.3345 },
]);

function buildAllowedCategorySet(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalized = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return normalized.length ? new Set(normalized) : null;
}

function loadDangerCategoricalLevelSets() {
  try {
    if (!fs.existsSync(DANGER_METADATA_PATH)) {
      return {
        weatherConditionAllowedSet: null,
        windDirectionAllowedSet: null,
      };
    }

    const raw = fs.readFileSync(DANGER_METADATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const levels = parsed?.categorical_levels || {};

    return {
      weatherConditionAllowedSet: buildAllowedCategorySet(levels?.Weather_Condition),
      windDirectionAllowedSet: buildAllowedCategorySet(levels?.Wind_Direction),
    };
  } catch (error) {
    console.warn("[Node] danger metadata load fallback:", error.message);
    return {
      weatherConditionAllowedSet: null,
      windDirectionAllowedSet: null,
    };
  }
}

const { weatherConditionAllowedSet, windDirectionAllowedSet } = loadDangerCategoricalLevelSets();
let weatherUnitsLogged = false;

function cToF(celsius) {
  return (celsius * 9) / 5 + 32;
}

function hPaToInHg(hPa) {
  return hPa * 0.0295299830714;
}

function mpsToMph(mps) {
  return mps * 2.2369362921;
}

function mmToIn(mm) {
  return mm / 25.4;
}

function metersToMiles(meters) {
  return meters / 1609.344;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function haversineDistanceKm(aLat, aLng, bLat, bLng) {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function destinationFromBearing(originLat, originLng, bearingDeg, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(originLat);
  const lng1 = toRadians(originLng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: toDegrees(lat2),
    lng: toDegrees(lng2),
  };
}

function normalizeDangerLevel(level, dangerPercent = null) {
  const text = String(level || "").trim().toLowerCase();
  if (text === "extreme" || text === "high" || text === "moderate" || text === "low") {
    return text;
  }

  const percent = safeNumber(dangerPercent);
  if (percent == null) {
    return "low";
  }
  if (percent < 25) return "low";
  if (percent < 50) return "moderate";
  if (percent < 75) return "high";
  return "extreme";
}

function normalizeLatLngPoint(point) {
  if (!Array.isArray(point) || point.length < 2) {
    return null;
  }
  const lat = safeNumber(point[0]);
  const lng = safeNumber(point[1]);
  if (lat == null || lng == null) {
    return null;
  }
  return [lat, lng];
}

function dedupePathPoints(path) {
  if (!Array.isArray(path)) {
    return [];
  }

  const deduped = [];
  const seen = new Set();
  for (const rawPoint of path) {
    const point = normalizeLatLngPoint(rawPoint);
    if (!point) {
      continue;
    }
    const key = `${point[0].toFixed(6)}:${point[1].toFixed(6)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(point);
  }
  return deduped;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value, digits = 2) {
  const n = safeNumber(value);
  if (n == null) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function parseBoundedNumber(value, fallback, { min, max, integer = false }) {
  const n = safeNumber(value);
  if (n == null) {
    return fallback;
  }
  const bounded = clampNumber(n, min, max);
  return integer ? Math.round(bounded) : bounded;
}

function isValidLatitude(lat) {
  return lat >= -90 && lat <= 90;
}

function isValidLongitude(lng) {
  return lng >= -180 && lng <= 180;
}

function toIsoTimestamp(input) {
  if (!input) {
    return new Date().toISOString();
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString();
  }
  return dt.toISOString();
}

function roundCoord(value) {
  const n = safeNumber(value);
  if (n == null) {
    return "nan";
  }
  return n.toFixed(3);
}

function weatherCacheKey(lat, lng, iso) {
  return `${roundCoord(lat)}:${roundCoord(lng)}:${iso.slice(0, 13)}`;
}

function twilightCacheKey(lat, lng, iso) {
  return `${roundCoord(lat)}:${roundCoord(lng)}:${iso.slice(0, 10)}`;
}

function mapWindDirection(degrees, windSpeedMph = null) {
  const d = safeNumber(degrees);
  const speed = safeNumber(windSpeedMph);

  if (speed != null && speed < 0.5) {
    return "CALM";
  }
  if (d == null) {
    return "Unknown";
  }

  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  const index = Math.round((((d % 360) + 360) % 360) / 22.5) % 16;
  return dirs[index];
}

function mapWeatherCondition(code) {
  const c = safeNumber(code);
  if (c == null) {
    return "Unknown";
  }

  if (c === 0) return "Clear";
  if (c === 1) return "Fair";
  if (c === 2) return "Partly Cloudy";
  if (c === 3) return "Overcast";
  if ([45, 48].includes(c)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(c)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "Snow";
  if ([95, 96, 99].includes(c)) return "Thunderstorm";
  return "Other";
}

function clampCategoricalValue(
  value,
  allowedSet,
  { fallbackIfEmpty = "Unknown", fallbackIfDisallowed = "Unknown" } = {},
) {
  const normalized = String(value || "").trim();
  const candidate = normalized || fallbackIfEmpty;

  if (!allowedSet || allowedSet.size === 0) {
    return candidate;
  }
  if (allowedSet.has(candidate)) {
    return candidate;
  }
  if (allowedSet.has(fallbackIfDisallowed)) {
    return fallbackIfDisallowed;
  }
  if (allowedSet.has("Unknown")) {
    return "Unknown";
  }
  return candidate;
}

function findNearestVisibility(hourly, currentTimeIso) {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.visibility)) {
    return null;
  }

  if (!currentTimeIso) {
    return safeNumber(hourly.visibility[0]);
  }

  const nowMs = Date.parse(currentTimeIso);
  if (Number.isNaN(nowMs)) {
    return safeNumber(hourly.visibility[0]);
  }

  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hourly.time.length; i += 1) {
    const tMs = Date.parse(hourly.time[i]);
    if (Number.isNaN(tMs)) {
      continue;
    }
    const diff = Math.abs(tMs - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  return safeNumber(hourly.visibility[bestIndex]);
}

async function getWeatherFeatures(lat, lng, timestampIso) {
  const key = weatherCacheKey(lat, lng, timestampIso);
  if (weatherCache.has(key)) {
    return weatherCache.get(key);
  }

  const params = {
    latitude: lat,
    longitude: lng,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "pressure_msl",
      "precipitation",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(","),
    hourly: "visibility",
    forecast_days: 1,
    // Critical bugfix: Open-Meteo defaults can vary. We pin units to model features explicitly.
    // Previous code treated wind_speed_10m as m/s and converted again, which can inflate mph ~3.6x.
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
  };

  const { data } = await axios.get(OPEN_METEO_URL, {
    params,
    timeout: WEATHER_TIMEOUT_MS,
  });

  if (DEBUG_WEATHER_UNITS && !weatherUnitsLogged) {
    weatherUnitsLogged = true;
    console.log("[Node][weather-units] current_units:", data?.current_units);
    console.log("[Node][weather-units] hourly_units:", data?.hourly_units);
  }

  const current = data?.current || {};
  const hourly = data?.hourly || {};

  const temperatureF = safeNumber(current.temperature_2m);
  const humidityPct = safeNumber(current.relative_humidity_2m);
  const pressureHPa = safeNumber(current.pressure_msl);
  const precipitationIn = safeNumber(current.precipitation);
  const windSpeedMph = safeNumber(current.wind_speed_10m);
  const weatherCode = safeNumber(current.weather_code);

  const visibilityMeters = findNearestVisibility(hourly, current.time || timestampIso);
  const mappedWeatherCondition = mapWeatherCondition(weatherCode);
  const mappedWindDirection = mapWindDirection(current.wind_direction_10m, windSpeedMph);
  const weatherCondition = clampCategoricalValue(mappedWeatherCondition, weatherConditionAllowedSet, {
    fallbackIfEmpty: "Unknown",
    fallbackIfDisallowed: "Other",
  });
  const windDirection = clampCategoricalValue(mappedWindDirection, windDirectionAllowedSet, {
    fallbackIfEmpty: "Unknown",
    fallbackIfDisallowed: "Unknown",
  });

  const row = {
    // Bugfix: Open-Meteo now returns F/mph/inch directly, so we avoid double-conversion.
    "Temperature(F)": temperatureF,
    "Humidity(%)": humidityPct,
    "Pressure(in)": pressureHPa == null ? null : hPaToInHg(pressureHPa),
    "Visibility(mi)": visibilityMeters == null ? null : metersToMiles(visibilityMeters),
    "Wind_Speed(mph)": windSpeedMph,
    "Precipitation(in)": precipitationIn,
    Wind_Direction: windDirection,
    Weather_Condition: weatherCondition,
  };

  weatherCache.set(key, row);
  return row;
}

function buildTwilightFallback(timestampIso) {
  const dt = new Date(timestampIso);
  const hour = dt.getHours();
  const day = hour >= 6 && hour < 18;
  const value = day ? "Day" : "Night";
  return {
    Sunrise_Sunset: value,
    Civil_Twilight: value,
    Nautical_Twilight: value,
    Astronomical_Twilight: value,
  };
}

function inRange(now, startIso, endIso) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }
  return now >= start && now <= end;
}

async function getTwilightFields(lat, lng, timestampIso) {
  const key = twilightCacheKey(lat, lng, timestampIso);
  if (twilightCache.has(key)) {
    return twilightCache.get(key);
  }

  const now = Date.parse(timestampIso);
  if (Number.isNaN(now)) {
    return buildTwilightFallback(timestampIso);
  }

  const date = timestampIso.slice(0, 10);

  try {
    const { data } = await axios.get(SUN_API_URL, {
      params: {
        lat,
        lng,
        date,
        formatted: 0,
        tzid: RISK_TIMEZONE,
      },
      timeout: SUN_TIMEOUT_MS,
    });

    if (!data || data.status !== "OK" || !data.results) {
      throw new Error(`Sun API error status=${data?.status || "UNKNOWN"}`);
    }

    const result = data.results;
    const fields = {
      Sunrise_Sunset: inRange(now, result.sunrise, result.sunset) ? "Day" : "Night",
      Civil_Twilight: inRange(now, result.civil_twilight_begin, result.civil_twilight_end)
        ? "Day"
        : "Night",
      Nautical_Twilight: inRange(
        now,
        result.nautical_twilight_begin,
        result.nautical_twilight_end,
      )
        ? "Day"
        : "Night",
      Astronomical_Twilight: inRange(
        now,
        result.astronomical_twilight_begin,
        result.astronomical_twilight_end,
      )
        ? "Day"
        : "Night",
    };

    twilightCache.set(key, fields);
    return fields;
  } catch (error) {
    console.warn("[Node] sunrise-sunset fallback:", error.message);
    const fallback = buildTwilightFallback(timestampIso);
    twilightCache.set(key, fallback);
    return fallback;
  }
}

function toBinaryRoadFlag(value) {
  if (value === true) return 1;
  if (value === false || value == null) return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0 ? 1 : 0;
  }

  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (!text) return 0;
    if (["true", "1", "yes", "y", "on"].includes(text)) return 1;
    if (["false", "0", "no", "n", "off"].includes(text)) return 0;

    const maybeNumber = safeNumber(text);
    return maybeNumber != null && maybeNumber !== 0 ? 1 : 0;
  }

  return 0;
}

function toRoadFlags(flags) {
  const obj = {};
  for (const key of ROAD_FLAG_KEYS) {
    const raw = flags?.[key];
    obj[key] = toBinaryRoadFlag(raw);
  }
  return obj;
}

function roadCacheKey(lat, lng) {
  const latNum = safeNumber(lat);
  const lngNum = safeNumber(lng);
  if (latNum == null || lngNum == null) {
    return "nan:nan";
  }

  const rawDecimals = safeNumber(OVERPASS_GRID_DECIMALS);
  const decimals = rawDecimals == null ? 3 : clampNumber(Math.round(rawDecimals), 0, 6);
  return `${latNum.toFixed(decimals)}:${lngNum.toFixed(decimals)}`;
}

function pruneRoadCacheIfNeeded() {
  const maxSizeRaw = safeNumber(ROAD_CACHE_MAX);
  const maxSize = maxSizeRaw == null ? 5000 : Math.max(1, Math.round(maxSizeRaw));
  if (roadCache.size <= maxSize) {
    return;
  }

  const excess = roadCache.size - maxSize;
  const keys = roadCache.keys();
  for (let i = 0; i < excess; i += 1) {
    const k = keys.next().value;
    if (k == null) {
      break;
    }
    roadCache.delete(k);
  }
}

function setCachedRoadFlags(key, flags) {
  if (!key) {
    return;
  }
  roadCache.set(key, toRoadFlags(flags || ROAD_FLAG_ZEROES));
  pruneRoadCacheIfNeeded();
}

function toLowerTag(value) {
  return String(value || "").trim().toLowerCase();
}

function buildOverpassRoadFlagsQuery(lat, lng) {
  const latText = Number(lat).toFixed(6);
  const lngText = Number(lng).toFixed(6);
  const timeoutSeconds = Math.max(5, Math.ceil(OVERPASS_TIMEOUT_MS / 1000));

  return `
[out:json][timeout:${timeoutSeconds}];
(
  node(around:35,${latText},${lngText})[highway=traffic_signals];
  node(around:35,${latText},${lngText})[highway=stop];
  node(around:35,${latText},${lngText})[highway=give_way];
  node(around:35,${latText},${lngText})[highway=crossing];
  node(around:35,${latText},${lngText})[crossing];
  way(around:35,${latText},${lngText})[crossing];
  node(around:35,${latText},${lngText})[traffic_calming];
  way(around:35,${latText},${lngText})[traffic_calming];
  node(around:60,${latText},${lngText})[railway];
  way(around:60,${latText},${lngText})[railway];
  way(around:60,${latText},${lngText})[junction];
  way(around:60,${latText},${lngText})[junction=roundabout];
  node(around:120,${latText},${lngText})[highway=motorway_junction];
  node(around:60,${latText},${lngText})[noexit=yes];
  way(around:60,${latText},${lngText})[noexit=yes];
  node(around:120,${latText},${lngText})[amenity];
  way(around:120,${latText},${lngText})[amenity];
  node(around:120,${latText},${lngText})[railway=station];
  way(around:120,${latText},${lngText})[railway=station];
  node(around:120,${latText},${lngText})[public_transport=station];
  way(around:120,${latText},${lngText})[public_transport=station];
  node(around:120,${latText},${lngText})[amenity=bus_station];
  way(around:120,${latText},${lngText})[amenity=bus_station];
  node(around:35,${latText},${lngText})[highway=turning_loop];
  way(around:35,${latText},${lngText})[highway=turning_loop];
);
out tags;
`.trim();
}

function parseOverpassRoadFlags(elements) {
  const flags = { ...ROAD_FLAG_ZEROES };
  const items = Array.isArray(elements) ? elements : [];

  for (const element of items) {
    const tags = element?.tags;
    if (!tags || typeof tags !== "object") {
      continue;
    }

    const highwayTag = toLowerTag(tags.highway);
    const junctionTag = toLowerTag(tags.junction);
    const trafficCalmingTag = toLowerTag(tags.traffic_calming);
    const crossingTag = String(tags.crossing || "").trim();
    const railwayTag = toLowerTag(tags.railway);
    const amenityTag = toLowerTag(tags.amenity);
    const publicTransportTag = toLowerTag(tags.public_transport);
    const noExitTag = toLowerTag(tags.noexit);

    if (highwayTag === "traffic_signals") flags.Traffic_Signal = 1;
    if (highwayTag === "stop") flags.Stop = 1;
    if (highwayTag === "give_way") flags.Give_Way = 1;
    if (highwayTag === "turning_loop") flags.Turning_Loop = 1;
    if (highwayTag === "crossing" || crossingTag) flags.Crossing = 1;
    if (highwayTag === "motorway_junction") flags.Junction = 1;

    if (junctionTag) flags.Junction = 1;
    if (junctionTag === "roundabout") {
      flags.Roundabout = 1;
      flags.Junction = 1;
    }

    if (trafficCalmingTag) {
      flags.Traffic_Calming = 1;
      if (["hump", "bump", "table", "yes"].includes(trafficCalmingTag)) {
        flags.Bump = 1;
      }
    }

    if (railwayTag) flags.Railway = 1;
    if (railwayTag === "station") flags.Station = 1;

    if (amenityTag) flags.Amenity = 1;
    if (amenityTag === "bus_station") flags.Station = 1;
    if (publicTransportTag === "station") flags.Station = 1;

    if (noExitTag === "yes") flags.No_Exit = 1;
  }

  if (flags.Roundabout === 1) {
    flags.Junction = 1;
  }

  return toRoadFlags(flags);
}

function sleepMs(ms) {
  const delay = safeNumber(ms);
  if (delay == null || delay <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, Math.round(delay)));
}

async function getRoadFlagsAsync(lat, lng, providedRoadFlags) {
  if (providedRoadFlags && typeof providedRoadFlags === "object") {
    return toRoadFlags(providedRoadFlags);
  }

  if (!ENABLE_OSM_FLAGS) {
    return toRoadFlags(ROAD_FLAG_ZEROES);
  }

  const point = validateLatLngStrict({ lat, lng });
  if (!point) {
    return toRoadFlags(ROAD_FLAG_ZEROES);
  }

  const key = roadCacheKey(point.lat, point.lng);
  if (roadCache.has(key)) {
    roadCacheHits += 1;
    if (DEBUG_OSM_FLAGS) {
      console.log(`[Node][osm-flags] cache hit h=${roadCacheHits} m=${roadCacheMisses} key=${key}`);
    }
    return roadCache.get(key);
  }

  roadCacheMisses += 1;
  if (DEBUG_OSM_FLAGS) {
    console.log(`[Node][osm-flags] cache miss h=${roadCacheHits} m=${roadCacheMisses} key=${key}`);
  }

  let flags = toRoadFlags(ROAD_FLAG_ZEROES);
  try {
    const query = buildOverpassRoadFlagsQuery(point.lat, point.lng);
    const { data } = await axios.post(OVERPASS_URL, query, {
      headers: { "Content-Type": "text/plain" },
      timeout: OVERPASS_TIMEOUT_MS,
    });

    flags = parseOverpassRoadFlags(data?.elements);
  } catch (error) {
    console.warn("[Node][osm-flags] Overpass fallback to zeroes:", error.message);
  }

  setCachedRoadFlags(key, flags);
  if (DEBUG_OSM_FLAGS) {
    console.log(`[Node][osm-flags] flags key=${key} ${JSON.stringify(flags)}`);
  }

  await sleepMs(OVERPASS_SLEEP_MS);
  return flags;
}

function safeRowNumber(value, fallback = 0) {
  const n = safeNumber(value);
  return n == null ? fallback : n;
}

function safeRowCategory(value, fallback = "Unknown") {
  const text = String(value || "").trim();
  return text || fallback;
}

async function buildDangerRow({ lat, lng, timestamp, roadFlags }) {
  const timestampIso = toIsoTimestamp(timestamp);
  const [weather, twilight, resolvedRoadFlags] = await Promise.all([
    getWeatherFeatures(lat, lng, timestampIso),
    getTwilightFields(lat, lng, timestampIso),
    getRoadFlagsAsync(lat, lng, roadFlags),
  ]);

  const finalRow = {
    Start_Time: timestampIso,
    "Temperature(F)": safeRowNumber(weather?.["Temperature(F)"], 0),
    "Humidity(%)": safeRowNumber(weather?.["Humidity(%)"], 0),
    "Pressure(in)": safeRowNumber(weather?.["Pressure(in)"], 0),
    "Visibility(mi)": safeRowNumber(weather?.["Visibility(mi)"], 0),
    "Wind_Speed(mph)": safeRowNumber(weather?.["Wind_Speed(mph)"], 0),
    "Precipitation(in)": safeRowNumber(weather?.["Precipitation(in)"], 0),
    Wind_Direction: safeRowCategory(weather?.Wind_Direction, "Unknown"),
    Weather_Condition: safeRowCategory(weather?.Weather_Condition, "Unknown"),
    Sunrise_Sunset: safeRowCategory(twilight?.Sunrise_Sunset, "Night"),
    Civil_Twilight: safeRowCategory(twilight?.Civil_Twilight, "Night"),
    Nautical_Twilight: safeRowCategory(twilight?.Nautical_Twilight, "Night"),
    Astronomical_Twilight: safeRowCategory(twilight?.Astronomical_Twilight, "Night"),
    ...resolvedRoadFlags,
  };

  console.log("\n[DANGER ROW][FINAL INPUT TO FLASK]:", finalRow);
  return finalRow;
}

function validateLatLng(body) {
  const lat = safeNumber(body?.lat);
  const lng = safeNumber(body?.lng);
  if (lat == null || lng == null) {
    return null;
  }
  return { lat, lng };
}

function validateLatLngStrict(body) {
  const point = validateLatLng(body);
  if (!point) {
    return null;
  }
  if (!isValidLatitude(point.lat) || !isValidLongitude(point.lng)) {
    return null;
  }
  return point;
}

function buildSyntheticDestinations(origin, radiusKm, count, usedIds) {
  if (count <= 0) {
    return [];
  }

  const results = [];
  for (let i = 0; i < count; i += 1) {
    const bearing = ((360 / count) * i + 35) % 360;
    const distanceKm = Math.max(2, Math.min(radiusKm * (0.45 + i * 0.1), radiusKm - 0.5));
    if (distanceKm <= 0) {
      continue;
    }

    const point = destinationFromBearing(origin.lat, origin.lng, bearing, distanceKm);
    const id = `nearby_target_${i + 1}`;
    if (usedIds.has(id)) {
      continue;
    }
    if (!isValidLatitude(point.lat) || !isValidLongitude(point.lng)) {
      continue;
    }

    usedIds.add(id);
    results.push({
      id,
      name: `Nearby route ${i + 1}`,
      lat: point.lat,
      lng: point.lng,
      distance_km: roundNumber(
        haversineDistanceKm(origin.lat, origin.lng, point.lat, point.lng),
        2,
      ),
    });
  }
  return results;
}

function selectNearbyDestinations(origin, radiusKm, maxDestinations) {
  const usedIds = new Set();
  const fromCities = FALLBACK_DESTINATIONS
    .map((item) => {
      const distanceKm = haversineDistanceKm(origin.lat, origin.lng, item.lat, item.lng);
      return {
        ...item,
        distance_km: roundNumber(distanceKm, 2),
      };
    })
    .filter((item) => item.distance_km != null && item.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, maxDestinations)
    .map((item) => {
      usedIds.add(item.id);
      return item;
    });

  if (fromCities.length >= maxDestinations) {
    return fromCities;
  }

  const needed = maxDestinations - fromCities.length;
  const synthetic = buildSyntheticDestinations(origin, radiusKm, needed, usedIds);
  return [...fromCities, ...synthetic].slice(0, maxDestinations);
}

function decodeOsrmPathCoordinates(rawCoordinates) {
  if (!Array.isArray(rawCoordinates)) {
    return null;
  }

  const path = rawCoordinates
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return null;
      }
      const lng = safeNumber(point[0]);
      const lat = safeNumber(point[1]);
      if (lat == null || lng == null) {
        return null;
      }
      return [lat, lng];
    })
    .filter(Boolean);

  return path.length >= 2 ? path : null;
}

function buildStraightLinePath(origin, destination) {
  return [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng],
  ];
}

function buildEvenSampleIndices(totalPoints, requestedSamples) {
  if (totalPoints <= 0) {
    return [];
  }
  if (totalPoints === 1) {
    return [0];
  }

  const sampleCount = Math.max(2, Math.min(totalPoints, requestedSamples));
  const indices = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const idx = Math.round((i * (totalPoints - 1)) / (sampleCount - 1));
    if (indices.length === 0 || indices[indices.length - 1] !== idx) {
      indices.push(idx);
    }
  }

  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices[indices.length - 1] !== totalPoints - 1) {
    indices.push(totalPoints - 1);
  }

  return indices;
}

function sampleRoutePoints(path, requestedSamples) {
  const normalizedPath = dedupePathPoints(path);
  if (normalizedPath.length === 0) {
    return [];
  }

  const indices = buildEvenSampleIndices(normalizedPath.length, requestedSamples);
  return indices.map((idx) => normalizedPath[idx]);
}

function sampleRouteIndices(pathLength, requestedSamples) {
  if (!Number.isFinite(pathLength) || pathLength <= 0) {
    return [];
  }
  if (pathLength === 1) {
    return [0];
  }

  const sampleCount = parseBoundedNumber(requestedSamples, DEFAULT_GUIDE_SAMPLE_COUNT, {
    min: 5,
    max: MAX_GUIDE_SAMPLE_COUNT,
    integer: true,
  });
  const targetCount = Math.max(2, Math.min(pathLength, sampleCount));

  const indices = [];
  for (let i = 0; i < targetCount; i += 1) {
    const idx = Math.round((i * (pathLength - 1)) / (targetCount - 1));
    if (indices.length === 0 || indices[indices.length - 1] !== idx) {
      indices.push(idx);
    }
  }

  if (indices[0] !== 0) {
    indices.unshift(0);
  }
  if (indices[indices.length - 1] !== pathLength - 1) {
    indices.push(pathLength - 1);
  }

  return indices;
}

function buildSamplePointsFromIndices(path, sampleIndices) {
  if (!Array.isArray(path) || !Array.isArray(sampleIndices)) {
    return [];
  }

  const points = [];
  for (const idx of sampleIndices) {
    const point = normalizeLatLngPoint(path[idx]);
    if (!point) {
      continue;
    }
    points.push(point);
  }
  return points;
}

function aggregateRouteSummary(samples) {
  const percents = samples
    .map((sample) => safeNumber(sample?.danger_percent))
    .filter((value) => value != null);

  if (!percents.length) {
    return {
      danger_percent: 0,
      danger_level: "low",
    };
  }

  const maxPercent = Math.max(...percents);
  const meanPercent = percents.reduce((acc, value) => acc + value, 0) / percents.length;
  const aggregated = roundNumber(0.6 * maxPercent + 0.4 * meanPercent, 2) ?? 0;

  return {
    danger_percent: aggregated,
    danger_level: normalizeDangerLevel(null, aggregated),
  };
}

function summarizeRouteSamples(samples) {
  return aggregateRouteSummary(samples);
}

function buildRouteGuideHash(origin, destination, timestampIso) {
  const input = [
    roundNumber(origin.lat, 5),
    roundNumber(origin.lng, 5),
    roundNumber(destination.lat, 5),
    roundNumber(destination.lng, 5),
    timestampIso,
  ].join("|");

  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

async function getOsrmRoutePath(origin, destination) {
  const url = `${OSRM_ROUTE_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  try {
    const { data } = await axios.get(url, {
      params: {
        overview: "full",
        geometries: "geojson",
        steps: false,
      },
      timeout: OSRM_TIMEOUT_MS,
    });

    if (data?.code && data.code !== "Ok") {
      throw new Error(`OSRM returned code=${data.code}`);
    }

    const route = data?.routes?.[0];
    const path = decodeOsrmPathCoordinates(route?.geometry?.coordinates);
    if (!path) {
      throw new Error("OSRM route geometry unavailable");
    }

    const distanceMeters = safeNumber(route?.distance);
    const durationSeconds = safeNumber(route?.duration);

    return {
      path,
      routing_source: "osrm",
      distance_km: distanceMeters == null ? null : roundNumber(distanceMeters / 1000, 2),
      duration_min: durationSeconds == null ? null : roundNumber(durationSeconds / 60, 2),
    };
  } catch (error) {
    const wrapped = new Error(`OSRM route lookup failed: ${error.message}`);
    wrapped.isOsrmError = true;
    throw wrapped;
  }
}

async function getRoutePathWithFallback(origin, destination) {
  const straightDistanceKm = haversineDistanceKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
  );

  const url = `${OSRM_ROUTE_URL}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  try {
    const { data } = await axios.get(url, {
      params: {
        overview: "full",
        geometries: "geojson",
        steps: false,
      },
      timeout: OSRM_TIMEOUT_MS,
    });

    const route = data?.routes?.[0];
    const path = decodeOsrmPathCoordinates(route?.geometry?.coordinates);
    if (!path) {
      throw new Error("OSRM route geometry unavailable");
    }

    const routeDistanceKm = safeNumber(route?.distance);
    return {
      path,
      distance_km: roundNumber(
        routeDistanceKm == null ? straightDistanceKm : routeDistanceKm / 1000,
        2,
      ),
      routing_source: "osrm",
    };
  } catch (error) {
    console.warn(`[Node] OSRM fallback for ${destination.id}: ${error.message}`);
    return {
      path: buildStraightLinePath(origin, destination),
      distance_km: roundNumber(straightDistanceKm, 2),
      routing_source: "straight_line",
    };
  }
}

function normalizeOverlaySamplePrediction(prediction) {
  const percentRaw = safeNumber(prediction?.danger_percent);
  const percent = percentRaw == null ? 0 : roundNumber(percentRaw, 2);
  const level = normalizeDangerLevel(prediction?.danger_level, percent);
  const confidence = safeNumber(prediction?.confidence);
  const quality = prediction?.quality == null ? null : String(prediction.quality);

  return {
    danger_percent: percent == null ? 0 : percent,
    danger_level: level,
    confidence: confidence == null ? null : roundNumber(confidence, 2),
    quality,
  };
}

async function scoreRouteSamplesWithOverlay({ sampledPoints, routeHash, timestampIso }) {
  const scoredRows = await Promise.all(
    sampledPoints.map(async ([lat, lng], idx) => {
      const sampleId = `route_${routeHash}_s${idx}`;
      const row = await buildDangerRow({
        lat,
        lng,
        timestamp: timestampIso,
        roadFlags: ROAD_FLAG_ZEROES,
      });

      setCachedSegmentRow(sampleId, row);

      return {
        sample_id: sampleId,
        lat,
        lng,
        row,
        model_row: {
          segment_id: sampleId,
          ...row,
        },
      };
    }),
  );

  const overlayResponse = await postToFlask("/risk/overlay", {
    rows: scoredRows.map((item) => item.model_row),
  });

  const overlayResults = Array.isArray(overlayResponse?.data?.results)
    ? overlayResponse.data.results
    : [];
  const predictionBySampleId = new Map();

  for (let i = 0; i < overlayResults.length; i += 1) {
    const item = overlayResults[i];
    const sampleId = String(item?.segment_id ?? scoredRows[i]?.sample_id ?? "");
    if (!sampleId) {
      continue;
    }
    predictionBySampleId.set(sampleId, normalizeOverlaySamplePrediction(item));
  }

  const sampleRowById = new Map();
  const samples = scoredRows.map((item) => {
    const prediction =
      predictionBySampleId.get(item.sample_id) || {
        danger_percent: 0,
        danger_level: "low",
        confidence: null,
        quality: null,
      };

    sampleRowById.set(item.sample_id, item.row);

    return {
      segment_id: item.sample_id,
      sample_id: item.sample_id,
      lat: item.lat,
      lng: item.lng,
      danger_percent: prediction.danger_percent,
      danger_level: prediction.danger_level,
      confidence: prediction.confidence,
      quality: prediction.quality,
    };
  });

  return { samples, sampleRowById };
}

function buildRouteGuideSegments({
  fullPath,
  sampleIndices,
  samples,
  fallbackSummary,
  routeHash,
  sampleRowById,
  useStraightSegments = false,
}) {
  if (!Array.isArray(samples) || samples.length < 2 || !Array.isArray(sampleIndices)) {
    return [];
  }

  const fallbackPercent = safeNumber(fallbackSummary?.danger_percent) ?? 0;
  const fallbackLevel = normalizeDangerLevel(fallbackSummary?.danger_level, fallbackPercent);
  const segments = [];

  for (let i = 0; i < samples.length - 1 && i < sampleIndices.length - 1; i += 1) {
    const start = samples[i];
    const end = samples[i + 1];
    if (!start || !end) {
      continue;
    }

    const i0 = Math.max(0, Number(sampleIndices[i]));
    const i1 = Math.max(i0, Number(sampleIndices[i + 1]));
    const endPercent = safeNumber(end.danger_percent);
    const segmentPercent = endPercent == null ? fallbackPercent : roundNumber(endPercent, 2);
    const segmentLevel = normalizeDangerLevel(end.danger_level, segmentPercent);
    const segmentId = `route_${routeHash}_seg${i}`;

    if (sampleRowById?.has(end.sample_id)) {
      setCachedSegmentRow(segmentId, sampleRowById.get(end.sample_id));
    }

    let segmentPath = [];
    if (useStraightSegments) {
      segmentPath = [
        [start.lat, start.lng],
        [end.lat, end.lng],
      ];
    } else if (Array.isArray(fullPath)) {
      segmentPath = dedupePathPoints(fullPath.slice(i0, i1 + 1));
    }
    if (!Array.isArray(segmentPath) || segmentPath.length < 2) {
      segmentPath = [
        [start.lat, start.lng],
        [end.lat, end.lng],
      ];
    }

    segments.push({
      segment_id: segmentId,
      path: segmentPath,
      danger_percent: segmentPercent == null ? fallbackPercent : segmentPercent,
      danger_level: segmentLevel || fallbackLevel,
      sample_from: i,
      sample_to: i + 1,
    });
  }

  return segments;
}

function buildRouteSegmentsFromSamples(samples, fallbackSummary) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return [];
  }

  const fallbackPercent = safeNumber(fallbackSummary?.danger_percent) ?? 0;
  const fallbackLevel = normalizeDangerLevel(fallbackSummary?.danger_level, fallbackPercent);

  const segments = [];
  for (let i = 0; i < samples.length - 1; i += 1) {
    const start = samples[i];
    const end = samples[i + 1];
    if (!start || !end) {
      continue;
    }

    const endPercent = safeNumber(end.danger_percent);
    const segmentPercent = endPercent == null ? fallbackPercent : roundNumber(endPercent, 2);
    const segmentLevel = normalizeDangerLevel(end.danger_level, segmentPercent);

    segments.push({
      path: [
        [start.lat, start.lng],
        [end.lat, end.lng],
      ],
      danger_percent: segmentPercent == null ? fallbackPercent : segmentPercent,
      danger_level: segmentLevel || fallbackLevel,
    });
  }

  return segments;
}

function pruneSegmentCacheIfNeeded() {
  if (segmentRowCache.size <= MAX_SEGMENT_CACHE) {
    return;
  }
  const excess = segmentRowCache.size - MAX_SEGMENT_CACHE;
  const keys = segmentRowCache.keys();
  for (let i = 0; i < excess; i += 1) {
    const k = keys.next().value;
    if (k == null) {
      break;
    }
    segmentRowCache.delete(k);
  }
}

function setCachedSegmentRow(segmentId, row) {
  if (segmentId == null) {
    return;
  }
  segmentRowCache.set(String(segmentId), row);
  pruneSegmentCacheIfNeeded();
}

async function postToFlask(path, body) {
  return axios.post(`${ML_SERVICE_BASE_URL}${path}`, body, {
    timeout: TIMEOUT_MS,
  });
}

exports.predictDriverRisk = async (req, res) => {
  const body = req.body;
  if (body == null || typeof body !== "object" || Object.keys(body).length === 0) {
    return res.status(400).json({ error: "Empty request body" });
  }

  try {
    const response = await postToFlask("/predict", body);
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Model service error" };
    console.error("[Node] /predict error:", err.message);
    return res.status(status).json(payload);
  }
};

exports.predictCurrentRisk = async (req, res) => {
  console.log("[React -> Node] /api/risk/current body:", req.body);

  const point = validateLatLng(req.body);
  if (!point) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const row = await buildDangerRow({
      lat: point.lat,
      lng: point.lng,
      timestamp: req.body?.timestamp,
      roadFlags: req.body?.roadFlags,
    });

    console.log("[Node -> Flask] /risk/current row:", row);
    const response = await postToFlask("/risk/current", row);
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Risk current model service error" };
    console.error("[Node] /api/risk/current error:", err.message);
    return res.status(status).json(payload);
  }
};

exports.predictRiskOverlay = async (req, res) => {
  console.log("[React -> Node] /api/risk/overlay body rows:", req.body?.rows?.length || 0);

  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "rows array is required" });
  }

  const invalid = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => validateLatLng(row) == null)
    .map(({ index }) => index);
  if (invalid.length > 0) {
    return res.status(400).json({ error: "each row needs lat/lng", invalid_indices: invalid });
  }

  try {
    const modelRows = await Promise.all(
      rows.map(async (row, index) => {
        const point = validateLatLng(row);
        const fullRow = await buildDangerRow({
          lat: point.lat,
          lng: point.lng,
          timestamp: row?.timestamp || req.body?.timestamp,
          roadFlags: row?.roadFlags,
        });

        const segmentId = row.segment_id ?? row.segmentId ?? index;
        setCachedSegmentRow(segmentId, fullRow);

        return {
          segment_id: segmentId,
          ...fullRow,
        };
      }),
    );

    if (modelRows.length > 0) {
      console.log("[Node -> Flask] /risk/overlay first row:", modelRows[0]);
    }

    const response = await postToFlask("/risk/overlay", { rows: modelRows });
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Risk overlay model service error" };
    console.error("[Node] /api/risk/overlay error:", err.message);
    return res.status(status).json(payload);
  }
};

exports.predictRouteGuide = async (req, res) => {
  console.log("[React -> Node] /api/risk/route body:", req.body);

  const origin = validateLatLngStrict(req.body?.origin);
  const destinationPoint = validateLatLngStrict(req.body?.destination);
  if (!origin || !destinationPoint) {
    return res.status(400).json({
      error: "origin and destination with valid lat/lng are required",
    });
  }

  const timestampIso = toIsoTimestamp(req.body?.timestamp);
  const sampleCount = parseBoundedNumber(
    req.body?.sample_count,
    DEFAULT_GUIDE_SAMPLE_COUNT,
    {
      min: 5,
      max: MAX_GUIDE_SAMPLE_COUNT,
      integer: true,
    },
  );
  const routeHash = buildRouteGuideHash(origin, destinationPoint, timestampIso);

  try {
    let routed = null;
    let routeWarning = null;

    try {
      routed = await getOsrmRoutePath(origin, destinationPoint);
    } catch (osrmError) {
      const straightDistanceKm = haversineDistanceKm(
        origin.lat,
        origin.lng,
        destinationPoint.lat,
        destinationPoint.lng,
      );
      console.warn("[Node] /api/risk/route OSRM fallback:", osrmError.message);

      routed = {
        path: buildStraightLinePath(origin, destinationPoint),
        routing_source: "straight_line",
        distance_km: roundNumber(straightDistanceKm, 2),
        duration_min: null,
      };
      routeWarning = "routing_fallback_straight_line";
    }

    const fullPath = dedupePathPoints(routed.path);
    const sampleIndices = sampleRouteIndices(fullPath.length, sampleCount);
    const sampledPoints = buildSamplePointsFromIndices(fullPath, sampleIndices);

    if (sampledPoints.length < 2) {
      return res.status(500).json({ error: "Failed to sample enough route points" });
    }

    const { samples, sampleRowById } = await scoreRouteSamplesWithOverlay({
      sampledPoints,
      routeHash,
      timestampIso,
    });
    const summary = aggregateRouteSummary(samples);
    const segments = buildRouteGuideSegments({
      fullPath,
      sampleIndices,
      samples,
      fallbackSummary: summary,
      routeHash,
      sampleRowById,
      useStraightSegments: routed.routing_source === "straight_line",
    });

    return res.json({
      origin,
      destination: {
        name: req.body?.destination?.name || "Destination",
        lat: destinationPoint.lat,
        lng: destinationPoint.lng,
      },
      routing_source: routed.routing_source,
      path: fullPath,
      sample_indices: sampleIndices,
      samples,
      segments,
      summary,
      distance_km: routed.distance_km,
      eta_min: routed.duration_min,
      duration_min: routed.duration_min,
      route_warning: routeWarning,
    });
  } catch (err) {
    console.error("[Node] /api/risk/route scoring error:", err.message);
    return res.status(500).json({ error: "Route danger scoring failed" });
  }
};

exports.predictNearbyZones = async (req, res) => {
  console.log("[React -> Node] /api/risk/nearby-zones body:", req.body);

  const origin = validateLatLngStrict(req.body);
  if (!origin) {
    return res.status(400).json({ error: "Valid lat and lng are required" });
  }

  const radiusKm = parseBoundedNumber(req.body?.radius_km, DEFAULT_NEARBY_RADIUS_KM, {
    min: 2,
    max: 100,
  });
  const maxDestinations = parseBoundedNumber(
    req.body?.max_destinations,
    DEFAULT_MAX_DESTINATIONS,
    {
      min: 1,
      max: MAX_NEARBY_DESTINATIONS,
      integer: true,
    },
  );
  const samplesPerRoute = parseBoundedNumber(
    req.body?.samples_per_route ?? req.body?.sample_points,
    DEFAULT_ROUTE_SAMPLES,
    {
      min: 2,
      max: MAX_ROUTE_SAMPLES,
      integer: true,
    },
  );
  const timestampIso = toIsoTimestamp(req.body?.timestamp);

  try {
    const destinations = selectNearbyDestinations(origin, radiusKm, maxDestinations);
    if (!destinations.length) {
      return res.json({ origin, routes: [] });
    }

    const routedRoutes = await Promise.all(
      destinations.map(async (destination, index) => {
        const routed = await getRoutePathWithFallback(origin, destination);
        return {
          route_id: `r${index + 1}`,
          destination: {
            id: destination.id,
            name: destination.name,
            lat: destination.lat,
            lng: destination.lng,
            distance_km: routed.distance_km,
          },
          path: routed.path,
          routing_source: routed.routing_source,
        };
      }),
    );

    const sampleJobs = [];
    const routeSamplesByRouteId = new Map();

    for (const route of routedRoutes) {
      let sampledPoints = sampleRoutePoints(route.path, samplesPerRoute);
      if (sampledPoints.length === 0) {
        sampledPoints = sampleRoutePoints(
          buildStraightLinePath(origin, route.destination),
          samplesPerRoute,
        );
      }

      const routeSamples = sampledPoints.map(([lat, lng], sampleIndex) => {
        const sampleId = `${route.route_id}:s${sampleIndex}`;
        sampleJobs.push({
          sample_id: sampleId,
          route_id: route.route_id,
          sample_index: sampleIndex,
          lat,
          lng,
        });
        return { sample_id: sampleId, lat, lng };
      });

      routeSamplesByRouteId.set(route.route_id, routeSamples);
    }

    if (sampleJobs.length === 0) {
      const routes = routedRoutes.map((route) => ({
        ...route,
        summary: { danger_percent: 0, danger_level: "low" },
        segments: [],
        samples: [],
      }));
      return res.json({ origin, routes });
    }

    const modelRows = await Promise.all(
      sampleJobs.map(async (job) => {
        const row = await buildDangerRow({
          lat: job.lat,
          lng: job.lng,
          timestamp: timestampIso,
          roadFlags: ROAD_FLAG_ZEROES,
        });
        return {
          segment_id: job.sample_id,
          ...row,
        };
      }),
    );

    const overlayResponse = await postToFlask("/risk/overlay", { rows: modelRows });
    const overlayResults = Array.isArray(overlayResponse?.data?.results)
      ? overlayResponse.data.results
      : [];

    const predictionBySampleId = new Map();
    for (let i = 0; i < overlayResults.length; i += 1) {
      const item = overlayResults[i];
      const sampleId = String(item?.segment_id ?? modelRows[i]?.segment_id ?? "");
      if (!sampleId) {
        continue;
      }
      predictionBySampleId.set(sampleId, normalizeOverlaySamplePrediction(item));
    }

    const routes = routedRoutes.map((route) => {
      const sampled = routeSamplesByRouteId.get(route.route_id) || [];
      const samples = sampled.map((sample) => {
        const predicted =
          predictionBySampleId.get(sample.sample_id) || {
            danger_percent: 0,
            danger_level: "low",
            confidence: null,
            quality: null,
          };
        return {
          lat: sample.lat,
          lng: sample.lng,
          danger_percent: predicted.danger_percent,
          danger_level: predicted.danger_level,
          confidence: predicted.confidence,
          quality: predicted.quality,
        };
      });

      const summary = summarizeRouteSamples(samples);
      const segments = buildRouteSegmentsFromSamples(samples, summary);

      return {
        ...route,
        summary,
        segments,
        samples,
      };
    });

    return res.json({
      origin,
      routes,
    });
  } catch (err) {
    console.error("[Node] /api/risk/nearby-zones error:", err.message);
    return res.status(500).json({ error: "Failed to compute nearby danger routes" });
  }
};

exports.predictRiskExplain = async (req, res) => {
  console.log("[React -> Node] /api/risk/explain body:", req.body);

  const segmentId = req.body?.segment_id ?? req.body?.segmentId;
  let row = null;

  if (req.body?.row && typeof req.body.row === "object") {
    row = req.body.row;
  } else if (segmentId != null && segmentRowCache.has(String(segmentId))) {
    row = segmentRowCache.get(String(segmentId));
  } else {
    const point = validateLatLng(req.body);
    if (!point) {
      return res.status(400).json({ error: "Provide segment_id from overlay cache or lat/lng" });
    }

    try {
      row = await buildDangerRow({
        lat: point.lat,
        lng: point.lng,
        timestamp: req.body?.timestamp,
        roadFlags: req.body?.roadFlags,
      });
      if (segmentId != null) {
        setCachedSegmentRow(segmentId, row);
      }
    } catch (err) {
      console.error("[Node] explain row build error:", err.message);
      return res.status(500).json({ error: "Failed to build explain row" });
    }
  }

  try {
    console.log("[Node -> Flask] /risk/explain row:", row);
    const response = await postToFlask("/risk/explain", {
      row,
      top_k: req.body?.top_k,
    });
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const payload = err.response?.data || { error: "Risk explain model service error" };
    console.error("[Node] /api/risk/explain error:", err.message);
    return res.status(status).json(payload);
  }
};
