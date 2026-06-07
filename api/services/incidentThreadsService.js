const pool = require("../db");

const MAX_RELATED = 50;

// Auto-merge window: a freshly created report is folded into an existing
// incident thread when another report of the SAME incident_type sits within
// this radius and time window ("same place / same time" duplicate).
const AUTO_MERGE_RADIUS_METERS = 300;
const AUTO_MERGE_WINDOW_HOURS = 6;

function ensureUuid(value, label = "id") {
  const text = String(value || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
  ) {
    const error = new Error(`Invalid ${label}`);
    error.status = 400;
    throw error;
  }
  return text;
}

async function getThreadByReportId(reportId) {
  const safeId = ensureUuid(reportId, "report id");
  const sql = `
    WITH thread_link AS (
      SELECT thread_id
      FROM app.incident_thread_reports
      WHERE report_id = $1
      LIMIT 1
    ),
    thread_row AS (
      SELECT it.*
      FROM app.incident_threads it
      JOIN thread_link tl ON tl.thread_id = it.id
      LIMIT 1
    ),
    members AS (
      SELECT
        itr.thread_id,
        itr.report_id,
        itr.role,
        itr.added_at,
        ar.title,
        ar.incident_type,
        ar.severity_hint,
        ar.created_at,
        ST_Y(ar.incident_location::geometry) AS lat,
        ST_X(ar.incident_location::geometry) AS lng,
        ar.verified_by_officer_id,
        ar.location_label
      FROM app.incident_thread_reports itr
      JOIN app.accident_reports ar ON ar.id = itr.report_id
      WHERE itr.thread_id = (SELECT id FROM thread_row)
      ORDER BY (itr.role = 'primary') DESC, ar.created_at ASC
    )
    SELECT
      (SELECT row_to_json(t) FROM thread_row t) AS thread,
      COALESCE(json_agg(row_to_json(m)) FILTER (WHERE m.thread_id IS NOT NULL), '[]') AS members
    FROM members m
  `;
  const result = await pool.query(sql, [safeId]);
  const row = result.rows[0] || {};
  if (!row.thread) return null;
  const members = Array.isArray(row.members) ? row.members : [];
  return {
    threadId: row.thread.id,
    primaryReportId: row.thread.primary_report_id,
    memberCount: Number(row.thread.member_count) || members.length,
    createdAt: row.thread.created_at
      ? new Date(row.thread.created_at).toISOString()
      : null,
    members: members.map((m) => ({
      reportId: m.report_id,
      role: m.role,
      title: m.title,
      incidentType: m.incident_type,
      severityHint: Number(m.severity_hint) || 0,
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : null,
      lat: m.lat != null ? Number(m.lat) : null,
      lng: m.lng != null ? Number(m.lng) : null,
      verifiedByPolice: Boolean(m.verified_by_officer_id),
      locationLabel: m.location_label || null,
    })),
  };
}

async function linkReportsAsThread({ primaryReportId, relatedReportIds, createdBy }) {
  const primaryId = ensureUuid(primaryReportId, "primaryReportId");
  if (!Array.isArray(relatedReportIds) || relatedReportIds.length === 0) {
    const error = new Error("relatedReportIds[] is required");
    error.status = 400;
    throw error;
  }
  const relatedIds = [...new Set(relatedReportIds.map((id) => ensureUuid(id, "relatedReportId")))]
    .filter((id) => id !== primaryId)
    .slice(0, MAX_RELATED);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingThread = await client.query(
      `SELECT thread_id FROM app.incident_thread_reports WHERE report_id = $1 LIMIT 1`,
      [primaryId],
    );

    let threadId;
    if (existingThread.rowCount > 0) {
      threadId = existingThread.rows[0].thread_id;
    } else {
      const created = await client.query(
        `INSERT INTO app.incident_threads (primary_report_id, created_by, member_count)
         VALUES ($1, $2, 1)
         RETURNING id`,
        [primaryId, createdBy || null],
      );
      threadId = created.rows[0].id;
      await client.query(
        `INSERT INTO app.incident_thread_reports (thread_id, report_id, role, added_by)
         VALUES ($1, $2, 'primary', $3)
         ON CONFLICT (thread_id, report_id) DO NOTHING`,
        [threadId, primaryId, createdBy || null],
      );
    }

    for (const id of relatedIds) {
      await client.query(
        `INSERT INTO app.incident_thread_reports (thread_id, report_id, role, added_by)
         VALUES ($1, $2, 'related', $3)
         ON CONFLICT (thread_id, report_id) DO NOTHING`,
        [threadId, id, createdBy || null],
      );
    }

    const countRow = await client.query(
      `SELECT COUNT(*)::int AS member_count
       FROM app.incident_thread_reports WHERE thread_id = $1`,
      [threadId],
    );

    await client.query(
      `UPDATE app.incident_threads
       SET member_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [Number(countRow.rows[0]?.member_count) || 1, threadId],
    );

    await client.query("COMMIT");

    return getThreadByReportId(primaryId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Automatically fold a newly created report into an incident thread when a
 * matching report already exists nearby and recently. "Matching" means: same
 * incident_type, within AUTO_MERGE_RADIUS_METERS, created within
 * AUTO_MERGE_WINDOW_HOURS, and not flagged as spam.
 *
 * Behaviour:
 *  - If a nearby report already belongs to a thread, the new report joins it.
 *  - Otherwise a fresh thread is created with the earliest nearby report as the
 *    primary and the new report linked as related.
 *  - If nothing matches, no thread is created and null is returned.
 *
 * Safe to call post-commit (opens its own connection/transaction). Never throws
 * for "no match" — callers may ignore the result.
 */
async function autoMergeReportOnCreate({ reportId, createdBy }) {
  const newId = ensureUuid(reportId, "report id");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // The new report must not already be linked (e.g. retried create).
    const alreadyLinked = await client.query(
      `SELECT 1 FROM app.incident_thread_reports WHERE report_id = $1 LIMIT 1`,
      [newId],
    );
    if (alreadyLinked.rowCount > 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // Find the best existing report to merge with. Prefer one that is already
    // part of a thread; otherwise the earliest nearby report becomes primary.
    const candidate = await client.query(
      `
        WITH new_report AS (
          SELECT id, incident_type, incident_location, created_at
          FROM app.accident_reports
          WHERE id = $1
        )
        SELECT
          ar.id,
          ar.created_at,
          itr.thread_id
        FROM app.accident_reports ar
        CROSS JOIN new_report nr
        LEFT JOIN app.incident_thread_reports itr ON itr.report_id = ar.id
        WHERE ar.id <> nr.id
          AND ar.incident_location IS NOT NULL
          AND nr.incident_location IS NOT NULL
          AND ar.incident_type = nr.incident_type
          AND ar.created_at >= nr.created_at - ($2::int * INTERVAL '1 hour')
          AND ar.created_at <= nr.created_at + ($2::int * INTERVAL '1 hour')
          AND COALESCE(ar.latest_predicted_label, 'real') <> 'spam'
          AND ar.status NOT IN ('rejected', 'archived')
          AND ST_DWithin(
            ar.incident_location::geography,
            nr.incident_location::geography,
            $3
          )
        ORDER BY (itr.thread_id IS NOT NULL) DESC, ar.created_at ASC
        LIMIT 1
      `,
      [newId, AUTO_MERGE_WINDOW_HOURS, AUTO_MERGE_RADIUS_METERS],
    );

    if (candidate.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const matchId = candidate.rows[0].id;
    let threadId = candidate.rows[0].thread_id;
    let primaryId = matchId;

    if (!threadId) {
      // No thread yet — create one with the existing (earlier) report as primary.
      const created = await client.query(
        `INSERT INTO app.incident_threads (primary_report_id, created_by, member_count)
         VALUES ($1, $2, 1)
         RETURNING id`,
        [matchId, createdBy || null],
      );
      threadId = created.rows[0].id;
      await client.query(
        `INSERT INTO app.incident_thread_reports (thread_id, report_id, role, added_by)
         VALUES ($1, $2, 'primary', $3)
         ON CONFLICT (report_id) DO NOTHING`,
        [threadId, matchId, createdBy || null],
      );
    } else {
      // Joining an existing thread — the primary is whatever that thread points to.
      const primaryRow = await client.query(
        `SELECT primary_report_id FROM app.incident_threads WHERE id = $1`,
        [threadId],
      );
      primaryId = primaryRow.rows[0]?.primary_report_id || matchId;
    }

    // Link the new report into the thread as a related duplicate.
    await client.query(
      `INSERT INTO app.incident_thread_reports (thread_id, report_id, role, added_by)
       VALUES ($1, $2, 'related', $3)
       ON CONFLICT (report_id) DO NOTHING`,
      [threadId, newId, createdBy || null],
    );

    // Mark the duplicate as merged into the primary so it shows in the admin
    // "Merged" view and drops out of the public feed. Terminal statuses are left
    // untouched (a verified/rejected/archived report keeps its decision).
    await client.query(
      `UPDATE app.accident_reports
       SET status = 'merged',
           merged_into_report_id = $1,
           merged_at = NOW(),
           merged_by = $2
       WHERE id = $3
         AND status NOT IN ('verified', 'rejected', 'archived')`,
      [primaryId, createdBy || null, newId],
    );

    const countRow = await client.query(
      `SELECT COUNT(*)::int AS member_count
       FROM app.incident_thread_reports WHERE thread_id = $1`,
      [threadId],
    );

    await client.query(
      `UPDATE app.incident_threads
       SET member_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [Number(countRow.rows[0]?.member_count) || 1, threadId],
    );

    await client.query("COMMIT");
    return getThreadByReportId(newId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getThreadByReportId,
  linkReportsAsThread,
  autoMergeReportOnCreate,
  AUTO_MERGE_RADIUS_METERS,
  AUTO_MERGE_WINDOW_HOURS,
};
