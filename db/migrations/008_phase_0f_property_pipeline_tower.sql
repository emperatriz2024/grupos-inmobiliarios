BEGIN;
CREATE TABLE IF NOT EXISTS property_twins(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,property_id uuid NOT NULL UNIQUE,payload_json jsonb NOT NULL,next_action text,next_action_at timestamptz,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS commercial_pipeline(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,client_id uuid NOT NULL,property_id uuid,opportunity_id uuid,stage text NOT NULL,owner text NOT NULL,next_action text,next_action_at timestamptz,loss_reason text,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,UNIQUE(client_id,property_id));
CREATE TABLE IF NOT EXISTS pipeline_events(id uuid PRIMARY KEY,pipeline_id uuid NOT NULL,event_type text NOT NULL,payload_json jsonb NOT NULL DEFAULT '{}',occurred_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS commercial_pipeline_due_idx ON commercial_pipeline(stage,next_action_at);
COMMIT;
