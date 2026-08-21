-- Keep operational crawler state private while preserving a deliberately
-- small, read-only provenance surface for the public application.

BEGIN;

CREATE OR REPLACE VIEW public.public_record_sources
WITH (security_barrier = true)
AS
SELECT
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
FROM public.record_sources;

CREATE OR REPLACE VIEW public.public_source_registry
WITH (security_barrier = true)
AS
SELECT
  id,
  name,
  url,
  organization,
  source_type,
  trust_level,
  refresh_frequency_hours,
  active
FROM public.sources;

REVOKE ALL ON public.public_record_sources FROM PUBLIC;
REVOKE ALL ON public.public_source_registry FROM PUBLIC;
GRANT SELECT ON public.public_record_sources TO anon, authenticated, service_role;
GRANT SELECT ON public.public_source_registry TO anon, authenticated, service_role;

-- Avoid recursive role checks by making the user_roles SELECT policy a simple
-- ownership check. has_role can then run as the caller instead of bypassing RLS.
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    auth.role() = 'service_role'
    OR (
      _user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Public counts only read tables that already have public SELECT policies, so
-- they do not need owner privileges.
ALTER FUNCTION public.public_surface_counts() SECURITY INVOKER;

-- Add a service-role-only bootstrap variant alongside the legacy zero-argument
-- function. The legacy function is removed by the contract migration after
-- the compatible application release is live.
-- The application server validates ADMIN_BOOTSTRAP_EMAILS before invoking it;
-- the database independently verifies the confirmed account email and the
-- single-use owner address stored in pipeline_settings.
CREATE OR REPLACE FUNCTION public.claim_admin_if_unclaimed(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email text;
  owner_email text;
  disabled boolean;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  SELECT (value #>> '{}')::boolean INTO disabled
  FROM public.pipeline_settings
  WHERE key = 'admin_bootstrap_disabled';
  IF coalesce(disabled, true) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    UPDATE public.pipeline_settings
    SET value = 'true'::jsonb, updated_at = now()
    WHERE key = 'admin_bootstrap_disabled';
    RETURN false;
  END IF;

  SELECT value #>> '{}' INTO owner_email
  FROM public.pipeline_settings
  WHERE key = 'owner_email';

  SELECT lower(email) INTO caller_email
  FROM auth.users
  WHERE id = target_user_id AND email_confirmed_at IS NOT NULL;

  IF owner_email IS NULL OR caller_email IS NULL OR caller_email <> lower(owner_email) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  UPDATE public.pipeline_settings
  SET value = 'true'::jsonb, updated_at = now()
  WHERE key = 'admin_bootstrap_disabled';

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_if_unclaimed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_unclaimed(uuid) TO service_role;

COMMIT;
