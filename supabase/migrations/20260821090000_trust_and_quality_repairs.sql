-- Trust lifecycle and public quality repair.
-- Archive legacy careers/policy pages that older ingestion logic mistook for
-- individual opportunities. Records remain recoverable for audit purposes.
WITH archived AS (
  UPDATE public.opportunities
  SET status = 'closed',
      verification_status = 'archived',
      confidence = 'low',
      updated_at = now()
  WHERE is_demo = false
    AND verification_status <> 'archived'
    AND (
      lower(trim(title)) ~ '^(how we hire|hiring process|applicant privacy( policy)?|candidate privacy( policy)?|search for your career|careers?|jobs?|vacancies|job alerts?)\.?$'
      OR lower(official_source_url) ~ '/(privacy|polic(y|ies)|how-we-hire|hiring-process|job-alerts?|candidate|applicant)(/|$)'
    )
  RETURNING id
)
UPDATE public.pulse_events
SET verification_status = 'archived',
    importance = 0,
    updated_at = now()
WHERE entity_type = 'opportunity'
  AND entity_id IN (SELECT id FROM archived);

UPDATE public.opportunities
SET status = 'closed',
    verification_status = 'closed',
    updated_at = now()
WHERE is_demo = false
  AND application_deadline IS NOT NULL
  AND application_deadline < current_date
  AND status IN ('open', 'closing_soon', 'possibly_open', 'rolling');

CREATE INDEX IF NOT EXISTS opportunities_public_quality_idx
  ON public.opportunities (is_demo, status, verification_status, application_deadline);

CREATE INDEX IF NOT EXISTS record_sources_source_checked_idx
  ON public.record_sources (source_id, last_checked_at DESC);

CREATE INDEX IF NOT EXISTS sources_refresh_due_idx
  ON public.sources (active, status, last_success_at);
