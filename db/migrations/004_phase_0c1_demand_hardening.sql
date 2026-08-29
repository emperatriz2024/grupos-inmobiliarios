BEGIN;

ALTER TABLE demands ADD COLUMN first_seen_at timestamptz;
ALTER TABLE demands ADD COLUMN last_seen_at timestamptz;
ALTER TABLE demands ADD COLUMN expires_at timestamptz;
ALTER TABLE demands ADD COLUMN requester_observed text;
ALTER TABLE demands ADD COLUMN criteria_fingerprint text;

UPDATE demands SET first_seen_at=COALESCE(first_seen_at,created_at),last_seen_at=COALESCE(last_seen_at,updated_at,created_at);
UPDATE demands SET expires_at=last_seen_at+interval '7 days' WHERE origin='MARKET' AND expires_at IS NULL;
ALTER TABLE demands ALTER COLUMN first_seen_at SET NOT NULL;
ALTER TABLE demands ALTER COLUMN last_seen_at SET NOT NULL;

ALTER TABLE demands DROP CONSTRAINT demands_status_check;
ALTER TABLE demands ADD CONSTRAINT demands_status_check CHECK(status IN ('ACTIVE','PAUSED','CLOSED','EXPIRED'));
ALTER TABLE clients DROP CONSTRAINT clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK(status IN ('ACTIVE','PAUSED','CLOSED'));

CREATE TABLE demand_sources (
  id uuid PRIMARY KEY, demand_id uuid NOT NULL REFERENCES demands(id), source_reference text NOT NULL,
  source_channel text NOT NULL, group_thread text, requester_observed text, observed_at timestamptz NOT NULL,
  source_kind text NOT NULL CHECK(source_kind IN ('ORIGINAL','REPOST','UPDATE')), raw_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_channel,source_reference)
);
CREATE INDEX demand_sources_demand_observed_idx ON demand_sources(demand_id,observed_at DESC);
CREATE INDEX demands_market_expiry_idx ON demands(workspace_id,expires_at) WHERE origin='MARKET' AND status='ACTIVE';
CREATE INDEX demands_criteria_requester_idx ON demands(workspace_id,origin,requester_observed,criteria_fingerprint);

COMMIT;
