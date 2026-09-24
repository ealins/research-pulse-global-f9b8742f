CREATE OR REPLACE FUNCTION public.public_surface_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'institutions', (
      SELECT count(*) FROM public.institutions i
      WHERE i.is_demo = false
        AND i.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    ),
    'researchers', (
      SELECT count(*) FROM public.researchers r
      WHERE r.is_demo = false
        AND r.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    ),
    'opportunities', (
      SELECT count(*) FROM public.opportunities o
      WHERE o.is_demo = false
        AND o.status IN ('open', 'closing_soon', 'rolling', 'possibly_open')
        AND o.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
        AND o.confidence IN ('high', 'medium')
        AND o.official_source_url IS NOT NULL
    ),
    'publications', (
      SELECT count(*) FROM public.publications p
      WHERE p.is_demo = false
        AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    ),
    'projects', (
      SELECT count(*) FROM public.projects p
      WHERE p.is_demo = false
        AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    ),
    'events', (
      SELECT count(*) FROM public.events e
      WHERE e.is_demo = false
        AND e.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    ),
    'courses', (
      SELECT count(*) FROM public.courses c
      WHERE c.is_demo = false
        AND c.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    )
  );
$$;
