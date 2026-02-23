const axios = require("axios");

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
const segmentRowCache = new Map();
const MAX_SEGMENT_CACHE = 2000;

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
    return "Other";
  }

  if (c === 0) return "Clear";
  if (c === 1) return "Fair";
  if (c === 2) return "Partly Cloudy";
  if (c === 3) return "Overcast";
  if ([45, 48].includes(c)) return "Fog";
  if ([51, 53, 55].includes(c)) return "Drizzle";
  if ([56, 57].includes(c)) return "Freezing Drizzle";
  if ([61].includes(c)) return "Light Rain";
  if ([63].includes(c)) return "Rain";
  if ([65].includes(c)) return "Heavy Rain";
  if ([66, 67].includes(c)) return "Freezing Rain";
  if ([71].includes(c)) return "Light Snow";
  if ([73, 77].includes(c)) return "Snow";
  if ([75].includes(c)) return "Heavy Snow";
  if ([80].includes(c)) return "Light Rain Shower";
  if ([81].includes(c)) return "Rain Shower";
  if ([82].includes(c)) return "Heavy Rain Showers";
  if ([85].includes(c)) return "Light Snow Showers";
  if ([86].includes(c)) return "Snow";
  if ([95].includes(c)) return "Thunderstorm";
  if ([96, 99].includes(c)) return "Thunder and Hail";
  return "Other";
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
    timezone: "auto",
  };

  const { data } = await axios.get(OPEN_METEO_URL, {
    params,
    timeout: WEATHER_TIMEOUT_MS,
  });

  const current = data?.current || {};
  const hourly = data?.hourly || {};

  const temperatureC = safeNumber(current.temperature_2m);
  const humidityPct = safeNumber(current.relative_humidity_2m);
  const pressureHPa = safeNumber(current.pressure_msl);
  const precipitationMm = safeNumber(current.precipitation);
  const windSpeedMps = safeNumber(current.wind_speed_10m);
  const weatherCode = safeNumber(current.weather_code);

  const visibilityMeters = findNearestVisibility(hourly, current.time || timestampIso);
  const windSpeedMph = windSpeedMps == null ? null : mpsToMph(windSpeedMps);

  const row = {
    "Temperature(F)": temperatureC == null ? null : cToF(temperatureC),
    "Humidity(%)": humidityPct,
    "Pressure(in)": pressureHPa == null ? null : hPaToInHg(pressureHPa),
    "Visibility(mi)": visibilityMeters == null ? null : metersToMiles(visibilityMeters),
    "Wind_Speed(mph)": windSpeedMph,
    "Precipitation(in)": precipitationMm == null ? null : mmToIn(precipitationMm),
    Wind_Direction: mapWindDirection(current.wind_direction_10m, windSpeedMph),
    Weather_Condition: mapWeatherCondition(weatherCode),
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

function toRoadFlags(flags) {
  const obj = {};
  for (const key of ROAD_FLAG_KEYS) {
    const raw = flags?.[key];
    obj[key] = raw ? 1 : 0;
  }
  return obj;
}

async function buildDangerRow({ lat, lng, timestamp, roadFlags }) {
  const timestampIso = toIsoTimestamp(timestamp);
  const [weather, twilight] = await Promise.all([
    getWeatherFeatures(lat, lng, timestampIso),
    getTwilightFields(lat, lng, timestampIso),
  ]);

  const finalRow = {
    Start_Time: timestampIso,
    ...weather,
    ...twilight,
    ...toRoadFlags(roadFlags || ROAD_FLAG_ZEROES),
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
