grant usage on schema geoacademic_engine to anon, authenticated;
grant select on geoacademic_engine.latest_public_entities, geoacademic_engine.live_public_signals to anon, authenticated;

alter function public.geoacademic_open_engine_latest(text, integer, text) security invoker;
alter function public.geoacademic_open_engine_pulse(integer, integer, text, text) security invoker;
alter function public.geoacademic_open_engine_entity(text, text) security invoker;
alter function public.geoacademic_open_engine_search(text, integer) security invoker;

revoke all on function public.geoacademic_open_engine_latest(text, integer, text) from public;
revoke all on function public.geoacademic_open_engine_pulse(integer, integer, text, text) from public;
revoke all on function public.geoacademic_open_engine_entity(text, text) from public;
revoke all on function public.geoacademic_open_engine_search(text, integer) from public;

grant execute on function public.geoacademic_open_engine_latest(text, integer, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_pulse(integer, integer, text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_entity(text, text) to anon, authenticated;
grant execute on function public.geoacademic_open_engine_search(text, integer) to anon, authenticated;
