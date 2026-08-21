-- Cross-section maintenance for Monitor + Knowledge Base.
--
-- The public graph is evidence-only: an edge exists only when two tracked
-- institutions occur on the same sourced project or publication. Topic
-- overlap alone is deliberately not treated as collaboration.

CREATE OR REPLACE FUNCTION public.refresh_collaboration_edges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_edges integer := 0;
  publication_edges integer := 0;
BEGIN
  DELETE FROM public.collaboration_edges
  WHERE is_demo = false
    AND edge_type IN ('joint_project', 'co_publication');

  WITH participants AS (
    SELECT p.id AS record_id,
           p.institution_id,
           p.website AS evidence_url
    FROM public.projects p
    WHERE p.is_demo = false
      AND p.institution_id IS NOT NULL
      AND p.website IS NOT NULL
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.project_topics pt WHERE pt.project_id = p.id)
    UNION
    SELECT p.id AS record_id,
           pi.institution_id,
           p.website AS evidence_url
    FROM public.projects p
    JOIN public.project_institutions pi ON pi.project_id = p.id
    WHERE p.is_demo = false
      AND p.website IS NOT NULL
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.project_topics pt WHERE pt.project_id = p.id)
  ), pairs AS (
    SELECT a.institution_id AS source_id,
           b.institution_id AS target_id,
           count(DISTINCT a.record_id)::numeric AS weight,
           min(a.evidence_url) AS evidence_url
    FROM participants a
    JOIN participants b
      ON b.record_id = a.record_id
     AND a.institution_id::text < b.institution_id::text
    GROUP BY a.institution_id, b.institution_id
  )
  INSERT INTO public.collaboration_edges (
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id,
    edge_type,
    weight,
    evidence_url,
    verification_status,
    is_demo
  )
  SELECT 'institution', source_id, 'institution', target_id,
         'joint_project', weight, evidence_url, 'verified', false
  FROM pairs
  WHERE evidence_url IS NOT NULL;
  GET DIAGNOSTICS project_edges = ROW_COUNT;

  WITH participants AS (
    SELECT p.id AS record_id,
           p.institution_id,
           coalesce(
             nullif(p.landing_url, ''),
             CASE WHEN p.doi IS NOT NULL THEN 'https://doi.org/' || p.doi END
           ) AS evidence_url
    FROM public.publications p
    WHERE p.is_demo = false
      AND p.institution_id IS NOT NULL
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.publication_topics pt WHERE pt.publication_id = p.id)
    UNION
    SELECT p.id AS record_id,
           pi.institution_id,
           coalesce(
             nullif(p.landing_url, ''),
             CASE WHEN p.doi IS NOT NULL THEN 'https://doi.org/' || p.doi END
           ) AS evidence_url
    FROM public.publications p
    JOIN public.publication_institutions pi ON pi.publication_id = p.id
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.publication_topics pt WHERE pt.publication_id = p.id)
  ), pairs AS (
    SELECT a.institution_id AS source_id,
           b.institution_id AS target_id,
           count(DISTINCT a.record_id)::numeric AS weight,
           min(a.evidence_url) AS evidence_url
    FROM participants a
    JOIN participants b
      ON b.record_id = a.record_id
     AND a.institution_id::text < b.institution_id::text
    GROUP BY a.institution_id, b.institution_id
  )
  INSERT INTO public.collaboration_edges (
    source_entity_type,
    source_entity_id,
    target_entity_type,
    target_entity_id,
    edge_type,
    weight,
    evidence_url,
    verification_status,
    is_demo
  )
  SELECT 'institution', source_id, 'institution', target_id,
         'co_publication', weight, evidence_url, 'verified', false
  FROM pairs
  WHERE evidence_url IS NOT NULL;
  GET DIAGNOSTICS publication_edges = ROW_COUNT;

  RETURN jsonb_build_object(
    'project_edges', project_edges,
    'publication_edges', publication_edges,
    'edges', project_edges + publication_edges,
    'refreshed_at', now()
  );
END;
$$;

-- Rebuild momentum from the same verified public rows used by the UI. This
-- also removes inactive-topic snapshots so old imports cannot inflate trends.
CREATE OR REPLACE FUNCTION public.refresh_topic_momentum()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  DELETE FROM public.topic_momentum tm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.research_topics t
    WHERE t.id = tm.topic_id AND t.active = true
  );

  INSERT INTO public.topic_momentum (
    topic_id, pubs_last_12m, pubs_prev_12m, pubs_last_36m,
    active_projects, open_opportunities, institutions_active,
    growth_ratio, trend_signal, computed_at
  )
  SELECT t.id,
    coalesce(p12.c, 0), coalesce(pprev.c, 0), coalesce(p36.c, 0),
    coalesce(pr.c, 0), coalesce(op.c, 0), coalesce(inst.c, 0),
    CASE
      WHEN coalesce(pprev.c, 0) = 0 THEN NULL
      ELSE round(coalesce(p12.c, 0)::numeric / pprev.c, 3)
    END,
    round(
      (coalesce(p12.c, 0) - coalesce(pprev.c, 0))::numeric
        / greatest(1, coalesce(pprev.c, 0))
      + 0.5 * coalesce(pr.c, 0)
      + 0.5 * coalesce(op.c, 0),
      3
    ),
    now()
  FROM public.research_topics t
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND p.publication_date >= (current_date - interval '12 months')
    GROUP BY 1
  ) p12 ON p12.topic_id = t.id
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND p.publication_date >= (current_date - interval '24 months')
      AND p.publication_date < (current_date - interval '12 months')
    GROUP BY 1
  ) pprev ON pprev.topic_id = t.id
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.publication_topics pt
    JOIN public.publications p ON p.id = pt.publication_id
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND p.publication_date >= (current_date - interval '36 months')
    GROUP BY 1
  ) p36 ON p36.topic_id = t.id
  LEFT JOIN (
    SELECT pt.topic_id, count(*) c
    FROM public.project_topics pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE p.is_demo = false
      AND p.status = 'active'
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    GROUP BY 1
  ) pr ON pr.topic_id = t.id
  LEFT JOIN (
    SELECT ot.topic_id, count(*) c
    FROM public.opportunity_topics ot
    JOIN public.opportunities o ON o.id = ot.opportunity_id
    WHERE o.is_demo = false
      AND o.status IN ('open', 'closing_soon', 'rolling', 'possibly_open')
      AND o.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND o.confidence IN ('high', 'medium')
      AND o.official_source_url IS NOT NULL
    GROUP BY 1
  ) op ON op.topic_id = t.id
  LEFT JOIN (
    SELECT it.topic_id, count(DISTINCT it.institution_id) c
    FROM public.institution_topics it
    JOIN public.institutions i ON i.id = it.institution_id
    WHERE i.is_demo = false
      AND i.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
    GROUP BY 1
  ) inst ON inst.topic_id = t.id
  WHERE t.active = true
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

  SELECT count(*) INTO affected
  FROM public.topic_momentum tm
  JOIN public.research_topics t ON t.id = tm.topic_id
  WHERE t.active = true;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_public_insights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  momentum_topics integer;
  collaboration jsonb;
BEGIN
  momentum_topics := public.refresh_topic_momentum();
  collaboration := public.refresh_collaboration_edges();
  RETURN jsonb_build_object(
    'momentum_topics', momentum_topics,
    'collaboration', collaboration,
    'refreshed_at', now()
  );
END;
$$;

-- Consistent, relevance-gated counts for the public hub. This replaces seven
-- separate browser count requests with one small RPC response.
CREATE OR REPLACE FUNCTION public.public_surface_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
        AND EXISTS (
          SELECT 1 FROM public.researcher_topics rt WHERE rt.researcher_id = r.id
        )
    ),
    'opportunities', (
      SELECT count(*) FROM public.opportunities o
      WHERE o.is_demo = false
        AND o.status IN ('open', 'closing_soon', 'rolling', 'possibly_open')
        AND o.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
        AND o.confidence IN ('high', 'medium')
        AND o.official_source_url IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.opportunity_topics ot WHERE ot.opportunity_id = o.id
        )
    ),
    'publications', (
      SELECT count(*) FROM public.publications p
      WHERE p.is_demo = false
        AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
        AND EXISTS (
          SELECT 1 FROM public.publication_topics pt WHERE pt.publication_id = p.id
        )
    ),
    'projects', (
      SELECT count(*) FROM public.projects p
      WHERE p.is_demo = false
        AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
        AND EXISTS (
          SELECT 1 FROM public.project_topics pt WHERE pt.project_id = p.id
        )
    ),
    'events', (
      SELECT count(*) FROM public.events e
      WHERE e.is_demo = false
        AND e.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
        AND EXISTS (
          SELECT 1 FROM public.event_topics et WHERE et.event_id = e.id
        )
    )
  );
$$;

-- Search uses the same public contract as the list and detail surfaces. It
-- must never resurrect unclassified legacy rows that the catalogue hides.
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
SET search_path = public
AS $$
  WITH needle AS (SELECT btrim(q) AS n)
  SELECT * FROM (
    SELECT 'institution'::text, i.id, i.slug, i.name,
           concat_ws(', ', i.city, i.country),
           similarity(i.name, (SELECT n FROM needle))
             + CASE WHEN i.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
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

REVOKE EXECUTE ON FUNCTION public.refresh_collaboration_edges() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_topic_momentum() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_public_insights() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.refresh_topic_momentum() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_collaboration_edges() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_public_insights() TO service_role;

REVOKE EXECUTE ON FUNCTION public.public_surface_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.public_surface_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer) TO anon, authenticated, service_role;

-- Queue selectors and current-first public lists use these shapes repeatedly.
CREATE INDEX IF NOT EXISTS ingestion_tasks_type_status_due_idx
  ON public.ingestion_tasks (task_type, status, run_after);
CREATE INDEX IF NOT EXISTS ingestion_tasks_payload_gin_idx
  ON public.ingestion_tasks USING gin (payload jsonb_path_ops);
CREATE INDEX IF NOT EXISTS events_public_start_idx
  ON public.events (start_date)
  WHERE is_demo = false;
CREATE INDEX IF NOT EXISTS topics_active_name_idx
  ON public.research_topics (active, name);
