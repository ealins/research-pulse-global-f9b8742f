-- Global search: match institutions by city/country as well as name.
-- Fixes searches like "Munich" that refer to an institution's location.
-- Forward-only; safe to re-apply.

CREATE OR REPLACE FUNCTION public.global_search(q text, max_results integer DEFAULT 20)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  slug text,
  title text,
  subtitle text,
  score real
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH needle AS (SELECT btrim(q) AS n)
  SELECT * FROM (
    SELECT 'institution'::text, i.id, i.slug, i.name,
           concat_ws(', ', i.city, i.country),
           similarity(i.name, (SELECT n FROM needle))
             + CASE WHEN i.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
             + CASE WHEN coalesce(i.city,'') ILIKE '%'||(SELECT n FROM needle)||'%'
                      OR coalesce(i.country,'') ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.2 ELSE 0 END
    FROM public.institutions i
    WHERE i.is_demo = false
      AND i.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND (
        EXISTS (SELECT 1 FROM public.institution_topics it WHERE it.institution_id = i.id)
        OR EXISTS (SELECT 1 FROM public.researcher_topics rt JOIN public.researchers r ON r.id = rt.researcher_id WHERE r.institution_id = i.id AND r.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.project_topics pt JOIN public.projects p ON p.id = pt.project_id WHERE p.institution_id = i.id AND p.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.publication_topics pt JOIN public.publications p ON p.id = pt.publication_id WHERE p.institution_id = i.id AND p.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.course_topics ct JOIN public.courses c ON c.id = ct.course_id WHERE c.institution_id = i.id AND c.is_demo = false)
      )
      AND (i.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.abbreviation,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.city,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.country,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(i.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'researcher', r.id, r.slug, r.full_name, concat_ws(' — ', r.academic_title, i.name),
           similarity(r.full_name,(SELECT n FROM needle))
             + CASE WHEN r.full_name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.researchers r
    LEFT JOIN public.institutions i ON i.id = r.institution_id AND i.is_demo = false
    WHERE r.is_demo = false
      AND r.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.researcher_topics rt WHERE rt.researcher_id = r.id)
      AND (r.full_name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(r.full_name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'topic', t.id, t.slug, t.name, t.category,
           similarity(t.name,(SELECT n FROM needle))
             + CASE WHEN t.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.research_topics t
    WHERE t.active = true
      AND (t.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(t.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'opportunity', o.id, o.slug, o.title, concat_ws(' — ', i.name, o.country),
           similarity(o.title,(SELECT n FROM needle))
             + CASE WHEN o.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.opportunities o
    LEFT JOIN public.institutions i ON i.id = o.institution_id AND i.is_demo = false
    WHERE o.is_demo = false
      AND o.status IN ('open', 'closing_soon', 'rolling', 'possibly_open')
      AND o.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND o.confidence IN ('high', 'medium')
      AND o.official_source_url IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.opportunity_topics ot WHERE ot.opportunity_id = o.id)
      AND (o.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(o.title,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'programme', c.id, c.slug, c.title, concat_ws(' — ', c.degree_type, i.name),
           similarity(c.title,(SELECT n FROM needle))
             + CASE WHEN c.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.courses c
    LEFT JOIN public.institutions i ON i.id = c.institution_id AND i.is_demo = false
    WHERE c.is_demo = false
      AND c.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.course_topics ct WHERE ct.course_id = c.id)
      AND (c.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(c.title,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'project', p.id, p.slug, p.name, coalesce(p.acronym, i.name),
           similarity(p.name,(SELECT n FROM needle))
             + CASE WHEN p.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.projects p
    LEFT JOIN public.institutions i ON i.id = p.institution_id AND i.is_demo = false
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.project_topics pt WHERE pt.project_id = p.id)
      AND (p.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(p.acronym,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(p.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'publication', pb.id, pb.id::text, pb.title, concat_ws(' · ', pb.venue, pb.year::text),
           similarity(pb.title,(SELECT n FROM needle))
             + CASE WHEN pb.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.publications pb
    WHERE pb.is_demo = false
      AND pb.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.publication_topics pt WHERE pt.publication_id = pb.id)
      AND (pb.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(pb.title,(SELECT n FROM needle)) > 0.3)
    UNION ALL
    SELECT 'event', e.id, e.slug, e.title, concat_ws(' · ', e.organization, e.location),
           similarity(e.title,(SELECT n FROM needle))
             + CASE WHEN e.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.events e
    WHERE e.is_demo = false
      AND e.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.event_topics et WHERE et.event_id = e.id)
      AND (e.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(e.title,(SELECT n FROM needle)) > 0.25)
  ) s(entity_type, entity_id, slug, title, subtitle, score)
  WHERE (SELECT length(n) FROM needle) >= 2
  ORDER BY score DESC NULLS LAST
  LIMIT greatest(1, least(max_results, 50));
$$;
