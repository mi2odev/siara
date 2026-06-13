// AI "predicted danger zones" for the user map.
//
// Strategy (reuses proven building blocks rather than new modelling):
//   1. getDangerHeatClusters() finds accident hotspot centres inside the
//      visible bounds (where incidents historically concentrate).
//   2. snapPointsToRoadSegments() maps each hotspot centre to a real
//      gis.road_segments id — the occurrence model is keyed by road segment.
//   3. predictOccurrenceRisk() scores each segment for the *forecast* time
//      (now + horizon, or an explicit timestamp), trained-model-first with a
//      rule-fusion fallback, personalized-else-model when a driver profile
//      exists.
//
// The hotspot centres are historical; the score is forward-looking. That is
// exactly "where is it likely to be dangerous in the next few hours".

const { getDangerHeatClusters } = require("./reportDangerHeatmapService");
const { snapPointsToRoadSegments } = require("./riskPersistence");
const { predictOccurrenceRisk } = require("./occurrenceRiskService");

// History window used to locate stable hotspots (independent of the forecast
// horizon, which only affects the *score*).
const HOTSPOT_HISTORY_HOURS = 24 * 14;
const MAX_ZONES = 12;
const DEFAULT_HORIZON_HOURS = 3;
const MAX_HORIZON_HOURS = 72;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Forecast time bucket: prefer an explicit ISO timestamp, else now + horizon.
function resolveForecastBucket({ timestamp, horizonHours }) {
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      const safeHours = Math.max(
        0,
        Math.round((parsed.getTime() - Date.now()) / 3_600_000),
      );
      parsed.setMinutes(0, 0, 0);
      return { bucketIso: parsed.toISOString(), horizon: safeHours };
    }
  }
  const horizon = Math.min(
    MAX_HORIZON_HOURS,
    Math.max(0, Math.round(Number(horizonHours) || DEFAULT_HORIZON_HOURS)),
  );
  const future = new Date(Date.now() + horizon * 3_600_000);
  future.setMinutes(0, 0, 0);
  return { bucketIso: future.toISOString(), horizon };
}

// Pull a single probability + risk level out of the occurrence prediction,
// honouring personalized-else-model. Rule-fusion has no calibrated
// probability, so fall back to its 0..1 heuristic score.
function extractZoneScore(prediction) {
  const occ = prediction || {};
  const personalizedApplied = occ.personalized?.driver_behavior_applied === true;

  const personalizedProb =
    finiteOrNull(occ.personalized?.calibrated_probability)
    ?? finiteOrNull(occ.personalized?.risk_score);
  const modelProb =
    finiteOrNull(occ.modelOnly?.calibrated_probability)
    ?? finiteOrNull(occ.modelOnly?.risk_score);

  const probability = personalizedApplied
    ? (personalizedProb ?? modelProb)
    : (modelProb ?? personalizedProb);

  const level =
    (personalizedApplied ? occ.personalized?.risk_level : occ.modelOnly?.risk_level)
    || occ.occurrenceRisk?.riskLevel
    || null;

  const calibrated =
    finiteOrNull(
      personalizedApplied
        ? occ.personalized?.calibrated_probability
        : occ.modelOnly?.calibrated_probability,
    ) != null;

  const topFactors = Array.isArray(occ.modelOnly?.top_factors)
    ? occ.modelOnly.top_factors.slice(0, 3)
    : [];

  return { probability, level, personalizedApplied, calibrated, topFactors };
}

// Collapse the occurrence risk level into the 3-bucket severity the map
// renderer colours by.
function severityFromLevel(level) {
  const l = String(level || "").toLowerCase();
  if (l === "critical" || l === "extreme" || l === "high") return "high";
  if (l === "moderate" || l === "medium") return "medium";
  return "low";
}

async function getForecastZones({
  bounds = null,
  timestamp = null,
  horizonHours = DEFAULT_HORIZON_HOURS,
  zoom = null,
  userId = null,
  limit = MAX_ZONES,
} = {}) {
  if (!bounds) {
    throw httpError(400, "bounds (north, south, east, west) are required");
  }

  const { bucketIso, horizon } = resolveForecastBucket({ timestamp, horizonHours });
  const safeLimit = Math.max(1, Math.min(MAX_ZONES, Math.round(Number(limit) || MAX_ZONES)));

  // 1. Hotspot centres in the visible bounds.
  const heat = await getDangerHeatClusters({
    bounds,
    hours: HOTSPOT_HISTORY_HOURS,
    zoom,
    minReports: 1,
  });
  const clusters = (Array.isArray(heat?.clusters) ? heat.clusters : []).slice(0, safeLimit);

  if (clusters.length === 0) {
    return {
      zones: [],
      horizonHours: horizon,
      forecastFor: bucketIso,
      generatedAt: new Date().toISOString(),
    };
  }

  // 2. Snap each centre to a real road segment.
  const points = clusters.map((c) => ({ lat: Number(c.lat), lng: Number(c.lon) }));
  const segmentIds = await snapPointsToRoadSegments(points);

  // 3. Score each segment for the forecast time. Bounded fan-out (<= MAX_ZONES);
  //    persist:false so forecasts never pollute the user's saved history.
  const scored = await Promise.all(
    clusters.map(async (cluster, index) => {
      const segmentId = segmentIds[index];
      if (!segmentId) return null;
      try {
        const prediction = await predictOccurrenceRisk({
          userId,
          roadSegmentId: segmentId,
          timeBucket: bucketIso,
          persist: false,
        });
        const { probability, level, personalizedApplied, calibrated, topFactors } =
          extractZoneScore(prediction);
        if (probability == null) return null;

        const serverRadius = Number(cluster.radiusMeters);
        return {
          id: `zone-${segmentId}`,
          roadSegmentId: String(segmentId),
          lat: Number(cluster.lat),
          lng: Number(cluster.lon),
          radiusM: serverRadius > 0 ? Math.round(serverRadius) : 600,
          probability: Number(probability.toFixed(4)),
          percent: Math.round(Math.max(0, Math.min(1, probability)) * 100),
          level,
          severity: severityFromLevel(level),
          calibrated,
          personalized: personalizedApplied,
          reportCount: cluster.reportCount ?? null,
          topFactors,
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[forecast-zones] segment_score_failed", {
            segmentId,
            message: error?.message,
          });
        }
        return null;
      }
    }),
  );

  const zones = scored
    .filter(Boolean)
    .sort((a, b) => b.probability - a.probability);

  return {
    zones,
    horizonHours: horizon,
    forecastFor: bucketIso,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getForecastZones };
