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
    UNION
    SELECT p.id AS record_id,
           pi.institution_id,
           p.website AS evidence_url
    FROM public.projects p
    JOIN public.project_institutions pi ON pi.project_id = p.id
    WHERE p.is_demo = false
      AND p.website IS NOT NULL
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
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

REVOKE EXECUTE ON FUNCTION public.refresh_collaboration_edges() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_public_insights() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.refresh_collaboration_edges() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_public_insights() TO service_role;

REVOKE EXECUTE ON FUNCTION public.public_surface_counts() FROM public;
GRANT EXECUTE ON FUNCTION public.public_surface_counts() TO anon, authenticated, service_role;

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

