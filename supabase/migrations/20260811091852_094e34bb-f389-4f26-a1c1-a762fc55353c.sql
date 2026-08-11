CREATE TABLE IF NOT EXISTS public.pipeline_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.pipeline_settings TO authenticated;
GRANT ALL ON public.pipeline_settings TO service_role;

ALTER TABLE public.pipeline_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pipeline settings" ON public.pipeline_settings;
CREATE POLICY "Admins manage pipeline settings"
  ON public.pipeline_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS touch_pipeline_settings ON public.pipeline_settings;
CREATE TRIGGER touch_pipeline_settings BEFORE UPDATE ON public.pipeline_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.pipeline_settings (key, value)
VALUES ('schedule', '{
  "backlog_threshold": 25,
  "backlog_batch_size": 8,
  "steady_batch_size": 4,
  "backlog_interval_minutes": 10,
  "steady_interval_minutes": 30,
  "refresh_hours": {
    "vacancies": 24,
    "projects": 72,
    "events": 72,
    "programmes": 168,
    "courses": 168,
    "publications": 168,
    "people": 720,
    "department": 720,
    "research_groups": 720,
    "research": 720,
    "default": 720
  },
  "discovery_days": 30,
  "adaptive_backoff_max": 2
}'::jsonb)
ON CONFLICT (key) DO NOTHING;