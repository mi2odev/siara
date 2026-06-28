-- Migration: 20260628_zone_interventions
-- Purpose: Intervention tracking for the pilot program. Supervisors log
-- counter-measures applied to dangerous segments/zones (speed control, signage,
-- roadwork, lighting, police patrol, ambulance response, ...) and record the
-- status / outcome after the action so impact can be measured over time.
--
-- No migration runner exists in this repo — apply manually (psql -f) against the
-- same database the API uses. Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS app.zone_interventions (
  id BIGSERIAL PRIMARY KEY,
  intervention_type VARCHAR(40) NOT NULL CHECK (intervention_type IN (
    'speed_control',
    'signage',
    'roadwork',
    'lighting',
    'police_patrol',
    'ambulance_response',
    'other'
  )),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  road_segment_id BIGINT REFERENCES gis.road_segments (id) ON DELETE SET NULL,
  location GEOGRAPHY(Point, 4326),
  location_label TEXT,
  wilaya_id BIGINT REFERENCES gis.admin_areas (id) ON DELETE SET NULL,
  commune_id BIGINT REFERENCES gis.admin_areas (id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
  )),
  outcome_note TEXT,
  severity_before SMALLINT,
  severity_after SMALLINT,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zone_interventions_status
  ON app.zone_interventions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_zone_interventions_type
  ON app.zone_interventions (intervention_type);

CREATE INDEX IF NOT EXISTS idx_zone_interventions_road_segment
  ON app.zone_interventions (road_segment_id);

CREATE INDEX IF NOT EXISTS idx_zone_interventions_created_at
  ON app.zone_interventions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_zone_interventions_location
  ON app.zone_interventions USING GIST (location);

COMMIT;
