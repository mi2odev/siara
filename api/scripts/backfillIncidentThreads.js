#!/usr/bin/env node
/**
 * One-time backfill: retroactively merge existing duplicate reports into
 * incident threads using the SAME rule as the live auto-merge
 * (same incident_type, within 300 m, within ±6 h, not spam).
 *
 * It walks every report newest-first and runs the auto-merge step on each one.
 * Processing the newest first means each report's match resolves to the EARLIEST
 * report in its cluster, so that earliest report becomes the thread primary —
 * exactly the primary that live auto-merge would have chosen. Later duplicates
 * then chain into the same thread. Reports already linked are skipped.
 *
 * The script is idempotent: re-running it only links reports that are not yet
 * part of a thread.
 *
 * Run:
 *     node scripts/backfillIncidentThreads.js          # apply
 *     node scripts/backfillIncidentThreads.js --dry    # preview only
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const pool = require("../db");
const {
  autoMergeReportOnCreate,
  AUTO_MERGE_RADIUS_METERS,
  AUTO_MERGE_WINDOW_HOURS,
} = require("../services/incidentThreadsService");

const DRY_RUN = process.argv.includes("--dry") || process.argv.includes("--dry-run");

async function main() {
  console.log(
    `[backfill] incident-thread merge — radius=${AUTO_MERGE_RADIUS_METERS}m window=${AUTO_MERGE_WINDOW_HOURS}h${
      DRY_RUN ? " (DRY RUN — no writes)" : ""
    }`,
  );

  // Process newest first so each report matches back to the earliest in its
  // cluster, making that earliest report the thread primary (see header note).
  const { rows } = await pool.query(
    `
      SELECT ar.id
      FROM app.accident_reports ar
      LEFT JOIN app.incident_thread_reports itr ON itr.report_id = ar.id
      WHERE ar.incident_location IS NOT NULL
        AND itr.report_id IS NULL            -- not already in a thread
      ORDER BY ar.created_at DESC
    `,
  );

  console.log(`[backfill] ${rows.length} unlinked report(s) to evaluate`);

  let merged = 0;
  const touchedThreads = new Set();

  for (const { id } of rows) {
    if (DRY_RUN) {
      const preview = await previewMatch(id);
      if (preview) {
        merged += 1;
        console.log(
          `[backfill][dry] ${id} would merge with ${preview.matchId} (${preview.distanceMeters} m, ${preview.hoursApart} h apart, type=${preview.incidentType})`,
        );
      }
      continue;
    }

    let thread = null;
    try {
      thread = await autoMergeReportOnCreate({ reportId: id, createdBy: null });
    } catch (error) {
      console.warn(`[backfill] failed for ${id}: ${error.message}`);
      continue;
    }
    if (thread) {
      merged += 1;
      touchedThreads.add(thread.threadId);
      console.log(
        `[backfill] linked ${id} -> thread ${thread.threadId} (${thread.memberCount} members)`,
      );
    }
  }

  if (DRY_RUN) {
    console.log(`[backfill] DRY RUN complete — ${merged} report(s) would be merged.`);
    return;
  }

  console.log(
    `[backfill] done — ${merged} report(s) merged across ${touchedThreads.size} thread(s).`,
  );

  await reconcileThreadStatuses();
}

/**
 * Sync report status with thread membership so the admin "Merged" view and the
 * public feed agree with the threads:
 *  - thread primaries must be active (never status='merged');
 *  - related members must be status='merged' pointing at their primary.
 * Terminal decisions (verified/rejected/archived) are preserved.
 */
async function reconcileThreadStatuses() {
  // 1) Un-merge any thread primary that was wrongly flagged merged
  //    (e.g. legacy circular merges). Reset to pending for re-review.
  const fixedPrimaries = await pool.query(
    `
      UPDATE app.accident_reports ar
      SET status = 'pending',
          merged_into_report_id = NULL,
          merged_at = NULL,
          merged_by = NULL
      FROM app.incident_threads it
      WHERE ar.id = it.primary_report_id
        AND ar.status = 'merged'
      RETURNING ar.id
    `,
  );

  // 2) Mark every related member as merged into its thread primary.
  const fixedRelated = await pool.query(
    `
      UPDATE app.accident_reports ar
      SET status = 'merged',
          merged_into_report_id = it.primary_report_id,
          merged_at = COALESCE(ar.merged_at, NOW())
      FROM app.incident_thread_reports itr
      JOIN app.incident_threads it ON it.id = itr.thread_id
      WHERE itr.report_id = ar.id
        AND itr.role = 'related'
        AND ar.status NOT IN ('verified', 'rejected', 'archived', 'merged')
      RETURNING ar.id
    `,
  );

  // 3) Repoint any related member already merged into the wrong target.
  const repointed = await pool.query(
    `
      UPDATE app.accident_reports ar
      SET merged_into_report_id = it.primary_report_id
      FROM app.incident_thread_reports itr
      JOIN app.incident_threads it ON it.id = itr.thread_id
      WHERE itr.report_id = ar.id
        AND itr.role = 'related'
        AND ar.status = 'merged'
        AND ar.merged_into_report_id IS DISTINCT FROM it.primary_report_id
      RETURNING ar.id
    `,
  );

  console.log(
    `[backfill] reconciled statuses — ${fixedPrimaries.rowCount} primary reset, ${fixedRelated.rowCount} marked merged, ${repointed.rowCount} repointed.`,
  );
}

// Mirror of the auto-merge candidate query, read-only, for --dry previews.
async function previewMatch(reportId) {
  const { rows } = await pool.query(
    `
      WITH new_report AS (
        SELECT id, incident_type, incident_location, created_at
        FROM app.accident_reports
        WHERE id = $1
      )
      SELECT
        ar.id AS match_id,
        ar.incident_type,
        ROUND(ST_Distance(ar.incident_location::geography, nr.incident_location::geography))::int AS distance_meters,
        ROUND(ABS(EXTRACT(EPOCH FROM (ar.created_at - nr.created_at)) / 3600.0)::numeric, 1) AS hours_apart
      FROM app.accident_reports ar
      CROSS JOIN new_report nr
      LEFT JOIN app.incident_thread_reports itr ON itr.report_id = ar.id
      WHERE ar.id <> nr.id
        AND ar.incident_location IS NOT NULL
        AND ar.incident_type = nr.incident_type
        AND ar.created_at >= nr.created_at - ($2::int * INTERVAL '1 hour')
        AND ar.created_at <= nr.created_at + ($2::int * INTERVAL '1 hour')
        AND COALESCE(ar.latest_predicted_label, 'real') <> 'spam'
        AND ST_DWithin(ar.incident_location::geography, nr.incident_location::geography, $3)
      ORDER BY (itr.thread_id IS NOT NULL) DESC, ar.created_at ASC
      LIMIT 1
    `,
    [reportId, AUTO_MERGE_WINDOW_HOURS, AUTO_MERGE_RADIUS_METERS],
  );
  if (!rows[0]) return null;
  return {
    matchId: rows[0].match_id,
    incidentType: rows[0].incident_type,
    distanceMeters: rows[0].distance_meters,
    hoursApart: rows[0].hours_apart,
  };
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill] fatal:", error);
    pool.end().finally(() => process.exit(1));
  });
