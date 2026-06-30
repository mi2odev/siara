// =============================================================================
// interventionsService — pilot intervention tracking.
//
// Supervisors (and admins) log counter-measures applied to dangerous
// segments/zones and track their status / outcome after the action. Data lives
// in app.zone_interventions (see migrations/20260628_zone_interventions.sql).
//
// Endpoints are mounted under /api/police/supervisor/interventions in
// contollers/police.js and are gated by requirePoliceSupervisor.
// =============================================================================

const createError = require("http-errors");

const pool = require("../db");
const {
  hasAnyRole,
  hasRole,
  POLICE_SUPERVISOR_ROLE_NAMES,
} = require("../contollers/verifytoken");

const INTERVENTION_TYPES = Object.freeze([
  "speed_control",
  "signage",
  "roadwork",
  "lighting",
  "police_patrol",
  "ambulance_response",
  "other",
]);

const INTERVENTION_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

const VISIBILITIES = Object.freeze(["public", "internal"]);

// Infrastructure measures are public-safe (useful to drivers); enforcement / EMS
// deployments default to internal. Supervisors can override per record.
const PUBLIC_DEFAULT_TYPES = Object.freeze(["speed_control", "signage", "roadwork", "lighting"]);

function normalizeVisibility(value, type) {
  const v = String(value || "").trim().toLowerCase();
  if (VISIBILITIES.includes(v)) return v;
  return PUBLIC_DEFAULT_TYPES.includes(type) ? "public" : "internal";
}

function assertSupervisorUser(user) {
  const ok = hasAnyRole(user, POLICE_SUPERVISOR_ROLE_NAMES) || hasRole(user, "admin");
  if (!ok) {
    throw createError(403, "Supervisor access is required");
  }
}

function userId(user) {
  return user?.userId || user?.id || null;
}

function safeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function clampSeverity(value) {
  const n = safeInt(value);
  if (n == null) return null;
  return Math.min(3, Math.max(1, n));
}

function normalizeType(value) {
  const t = String(value || "").trim().toLowerCase();
  return INTERVENTION_TYPES.includes(t) ? t : null;
}

function normalizeStatus(value, fallback = null) {
  const s = String(value || "").trim().toLowerCase();
  if (INTERVENTION_STATUSES.includes(s)) return s;
  return fallback;
}

function rowToIntervention(row) {
  return {
    id: Number(row.id),
    type: row.intervention_type,
    title: row.title || "",
    description: row.description || null,
    roadSegmentId: row.road_segment_id == null ? null : Number(row.road_segment_id),
    roadName: row.road_name || row.road_ref || null,
    locationLabel: row.location_label || null,
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    visibility: row.visibility || "internal",
    status: row.status,
    outcomeNote: row.outcome_note || null,
    severityBefore: row.severity_before == null ? null : Number(row.severity_before),
    severityAfter: row.severity_after == null ? null : Number(row.severity_after),
    createdByName: row.created_by_name || null,
    assignedToName: row.assigned_to_name || null,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for).toISOString() : null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

const SELECT_COLUMNS = `
  zi.id,
  zi.intervention_type,
  zi.title,
  zi.description,
  zi.road_segment_id,
  zi.location_label,
  zi.visibility,
  zi.status,
  zi.outcome_note,
  zi.severity_before,
  zi.severity_after,
  zi.scheduled_for,
  zi.started_at,
  zi.completed_at,
  zi.created_at,
  zi.updated_at,
  rs.name AS road_name,
  rs.ref AS road_ref,
  -- Plot point: the explicit pin, else the linked road segment's centroid.
  COALESCE(ST_Y(zi.location::geometry), ST_Y(ST_Centroid(rs.geom))) AS lat,
  COALESCE(ST_X(zi.location::geometry), ST_X(ST_Centroid(rs.geom))) AS lng,
  CONCAT_WS(' ', creator.first_name, creator.last_name) AS created_by_name,
  CONCAT_WS(' ', assignee.first_name, assignee.last_name) AS assigned_to_name
`;

const FROM_JOINS = `
  FROM app.zone_interventions zi
  LEFT JOIN gis.road_segments rs ON rs.id = zi.road_segment_id
  LEFT JOIN auth.users creator ON creator.id = zi.created_by
  LEFT JOIN auth.users assignee ON assignee.id = zi.assigned_to
`;

async function findNearestRoadSegmentId(db, lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const result = await db.query(
    `
      SELECT rs.id
      FROM gis.road_segments rs
      WHERE ST_DWithin(
        rs.geom::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        200
      )
      ORDER BY rs.geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
      LIMIT 1
    `,
    [latitude, longitude],
  );
  return result.rows[0]?.id || null;
}

async function listInterventions(user, query = {}, db = pool) {
  assertSupervisorUser(user);

  const conditions = [];
  const params = [];

  const type = normalizeType(query.type);
  if (type) {
    params.push(type);
    conditions.push(`zi.intervention_type = $${params.length}`);
  }

  const status = normalizeStatus(query.status);
  if (status) {
    params.push(status);
    conditions.push(`zi.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(safeInt(query.limit) || 100, 1), 200);

  const [listResult, statsResult] = await Promise.all([
    db.query(
      `
        SELECT ${SELECT_COLUMNS}
        ${FROM_JOINS}
        ${where}
        ORDER BY zi.created_at DESC
        LIMIT ${limit}
      `,
      params,
    ),
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'planned')::int AS planned,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM app.zone_interventions
      `,
    ),
  ]);

  const s = statsResult.rows[0] || {};
  return {
    items: listResult.rows.map(rowToIntervention),
    stats: {
      total: Number(s.total || 0),
      planned: Number(s.planned || 0),
      inProgress: Number(s.in_progress || 0),
      completed: Number(s.completed || 0),
      cancelled: Number(s.cancelled || 0),
    },
  };
}

async function createIntervention(user, body = {}, db = pool) {
  assertSupervisorUser(user);

  const type = normalizeType(body.type);
  if (!type) {
    throw createError(400, "A valid intervention type is required");
  }
  const title = String(body.title || "").trim();
  if (title.length < 3) {
    throw createError(400, "Title is required (min 3 characters)");
  }

  const description = body.description ? String(body.description).trim() : null;
  const locationLabel = body.locationLabel ? String(body.locationLabel).trim() : null;
  const status = normalizeStatus(body.status, "planned");
  const visibility = normalizeVisibility(body.visibility, type);
  const severityBefore = clampSeverity(body.severityBefore);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  let roadSegmentId = safeInt(body.roadSegmentId);
  if (!roadSegmentId && hasPoint) {
    roadSegmentId = await findNearestRoadSegmentId(db, lat, lng);
  }

  const result = await db.query(
    `
      INSERT INTO app.zone_interventions (
        intervention_type, title, description, road_segment_id,
        location, location_label, visibility, status, severity_before,
        scheduled_for, created_by, assigned_to,
        started_at
      )
      VALUES (
        $1, $2, $3, $4,
        CASE WHEN $5::float8 IS NOT NULL AND $6::float8 IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography
          ELSE NULL END,
        $7, $13, $8, $9,
        $10, $11, $12,
        CASE WHEN $8 = 'in_progress' THEN NOW() ELSE NULL END
      )
      RETURNING id
    `,
    [
      type,
      title,
      description,
      roadSegmentId,
      hasPoint ? lat : null,
      hasPoint ? lng : null,
      locationLabel,
      status,
      severityBefore,
      body.scheduledFor || null,
      userId(user),
      body.assignedTo || null,
      visibility,
    ],
  );

  const id = result.rows[0]?.id;
  return getInterventionById(user, id, db);
}

async function getInterventionById(user, id, db = pool) {
  assertSupervisorUser(user);
  const numericId = safeInt(id);
  if (!numericId) throw createError(400, "Invalid intervention id");

  const result = await db.query(
    `
      SELECT ${SELECT_COLUMNS}
      ${FROM_JOINS}
      WHERE zi.id = $1
      LIMIT 1
    `,
    [numericId],
  );
  if (result.rowCount === 0) {
    throw createError(404, "Intervention not found");
  }
  return rowToIntervention(result.rows[0]);
}

async function updateInterventionStatus(user, id, body = {}, db = pool) {
  assertSupervisorUser(user);
  const numericId = safeInt(id);
  if (!numericId) throw createError(400, "Invalid intervention id");

  const status = normalizeStatus(body.status);
  if (!status) {
    throw createError(400, "A valid status is required");
  }
  const outcomeNote = body.outcomeNote ? String(body.outcomeNote).trim() : null;
  const severityAfter = clampSeverity(body.severityAfter);

  const result = await db.query(
    `
      UPDATE app.zone_interventions
      SET
        status = $2,
        outcome_note = COALESCE($3, outcome_note),
        severity_after = COALESCE($4, severity_after),
        started_at = CASE
          WHEN $2 = 'in_progress' AND started_at IS NULL THEN NOW()
          ELSE started_at END,
        completed_at = CASE
          WHEN $2 = 'completed' THEN NOW()
          WHEN $2 IN ('planned', 'in_progress') THEN NULL
          ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [numericId, status, outcomeNote, severityAfter],
  );

  if (result.rowCount === 0) {
    throw createError(404, "Intervention not found");
  }
  return getInterventionById(user, numericId, db);
}

module.exports = {
  INTERVENTION_TYPES,
  INTERVENTION_STATUSES,
  listInterventions,
  createIntervention,
  getInterventionById,
  updateInterventionStatus,
};
