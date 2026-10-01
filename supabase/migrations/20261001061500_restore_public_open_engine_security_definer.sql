-- Restore the public Open Engine read boundary for anonymous website visitors.
-- The curated read models remain read-only; SECURITY DEFINER is required because
-- their underlying projection tables are intentionally not directly public.
alter function public.geoacademic_open_engine_latest(text, integer, text)
  security definer
  set search_path = pg_catalog, public, geoacademic_engine;
alter function public.geoacademic_open_engine_pulse(integer, integer, text, text)
  security definer
  set search_path = pg_catalog, public, geoacademic_engine;
alter function public.geoacademic_open_engine_entity(text, text)
  security definer
  set search_path = pg_catalog, public, geoacademic_engine;
alter function public.geoacademic_open_engine_search(text, integer)
  security definer
  set search_path = pg_catalog, public, geoacademic_engine;

grant execute on function public.geoacademic_open_engine_latest(text, integer, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_pulse(integer, integer, text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_entity(text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_search(text, integer) to anon, authenticated;
