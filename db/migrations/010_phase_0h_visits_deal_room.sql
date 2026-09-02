BEGIN;
CREATE TABLE IF NOT EXISTS visits(id uuid PRIMARY KEY,buyer_id uuid NOT NULL,property_id uuid NOT NULL,owner_id uuid,stage text NOT NULL,slot_at timestamptz,responsible text NOT NULL,payload_json jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS visit_events(id uuid PRIMARY KEY,visit_id uuid NOT NULL,event_type text NOT NULL,payload_json jsonb NOT NULL,occurred_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS deals(id uuid PRIMARY KEY,buyer_id uuid NOT NULL,property_id uuid NOT NULL UNIQUE,owner_id uuid,opportunity_id uuid,stage text NOT NULL,offer_amount numeric,counter_amount numeric,currency text NOT NULL,payload_json jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS deal_events(id uuid PRIMARY KEY,deal_id uuid NOT NULL,event_type text NOT NULL,payload_json jsonb NOT NULL,occurred_at timestamptz NOT NULL);
COMMIT;
