BEGIN;

ALTER TABLE readiness_assessments ADD COLUMN is_current boolean NOT NULL DEFAULT false;
ALTER TABLE readiness_assessments ADD COLUMN superseded_at timestamptz;
ALTER TABLE readiness_assessments DROP CONSTRAINT readiness_assessments_opportunity_id_key;
UPDATE readiness_assessments SET is_current=true;
CREATE UNIQUE INDEX readiness_assessments_current_uq ON readiness_assessments(opportunity_id) WHERE is_current;
CREATE INDEX readiness_assessments_history_idx ON readiness_assessments(opportunity_id,assessed_at DESC);

ALTER TABLE enrichment_tasks DROP CONSTRAINT enrichment_tasks_status_check;
ALTER TABLE enrichment_tasks ADD CONSTRAINT enrichment_tasks_status_check
  CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','DISMISSED','FAILED'));
ALTER TABLE enrichment_tasks ADD COLUMN resolved_at timestamptz;

ALTER TABLE package_media ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE'
  CHECK(status IN ('ACTIVE','REVOKED'));
ALTER TABLE package_media ADD COLUMN revoked_at timestamptz;
ALTER TABLE package_media ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX package_media_active_idx ON package_media(package_id,status);

COMMIT;
