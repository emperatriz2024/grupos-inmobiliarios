BEGIN;

CREATE TABLE workspaces (
  id uuid PRIMARY KEY, name text NOT NULL, timezone text NOT NULL, country_code char(2) NOT NULL,
  default_currency char(3) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_channels (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), channel_type text NOT NULL CHECK (channel_type IN ('WHATSAPP_ZIP','WHATSAPP_SECONDARY','MANUAL','EXTERNAL_WEB')),
  account_role text NOT NULL CHECK (account_role IN ('PRIMARY_NUMBER','SECONDARY_NUMBER','NONE')), mode text NOT NULL CHECK (mode IN ('MANUAL','AUTOMATIC','HYBRID')),
  enabled boolean NOT NULL DEFAULT true, fallback_enabled boolean NOT NULL DEFAULT true, adapter_version text NOT NULL,
  external_account_ref text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_threads (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), ingestion_channel_id uuid NOT NULL REFERENCES ingestion_channels(id),
  external_thread_id text, thread_type text NOT NULL, name text NOT NULL, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX source_threads_external_uq ON source_threads(ingestion_channel_id,external_thread_id) WHERE external_thread_id IS NOT NULL;

CREATE TABLE group_ingestion_coverage (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), group_identifier text NOT NULL, group_name text NOT NULL,
  zip_available boolean NOT NULL DEFAULT true, secondary_available boolean NOT NULL DEFAULT false,
  coverage_status text NOT NULL CHECK (coverage_status IN ('ZIP_ONLY','PENDING_SECONDARY','DUAL','SECONDARY_PRIMARY','SECONDARY_ONLY','INACTIVE')),
  secondary_joined_at timestamptz, last_zip_activity_at timestamptz, last_secondary_activity_at timestamptz,
  zip_fallback_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,group_identifier)
);
CREATE INDEX group_ingestion_coverage_status_idx ON group_ingestion_coverage(workspace_id,coverage_status);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), device_id uuid, file_hash text NOT NULL, source_filename text NOT NULL,
  source_thread_id uuid REFERENCES source_threads(id), range_start timestamptz, range_end timestamptz, messages_detected integer NOT NULL DEFAULT 0,
  messages_imported integer NOT NULL DEFAULT 0, duplicates_detected integer NOT NULL DEFAULT 0, errors_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL, finished_at timestamptz, status text NOT NULL
);
CREATE INDEX import_batches_hash_idx ON import_batches(workspace_id,file_hash,started_at DESC);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), ingestion_channel_id uuid NOT NULL REFERENCES ingestion_channels(id),
  started_at timestamptz NOT NULL, finished_at timestamptz, last_heartbeat_at timestamptz, messages_received integer NOT NULL DEFAULT 0,
  media_received integer NOT NULL DEFAULT 0, duplicates_detected integer NOT NULL DEFAULT 0, errors_count integer NOT NULL DEFAULT 0,
  status text NOT NULL, cursor text, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE territories (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), parent_id uuid REFERENCES territories(id), type text NOT NULL CHECK (type IN ('country','state','municipality','macrozone','zone_family','zone','subzone','urbanization','complex','landmark')),
  name text NOT NULL, canonical_slug text NOT NULL, country_code char(2) NOT NULL, state_name text, municipality_name text,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,canonical_slug)
);
CREATE TABLE territory_aliases (
  id uuid PRIMARY KEY, territory_id uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE, alias text NOT NULL, normalized_alias text NOT NULL,
  UNIQUE(territory_id,normalized_alias)
);
CREATE INDEX territory_aliases_normalized_idx ON territory_aliases(normalized_alias);
CREATE TABLE territory_closure (
  ancestor_id uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE, descendant_id uuid NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  depth integer NOT NULL CHECK(depth>=0), PRIMARY KEY(ancestor_id,descendant_id)
);
CREATE INDEX territory_closure_descendant_idx ON territory_closure(descendant_id,depth);

CREATE TABLE source_messages (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), source_thread_id uuid NOT NULL REFERENCES source_threads(id),
  ingestion_channel_id uuid NOT NULL REFERENCES ingestion_channels(id), external_message_id text, author_external_ref text, raw_text text NOT NULL,
  source_url text, published_at timestamptz, received_at timestamptz NOT NULL, ingested_at timestamptz NOT NULL, content_hash text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('PROPERTY','REQUEST','PRICE_UPDATE','AVAILABILITY_UPDATE','FEATURE_UPDATE','CONTACT_UPDATE','MEDIA_ONLY','VOICE_INFORMATION','REPOST','NOISE','UNKNOWN')),
  classification_confidence numeric(5,4), classification_version text, future_date_flag boolean NOT NULL DEFAULT false,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX source_messages_external_uq ON source_messages(ingestion_channel_id,source_thread_id,external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX source_messages_thread_published_idx ON source_messages(source_thread_id,published_at DESC);
CREATE INDEX source_messages_content_hash_idx ON source_messages(content_hash);

CREATE TABLE master_properties (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), canonical_code text NOT NULL, operation text, property_type text,
  territory_id uuid REFERENCES territories(id), residence_name text, price_usd numeric(14,2), currency char(3) NOT NULL DEFAULT 'USD',
  area_m2 numeric(12,2), land_area_m2 numeric(12,2), bedrooms numeric(5,1), bathrooms numeric(5,1), half_bathrooms numeric(5,1), parking integer,
  status text NOT NULL CHECK(status IN ('ACTIVE','LIKELY_ACTIVE','VERIFY','RESERVED','SOLD','RENTED','EXPIRED','ARCHIVED','UNKNOWN')),
  ownership_scope text NOT NULL CHECK(ownership_scope IN ('OWN','MARKET','UNKNOWN')), first_seen_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL,
  last_verified_at timestamptz, readiness_status text NOT NULL CHECK(readiness_status IN ('READY','ENRICHING','VERIFY','BLOCKED')),
  identity_confidence numeric(5,4), canonical_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(workspace_id,canonical_code)
);
CREATE INDEX master_properties_search_idx ON master_properties(workspace_id,status,operation,property_type,territory_id);
CREATE INDEX master_properties_price_idx ON master_properties(workspace_id,price_usd) WHERE deleted_at IS NULL;
CREATE INDEX master_properties_recent_idx ON master_properties(workspace_id,last_seen_at DESC,ownership_scope);

CREATE TABLE evidence_facts (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), entity_type text NOT NULL, entity_id uuid, field_key text NOT NULL,
  value_json jsonb NOT NULL, normalized_text text, source_message_id uuid REFERENCES source_messages(id), source_attachment_id uuid, source_url text,
  evidence_method text NOT NULL CHECK(evidence_method IN ('platform_metadata','title','description','caption','ocr','voice_transcription','api','manual','user_confirmed')),
  evidence_locator text, confidence numeric(5,4) NOT NULL, status text NOT NULL CHECK(status IN ('OBSERVED','CONFIRMED','REJECTED','SUPERSEDED')),
  observed_at timestamptz NOT NULL, valid_from timestamptz, valid_to timestamptz, extractor_version text, confirmed_by uuid, confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK(source_message_id IS NOT NULL OR source_attachment_id IS NOT NULL OR source_url IS NOT NULL)
);
CREATE INDEX evidence_facts_entity_field_idx ON evidence_facts(entity_id,field_key,status);
CREATE INDEX evidence_facts_source_message_idx ON evidence_facts(source_message_id);

CREATE TABLE property_canonical_facts (
  property_id uuid NOT NULL REFERENCES master_properties(id), field_key text NOT NULL, evidence_fact_id uuid NOT NULL REFERENCES evidence_facts(id),
  value_json jsonb NOT NULL, selection_method text NOT NULL, selected_at timestamptz NOT NULL, selected_by uuid,
  PRIMARY KEY(property_id,field_key)
);

CREATE TABLE property_sources (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), property_id uuid NOT NULL REFERENCES master_properties(id),
  source_message_id uuid NOT NULL REFERENCES source_messages(id), relation_type text NOT NULL CHECK(relation_type IN ('original','repost','portal_listing','social_listing','manual','historical')),
  identity_confidence numeric(5,4), linked_at timestamptz NOT NULL, linked_by uuid, UNIQUE(property_id,source_message_id)
);
CREATE INDEX property_sources_property_idx ON property_sources(property_id);
CREATE INDEX property_sources_message_idx ON property_sources(source_message_id);

CREATE TABLE domain_events (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), event_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  schema_version integer NOT NULL, payload_json jsonb NOT NULL, occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL, actor_id uuid, correlation_id uuid NOT NULL, causation_id uuid, idempotency_key text
);
CREATE UNIQUE INDEX domain_events_idempotency_uq ON domain_events(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX domain_events_aggregate_idx ON domain_events(workspace_id,aggregate_type,aggregate_id,occurred_at);
CREATE OR REPLACE FUNCTION reject_domain_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'domain_events are append-only'; END $$;
CREATE TRIGGER domain_events_no_update BEFORE UPDATE OR DELETE ON domain_events FOR EACH ROW EXECUTE FUNCTION reject_domain_event_mutation();

CREATE TABLE idempotency_keys (
  workspace_id uuid NOT NULL REFERENCES workspaces(id), operation text NOT NULL, idempotency_key text NOT NULL, result_entity_type text,
  result_entity_id uuid, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, PRIMARY KEY(workspace_id,operation,idempotency_key)
);

CREATE TABLE devices (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), device_name text NOT NULL, last_seen_at timestamptz NOT NULL,
  last_sync_sequence bigint NOT NULL DEFAULT 0
);
CREATE TABLE sync_changes (
  sequence_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), entity_type text NOT NULL,
  entity_id uuid NOT NULL, operation text NOT NULL, row_version bigint NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sync_changes_workspace_sequence_idx ON sync_changes(workspace_id,sequence_id);
CREATE TABLE client_mutations (
  mutation_id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES devices(id), workspace_id uuid NOT NULL REFERENCES workspaces(id),
  entity_type text NOT NULL, entity_id uuid NOT NULL, operation text NOT NULL, payload_json jsonb NOT NULL, created_at timestamptz NOT NULL,
  status text NOT NULL, applied_at timestamptz
);

COMMIT;
