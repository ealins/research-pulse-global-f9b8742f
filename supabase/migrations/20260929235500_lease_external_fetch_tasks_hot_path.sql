create index if not exists ingestion_tasks_normalize_vacancy_status_due_idx
  on public.ingestion_tasks (status, run_after)
  where task_type = 'NORMALIZE'
    and payload->>'classification' = 'VACANCY';

create or replace function public.lease_external_fetch_tasks(p_limit integer default 8)
returns table (
  task_id uuid,
  source_id uuid,
  lease_started_at timestamptz,
  url text,
  adapter_key text,
  category text,
  institution_id uuid,
  refresh_frequency_hours integer,
  attempt integer,
  max_attempts integer
)
language sql
set search_path = public
as $$
  with stale as (
    update public.ingestion_tasks
       set status = case when attempts >= max_attempts then 'DEAD' else 'RETRY' end,
           last_error = 'External fetch lease expired before completion',
           run_after = now(),
           started_at = null,
           updated_at = now()
     where task_type = 'FETCH'
       and status = 'PROCESSING'
       and started_at < now() - interval '15 minutes'
    returning id
  ),
  candidates as (
    select t.id
      from public.ingestion_tasks t
      join public.sources s on s.id = t.source_id
     where t.task_type = 'FETCH'
       and t.status in ('QUEUED','RETRY')
       and t.run_after <= now()
       and s.active is distinct from false
       and s.status is distinct from 'BLOCKED'
     order by t.run_after desc
     limit least(20, greatest(1, coalesce(p_limit, 8)))
     for update of t skip locked
  ),
  claimed as (
    update public.ingestion_tasks t
       set status = 'PROCESSING',
           attempts = t.attempts + 1,
           started_at = now(),
           last_error = null,
           updated_at = now()
      from candidates c
     where t.id = c.id
    returning t.id, t.source_id, t.started_at, t.attempts, t.max_attempts
  )
  select c.id,
         c.source_id,
         c.started_at,
         s.url,
         s.adapter_key,
         s.category,
         s.institution_id,
         s.refresh_frequency_hours,
         c.attempts,
         c.max_attempts
    from claimed c
    join public.sources s on s.id = c.source_id
   order by c.started_at;
$$;

revoke all on function public.lease_external_fetch_tasks(integer) from public;
grant execute on function public.lease_external_fetch_tasks(integer) to service_role;