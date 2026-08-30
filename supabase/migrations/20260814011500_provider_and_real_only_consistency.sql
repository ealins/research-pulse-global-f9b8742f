-- GeoAcademic v7: strict public truth surfaces.
-- Demo rows remain in the database for internal/history purposes, but public
-- global search and momentum analytics must only aggregate source-backed rows.

CREATE OR REPLACE FUNCTION public.global_search(q text, max_results integer DEFAULT 20)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  slug text,
  title text,
  subtitle text,
  score real
)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  WITH needle AS (SELECT btrim(q) AS n)
  SELECT * FROM (
    SELECT 'institution'::text, i.id, i.slug, i.name,
           concat_ws(', ', i.city, i.country),
           similarity(i.name, (SELECT n FROM needle)) + CASE WHEN i.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.institutions i
    WHERE i.is_demo = false
      AND (i.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.abbreviation,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(i.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'researcher', r.id, r.slug, r.full_name, concat_ws(' — ', r.academic_title, i.name),
           similarity(r.full_name,(SELECT n FROM needle)) + CASE WHEN r.full_name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.researchers r
    LEFT JOIN public.institutions i ON i.id = r.institution_id AND i.is_demo = false
    WHERE r.is_demo = false
      AND (r.full_name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(r.full_name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'topic', t.id, t.slug, t.name, t.category,
           similarity(t.name,(SELECT n FROM needle)) + CASE WHEN t.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.research_topics t
    WHERE t.name ILIKE '%'||(SELECT n FROM needle)||'%'
       OR similarity(t.name,(SELECT n FROM needle)) > 0.25
    UNION ALL
    SELECT 'opportunity', o.id, o.slug, o.title, concat_ws(' — ', i.name, o.country),
           similarity(o.title,(SELECT n FROM needle)) + CASE WHEN o.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.opportunities o
    LEFT JOIN public.institutions i ON i.id = o.institution_id AND i.is_demo = false
    WHERE o.is_demo = false
      AND (o.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(o.title,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'project', p.id, p.slug, p.name, coalesce(p.acronym, i.name),
           similarity(p.name,(SELECT n FROM needle)) + CASE WHEN p.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.projects p
    LEFT JOIN public.institutions i ON i.id = p.institution_id AND i.is_demo = false
    WHERE p.is_demo = false
      AND (p.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(p.acronym,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(p.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'publication', pb.id, pb.id::text, pb.title, concat_ws(' · ', pb.venue, pb.year::text),
           similarity(pb.title,(SELECT n FROM needle)) + CASE WHEN pb.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.publications pb
    WHERE pb.is_demo = false
      AND (pb.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(pb.title,(SELECT n FROM needle)) > 0.3)
    UNION ALL
    SELECT 'event', e.id, e.slug, e.title, concat_ws(' · ', e.organization, e.location),
           similarity(e.title,(SELECT n FROM needle)) + CASE WHEN e.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.events e
    WHERE e.is_demo = false
      AND (e.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(e.title,(SELECT n FROM needle)) > 0.25)
  ) s(entity_type, entity_id, slug, title, subtitle, score)
  WHERE (SELECT length(n) FROM needle) >= 2
  ORDER BY score DESC NULLS LAST
  LIMIT greatest(1, least(max_results, 50));
$$;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_topic_momentum()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE affected integer;
BEGIN
  INSERT INTO public.topic_momentum (
    topic_id, pubs_last_12m, pubs_prev_12m, pubs_last_36m,
    active_projects, open_opportunities, institutions_active,
    growth_ratio, trend_signal, computed_at
  )
  SELECT t.id,
    coalesce(p12.c,0), coalesce(pprev.c,0), coalesce(p36.c,0),
    coalesce(pr.c,0), coalesce(op.c,0), coalesce(inst.c,0),
    CASE WHEN coalesce(pprev.c,0) = 0 THEN NULL ELSE round(coalesce(p12.c,0)::numeric / pprev.c, 3) END,
    round(
      (coalesce(p12.c,0) - coalesce(pprev.c,0))::numeric / greatest(1, coalesce(pprev.c,0))
      + 0.5 * coalesce(pr.c,0) + 0.5 * coalesce(op.c,0)
    , 3),
    now()
  FROM public.research_topics t
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.publication_date >= (current_date - interval '12 months')
    GROUP BY 1
  ) p12 ON p12.topic_id = t.id
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.publication_date >= (current_date - interval '24 months')
      AND p.publication_date < (current_date - interval '12 months')
    GROUP BY 1
  ) pprev ON pprev.topic_id = t.id
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.publication_date >= (current_date - interval '36 months')
    GROUP BY 1
  ) p36 ON p36.topic_id = t.id
  LEFT JOIN (
    SELECT prt.topic_id, count(*) c
    FROM public.project_topics prt
    JOIN public.projects pj ON pj.id = prt.project_id
    WHERE pj.is_demo = false AND pj.status = 'active'
    GROUP BY 1
  ) pr ON pr.topic_id = t.id
  LEFT JOIN (
    SELECT ot.topic_id, count(*) c
    FROM public.opportunity_topics ot
    JOIN public.opportunities o ON o.id = ot.opportunity_id
    WHERE o.is_demo = false AND o.status IN ('open','closing_soon','rolling')
    GROUP BY 1
  ) op ON op.topic_id = t.id
  LEFT JOIN (
    SELECT it.topic_id, count(DISTINCT it.institution_id) c
    FROM public.institution_topics it
    JOIN public.institutions i ON i.id = it.institution_id
    WHERE i.is_demo = false
    GROUP BY 1
  ) inst ON inst.topic_id = t.id
  ON CONFLICT (topic_id) DO UPDATE SET
    pubs_last_12m = EXCLUDED.pubs_last_12m,
    pubs_prev_12m = EXCLUDED.pubs_prev_12m,
    pubs_last_36m = EXCLUDED.pubs_last_36m,
    active_projects = EXCLUDED.active_projects,
    open_opportunities = EXCLUDED.open_opportunities,
    institutions_active = EXCLUDED.institutions_active,
    growth_ratio = EXCLUDED.growth_ratio,
    trend_signal = EXCLUDED.trend_signal,
    computed_at = now();
  SELECT count(*) INTO affected FROM public.topic_momentum;
  RETURN affected;
END; $$;
REVOKE EXECUTE ON FUNCTION public.refresh_topic_momentum() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.refresh_topic_momentum() TO service_role;

