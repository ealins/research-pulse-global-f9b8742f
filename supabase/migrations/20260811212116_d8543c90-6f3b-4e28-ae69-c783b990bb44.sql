insert into public.pipeline_settings (key, value)
values ('owner_email', '"ealinb4u@gmail.com"'::jsonb),
       ('admin_bootstrap_disabled', 'false'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.claim_admin_if_unclaimed()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_email text;
  owner_email text;
  disabled boolean;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  -- Already an admin? nothing to claim.
  if public.has_role(uid, 'admin') then
    return true;
  end if;

  select (value #>> '{}')::boolean into disabled
  from public.pipeline_settings where key = 'admin_bootstrap_disabled';
  if coalesce(disabled, true) then
    return false;
  end if;

  -- Bootstrap is single-use: any existing admin permanently closes it.
  if exists (select 1 from public.user_roles where role = 'admin') then
    update public.pipeline_settings set value = 'true'::jsonb, updated_at = now()
    where key = 'admin_bootstrap_disabled';
    return false;
  end if;

  select value #>> '{}' into owner_email from public.pipeline_settings where key = 'owner_email';
  select lower(email) into caller_email
  from auth.users where id = uid and email_confirmed_at is not null;

  if owner_email is null or caller_email is null or caller_email <> lower(owner_email) then
    return false;
  end if;

  insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
  update public.pipeline_settings set value = 'true'::jsonb, updated_at = now()
  where key = 'admin_bootstrap_disabled';
  return true;
end; $$;

revoke all on function public.claim_admin_if_unclaimed() from public, anon;
grant execute on function public.claim_admin_if_unclaimed() to authenticated;