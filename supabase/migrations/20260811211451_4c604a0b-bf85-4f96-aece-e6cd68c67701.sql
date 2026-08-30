create or replace function public.claim_admin_if_unclaimed()
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return public.has_role(uid, 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
  return true;
end; $$;

revoke all on function public.claim_admin_if_unclaimed() from public, anon;
grant execute on function public.claim_admin_if_unclaimed() to authenticated;
