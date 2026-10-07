create or replace function public.public_surface_counts()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select jsonb_build_object(
    'institutions', (select count(*) from public.institutions i where i.is_demo=false and i.verification_status in ('verified','auto_discovered','possibly_outdated')),
    'researchers', (select count(*) from public.researchers r where r.is_demo=false and r.verification_status in ('verified','auto_discovered','possibly_outdated')),
    'opportunities', (
      select count(*) from public.opportunities o
      where o.is_demo=false
        and o.status in ('open','closing_soon','rolling','possibly_open')
        and o.verification_status in ('verified','auto_discovered','possibly_outdated')
        and o.confidence in ('high','medium')
        and o.official_source_url is not null
        and (
          lower(o.official_source_url) ~ '/(jobs?|vacancies|careers|recruitment)(/|$)'
          or lower(o.title) ~ '(phd|postdoc|doctoral|research assistant|research associate|research scientist|research fellow|scientist|engineer|developer|analyst|professor|lecturer|faculty|fellowship|fellow|intern|technician|manager|coordinator|officer|specialist|principal|director|assistant professor|associate professor)'
        )
        and lower(o.official_source_url) !~ '/(privacy|policy|policies|how-we-hire|hiring-process|job-alerts?|candidate|applicant|job-openings?|employment-opportunities?|employment|opportunities?|job_opportunities)(/|$)'
    ),
    'publications', (select count(*) from public.publications p where p.is_demo=false and p.verification_status in ('verified','auto_discovered','possibly_outdated')),
    'projects', (select count(*) from public.projects p where p.is_demo=false and p.verification_status in ('verified','auto_discovered','possibly_outdated')),
    'events', (select count(*) from public.events e where e.is_demo=false and e.verification_status in ('verified','auto_discovered','possibly_outdated') and e.confidence in ('high','medium')),
    'courses', (select count(*) from public.courses c where c.is_demo=false and c.verification_status in ('verified','auto_discovered','possibly_outdated'))
  );
$$;

grant execute on function public.public_surface_counts() to anon, authenticated, service_role;
