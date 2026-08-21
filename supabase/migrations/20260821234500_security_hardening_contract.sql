-- Contract the compatibility window opened by the preceding migration after
-- the application has switched to the public-safe views and service RPCs.

BEGIN;

DROP POLICY IF EXISTS "public read sources" ON public.sources;
DROP POLICY IF EXISTS "public read record_sources" ON public.record_sources;
DROP POLICY IF EXISTS "public read entity_metrics" ON public.entity_metrics;
DROP POLICY IF EXISTS "Academic changes are public" ON public.academic_changes;

REVOKE ALL ON public.sources FROM anon, authenticated;
REVOKE ALL ON public.record_sources FROM anon, authenticated;
REVOKE ALL ON public.entity_metrics FROM anon, authenticated;
REVOKE ALL ON public.academic_changes FROM anon, authenticated;

-- Scheduler inspection is performed by the authenticated application server
-- after its own admin check. Browser roles never need direct RPC access.
REVOKE ALL ON FUNCTION public.scheduler_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduler_status() TO service_role;

-- The compatible application calls the target-user overload with the service
-- role, so the old browser-callable bootstrap is no longer needed.
DROP FUNCTION IF EXISTS public.claim_admin_if_unclaimed();

COMMIT;
