-- Public vacancy quality repair.
-- Obvious career/marketing pages are archived. Other low-confidence discoveries
-- remain recoverable in the review queue but no longer appear as live calls.
WITH archived AS (
  UPDATE public.opportunities
  SET status = 'archived',
      verification_status = 'archived',
      confidence = 'low',
      updated_at = now()
  WHERE is_demo = false
    AND verification_status <> 'archived'
    AND (
      lower(title) ~ '(academy|careers? in|working at|employee stor(y|ies)|learning (&|and) development|leadership track|u[.]?gro programme|talent community|where we work|how we hire|our people|graduate programme|programme careers?)'
      OR lower(official_source_url) ~ '/(academy|working-at|employee-stor(y|ies)|learning-development|u-gro|leadership-track|careers-in|talent-community)(/|$)'
    )
  RETURNING id
)
UPDATE public.pulse_events
SET verification_status = 'archived',
    importance = 0,
    updated_at = now()
WHERE entity_type = 'opportunity'
  AND entity_id IN (SELECT id FROM archived);

WITH quarantined AS (
  UPDATE public.opportunities
  SET verification_status = 'needs_review',
      updated_at = now()
  WHERE is_demo = false
    AND confidence = 'low'
    AND verification_status IN ('auto_discovered', 'possibly_outdated', 'unverified')
  RETURNING id
)
UPDATE public.pulse_events
SET verification_status = 'needs_review',
    importance = LEAST(importance, 1),
    updated_at = now()
WHERE entity_type = 'opportunity'
  AND entity_id IN (SELECT id FROM quarantined);
