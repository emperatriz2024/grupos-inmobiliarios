BEGIN;

CREATE TABLE source_attachments (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), source_message_id uuid REFERENCES source_messages(id),
  external_message_id text, external_media_id text, provenance_status text NOT NULL DEFAULT 'UNRESOLVED' CHECK(provenance_status IN ('UNRESOLVED','RESOLVED')),
  media_type text NOT NULL CHECK(media_type IN ('IMAGE','FLYER','VIDEO','AUDIO','DOCUMENT','UNKNOWN')),
  mime_type text, original_filename text, size_bytes bigint, width integer, height integer, duration_ms bigint, sha256 text,
  storage_locator text, media_status text NOT NULL CHECK(media_status IN ('OBSERVED','AVAILABLE','STORED','MISSING','FAILED')),
  received_at timestamptz NOT NULL, ingested_at timestamptz NOT NULL, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((provenance_status='RESOLVED' AND source_message_id IS NOT NULL) OR (provenance_status='UNRESOLVED' AND source_message_id IS NULL AND external_message_id IS NOT NULL))
);
CREATE INDEX source_attachments_message_idx ON source_attachments(source_message_id);
CREATE INDEX source_attachments_hash_idx ON source_attachments(workspace_id,sha256) WHERE sha256 IS NOT NULL;

ALTER TABLE evidence_facts ADD CONSTRAINT evidence_facts_source_attachment_fk
  FOREIGN KEY(source_attachment_id) REFERENCES source_attachments(id);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), sha256 text, phash text, mime_type text,
  storage_key text, width integer, height integer, duration_ms bigint,
  rights_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(rights_status IN ('OWNED','AUTHORIZED','INTERNAL_ONLY','SOURCE_LINK_ONLY','UNKNOWN')),
  quality_score numeric(5,4), media_role text NOT NULL CHECK(media_role IN ('PHOTO','FLYER','VIDEO','AUDIO','DOCUMENT','UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX media_assets_workspace_sha_uq ON media_assets(workspace_id,sha256) WHERE sha256 IS NOT NULL;
CREATE INDEX media_assets_workspace_phash_idx ON media_assets(workspace_id,phash) WHERE phash IS NOT NULL;

CREATE TABLE property_media (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), property_id uuid NOT NULL REFERENCES master_properties(id),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id), source_attachment_id uuid REFERENCES source_attachments(id),
  relation_type text NOT NULL CHECK(relation_type IN ('SOURCE_MEDIA','MATCHED_MEDIA','OWN_MEDIA','MANUAL','HISTORICAL')),
  relation_confidence numeric(5,4), client_allowed boolean NOT NULL DEFAULT false, is_primary boolean NOT NULL DEFAULT false,
  sort_order integer, linked_at timestamptz NOT NULL, linked_by uuid
);
CREATE INDEX property_media_property_idx ON property_media(property_id);
CREATE INDEX property_media_asset_idx ON property_media(media_asset_id);

CREATE TABLE property_identity_links (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), property_a_id uuid NOT NULL REFERENCES master_properties(id),
  property_b_id uuid NOT NULL REFERENCES master_properties(id), identity_score numeric(5,4) NOT NULL,
  decision text NOT NULL CHECK(decision IN ('PENDING','SAME_PROPERTY','DIFFERENT_PROPERTY','MERGED','REJECTED')),
  signals_json jsonb NOT NULL DEFAULT '[]'::jsonb, conflicts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  identity_model_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid,
  resolution_notes text, CHECK(property_a_id<>property_b_id), CHECK(property_a_id::text<property_b_id::text), UNIQUE(workspace_id,property_a_id,property_b_id)
);
CREATE INDEX property_identity_links_a_idx ON property_identity_links(property_a_id);
CREATE INDEX property_identity_links_b_idx ON property_identity_links(property_b_id);

CREATE TABLE property_redirects (
  old_property_id uuid PRIMARY KEY REFERENCES master_properties(id), canonical_property_id uuid NOT NULL REFERENCES master_properties(id),
  merged_at timestamptz NOT NULL, reason text NOT NULL, decision_reference uuid REFERENCES property_identity_links(id),
  CHECK(old_property_id<>canonical_property_id)
);

CREATE TABLE review_queue (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), review_type text NOT NULL
    CHECK(review_type IN ('POSSIBLE_DUPLICATE','IDENTITY_CONFLICT','PRICE_CONFLICT','MEDIA_IDENTITY_CONFLICT','MEDIA_RIGHTS_UNKNOWN')),
  entity_type text NOT NULL, entity_id uuid NOT NULL, status text NOT NULL DEFAULT 'PENDING', priority integer NOT NULL DEFAULT 0,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, resolved_by uuid
);
CREATE INDEX review_queue_pending_idx ON review_queue(workspace_id,status,priority DESC,created_at);

CREATE TABLE own_listing_details (
  property_id uuid PRIMARY KEY REFERENCES master_properties(id), workspace_id uuid NOT NULL REFERENCES workspaces(id), capture_date date,
  agreement_type text NOT NULL DEFAULT 'UNKNOWN' CHECK(agreement_type IN ('EXCLUSIVE','OPEN','DIRECT','UNKNOWN')),
  agreement_start date, agreement_end date, authorized_price numeric(14,2), currency char(3) NOT NULL DEFAULT 'USD',
  commission_pct numeric(6,3), vehicle_accepted boolean, financing_available boolean,
  documents_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(documents_status IN ('UNKNOWN','PENDING','PARTIAL','COMPLETE','REVIEW')),
  media_authorization_status text NOT NULL DEFAULT 'UNKNOWN' CHECK(media_authorization_status IN ('UNKNOWN','AUTHORIZED','NOT_AUTHORIZED','PARTIAL')),
  internal_notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX own_listing_details_workspace_property_idx ON own_listing_details(workspace_id,property_id);

COMMIT;
