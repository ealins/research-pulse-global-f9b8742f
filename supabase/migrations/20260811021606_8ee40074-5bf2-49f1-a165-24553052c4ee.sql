
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  name text NOT NULL,
  organization text,
  source_type public.source_type NOT NULL DEFAULT 'other',
  adapter_key text,
  trust_level integer NOT NULL DEFAULT 3,
  refresh_frequency_hours integer NOT NULL DEFAULT 168,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sources_url_uq ON public.sources(url);

CREATE TABLE public.record_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  source_organization text,
  source_type public.source_type NOT NULL DEFAULT 'other',
  original_title text,
  claim text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_verified_at timestamptz,
  verification_status public.verification_status NOT NULL DEFAULT 'auto_discovered',
  confidence public.confidence_level NOT NULL DEFAULT 'low',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX record_sources_entity_idx ON public.record_sources(entity_type, entity_id);

CREATE TABLE public.raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  adapter_key text NOT NULL,
  external_id text,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  canonical_entity_type text,
  canonical_entity_id uuid
);
CREATE INDEX raw_records_adapter_idx ON public.raw_records(adapter_key, fetched_at DESC);

CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  adapter_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean,
  records_discovered integer NOT NULL DEFAULT 0,
  duplicates_detected integer NOT NULL DEFAULT 0,
  records_changed integer NOT NULL DEFAULT 0,
  records_closed integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_message text,
  response_time_ms integer
);
CREATE INDEX sync_runs_started_idx ON public.sync_runs(started_at DESC);

CREATE TABLE public.duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  primary_id uuid NOT NULL,
  duplicate_id uuid NOT NULL,
  match_reason text,
  score numeric,
  resolved boolean NOT NULL DEFAULT false,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.entity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  change_reason text,
  source_url text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entity_history_entity_idx ON public.entity_history(entity_type, entity_id, changed_at DESC);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log(created_at DESC);

CREATE TABLE public.entity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  metric text NOT NULL,
  value numeric,
  value_text text,
  metric_source text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, metric, metric_source)
);
CREATE INDEX entity_metrics_entity_idx ON public.entity_metrics(entity_type, entity_id);

CREATE TABLE public.topic_momentum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  pubs_last_12m integer NOT NULL DEFAULT 0,
  pubs_prev_12m integer NOT NULL DEFAULT 0,
  pubs_last_36m integer NOT NULL DEFAULT 0,
  active_projects integer NOT NULL DEFAULT 0,
  open_opportunities integer NOT NULL DEFAULT 0,
  institutions_active integer NOT NULL DEFAULT 0,
  growth_ratio numeric,
  trend_signal numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE TABLE public.pulse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.pulse_category NOT NULL,
  title text NOT NULL,
  summary text,
  entity_type text,
  entity_id uuid,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  researcher_id uuid REFERENCES public.researchers(id) ON DELETE SET NULL,
  country text,
  event_date timestamptz NOT NULL DEFAULT now(),
  importance integer NOT NULL DEFAULT 50,
  link_url text,
  source_url text,
  verification_status public.verification_status NOT NULL DEFAULT 'auto_discovered',
  confidence public.confidence_level NOT NULL DEFAULT 'low',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pulse_events_date_idx ON public.pulse_events(event_date DESC);
CREATE INDEX pulse_events_category_idx ON public.pulse_events(category);

CREATE TABLE public.pulse_event_topics (
  pulse_event_id uuid NOT NULL REFERENCES public.pulse_events(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (pulse_event_id, topic_id)
);

CREATE TABLE public.collaboration_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type text NOT NULL,
  source_entity_id uuid NOT NULL,
  target_entity_type text NOT NULL,
  target_entity_id uuid NOT NULL,
  edge_type text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  evidence_url text NOT NULL,
  verification_status public.verification_status NOT NULL DEFAULT 'auto_discovered',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collab_source_idx ON public.collaboration_edges(source_entity_type, source_entity_id);
CREATE INDEX collab_target_idx ON public.collaboration_edges(target_entity_type, target_entity_id);

DO $$
DECLARE t text;
BEGIN
  -- publicly readable provenance / analytics
  FOREACH t IN ARRAY ARRAY['sources','record_sources','entity_metrics','topic_momentum','pulse_events','pulse_event_topics','collaboration_edges'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public read %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "admins write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
  -- admin-only operational tables
  FOREACH t IN ARRAY ARRAY['raw_records','sync_runs','duplicate_candidates','entity_history','audit_log'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admins only %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['sources','record_sources','pulse_events','collaboration_edges'] LOOP
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;
