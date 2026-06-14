-- Migration: 20260614_accident_reports_status_resolved
-- Purpose: Allow the full set of report statuses the application writes.
--
-- The original base-schema constraint only permitted
--   pending, verified, rejected, flagged, merged, archived
-- so resolving an incident (status = 'resolved') — and the admin
-- 'under_review' / 'dispatched' transitions — violated
-- accident_reports_status_check. This widens the constraint to the union of
-- every status the API persists (see policeService PERSISTABLE_REPORT_STATUS
-- and reports.js ALLOWED_STATUSES). All previously-allowed values are kept, so
-- existing rows stay valid.
--
-- Idempotent: drops the constraint if present, then re-adds the widened one.

ALTER TABLE app.accident_reports
  DROP CONSTRAINT IF EXISTS accident_reports_status_check;

ALTER TABLE app.accident_reports
  ADD CONSTRAINT accident_reports_status_check
  CHECK (status IN (
    'pending',
    'under_review',
    'verified',
    'dispatched',
    'rejected',
    'resolved',
    'flagged',
    'merged',
    'archived'
  ));
