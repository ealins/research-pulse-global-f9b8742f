ALTER TABLE source_registry
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS access_method text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS parent_source_id uuid REFERENCES source_registry(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS content_scope text NOT NULL DEFAULT 'fresh';

CREATE INDEX IF NOT EXISTS source_registry_due_adapter_idx
  ON source_registry(next_check_at, id)
  WHERE active=true AND source_kind='adapter';

CREATE INDEX IF NOT EXISTS source_registry_content_expiry_idx
  ON source_registry(created_at)
  WHERE source_kind='content';

CREATE INDEX IF NOT EXISTS source_registry_parent_idx
  ON source_registry(parent_source_id);

CREATE UNIQUE INDEX IF NOT EXISTS source_registry_external_id_uq
  ON source_registry(external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT 'signal';

CREATE INDEX IF NOT EXISTS signals_expiry_idx
  ON signals(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS canonical_entity_retention_idx
  ON canonical_entities(entity_type, last_seen_at);

-- Canonical entities are intentionally retained for institutions/researchers/topics.
-- Time-sensitive entities are filtered by the public view and physically purged
-- only after a grace period by retention.py.
CREATE OR REPLACE VIEW latest_public_entities AS
SELECT e.*
FROM canonical_entities e
WHERE e.verification_status IN ('verified','auto_discovered','possibly_outdated')
  AND e.confidence >= 0.60
  AND (
    e.entity_type IN ('institution','researcher','topic','programme')
    OR (
      e.entity_type='publication'
      AND coalesce(e.published_at,e.last_changed_at) >= now() - interval '365 days'
    )
    OR (
      e.entity_type='opportunity'
      AND (
        (nullif(e.data->>'application_deadline','') IS NULL
          AND e.last_changed_at >= now() - interval '30 days')
        OR (nullif(e.data->>'application_deadline','') IS NOT NULL
          AND nullif(e.data->>'application_deadline','')::date >= current_date - 14)
      )
    )
    OR (
      e.entity_type='event'
      AND (
        (nullif(e.data->>'end_date','') IS NOT NULL
          AND nullif(e.data->>'end_date','')::date >= current_date - 14)
        OR (nullif(e.data->>'end_date','') IS NULL
          AND nullif(e.data->>'start_date','') IS NOT NULL
          AND nullif(e.data->>'start_date','')::date >= current_date - 14)
        OR (nullif(e.data->>'end_date','') IS NULL
          AND nullif(e.data->>'start_date','') IS NULL
          AND e.last_changed_at >= now() - interval '30 days')
      )
    )
    OR (
      e.entity_type='project'
      AND e.last_changed_at >= now() - interval '90 days'
    )
  );
CREATE OR REPLACE VIEW live_public_signals AS
SELECT s.*
FROM signals s
WHERE s.verification_status IN ('verified','auto_discovered')
  AND s.confidence >= 0.60
  AND (
    s.expires_at IS NULL
    OR s.expires_at > now()
  );

-- Curated source adapters. These are definitions, not pages to crawl.
INSERT INTO source_registry(
  name,url,source_type,entity_hint,trust_level,refresh_interval_minutes,
  active,category,access_method,source_kind,config,retention_days,content_scope,next_check_at
) VALUES
(
  'Wikidata geospatial universities',
  'https://query.wikidata.org/sparql',
  'structured',
  'INSTITUTION',
  'official',
  10080,
  true,
  'institutions',
  'wikidata_sparql',
  'adapter',
  jsonb_build_object(
    'query', $wd$
SELECT DISTINCT ?university ?universityLabel ?website ?countryLabel ?lat ?lon WHERE {
  ?university wdt:P31/wdt:P279* wd:Q3918 .
  ?university wdt:P856 ?website .
  OPTIONAL { ?university wdt:P17 ?country . }
  OPTIONAL {
    ?university wdt:P625 ?coord .
    BIND(geof:latitude(?coord) AS ?lat)
    BIND(geof:longitude(?coord) AS ?lon)
  }
  OPTIONAL {
    ?university p:P5460 ?degreeStatement .
    ?degreeStatement pq:P812 ?major .
    VALUES ?majorRoot { wd:Q918779 wd:Q483130 wd:Q199687 wd:Q110745442 }
    ?major wdt:P279* ?majorRoot .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 500
$wd$
  ),
  30,
  'fresh',
  now()
),
(
  'OpenAlex geospatial publications',
  'https://api.openalex.org/works',
  'structured',
  'PUBLICATION',
  'official',
  360,
  true,
  'publications',
  'openalex',
  'adapter',
  jsonb_build_object(
    'search', 'geoinformatics OR photogrammetry OR remote sensing OR GIS OR lidar OR earth observation',
    'per_page', 100
  ),
  365,
  'fresh',
  now()
),
(
  'Crossref geospatial publications',
  'https://api.crossref.org/works',
  'structured',
  'PUBLICATION',
  'official',
  720,
  true,
  'publications',
  'crossref',
  'adapter',
  jsonb_build_object(
    'query', 'geoinformatics OR photogrammetry OR remote sensing OR GIS OR lidar OR earth observation',
    'rows', 100
  ),
  365,
  'fresh',
  now()
),
(
  'GitHub geospatial research software',
  'https://api.github.com/search/repositories',
  'structured',
  'PROJECT',
  'official',
  1440,
  true,
  'software',
  'github',
  'adapter',
  jsonb_build_object(
    'queries', jsonb_build_array('photogrammetry','remote sensing','earth observation','geoinformatics','lidar point cloud','spatial data infrastructure'),
    'per_page', 30
  ),
  60,
  'fresh',
  now()
),
(
  'arXiv geospatial research',
  'https://export.arxiv.org/api/query',
  'structured',
  'PUBLICATION',
  'official',
  720,
  true,
  'publications',
  'arxiv',
  'adapter',
  jsonb_build_object(
    'queries', jsonb_build_array('all:"geoinformatics"','all:"photogrammetry"','all:"remote sensing"','all:"earth observation"','all:"lidar"'),
    'max_results', 50
  ),
  365,
  'fresh',
  now()
),
(
  'Zenodo geospatial research outputs',
  'https://zenodo.org/api/records',
  'structured',
  'PROJECT',
  'official',
  1440,
  true,
  'datasets',
  'zenodo',
  'adapter',
  jsonb_build_object(
    'queries', jsonb_build_array('geoinformatics','photogrammetry','remote sensing','GIS','LiDAR','earth observation'),
    'size', 25
  ),
  90,
  'fresh',
  now()
)
ON CONFLICT (url) DO UPDATE SET
  name=excluded.name,
  source_type=excluded.source_type,
  entity_hint=excluded.entity_hint,
  trust_level=excluded.trust_level,
  refresh_interval_minutes=excluded.refresh_interval_minutes,
  active=true,
  category=excluded.category,
  access_method=excluded.access_method,
  source_kind='adapter',
  config=excluded.config,
  retention_days=excluded.retention_days,
  content_scope=excluded.content_scope,
  next_check_at=coalesce(source_registry.next_check_at, now());

-- Adapter rows must never become ordinary FETCH tasks.
UPDATE source_registry
SET source_kind='adapter'
WHERE access_method IN ('wikidata_sparql','openalex','crossref','github','arxiv','zenodo');
