-- Prevent future canonical duplicate title/source records when external keys drift.
create unique index if not exists canonical_entities_title_source_uq
on geoacademic_engine.canonical_entities (
  entity_type,
  lower(btrim(title)),
  source_url
)
where source_url is not null;
