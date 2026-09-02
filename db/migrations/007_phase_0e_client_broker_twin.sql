BEGIN;
CREATE TABLE IF NOT EXISTS client_twins (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, client_id uuid NOT NULL UNIQUE, status text NOT NULL, intent text NOT NULL, mandatory_json jsonb NOT NULL DEFAULT '{}', preferences_json jsonb NOT NULL DEFAULT '{}', alternatives_json jsonb NOT NULL DEFAULT '{}', next_action text, next_action_at timestamptz, last_contact_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS client_property_states (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, client_id uuid NOT NULL, property_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('REVIEWED','SELECTED','DISCARDED')), reason text, evidence_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, UNIQUE(client_id,property_id));
CREATE TABLE IF NOT EXISTS commercial_actions (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, client_id uuid NOT NULL, property_id uuid, action_type text NOT NULL, status text NOT NULL, due_at timestamptz, payload_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS twin_events (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, client_id uuid NOT NULL, property_id uuid, event_type text NOT NULL, payload_json jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS client_twins_next_action_idx ON client_twins(workspace_id,status,next_action_at);
CREATE INDEX IF NOT EXISTS client_property_states_client_idx ON client_property_states(client_id,status);
CREATE INDEX IF NOT EXISTS commercial_actions_due_idx ON commercial_actions(workspace_id,status,due_at);
COMMIT;
