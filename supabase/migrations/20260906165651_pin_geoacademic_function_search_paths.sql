alter function geoacademic_engine.geoacademic_entity_slug(text, text)
  set search_path = geoacademic_engine, pg_catalog, public;
alter function geoacademic_engine.geoacademic_assign_entity_slug()
  set search_path = geoacademic_engine, pg_catalog, public;
alter function geoacademic_engine.geoacademic_scope_text_matches(text, jsonb)
  set search_path = geoacademic_engine, pg_catalog, public;
alter function geoacademic_engine.geoacademic_apply_scope_guard()
  set search_path = geoacademic_engine, pg_catalog, public;
alter function geoacademic_engine.geoacademic_sync_child_verification()
  set search_path = geoacademic_engine, pg_catalog, public;
