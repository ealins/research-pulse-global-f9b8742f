CREATE TABLE public.llm_processing_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'NVIDIA',
  model text NOT NULL,
  operation text NOT NULL,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  raw_page_id uuid REFERENCES public.raw_records(id) ON DELETE SET NULL,
  content_hash text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'RUNNING',
  input_characters integer NOT NULL DEFAULT 0,
  output_characters integer NOT NULL DEFAULT 0,
  latency_ms integer,
  attempt integer NOT NULL DEFAULT 1,
  cached boolean NOT NULL DEFAULT false,
  content_reduced boolean NOT NULL DEFAULT false,
  http_status integer,
  error_code text,
  error_message text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.llm_processing_runs TO service_role;
GRANT SELECT ON public.llm_processing_runs TO authenticated;

ALTER TABLE public.llm_processing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read llm processing runs"
ON public.llm_processing_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX llm_runs_cache_idx ON public.llm_processing_runs (operation, model, content_hash, status);
CREATE INDEX llm_runs_recent_idx ON public.llm_processing_runs (created_at DESC);
CREATE INDEX llm_runs_source_idx ON public.llm_processing_runs (source_id);