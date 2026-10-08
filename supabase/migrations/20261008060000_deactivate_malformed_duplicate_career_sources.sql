-- Deactivate malformed HTML-encoded careers sources and duplicate active source URLs.
-- Preserve rows for auditability; only remove them from future crawling.
with ranked as (
  select id,
         row_number() over (
           partition by lower(trim(url))
           order by trust_level desc nulls last, id
         ) as rn
  from public.public_source_registry
  where active=true
    and source_type='careers_page'
)
update public.public_source_registry s
set active=false
from ranked r
where s.id=r.id
  and r.rn>1;

update public.public_source_registry
set active=false
where active=true
  and source_type='careers_page'
  and url like '%&amp;%';
