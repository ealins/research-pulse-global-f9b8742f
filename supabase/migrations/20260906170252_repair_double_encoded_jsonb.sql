create or replace function geoacademic_engine.geoacademic_unwrap_canonical_data()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare parsed jsonb;
begin
  if pg_catalog.jsonb_typeof(new.data) = 'string' then
    begin
      parsed := (new.data #>> '{}')::jsonb;
      if pg_catalog.jsonb_typeof(parsed) in ('object','array') then
        new.data := parsed;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function geoacademic_engine.geoacademic_unwrap_signal_data()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare parsed jsonb;
begin
  if pg_catalog.jsonb_typeof(new.data) = 'string' then
    begin
      parsed := (new.data #>> '{}')::jsonb;
      if pg_catalog.jsonb_typeof(parsed) in ('object','array') then
        new.data := parsed;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function geoacademic_engine.geoacademic_unwrap_record_evidence()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare parsed jsonb;
begin
  if pg_catalog.jsonb_typeof(new.evidence) = 'string' then
    begin
      parsed := (new.evidence #>> '{}')::jsonb;
      if pg_catalog.jsonb_typeof(parsed) in ('object','array') then
        new.evidence := parsed;
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists aa_unwrap_canonical_data on geoacademic_engine.canonical_entities;
create trigger aa_unwrap_canonical_data
before insert or update of data on geoacademic_engine.canonical_entities
for each row execute function geoacademic_engine.geoacademic_unwrap_canonical_data();

drop trigger if exists aa_unwrap_signal_data on geoacademic_engine.signals;
create trigger aa_unwrap_signal_data
before insert or update of data on geoacademic_engine.signals
for each row execute function geoacademic_engine.geoacademic_unwrap_signal_data();

drop trigger if exists aa_unwrap_record_evidence on geoacademic_engine.record_sources;
create trigger aa_unwrap_record_evidence
before insert or update of evidence on geoacademic_engine.record_sources
for each row execute function geoacademic_engine.geoacademic_unwrap_record_evidence();

update geoacademic_engine.canonical_entities
set data = data
where pg_catalog.jsonb_typeof(data) = 'string';

update geoacademic_engine.signals
set data = data
where pg_catalog.jsonb_typeof(data) = 'string';

update geoacademic_engine.record_sources
set evidence = evidence
where pg_catalog.jsonb_typeof(evidence) = 'string';
