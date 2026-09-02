BEGIN;
CREATE TABLE IF NOT EXISTS owner_twins(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,dedupe_key text NOT NULL UNIQUE,payload_json jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS owner_events(id uuid PRIMARY KEY,owner_id uuid NOT NULL,event_type text NOT NULL,payload_json jsonb NOT NULL DEFAULT '{}',occurred_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS capture_pipeline(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,owner_id uuid NOT NULL,property_id uuid NOT NULL,stage text NOT NULL,responsible text NOT NULL,next_action text,due_at timestamptz,loss_reason text,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,UNIQUE(owner_id,property_id));
CREATE TABLE IF NOT EXISTS capture_events(id uuid PRIMARY KEY,capture_id uuid NOT NULL,event_type text NOT NULL,payload_json jsonb NOT NULL DEFAULT '{}',occurred_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS demand_signals(id text PRIMARY KEY,workspace_id uuid NOT NULL,property_type text,territory_id text,budget_band numeric,buyer_count integer NOT NULL,strength text NOT NULL,evidence_json jsonb NOT NULL,updated_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS capture_pipeline_due_idx ON capture_pipeline(stage,due_at);
COMMIT;
