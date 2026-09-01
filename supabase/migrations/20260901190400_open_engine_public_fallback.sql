-- Public, read-only fallback for the GeoAcademic Open Engine.
-- These functions expose only the already-curated public read models and allow
-- the web app to remain available when the standalone Open Engine API is down.

create or replace function public.geoacademic_open_engine_latest(
  p_entity_type text,
  p_limit integer default 50,
  p_country text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, geoacademic_engine
as $$
  select jsonb_build_object(
    'entity_type', p_entity_type,
    'items', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  )
  from (
    select id, entity_type, external_key, slug, title, subtitle, country,
           latitude, longitude, verification_status, confidence, source_url,
           published_at, first_seen_at, last_seen_at, last_changed_at, data
    from geoacademic_engine.latest_public_entities
    where entity_type = p_entity_type
      and (p_country is null or country = p_country)
    order by coalesce(published_at, last_changed_at) desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) x;
$$;

create or replace function public.geoacademic_open_engine_pulse(
  p_hours integer default 24,
  p_limit integer default 50,
  p_country text default null,
  p_topic text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, geoacademic_engine
as $$
  select jsonb_build_object(
    'window_hours', least(greatest(coalesce(p_hours, 24), 1), 720),
    'items', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  )
  from (
    select id, signal_type, entity_id, entity_type, title, summary, country,
           topics, importance_score, confidence, verification_status,
           source_url, detected_at, published_at, expires_at, data
    from geoacademic_engine.live_public_signals
    where published_at >= now() - (
      least(greatest(coalesce(p_hours, 24), 1), 720) * interval '1 hour'
    )
      and (p_country is null or country = p_country)
      and (p_topic is null or p_topic = any(topics))
    order by importance_score desc, published_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) x;
$$;

create or replace function public.geoacademic_open_engine_entity(
  p_entity_type text,
  p_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, geoacademic_engine
as $$
  select to_jsonb(x)
  from (
    select id, entity_type, external_key, slug, title, subtitle, country,
           latitude, longitude, verification_status, confidence, source_url,
           published_at, first_seen_at, last_seen_at, last_changed_at, data
    from geoacademic_engine.latest_public_entities
    where entity_type = p_entity_type
      and slug = p_slug
    limit 1
  ) x;
$$;

create or replace function public.geoacademic_open_engine_search(
  p_query text,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, geoacademic_engine
as $$
  select jsonb_build_object(
    'query', p_query,
    'items', coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  )
  from (
    select id, entity_type, slug, title, subtitle, country,
           verification_status, confidence, source_url, data
    from geoacademic_engine.latest_public_entities
    where title ilike '%' || trim(p_query) || '%'
    order by coalesce(published_at, last_changed_at) desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ) x;
$$;

revoke all on function public.geoacademic_open_engine_latest(text, integer, text) from public;
revoke all on function public.geoacademic_open_engine_pulse(integer, integer, text, text) from public;
revoke all on function public.geoacademic_open_engine_entity(text, text) from public;
revoke all on function public.geoacademic_open_engine_search(text, integer) from public;

grant execute on function public.geoacademic_open_engine_latest(text, integer, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_pulse(integer, integer, text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_entity(text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_search(text, integer) to anon, authenticated;
