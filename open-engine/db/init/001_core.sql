CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  url text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'web',
  entity_hint text,
  trust_level text NOT NULL DEFAULT 'standard',
  refresh_interval_minutes integer NOT NULL DEFAULT 1440,
  active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canonical_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN (
    'institution','researcher','publication','project','programme','opportunity','event','topic'
  )),
  external_key text,
  slug text,
  title text NOT NULL,
  subtitle text,
  country text,
  latitude double precision,
  longitude double precision,
  verification_status text NOT NULL DEFAULT 'auto_discovered',
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_url text,
  published_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_entity_external_uq
  ON canonical_entities(entity_type, external_key)
  WHERE external_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS canonical_entity_slug_uq
  ON canonical_entities(entity_type, slug)
  WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS canonical_entity_latest_idx
  ON canonical_entities(entity_type, coalesce(published_at, last_changed_at) DESC);
CREATE INDEX IF NOT EXISTS canonical_entity_country_idx
  ON canonical_entities(country);
CREATE INDEX IF NOT EXISTS canonical_entity_title_trgm_idx
  ON canonical_entities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS canonical_entity_data_gin_idx
  ON canonical_entities USING gin (data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS canonical_entity_geom_idx
  ON canonical_entities USING gist (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  )
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS entity_topics (
  entity_id uuid NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  topic text NOT NULL,
  weight real NOT NULL DEFAULT 1,
  PRIMARY KEY(entity_id, topic)
);
CREATE INDEX IF NOT EXISTS entity_topics_topic_idx ON entity_topics(topic);

CREATE TABLE IF NOT EXISTS record_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES canonical_entities(id) ON DELETE CASCADE,
  source_id uuid REFERENCES source_registry(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  claim text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_verified_at timestamptz,
  verification_status text NOT NULL DEFAULT 'auto_discovered',
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  is_primary boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS record_sources_entity_idx ON record_sources(entity_id);
CREATE INDEX IF NOT EXISTS record_sources_url_idx ON record_sources(source_url);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id bigserial PRIMARY KEY,
  source_id uuid REFERENCES source_registry(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  object_key text,
  content_hash text NOT NULL,
  etag text,
  last_modified text,
  http_status integer,
  bytes integer,
  changed boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_snapshots_url_latest_idx
  ON source_snapshots(source_url, fetched_at DESC);
CREATE INDEX IF NOT EXISTS source_snapshots_hash_idx ON source_snapshots(content_hash);

CREATE TABLE IF NOT EXISTS signals (
  id bigserial PRIMARY KEY,
  signal_type text NOT NULL,
  entity_id uuid REFERENCES canonical_entities(id) ON DELETE SET NULL,
  entity_type text,
  title text NOT NULL,
  summary text,
  country text,
  topics text[] NOT NULL DEFAULT '{}',
  importance_score real NOT NULL DEFAULT 0 CHECK (importance_score >= 0 AND importance_score <= 100),
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  verification_status text NOT NULL DEFAULT 'auto_discovered',
  source_url text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS signals_latest_idx ON signals(published_at DESC);
CREATE INDEX IF NOT EXISTS signals_importance_idx ON signals(importance_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS signals_country_latest_idx ON signals(country, published_at DESC);
CREATE INDEX IF NOT EXISTS signals_topics_gin_idx ON signals USING gin(topics);
CREATE INDEX IF NOT EXISTS signals_data_gin_idx ON signals USING gin(data jsonb_path_ops);

CREATE TABLE IF NOT EXISTS ingestion_tasks (
  id bigserial PRIMARY KEY,
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','RETRY','DONE','DEAD')),
  priority integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingestion_tasks_due_idx
  ON ingestion_tasks(status, task_type, priority DESC, next_attempt_at, id)
  WHERE status IN ('QUEUED','RETRY');

CREATE OR REPLACE VIEW latest_public_entities AS
SELECT e.*
FROM canonical_entities e
WHERE e.verification_status IN ('verified','auto_discovered','possibly_outdated')
  AND e.confidence >= 0.60;

CREATE OR REPLACE VIEW live_public_signals AS
SELECT s.*
FROM signals s
WHERE s.verification_status IN ('verified','auto_discovered')
  AND s.confidence >= 0.60
  AND (s.expires_at IS NULL OR s.expires_at > now());
