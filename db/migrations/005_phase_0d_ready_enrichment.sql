BEGIN;

CREATE TABLE readiness_assessments (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id), property_id uuid NOT NULL REFERENCES master_properties(id),
  status text NOT NULL CHECK(status IN ('READY','VERIFY_AVAILABILITY','NEEDS_FACTS','NEEDS_MEDIA','PRICE_CONFLICT','IDENTITY_REVIEW','RIGHTS_REVIEW','BLOCKED')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb, gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  readiness_score numeric(5,2) NOT NULL CHECK(readiness_score BETWEEN 0 AND 100),
  assessed_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(opportunity_id)
);
CREATE INDEX readiness_property_status_idx ON readiness_assessments(workspace_id,property_id,status);

CREATE TABLE enrichment_tasks (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), opportunity_id uuid NOT NULL REFERENCES opportunities(id),
  property_id uuid NOT NULL REFERENCES master_properties(id), task_type text NOT NULL
    CHECK(task_type IN ('VERIFY_AVAILABILITY','FIND_FACTS','FIND_MEDIA','VERIFY_PRICE','REVIEW_IDENTITY','VERIFY_MEDIA_RIGHTS')),
  status text NOT NULL CHECK(status IN ('OPEN','COMPLETED','CANCELLED')), details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(opportunity_id,task_type)
);
CREATE INDEX enrichment_tasks_open_idx ON enrichment_tasks(workspace_id,status,task_type);

CREATE TABLE property_packages (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), opportunity_id uuid NOT NULL REFERENCES opportunities(id),
  property_id uuid NOT NULL REFERENCES master_properties(id), status text NOT NULL CHECK(status IN ('READY','INVALIDATED')),
  payload_json jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(opportunity_id)
);

CREATE TABLE package_media (
  id uuid PRIMARY KEY, package_id uuid NOT NULL REFERENCES property_packages(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id), sort_order integer, is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(package_id,media_asset_id)
);

COMMIT;
