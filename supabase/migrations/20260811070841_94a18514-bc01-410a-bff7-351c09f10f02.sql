-- 1. Controlled taxonomy (idempotent)
INSERT INTO public.research_topics (name, slug, category, description) VALUES
  ('Geomatics','geomatics','core','Measurement, mapping and management of spatial information.'),
  ('UAV Mapping','uav-mapping','sensing','Drone-based image acquisition and mapping workflows.'),
  ('3D GIS','3d-gis','urban','Three-dimensional geographic information systems and analysis.'),
  ('Urban Digital Twins','urban-digital-twins','urban','Live, semantically rich digital replicas of cities.'),
  ('Environmental Remote Sensing','environmental-remote-sensing','core','Monitoring of environment, vegetation, water and climate from sensors.'),
  ('Foundation Models for Earth Observation','foundation-models-earth-observation','ai','Large pre-trained models applied to Earth observation data.'),
  ('Multimodal Earth Observation','multimodal-earth-observation','ai','Joint use of optical, radar, LiDAR and text modalities for EO.')
ON CONFLICT (slug) DO NOTHING;

-- 2. Additive columns on existing sources table
ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS discovered_from text,
  ADD COLUMN IF NOT EXISTS last_http_status integer;

CREATE UNIQUE INDEX IF NOT EXISTS sources_url_key ON public.sources (url);

-- 3. Additive columns on existing raw_records (raw page storage)
ALTER TABLE public.raw_records
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS text_content text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric,
  ADD COLUMN IF NOT EXISTS normalization_status text,
  ADD COLUMN IF NOT EXISTS normalization_error text,
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS raw_records_source_idx ON public.raw_records (source_id);
CREATE INDEX IF NOT EXISTS raw_records_classification_idx ON public.raw_records (classification);

-- 4. Ingestion queue
CREATE TABLE IF NOT EXISTS public.ingestion_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  source_id uuid REFERENCES public.sources(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ingestion_tasks TO authenticated;
GRANT ALL ON public.ingestion_tasks TO service_role;
ALTER TABLE public.ingestion_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read ingestion tasks" ON public.ingestion_tasks;
CREATE POLICY "Admins read ingestion tasks" ON public.ingestion_tasks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS ingestion_tasks_status_idx ON public.ingestion_tasks (status, run_after);

DROP TRIGGER IF EXISTS touch_ingestion_tasks ON public.ingestion_tasks;
CREATE TRIGGER touch_ingestion_tasks BEFORE UPDATE ON public.ingestion_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Academic change log
CREATE TABLE IF NOT EXISTS public.academic_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academic_changes TO anon;
GRANT SELECT ON public.academic_changes TO authenticated;
GRANT ALL ON public.academic_changes TO service_role;
ALTER TABLE public.academic_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academic changes are public" ON public.academic_changes;
CREATE POLICY "Academic changes are public" ON public.academic_changes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write academic changes" ON public.academic_changes;
CREATE POLICY "Admins write academic changes" ON public.academic_changes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS academic_changes_dedupe_idx
  ON public.academic_changes (change_type, entity_type, coalesce(entity_id,'00000000-0000-0000-0000-000000000000'::uuid));