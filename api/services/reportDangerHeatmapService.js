const pool = require("../db");

const DEFAULT_HOURS = 24;
const MAX_HOURS = 24 * 30;
const DBSCAN_EPS_DEG = 0.002;
const DBSCAN_MINPOINTS = 1;

function logHeatmap(message, payload) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[report-danger-heatmap] ${message}`, payload || {});
  }
}

function parseHoursFromRequest(value) {
  if (value == null || value === "") return DEFAULT_HOURS;
  const text = String(value).trim().toLowerCase();
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(MAX_HOURS, Math.max(1, Math.round(numeric)));
  }
  const match = text.match(/^(\d+(?:\.\d+)?)\s*([hd])$/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (Number.isFinite(amount) && amount > 0) {
      const hours = unit === "d" ? amount * 24 : amount;
      return Math.min(MAX_HOURS, Math.max(1, Math.round(hours)));
    }
  }
  return DEFAULT_HOURS;
}

function mapDangerWeightToVisuals(weight) {
  const value = Number(weight);
  if (!Number.isFinite(value) || value <= 0) {
    return {
      level: "low",
      radiusMeters: 80,
      fillOpacity: 0.2,
      color: "#facc15",
    };
  }
  if (value > 20) {
    return {
      level: "critical",
      radiusMeters: 320,
      fillOpacity: 0.5,
      color: "#dc2626",
    };
  }
  if (value >= 13) {
    return {
      level: "high",
      radiusMeters: 220,
      fillOpacity: 0.4,
      color: "#ea580c",
    };
  }
  if (value >= 6) {
    return {
      level: "moderate",
      radiusMeters: 140,
      fillOpacity: 0.3,
      color: "#f59e0b",
    };
  }
  return {
    level: "low",
    radiusMeters: 80,
    fillOpacity: 0.2,
    color: "#facc15",
  };
}

function parseBounds(input) {
  if (!input || typeof input !== "object") return null;
  const north = Number(input.north);
  const south = Number(input.south);
  const east = Number(input.east);
  const west = Number(input.west);
  if (
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    return null;
  }
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}

async function getDangerHeatClusters({ bounds = null, hours = DEFAULT_HOURS } = {}) {
  const safeHours = Number.isFinite(Number(hours)) && Number(hours) > 0 ? Number(hours) : DEFAULT_HOURS;
  const intervalText = `${Math.round(safeHours)} hours`;
  const safeBounds = parseBounds(bounds);

  const params = [intervalText];
  let boundsClause = "";
  if (safeBounds) {
    boundsClause = `
      AND ar.incident_location && ST_MakeEnvelope($2, $3, $4, $5, 4326)::geography
    `;
    params.push(safeBounds.west, safeBounds.south, safeBounds.east, safeBounds.north);
  }

  const sql = `
    WITH source AS (
      SELECT
        ar.id,
        ar.incident_location::geometry AS geom,
        COALESCE(ar.severity_hint, 0) AS severity_hint,
        ar.created_at,
        ar.verified_by_officer_id,
        CASE
          WHEN COALESCE(ar.severity_hint, 0) >= 5 THEN 8
          WHEN ar.severity_hint = 4 THEN 6
          WHEN ar.severity_hint = 3 THEN 4
          WHEN ar.severity_hint = 2 THEN 2
          WHEN ar.severity_hint = 1 THEN 1
          ELSE 1
        END
        + CASE WHEN ar.verified_by_officer_id IS NOT NULL THEN 2 ELSE 0 END
        AS weight
      FROM app.accident_reports ar
      WHERE ar.incident_location IS NOT NULL
        AND ar.created_at >= now() - ($1::text)::interval
        AND COALESCE(ar.latest_predicted_label, 'real')
            NOT IN ('spam', 'out_of_context', 'invalid_location')
        ${boundsClause}
    ),
    clustered AS (
      SELECT
        ST_ClusterDBSCAN(geom, eps := ${DBSCAN_EPS_DEG}, minpoints := ${DBSCAN_MINPOINTS}) OVER () AS cluster_id,
        geom,
        severity_hint,
        weight,
        created_at
      FROM source
    )
    SELECT
      cluster_id,
      COUNT(*)::int AS report_count,
      SUM(weight)::int AS danger_weight,
      MAX(severity_hint)::int AS max_severity,
      MAX(created_at) AS latest_report_at,
      ST_Y(ST_Centroid(ST_Collect(geom))) AS lat,
      ST_X(ST_Centroid(ST_Collect(geom))) AS lon
    FROM clustered
    WHERE cluster_id IS NOT NULL
    GROUP BY cluster_id
    ORDER BY danger_weight DESC
    LIMIT 500
  `;

  let rows = [];
  try {
    const result = await pool.query(sql, params);
    rows = result.rows || [];
  } catch (error) {
    logHeatmap("dbscan_query_failed", { message: error?.message, code: error?.code });
    throw error;
  }

  const clusters = rows.map((row, index) => {
    const visuals = mapDangerWeightToVisuals(row.danger_weight);
    return {
      id: `cluster-${row.cluster_id != null ? row.cluster_id : index + 1}`,
      lat: Number(row.lat),
      lon: Number(row.lon),
      reportCount: Number(row.report_count || 0),
      dangerWeight: Number(row.danger_weight || 0),
      maxSeverity: Number(row.max_severity || 0),
      latestReportAt: row.latest_report_at
        ? new Date(row.latest_report_at).toISOString()
        : null,
      level: visuals.level,
      radiusMeters: visuals.radiusMeters,
      fillOpacity: visuals.fillOpacity,
      color: visuals.color,
    };
  });

  logHeatmap("computed_clusters", {
    rangeHours: Math.round(safeHours),
    clusterCount: clusters.length,
    bounded: Boolean(safeBounds),
  });

  return {
    rangeHours: Math.round(safeHours),
    clusters,
  };
}

module.exports = {
  getDangerHeatClusters,
  mapDangerWeightToVisuals,
  parseHoursFromRequest,
};
