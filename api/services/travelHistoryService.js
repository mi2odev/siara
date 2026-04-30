const pool = require("../db");

const VALID_RISK_LEVELS = new Set(["low", "moderate", "medium", "high", "extreme", "critical"]);

function safeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampRiskPercent(value) {
  const num = safeNumber(value);
  if (num == null) return null;
  return Math.max(0, Math.min(100, num));
}

function clampRating(value) {
  const num = safeNumber(value);
  if (num == null) return null;
  const rounded = Math.round(num);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeRiskLevel(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (!VALID_RISK_LEVELS.has(text)) return text;
  return text;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickPoint(input) {
  if (!input || typeof input !== "object") return null;
  const lat = safeNumber(input.lat ?? input.latitude);
  const lng = safeNumber(input.lng ?? input.lon ?? input.longitude);
  if (lat == null || lng == null) return null;
  const name =
    typeof input.name === "string"
      ? input.name.trim()
      : typeof input.label === "string"
        ? input.label.trim()
        : null;
  return { lat, lng, name: name || null };
}

function extractSegments(selectedRoute) {
  if (!selectedRoute || typeof selectedRoute !== "object") return [];
  const candidates =
    Array.isArray(selectedRoute.segments) && selectedRoute.segments.length > 0
      ? selectedRoute.segments
      : Array.isArray(selectedRoute.samples)
        ? selectedRoute.samples
        : [];

  return candidates.map((seg, index) => ({
    index: index + 1,
    segment_id: seg?.segment_id ?? seg?.id ?? null,
    name: seg?.name || seg?.road_name || null,
    ref: seg?.ref || null,
    road_class: seg?.road_class || null,
    distance_km: safeNumber(seg?.distance_km),
    danger_percent: safeNumber(seg?.danger_percent),
    danger_level: normalizeRiskLevel(seg?.danger_level),
    confidence: safeNumber(seg?.confidence),
    quality: seg?.quality || null,
    start_km: safeNumber(seg?.start_km),
    end_km: safeNumber(seg?.end_km),
    predicted_enter_at: seg?.predicted_enter_at || null,
    risk_timestamp_used: seg?.risk_timestamp_used || null,
    path: Array.isArray(seg?.path) ? seg.path : null,
  }));
}

function buildRouteSnapshot(selectedRoute) {
  if (!selectedRoute || typeof selectedRoute !== "object") return {};
  return {
    route_id: selectedRoute.route_id || null,
    route_type: selectedRoute.route_type || null,
    routing_source: selectedRoute.routing_source || null,
    distance_km: safeNumber(selectedRoute.distance_km),
    duration_min: safeNumber(selectedRoute.duration_min ?? selectedRoute.eta_min),
    summary: selectedRoute.summary && typeof selectedRoute.summary === "object"
      ? {
          danger_percent: safeNumber(selectedRoute.summary.danger_percent),
          danger_level: normalizeRiskLevel(selectedRoute.summary.danger_level),
        }
      : null,
    path: Array.isArray(selectedRoute.path) ? selectedRoute.path : null,
    sample_indices: Array.isArray(selectedRoute.sample_indices)
      ? selectedRoute.sample_indices
      : null,
    route_warning: selectedRoute.route_warning || null,
  };
}

async function listMyTravelHistory(userId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const result = await pool.query(
    `
      select
        id,
        destination_name,
        origin_name,
        started_at,
        arrived_at,
        duration_seconds,
        distance_km,
        route_type,
        overall_risk_percent,
        overall_risk_level,
        rating,
        created_at
      from app.travel_histories
      where user_id = $1
      order by created_at desc
      limit $2 offset $3
    `,
    [userId, safeLimit + 1, safeOffset],
  );
  const hasMore = result.rows.length > safeLimit;
  const rows = hasMore ? result.rows.slice(0, safeLimit) : result.rows;
  return {
    items: rows.map((row) => ({
      id: row.id,
      destinationName: row.destination_name,
      originName: row.origin_name,
      startedAt: row.started_at,
      arrivedAt: row.arrived_at,
      durationSeconds:
        row.duration_seconds != null ? Number(row.duration_seconds) : null,
      distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
      routeType: row.route_type,
      overallRiskPercent:
        row.overall_risk_percent != null ? Number(row.overall_risk_percent) : null,
      overallRiskLevel: row.overall_risk_level,
      rating: row.rating != null ? Number(row.rating) : null,
      createdAt: row.created_at,
    })),
    pagination: { limit: safeLimit, offset: safeOffset, hasMore },
  };
}

async function getTravelHistoryDetail(userId, id) {
  const result = await pool.query(
    `
      select *
      from app.travel_histories
      where id = $1 and user_id = $2
      limit 1
    `,
    [id, userId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    origin: {
      name: row.origin_name,
      lat: Number(row.origin_lat),
      lng: Number(row.origin_lng),
    },
    destination: {
      name: row.destination_name,
      lat: Number(row.destination_lat),
      lng: Number(row.destination_lng),
    },
    routeType: row.route_type,
    startedAt: row.started_at,
    arrivedAt: row.arrived_at,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    overallRiskPercent:
      row.overall_risk_percent != null ? Number(row.overall_risk_percent) : null,
    overallRiskLevel: row.overall_risk_level,
    routeSnapshot:
      row.route_snapshot && typeof row.route_snapshot === "object"
        ? row.route_snapshot
        : {},
    segmentsSnapshot: Array.isArray(row.segments_snapshot)
      ? row.segments_snapshot
      : [],
    rating: row.rating != null ? Number(row.rating) : null,
    feedbackText: row.feedback_text,
    createdAt: row.created_at,
  };
}

async function completeTravelHistory(userId, payload) {
  if (!payload || typeof payload !== "object") {
    const error = new Error("Payload is required");
    error.status = 400;
    throw error;
  }

  const origin = pickPoint(payload.origin);
  const destination = pickPoint(payload.destination);
  if (!origin) {
    const error = new Error("origin must contain valid lat/lng");
    error.status = 400;
    throw error;
  }
  if (!destination) {
    const error = new Error("destination must contain valid lat/lng");
    error.status = 400;
    throw error;
  }

  const selectedRoute = payload.selectedRoute;
  if (!selectedRoute || typeof selectedRoute !== "object") {
    const error = new Error("selectedRoute is required");
    error.status = 400;
    throw error;
  }

  const startedAt = parseTimestamp(payload.startedAt) || new Date();
  const arrivedAt = parseTimestamp(payload.arrivedAt);
  const durationSeconds =
    arrivedAt && startedAt
      ? Math.max(0, Math.round((arrivedAt.getTime() - startedAt.getTime()) / 1000))
      : null;

  const routeType =
    payload.selectedRouteType ||
    selectedRoute.route_type ||
    selectedRoute.route_label ||
    null;
  const distanceKm = safeNumber(selectedRoute.distance_km);
  const overallRiskPercent = clampRiskPercent(selectedRoute?.summary?.danger_percent);
  const overallRiskLevel = normalizeRiskLevel(selectedRoute?.summary?.danger_level);
  const rating = clampRating(payload.rating);
  const feedbackText =
    typeof payload.feedbackText === "string"
      ? payload.feedbackText.trim().slice(0, 4000) || null
      : null;

  const routeSnapshot = buildRouteSnapshot(selectedRoute);
  const segmentsSnapshot = extractSegments(selectedRoute);

  const insert = await pool.query(
    `
      insert into app.travel_histories (
        user_id,
        origin_name, origin_lat, origin_lng,
        destination_name, destination_lat, destination_lng,
        route_type,
        started_at, arrived_at, duration_seconds, distance_km,
        overall_risk_percent, overall_risk_level,
        route_snapshot, segments_snapshot,
        rating, feedback_text
      )
      values (
        $1,
        $2, $3, $4,
        $5, $6, $7,
        $8,
        $9, $10, $11, $12,
        $13, $14,
        $15::jsonb, $16::jsonb,
        $17, $18
      )
      returning id, created_at
    `,
    [
      userId,
      origin.name,
      origin.lat,
      origin.lng,
      destination.name,
      destination.lat,
      destination.lng,
      routeType,
      startedAt.toISOString(),
      arrivedAt ? arrivedAt.toISOString() : null,
      durationSeconds,
      distanceKm,
      overallRiskPercent,
      overallRiskLevel,
      JSON.stringify(routeSnapshot),
      JSON.stringify(segmentsSnapshot),
      rating,
      feedbackText,
    ],
  );

  return {
    id: insert.rows[0].id,
    createdAt: insert.rows[0].created_at,
  };
}

async function updateTravelHistoryRating(userId, id, { rating, feedbackText }) {
  const safeRating = clampRating(rating);
  if (safeRating == null && feedbackText == null) {
    const error = new Error("rating or feedbackText is required");
    error.status = 400;
    throw error;
  }
  const sanitizedFeedback =
    typeof feedbackText === "string"
      ? feedbackText.trim().slice(0, 4000) || null
      : null;

  const result = await pool.query(
    `
      update app.travel_histories
      set
        rating = coalesce($1, rating),
        feedback_text = case
          when $2::text is null and $3::boolean = true then null
          when $2::text is not null then $2::text
          else feedback_text
        end
      where id = $4 and user_id = $5
      returning id, rating, feedback_text
    `,
    [
      safeRating,
      sanitizedFeedback,
      typeof feedbackText === "string",
      id,
      userId,
    ],
  );

  if (result.rowCount === 0) {
    const error = new Error("Travel history not found");
    error.status = 404;
    throw error;
  }

  return {
    id: result.rows[0].id,
    rating: result.rows[0].rating != null ? Number(result.rows[0].rating) : null,
    feedbackText: result.rows[0].feedback_text,
  };
}

module.exports = {
  listMyTravelHistory,
  getTravelHistoryDetail,
  completeTravelHistory,
  updateTravelHistoryRating,
};
