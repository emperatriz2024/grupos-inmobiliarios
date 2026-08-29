BEGIN;

CREATE TABLE clients (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), legacy_buyer_id text,
  name text NOT NULL, phone text, status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clients_workspace_legacy_buyer_uq ON clients(workspace_id,legacy_buyer_id) WHERE legacy_buyer_id IS NOT NULL;

CREATE TABLE demands (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), client_id uuid REFERENCES clients(id),
  origin text NOT NULL CHECK(origin IN ('CLIENT','MARKET','MANUAL')), status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','CLOSED')),
  source_channel text, source_id text, source_fingerprint text, raw_text text, operation text, property_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  territory_ids jsonb NOT NULL DEFAULT '[]'::jsonb, municipality_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_price numeric, max_price numeric, budget_tolerance numeric NOT NULL DEFAULT 0,
  min_bedrooms numeric, min_bathrooms numeric, min_parking numeric, min_area numeric, max_area numeric,
  required_features jsonb NOT NULL DEFAULT '[]'::jsonb, desired_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX demands_workspace_source_fingerprint_uq ON demands(workspace_id,source_fingerprint) WHERE source_fingerprint IS NOT NULL;
CREATE INDEX demands_client_idx ON demands(client_id);
CREATE INDEX demands_origin_status_idx ON demands(workspace_id,origin,status);

CREATE TABLE match_runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), trigger_type text NOT NULL,
  trigger_entity_id text, started_at timestamptz NOT NULL, completed_at timestamptz, status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED')),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX match_runs_workspace_started_idx ON match_runs(workspace_id,started_at DESC);

CREATE TABLE match_candidates (
  id uuid PRIMARY KEY, match_run_id uuid NOT NULL REFERENCES match_runs(id), demand_id uuid NOT NULL REFERENCES demands(id),
  property_id uuid NOT NULL REFERENCES master_properties(id), classification text NOT NULL CHECK(classification IN ('EXACT','VERIFY','ALTERNATIVE','REJECTED')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb, gaps jsonb NOT NULL DEFAULT '[]'::jsonb, conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  fit_score numeric NOT NULL, evidence_score numeric NOT NULL, availability_score numeric NOT NULL, ready_score numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(match_run_id,demand_id,property_id)
);
CREATE INDEX match_candidates_demand_idx ON match_candidates(demand_id,classification);

CREATE TABLE opportunities (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), demand_id uuid NOT NULL REFERENCES demands(id),
  property_id uuid NOT NULL REFERENCES master_properties(id), opportunity_type text NOT NULL CHECK(opportunity_type IN ('CLIENT_PROPERTY','BROKER_OWN_LISTING')),
  status text NOT NULL CHECK(status IN ('ACTIVE','INVALIDATED')), classification text NOT NULL CHECK(classification IN ('EXACT','VERIFY','ALTERNATIVE')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb, gaps jsonb NOT NULL DEFAULT '[]'::jsonb, conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  invalidated_at timestamptz, invalidation_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_type,demand_id,property_id)
);
CREATE INDEX opportunities_status_type_idx ON opportunities(workspace_id,status,opportunity_type);

CREATE TABLE opportunity_scores (
  id uuid PRIMARY KEY, opportunity_id uuid NOT NULL REFERENCES opportunities(id), fit_score numeric NOT NULL,
  evidence_score numeric NOT NULL, availability_score numeric NOT NULL, ready_score numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_scores_opportunity_idx ON opportunity_scores(opportunity_id,created_at DESC);

COMMIT;
