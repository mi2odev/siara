-- Migration: 20260630_intervention_visibility
-- Purpose: Add a per-intervention visibility flag so the citizen-facing "safety
-- layer" (Phase 2) can serve only public-safe interventions while enforcement /
-- EMS deployments stay internal to police/supervisor views.
--
-- Default by type: infrastructure measures (speed control, signage, roadwork,
-- lighting) are public-safe and useful to drivers; police_patrol /
-- ambulance_response / other stay internal. Supervisors can override per record.
--
-- Apply manually (psql -f). Idempotent.

BEGIN;

ALTER TABLE app.zone_interventions
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('public', 'internal'));

-- Backfill existing rows by type (no-op on a fresh install).
UPDATE app.zone_interventions
SET visibility = 'public'
WHERE intervention_type IN ('speed_control', 'signage', 'roadwork', 'lighting')
  AND visibility = 'internal';

CREATE INDEX IF NOT EXISTS idx_zone_interventions_visibility
  ON app.zone_interventions (visibility);

COMMIT;
