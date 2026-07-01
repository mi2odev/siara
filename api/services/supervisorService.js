const createError = require("http-errors");

const pool = require("../db");
const { hasAnyRole, POLICE_SUPERVISOR_ROLE_NAMES, hasRole } = require("../contollers/verifytoken");
const { getCurrentWeatherUi } = require("./risk/weatherProvider");

// Time-of-day bands used by the pilot dashboard (index = floor(hour / 6)).
const TIME_OF_DAY_BANDS = ["night", "morning", "afternoon", "evening"];

function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function assertSupervisorUser(user) {
  const isSupervisor =
    hasAnyRole(user, POLICE_SUPERVISOR_ROLE_NAMES) || hasRole(user, "admin");

  if (!isSupervisor) {
    throw createError(403, "Supervisor access is required");
  }
}

function getSupervisorZoneFilter(query, isAdmin) {
  return {
    wilayaId: !isAdmin && query.wilayaId ? Number(query.wilayaId) : null,
    communeId: !isAdmin && query.communeId ? Number(query.communeId) : null,
  };
}

async function getSupervisorDashboard(supervisorUser, query = {}, db = pool) {
  assertSupervisorUser(supervisorUser);

  const isAdmin = hasRole(supervisorUser, "admin");

  const [
    statsResult,
    officerResult,
    highSeverityResult,
    activityResult,
    mapResult,
  ] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE ar.status NOT IN ('resolved', 'rejected', 'archived')
          )::int AS active_count,
          COUNT(*) FILTER (
            WHERE ar.status NOT IN ('resolved', 'rejected', 'archived')
              AND COALESCE(ar.severity_hint, 0) >= 3
          )::int AS high_severity_count,
          COUNT(*) FILTER (
            WHERE ar.status = 'pending'
          )::int AS pending_verification_count,
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (
                COALESCE(ar.verified_at, ar.updated_at) - ar.created_at
              )) * 1000
            ) FILTER (WHERE ar.status IN ('verified', 'resolved'))
          )::bigint AS avg_response_time_ms
        FROM app.accident_reports ar
        WHERE ar.created_at >= NOW() - INTERVAL '30 days'
      `,
    ),
    db.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE pp.is_on_duty = TRUE)::int AS on_duty,
          COUNT(*) FILTER (WHERE pp.is_on_duty = FALSE)::int AS off_duty,
          COUNT(*)::int AS total
        FROM app.police_profiles pp
        JOIN auth.users u ON u.id = pp.user_id
        WHERE u.is_active = TRUE
      `,
    ),
    db.query(
      `
        SELECT
          ar.id,
          ar.title,
          ar.status,
          ar.severity_hint,
          ar.location_label,
          ar.occurred_at,
          ar.created_at,
          ST_Y(ar.incident_location::geometry) AS lat,
          ST_X(ar.incident_location::geometry) AS lng,
          CONCAT_WS(' ', assigned.first_name, assigned.last_name) AS assigned_officer_name
        FROM app.accident_reports ar
        LEFT JOIN auth.users assigned ON assigned.id = ar.assigned_officer_id
        WHERE ar.status NOT IN ('resolved', 'rejected', 'archived')
          AND COALESCE(ar.severity_hint, 0) >= 3
        ORDER BY COALESCE(ar.severity_hint, 0) DESC, ar.created_at DESC
        LIMIT 8
      `,
    ),
    db.query(
      `
        SELECT
          h.action_type,
          h.note,
          h.created_at,
          CONCAT_WS(' ', u.first_name, u.last_name) AS officer_name,
          ar.title AS report_title
        FROM app.police_operation_history h
        LEFT JOIN auth.users u ON u.id = h.officer_user_id
        LEFT JOIN app.accident_reports ar ON ar.id = h.report_id
        WHERE h.action_type != 'location_update'
        ORDER BY h.created_at DESC
        LIMIT 15
      `,
    ),
    db.query(
      `
        SELECT
          ar.id,
          ar.title,
          ar.status,
          ar.severity_hint,
          ST_Y(ar.incident_location::geometry) AS lat,
          ST_X(ar.incident_location::geometry) AS lng,
          ar.location_label,
          CONCAT_WS(' ', assigned.first_name, assigned.last_name) AS assigned_officer_name
        FROM app.accident_reports ar
        LEFT JOIN auth.users assigned ON assigned.id = ar.assigned_officer_id
        WHERE ar.status NOT IN ('resolved', 'rejected', 'archived')
          AND ar.incident_location IS NOT NULL
        ORDER BY COALESCE(ar.severity_hint, 0) DESC, ar.created_at DESC
        LIMIT 100
      `,
    ),
  ]);

  const stats = statsResult.rows[0] || {};
  const officerStats = officerResult.rows[0] || {};

  return {
    stats: {
      activeIncidents: Number(stats.active_count || 0),
      highSeverityIncidents: Number(stats.high_severity_count || 0),
      pendingVerification: Number(stats.pending_verification_count || 0),
      activeOfficers: Number(officerStats.on_duty || 0),
      totalOfficers: Number(officerStats.total || 0),
      avgResponseTimeMs: stats.avg_response_time_ms ? Number(stats.avg_response_time_ms) : null,
    },
    officerStatus: {
      onDuty: Number(officerStats.on_duty || 0),
      offDuty: Number(officerStats.off_duty || 0),
      total: Number(officerStats.total || 0),
    },
    highSeverityIncidents: highSeverityResult.rows.map((row) => ({
      id: row.id,
      title: row.title || "",
      status: row.status,
      severity: row.severity_hint >= 3 ? "high" : "medium",
      severityHint: Number(row.severity_hint || 0),
      locationLabel: row.location_label || "",
      assignedOfficerName: row.assigned_officer_name || null,
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      location: {
        lat: row.lat == null ? null : Number(row.lat),
        lng: row.lng == null ? null : Number(row.lng),
      },
    })),
    recentActivity: activityResult.rows.map((row) => ({
      actionType: row.action_type,
      note: row.note || null,
      officerName: row.officer_name || "Unknown Officer",
      reportTitle: row.report_title || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    mapMarkers: mapResult.rows.map((row) => ({
      id: row.id,
      title: row.title || "",
      status: row.status,
      severityHint: Number(row.severity_hint || 0),
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      locationLabel: row.location_label || "",
      assignedOfficerName: row.assigned_officer_name || null,
    })),
  };
}

async function getSupervisorAnalytics(supervisorUser, query = {}, db = pool) {
  assertSupervisorUser(supervisorUser);

  const days = Math.min(Math.max(Number(query.days || 30), 7), 90);

  const [
    byStatusResult,
    bySeverityResult,
    avgResponseResult,
    busiestZonesResult,
    officerWorkloadResult,
    trendResult,
  ] = await Promise.all([
    db.query(
      `
        SELECT status, COUNT(*)::int AS count
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY status
        ORDER BY count DESC
      `,
      [days],
    ),
    db.query(
      `
        SELECT
          CASE
            WHEN COALESCE(severity_hint, 0) >= 3 THEN 'high'
            WHEN COALESCE(severity_hint, 0) = 2 THEN 'medium'
            ELSE 'low'
          END AS severity,
          COUNT(*)::int AS count
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY severity
        ORDER BY MIN(COALESCE(severity_hint, 0)) DESC
      `,
      [days],
    ),
    db.query(
      `
        SELECT
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (
                COALESCE(verified_at, updated_at) - created_at
              )) * 1000
            ) FILTER (WHERE status IN ('verified', 'resolved'))
          )::bigint AS avg_ms,
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (
                resolved_at - created_at
              )) * 1000
            ) FILTER (WHERE status = 'resolved' AND resolved_at IS NOT NULL)
          )::bigint AS avg_resolution_ms,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
          COUNT(*)::int AS total_count
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1 || ' days')::interval
      `,
      [days],
    ),
    db.query(
      `
        SELECT
          COALESCE(ar.location_label, 'Unknown') AS zone_name,
          COUNT(ar.id)::int AS incident_count
        FROM app.accident_reports ar
        WHERE ar.created_at >= NOW() - ($1 || ' days')::interval
          AND ar.location_label IS NOT NULL
          AND ar.location_label != ''
        GROUP BY ar.location_label
        ORDER BY incident_count DESC
        LIMIT 10
      `,
      [days],
    ),
    db.query(
      `
        SELECT
          CONCAT_WS(' ', u.first_name, u.last_name) AS officer_name,
          COUNT(ar.id) FILTER (WHERE ar.status NOT IN ('resolved', 'rejected', 'archived'))::int AS active_incidents,
          COUNT(ar.id)::int AS total_incidents
        FROM auth.users u
        JOIN auth.user_roles ur ON ur.user_id = u.id
        JOIN auth.roles r ON r.id = ur.role_id AND LOWER(r.name) = 'police'
        LEFT JOIN app.accident_reports ar
          ON ar.assigned_officer_id = u.id
          AND ar.created_at >= NOW() - ($1 || ' days')::interval
        WHERE u.is_active = TRUE
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY active_incidents DESC, total_incidents DESC
        LIMIT 10
      `,
      [days],
    ),
    db.query(
      `
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'Africa/Algiers') AS day,
          COUNT(*)::int AS count
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY day
        ORDER BY day ASC
      `,
      [days],
    ),
  ]);

  // Impact metrics run separately and never break the rest of the analytics
  // payload: if the query fails (e.g. on an older schema) the page still renders
  // with zeroed impact cards instead of a 500.
  const impactResult = await fetchImpactMetrics(days, db).catch((error) => {
    console.warn("[supervisor/analytics] impact metrics failed:", error?.message || error);
    return { rows: [{}] };
  });

  const responseStats = avgResponseResult.rows[0] || {};
  const totalCount = Number(responseStats.total_count || 0);
  const resolvedCount = Number(responseStats.resolved_count || 0);

  return {
    period: { days },
    incidentsByStatus: byStatusResult.rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {}),
    incidentsBySeverity: bySeverityResult.rows.reduce((acc, row) => {
      acc[row.severity] = row.count;
      return acc;
    }, {}),
    responseMetrics: {
      avgResponseTimeMs: responseStats.avg_ms ? Number(responseStats.avg_ms) : null,
      avgResolutionTimeMs: responseStats.avg_resolution_ms
        ? Number(responseStats.avg_resolution_ms)
        : null,
      resolutionRate: totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0,
      totalIncidents: totalCount,
      resolvedIncidents: resolvedCount,
    },
    busiestZones: busiestZonesResult.rows.map((row) => ({
      name: row.zone_name,
      level: row.level,
      count: row.incident_count,
    })),
    officerWorkload: officerWorkloadResult.rows.map((row) => ({
      name: row.officer_name || "Unknown",
      activeIncidents: row.active_incidents,
      totalIncidents: row.total_incidents,
    })),
    trendByDay: trendResult.rows.map((row) => ({
      date: row.day ? new Date(row.day).toISOString().slice(0, 10) : null,
      count: row.count,
    })),
    impact: buildImpactMetrics(impactResult.rows[0] || {}),
  };
}

// Impact metrics. False/verified alert rates and repeat reports are derived from
// report statuses (rejected = false alert, verified/dispatched/resolved =
// actioned alert, merged = duplicate/repeat). High-risk-zone reduction compares
// the count of distinct high-severity zones in this window vs the immediately
// preceding window of the same length. Uses `$1::int * interval '1 day'`
// throughout (no text concatenation) so the single parameter has one clear type.
async function fetchImpactMetrics(days, db = pool) {
  return db.query(
    `
      WITH cur AS (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN ('verified', 'dispatched', 'resolved'))::int AS verified,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE status = 'merged')::int AS merged,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1::int * interval '1 day')
      ),
      cur_zones AS (
        SELECT COUNT(DISTINCT location_label)::int AS zones
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1::int * interval '1 day')
          AND COALESCE(severity_hint, 0) >= 3
          AND location_label IS NOT NULL AND location_label <> ''
      ),
      prev_zones AS (
        SELECT COUNT(DISTINCT location_label)::int AS zones
        FROM app.accident_reports
        WHERE created_at >= NOW() - ($1::int * 2 * interval '1 day')
          AND created_at <  NOW() - ($1::int * interval '1 day')
          AND COALESCE(severity_hint, 0) >= 3
          AND location_label IS NOT NULL AND location_label <> ''
      )
      SELECT cur.total, cur.verified, cur.rejected, cur.merged, cur.resolved,
             cur_zones.zones AS current_high_risk_zones,
             prev_zones.zones AS previous_high_risk_zones
      FROM cur, cur_zones, prev_zones
    `,
    [days],
  );
}

// Derive the impact KPIs (false-alert rate, verified-alert rate, repeated
// reports, resolved incidents, high-risk-zone reduction) from raw status counts.
function buildImpactMetrics(row) {
  const total = Number(row.total || 0);
  const verified = Number(row.verified || 0);
  const rejected = Number(row.rejected || 0);
  const merged = Number(row.merged || 0);
  const resolved = Number(row.resolved || 0);
  const currentZones = Number(row.current_high_risk_zones || 0);
  const previousZones = Number(row.previous_high_risk_zones || 0);

  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  // Positive = fewer high-risk zones than the previous window (improvement).
  const zoneReductionPct = previousZones > 0
    ? Math.round(((previousZones - currentZones) / previousZones) * 1000) / 10
    : null;

  return {
    totalReports: total,
    falseAlerts: rejected,
    falseAlertRate: pct(rejected, total),
    verifiedAlerts: verified,
    verifiedAlertRate: pct(verified, total),
    repeatedReports: merged,
    repeatedReportRate: pct(merged, total),
    resolvedIncidents: resolved,
    highRiskZones: {
      current: currentZones,
      previous: previousZones,
      reductionPct: zoneReductionPct,
    },
  };
}

// On-duty officers in the caller's own work zone, excluding the caller.
// Shared by the supervisor "Global Map" officer layer and the police officers
// map. The caller's zone is their active commune assignment (most specific),
// falling back to active wilaya, then the default profile zone.
async function fetchOnDutyZoneOfficers(user, db = pool) {
  const userId = user?.userId || user?.id;
  if (!userId) {
    const error = new Error("Authenticated user required");
    error.status = 401;
    throw error;
  }

  const zoneResult = await db.query(
    `
      SELECT
        COALESCE(act.commune_id, pp.default_commune_id) AS commune_id,
        COALESCE(act.wilaya_id, pp.default_wilaya_id) AS wilaya_id
      FROM app.police_profiles pp
      LEFT JOIN LATERAL (
        SELECT
          MAX(CASE WHEN zone_level = 'commune' AND is_active THEN admin_area_id END) AS commune_id,
          MAX(CASE WHEN zone_level = 'wilaya'  AND is_active THEN admin_area_id END) AS wilaya_id
        FROM app.police_work_zone_assignments
        WHERE officer_user_id = pp.user_id
      ) act ON TRUE
      WHERE pp.user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  const zone = zoneResult.rows[0] || {};
  const communeId = zone.commune_id != null ? Number(zone.commune_id) : null;
  const wilayaId = zone.wilaya_id != null ? Number(zone.wilaya_id) : null;

  // No zone configured → nothing scoped to show.
  if (communeId == null && wilayaId == null) return [];

  const officersResult = await db.query(
    `
      SELECT
        u.id,
        CONCAT_WS(' ', u.first_name, u.last_name) AS full_name,
        pp.badge_number,
        pp.rank,
        pp.is_on_duty,
        ST_Y(latest_loc.location::geometry) AS lat,
        ST_X(latest_loc.location::geometry) AS lng,
        latest_loc.captured_at,
        active_commune.name AS commune_name,
        active_wilaya.name AS wilaya_name
      FROM app.police_profiles pp
      JOIN auth.users u ON u.id = pp.user_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM app.officer_location_updates loc
        WHERE loc.officer_user_id = u.id
        ORDER BY loc.captured_at DESC, loc.id DESC
        LIMIT 1
      ) latest_loc ON TRUE
      LEFT JOIN app.police_work_zone_assignments wza_commune
        ON wza_commune.officer_user_id = u.id
       AND wza_commune.zone_level = 'commune'
       AND wza_commune.is_active = TRUE
      LEFT JOIN gis.admin_areas active_commune ON active_commune.id = wza_commune.admin_area_id
      LEFT JOIN app.police_work_zone_assignments wza_wilaya
        ON wza_wilaya.officer_user_id = u.id
       AND wza_wilaya.zone_level = 'wilaya'
       AND wza_wilaya.is_active = TRUE
      LEFT JOIN gis.admin_areas active_wilaya ON active_wilaya.id = wza_wilaya.admin_area_id
      WHERE u.is_active = TRUE
        AND pp.is_on_duty = TRUE
        AND u.id <> $1
        AND (
          ($2::int IS NOT NULL AND wza_commune.admin_area_id = $2)
          OR ($2::int IS NULL AND $3::int IS NOT NULL AND wza_wilaya.admin_area_id = $3)
        )
      ORDER BY u.first_name ASC
    `,
    [userId, communeId, wilayaId],
  );

  return officersResult.rows.map((row) => ({
    id: row.id,
    name: row.full_name || "Officer",
    badgeNumber: row.badge_number || null,
    rank: row.rank || null,
    isOnDuty: Boolean(row.is_on_duty),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    locationCapturedAt: row.captured_at ? new Date(row.captured_at).toISOString() : null,
    communeName: row.commune_name || null,
    wilayaName: row.wilaya_name || null,
  }));
}

async function getSupervisorGlobalMap(supervisorUser, db = pool) {
  assertSupervisorUser(supervisorUser);

  const [incidentsResult, officers] = await Promise.all([
    db.query(
      `
        SELECT
          ar.id,
          ar.title,
          ar.status,
          ar.severity_hint,
          ar.location_label,
          ar.occurred_at,
          ar.created_at,
          ST_Y(ar.incident_location::geometry) AS lat,
          ST_X(ar.incident_location::geometry) AS lng,
          CONCAT_WS(' ', assigned.first_name, assigned.last_name) AS assigned_officer_name,
          assigned.id AS assigned_officer_id
        FROM app.accident_reports ar
        LEFT JOIN auth.users assigned ON assigned.id = ar.assigned_officer_id
        WHERE ar.status NOT IN ('resolved', 'rejected', 'archived')
          AND ar.incident_location IS NOT NULL
        ORDER BY COALESCE(ar.severity_hint, 0) DESC, ar.created_at DESC
        LIMIT 200
      `,
    ),
    // Officer layer is scoped to the supervisor's own zone, on-duty only,
    // excluding the supervisor themselves.
    fetchOnDutyZoneOfficers(supervisorUser, db),
  ]);

  return {
    incidents: incidentsResult.rows.map((row) => ({
      id: row.id,
      title: row.title || "",
      status: row.status,
      severityHint: Number(row.severity_hint || 0),
      severity:
        row.severity_hint >= 3
          ? "high"
          : row.severity_hint >= 2
            ? "medium"
            : "low",
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      locationLabel: row.location_label || "",
      assignedOfficerName: row.assigned_officer_name || null,
      assignedOfficerId: row.assigned_officer_id || null,
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    officers,
  };
}

// =============================================================================
// Pilot dashboard — ranks the most dangerous road segments by *verified* report
// volume and enriches each with severity, occurrence risk (latest persisted
// ml.risk_predictions row), peak time-of-day band, and average police response
// time. Current weather is fetched once for the centroid of the ranked segments
// (Open-Meteo, best-effort) and returned as shared context.
// =============================================================================
async function getSupervisorPilotDashboard(supervisorUser, query = {}, db = pool) {
  assertSupervisorUser(supervisorUser);

  const days = Math.min(Math.max(Number(query.days || 30), 7), 180);
  const limit = Math.min(Math.max(Number(query.limit || 10), 1), 25);

  // Spatial joins use a bounded scan + statement_timeout so a missing GiST index
  // can't freeze the request (mirrors adminAnalyticsService.fetchDangerousRoads).
  const client = await db.connect();
  let segmentRows = [];
  let throughputRow = {};
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await client.query(
      `
        WITH windowed AS (
          SELECT id, incident_location, severity_hint, status, created_at, verified_at,
                 verified_by_officer_id, latest_predicted_label, latest_spam_score
          FROM app.accident_reports
          WHERE created_at >= NOW() - ($1::int * interval '1 day')
            AND incident_location IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 3000
        ),
        classified AS (
          -- One mutually-exclusive credibility class per report so a segment ranks
          -- on ALL its signal, not just the rare officer-verified rows. Precedence:
          -- officer confirmation > AI spam-flag > explicit rejection > AI "real" > pending.
          SELECT w.*,
            CASE
              WHEN (w.status IN ('verified', 'dispatched', 'resolved')
                    OR w.verified_by_officer_id IS NOT NULL) THEN 'officer'
              WHEN (w.latest_predicted_label IN ('spam', 'suspicious', 'out_of_context', 'invalid_location')
                    OR COALESCE(w.latest_spam_score, 0) >= 0.65) THEN 'flagged'
              WHEN w.status = 'rejected' THEN 'rejected'
              WHEN (w.latest_predicted_label = 'real'
                    AND COALESCE(w.latest_spam_score, 1) < 0.35) THEN 'ai'
              ELSE 'pending'
            END AS signal_class
          FROM windowed w
        ),
        nearest AS (
          SELECT c.*,
                 (
                   SELECT rs.id
                   FROM gis.road_segments rs
                   WHERE ST_DWithin(rs.geom, c.incident_location::geometry, 0.0008)
                   ORDER BY rs.geom <-> c.incident_location::geometry
                   LIMIT 1
                 ) AS road_segment_id
          FROM classified c
        ),
        agg AS (
          SELECT
            n.road_segment_id,
            COUNT(*)::int AS total_reports,
            COUNT(*) FILTER (WHERE n.signal_class = 'officer')::int AS verified_reports,
            COUNT(*) FILTER (WHERE n.signal_class = 'ai')::int AS ai_verified_reports,
            COUNT(*) FILTER (WHERE n.signal_class = 'pending')::int AS pending_reports,
            COUNT(*) FILTER (WHERE n.signal_class = 'flagged')::int AS flagged_reports,
            COUNT(*) FILTER (WHERE COALESCE(n.severity_hint, 0) >= 3)::int AS high_severity_reports,
            (mode() WITHIN GROUP (ORDER BY COALESCE(n.severity_hint, 1)))::int AS top_severity_hint,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (n.verified_at - n.created_at)) * 1000)
                FILTER (WHERE n.verified_at IS NOT NULL)
            )::bigint AS avg_response_ms,
            (mode() WITHIN GROUP (
              ORDER BY FLOOR(EXTRACT(HOUR FROM n.created_at AT TIME ZONE 'Africa/Algiers') / 6)::int
            ))::int AS peak_band,
            -- Weighted evidence score: confirmed reports count most, AI-verified
            -- next, raw pending least, with a bump for high-severity signal.
            ROUND((
              COUNT(*) FILTER (WHERE n.signal_class = 'officer') * 1.0
              + COUNT(*) FILTER (WHERE n.signal_class = 'ai') * 0.6
              + COUNT(*) FILTER (WHERE n.signal_class = 'pending') * 0.3
              + COUNT(*) FILTER (WHERE COALESCE(n.severity_hint, 0) >= 3) * 0.5
            )::numeric, 2) AS signal_score
          FROM nearest n
          WHERE n.road_segment_id IS NOT NULL
          GROUP BY n.road_segment_id
          -- Drop pure-noise segments (only spam/rejected) from the danger ranking.
          HAVING COUNT(*) FILTER (WHERE n.signal_class IN ('officer', 'ai', 'pending')) > 0
          ORDER BY signal_score DESC, total_reports DESC
          LIMIT ${limit}
        )
        SELECT
          a.road_segment_id,
          a.total_reports,
          a.verified_reports,
          a.ai_verified_reports,
          a.pending_reports,
          a.flagged_reports,
          a.high_severity_reports,
          a.top_severity_hint,
          a.avg_response_ms,
          a.peak_band,
          a.signal_score,
          rs.name AS road_name,
          rs.ref AS road_ref,
          rs.road_class,
          ST_Y(ST_Centroid(rs.geom)) AS lat,
          ST_X(ST_Centroid(rs.geom)) AS lng,
          lp.calibrated_probability AS occurrence_probability,
          lp.risk_level AS occurrence_level,
          lp.predicted_at AS occurrence_predicted_at
        FROM agg a
        JOIN gis.road_segments rs ON rs.id = a.road_segment_id
        LEFT JOIN LATERAL (
          SELECT calibrated_probability, risk_level, predicted_at
          FROM ml.risk_predictions rp
          WHERE rp.road_segment_id = a.road_segment_id
          ORDER BY rp.predicted_at DESC
          LIMIT 1
        ) lp ON TRUE
        ORDER BY a.signal_score DESC, a.total_reports DESC
      `,
      [days],
    );

    // Verification throughput over the whole window (all reports, not just the
    // ones that mapped to a segment) so supervisors get an actionable "are we
    // keeping up?" read even when the segment table is thin. Same credibility
    // taxonomy as the segment ranking above.
    const throughputResult = await client.query(
      `
        WITH classified AS (
          SELECT verified_at, created_at,
            CASE
              WHEN (status IN ('verified', 'dispatched', 'resolved')
                    OR verified_by_officer_id IS NOT NULL) THEN 'officer'
              WHEN (latest_predicted_label IN ('spam', 'suspicious', 'out_of_context', 'invalid_location')
                    OR COALESCE(latest_spam_score, 0) >= 0.65) THEN 'flagged'
              WHEN status = 'rejected' THEN 'rejected'
              WHEN (latest_predicted_label = 'real'
                    AND COALESCE(latest_spam_score, 1) < 0.35) THEN 'ai'
              ELSE 'pending'
            END AS signal_class
          FROM app.accident_reports
          WHERE created_at >= NOW() - ($1::int * interval '1 day')
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE signal_class = 'officer')::int AS officer_verified,
          COUNT(*) FILTER (WHERE signal_class = 'ai')::int AS ai_verified,
          COUNT(*) FILTER (WHERE signal_class = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE signal_class = 'flagged')::int AS flagged,
          COUNT(*) FILTER (WHERE signal_class = 'rejected')::int AS rejected,
          ROUND(
            AVG(EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000)
              FILTER (WHERE verified_at IS NOT NULL)
          )::bigint AS avg_verify_ms,
          (PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000
          ) FILTER (WHERE verified_at IS NOT NULL))::bigint AS median_verify_ms
        FROM classified
      `,
      [days],
    );

    await client.query("COMMIT");
    segmentRows = result.rows;
    throughputRow = throughputResult.rows[0] || {};
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const segments = segmentRows.map((row) => {
    const hint = Number(row.top_severity_hint || 1);
    const occProb = row.occurrence_probability == null ? null : Number(row.occurrence_probability);
    const label = (row.road_name && row.road_name.trim())
      || (row.road_ref && row.road_ref.trim())
      || `${row.road_class || "Road"} segment #${row.road_segment_id}`;
    const officer = Number(row.verified_reports || 0);
    const ai = Number(row.ai_verified_reports || 0);
    const pending = Number(row.pending_reports || 0);
    // Confidence reflects the strongest evidence backing the segment.
    const confidence = officer > 0 ? "confirmed" : ai > 0 ? "likely" : "unconfirmed";
    return {
      roadSegmentId: Number(row.road_segment_id),
      road: label,
      ref: row.road_ref || null,
      roadClass: row.road_class || null,
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      totalReports: Number(row.total_reports || 0),
      verifiedReports: officer,
      aiVerifiedReports: ai,
      pendingReports: pending,
      flaggedReports: Number(row.flagged_reports || 0),
      signalScore: row.signal_score == null ? 0 : Number(row.signal_score),
      confidence,
      highSeverityReports: Number(row.high_severity_reports || 0),
      severity: hint >= 3 ? "high" : hint >= 2 ? "medium" : "low",
      severityHint: hint,
      avgResponseTimeMs: row.avg_response_ms == null ? null : Number(row.avg_response_ms),
      timeOfDay: TIME_OF_DAY_BANDS[Number(row.peak_band)] || null,
      occurrence: occProb == null
        ? null
        : {
            // Beta model: relative occurrence risk, NOT a calibrated probability.
            percent: Math.round(Math.max(0, Math.min(1, occProb)) * 1000) / 10,
            level: row.occurrence_level || null,
            predictedAt: row.occurrence_predicted_at
              ? new Date(row.occurrence_predicted_at).toISOString()
              : null,
          },
    };
  });

  // Single best-effort weather call for the centroid of the ranked segments.
  let weatherContext = null;
  const pts = segments.filter((s) => s.lat != null && s.lng != null);
  if (pts.length > 0) {
    const lat = pts.reduce((sum, s) => sum + s.lat, 0) / pts.length;
    const lng = pts.reduce((sum, s) => sum + s.lng, 0) / pts.length;
    try {
      const deadline = Date.now() + 4000;
      const weather = await getCurrentWeatherUi(lat, lng, null, deadline);
      if (weather) {
        weatherContext = {
          condition: weather.condition || null,
          temperatureC: weather.temperature_c ?? null,
          windKmh: weather.wind_kmh ?? null,
          visibilityKm: weather.visibility_km ?? null,
          precipitationMm: weather.precipitation_mm ?? null,
          humidityPct: weather.humidity_pct ?? null,
          atLat: Math.round(lat * 1000) / 1000,
          atLng: Math.round(lng * 1000) / 1000,
        };
      }
    } catch (error) {
      console.warn("[supervisor/pilot] weather lookup failed:", error?.message || error);
    }
  }

  // Verification throughput KPIs for the window. "Verified rate" is measured
  // against credible reports (excluding spam-flagged and rejected noise) so the
  // percentage reflects how much real work is being confirmed.
  const tp = throughputRow || {};
  const tpTotal = Number(tp.total || 0);
  const tpOfficer = Number(tp.officer_verified || 0);
  const tpAi = Number(tp.ai_verified || 0);
  const tpPending = Number(tp.pending || 0);
  const tpFlagged = Number(tp.flagged || 0);
  const tpRejected = Number(tp.rejected || 0);
  const credible = Math.max(0, tpTotal - tpFlagged - tpRejected);
  const throughput = {
    totalReports: tpTotal,
    officerVerified: tpOfficer,
    aiVerified: tpAi,
    pending: tpPending,
    flagged: tpFlagged,
    rejected: tpRejected,
    pendingBacklog: tpPending,
    verifiedRatePct: credible > 0 ? Math.round((tpOfficer / credible) * 1000) / 10 : null,
    avgTimeToVerifyMs: tp.avg_verify_ms == null ? null : Number(tp.avg_verify_ms),
    medianTimeToVerifyMs: tp.median_verify_ms == null ? null : Number(tp.median_verify_ms),
  };

  return {
    period: { days },
    generatedAt: new Date().toISOString(),
    occurrenceBeta: true,
    occurrenceDisclaimer:
      "Occurrence risk is a beta model output — relative risk per segment, not a final calibrated probability.",
    weatherContext,
    throughput,
    segments,
  };
}

module.exports = {
  getSupervisorDashboard,
  getSupervisorAnalytics,
  getSupervisorGlobalMap,
  getSupervisorPilotDashboard,
  fetchOnDutyZoneOfficers,
};
