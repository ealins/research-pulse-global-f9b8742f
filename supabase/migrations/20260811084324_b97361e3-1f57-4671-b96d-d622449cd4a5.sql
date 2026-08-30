CREATE TABLE public.pipeline_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger text NOT NULL DEFAULT 'cron',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  tasks_processed integer NOT NULL DEFAULT 0,
  tasks_ok integer NOT NULL DEFAULT 0,
  tasks_failed integer NOT NULL DEFAULT 0,
  tasks_dead integer NOT NULL DEFAULT 0,
  fetch_enqueued integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  nvidia_calls integer NOT NULL DEFAULT 0,
  nvidia_cached integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pipeline_runs TO authenticated;
GRANT ALL ON public.pipeline_runs TO service_role;

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read pipeline runs"
ON public.pipeline_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX pipeline_runs_started_at_idx ON public.pipeline_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.scheduler_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, cron
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT coalesce(jsonb_agg(j), '[]'::jsonb) INTO result
  FROM (
    SELECT c.jobname,
           c.schedule,
           c.active,
           (SELECT max(d.start_time) FROM cron.job_run_details d WHERE d.jobid = c.jobid) AS last_run_at,
           (SELECT d.status FROM cron.job_run_details d WHERE d.jobid = c.jobid ORDER BY d.start_time DESC LIMIT 1) AS last_status,
           (SELECT d.return_message FROM cron.job_run_details d WHERE d.jobid = c.jobid ORDER BY d.start_time DESC LIMIT 1) AS last_message,
           (SELECT count(*) FROM cron.job_run_details d WHERE d.jobid = c.jobid AND d.start_time > now() - interval '24 hours') AS runs_24h
    FROM cron.job c
  ) j;

  RETURN result;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  RETURN '[]'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.scheduler_status() FROM public;
GRANT EXECUTE ON FUNCTION public.scheduler_status() TO authenticated;

