-- Contract the compatibility window opened by the preceding migration after
-- the application has switched to the public-safe views and service RPCs.

BEGIN;

DROP POLICY IF EXISTS "public read entity_metrics" ON public.entity_metrics;
DROP POLICY IF EXISTS "Academic changes are public" ON public.academic_changes;

REVOKE ALL ON public.sources FROM anon, authenticated;
REVOKE ALL ON public.record_sources FROM anon, authenticated;
REVOKE ALL ON public.entity_metrics FROM anon, authenticated;
REVOKE ALL ON public.academic_changes FROM anon, authenticated;

-- The caller-level public views need only these columns. Keeping the existing
-- public SELECT policies while narrowing SQL privileges prevents direct access
-- to adapter keys, crawler state, errors, notes and source foreign keys.
GRANT SELECT (
  id,
  name,
  url,
  organization,
  source_type,
  trust_level,
  refresh_frequency_hours,
  active
) ON public.sources TO anon, authenticated;

GRANT SELECT (
  id,
  entity_type,
  entity_id,
  source_url,
  source_organization,
  source_type,
  original_title,
  claim,
  discovered_at,
  last_checked_at,
  last_verified_at,
  verification_status,
  confidence,
  is_primary
) ON public.record_sources TO anon, authenticated;

-- Scheduler inspection is performed by the authenticated application server
-- after its own admin check. Browser roles never need direct RPC access.
REVOKE ALL ON FUNCTION public.scheduler_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduler_status() TO service_role;

-- The compatible application calls the target-user overload with the service
-- role, so the old browser-callable bootstrap is no longer needed.
DROP FUNCTION IF EXISTS public.claim_admin_if_unclaimed();

COMMIT;
