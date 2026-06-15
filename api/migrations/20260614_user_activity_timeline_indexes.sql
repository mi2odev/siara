-- Migration: 20260614_user_activity_timeline_indexes
-- Purpose: Supporting indexes for the profile "Timeline" activity feed
--          (GET /api/auth/activity → fetchUserActivityTimeline).
--
-- The timeline pulls a user's most-recent reports (with their lifecycle), the
-- alert rules they created, and the times those alerts fired. The report query
-- filters by reported_by and orders by created_at DESC; a composite index makes
-- that a single index scan instead of filter-then-sort. The alert-rule and
-- alert-trigger queries are already covered by existing indexes
-- (idx_alert_rules_user_id, idx_alert_rules_created_at,
--  idx_alert_trigger_log_alert_id_matched_at).
--
-- Idempotent: CREATE INDEX IF NOT EXISTS. No data change.

CREATE INDEX IF NOT EXISTS idx_accident_reports_reported_by_created_at
  ON app.accident_reports (reported_by, created_at DESC);
