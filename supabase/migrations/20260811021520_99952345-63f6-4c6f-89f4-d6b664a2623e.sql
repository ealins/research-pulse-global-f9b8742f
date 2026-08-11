
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  acronym text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  status public.project_status NOT NULL DEFAULT 'unknown',
  funder_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  funding_organization text,
  funding_amount numeric,
  funding_currency text,
  website text,
  summary text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  confidence public.confidence_level NOT NULL DEFAULT 'low',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_institution_idx ON public.projects(institution_id);
CREATE INDEX projects_status_idx ON public.projects(status);

CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doi text,
  title text NOT NULL,
  normalized_title text,
  publication_date date,
  year integer,
  venue text,
  authors_text text,
  citation_count integer,
  citation_source text,
  is_open_access boolean,
  abstract text,
  source text,
  external_id text,
  landing_url text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  verification_status public.verification_status NOT NULL DEFAULT 'auto_discovered',
  confidence public.confidence_level NOT NULL DEFAULT 'medium',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX publications_doi_key ON public.publications(lower(doi)) WHERE doi IS NOT NULL;
CREATE UNIQUE INDEX publications_external_key ON public.publications(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX publications_year_idx ON public.publications(year DESC);
CREATE INDEX publications_date_idx ON public.publications(publication_date DESC);
CREATE INDEX publications_title_trgm ON public.publications USING gin (title gin_trgm_ops);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  normalized_title text,
  dedupe_key text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  research_group_id uuid REFERENCES public.research_groups(id) ON DELETE SET NULL,
  supervisor_id uuid REFERENCES public.researchers(id) ON DELETE SET NULL,
  supervisor_name text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  country text,
  city text,
  opportunity_type public.opportunity_type NOT NULL DEFAULT 'phd',
  description text,
  requirements text,
  funding_type text,
  salary_text text,
  start_date date,
  application_deadline date,
  application_url text,
  official_source_url text,
  first_discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  status public.opportunity_status NOT NULL DEFAULT 'possibly_open',
  confidence public.confidence_level NOT NULL DEFAULT 'low',
  verification_status public.verification_status NOT NULL DEFAULT 'auto_discovered',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunities_status_idx ON public.opportunities(status);
CREATE INDEX opportunities_deadline_idx ON public.opportunities(application_deadline);
CREATE INDEX opportunities_institution_idx ON public.opportunities(institution_id);
CREATE INDEX opportunities_country_idx ON public.opportunities(country);
CREATE INDEX opportunities_title_trgm ON public.opportunities USING gin (title gin_trgm_ops);
CREATE UNIQUE INDEX opportunities_dedupe_key_uq ON public.opportunities(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization text,
  location text,
  country text,
  start_date date,
  end_date date,
  abstract_deadline date,
  paper_deadline date,
  registration_deadline date,
  website text,
  recurrence text,
  summary text,
  source text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  confidence public.confidence_level NOT NULL DEFAULT 'low',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_start_idx ON public.events(start_date);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  degree_type text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  language text,
  duration text,
  website text,
  summary text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_institution_idx ON public.courses(institution_id);

CREATE TABLE public.researcher_topics (
  researcher_id uuid NOT NULL REFERENCES public.researchers(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1,
  PRIMARY KEY (researcher_id, topic_id)
);
CREATE TABLE public.institution_topics (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  weight numeric NOT NULL DEFAULT 1,
  PRIMARY KEY (institution_id, topic_id)
);
CREATE TABLE public.project_topics (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, topic_id)
);
CREATE TABLE public.publication_topics (
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, topic_id)
);
CREATE TABLE public.opportunity_topics (
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, topic_id)
);
CREATE TABLE public.event_topics (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, topic_id)
);
CREATE TABLE public.course_topics (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, topic_id)
);
CREATE TABLE public.project_researchers (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.researchers(id) ON DELETE CASCADE,
  role text,
  PRIMARY KEY (project_id, researcher_id)
);
CREATE TABLE public.project_institutions (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  role text,
  PRIMARY KEY (project_id, institution_id)
);
CREATE TABLE public.project_organizations (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text,
  PRIMARY KEY (project_id, organization_id)
);
CREATE TABLE public.publication_researchers (
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.researchers(id) ON DELETE CASCADE,
  author_position integer,
  PRIMARY KEY (publication_id, researcher_id)
);
CREATE TABLE public.publication_institutions (
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (publication_id, institution_id)
);
CREATE TABLE public.course_researchers (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.researchers(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, researcher_id)
);
CREATE TABLE public.event_institutions (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, institution_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','publications','opportunities','events','courses'] LOOP
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['projects','publications','opportunities','events','courses',
    'researcher_topics','institution_topics','project_topics','publication_topics','opportunity_topics','event_topics','course_topics',
    'project_researchers','project_institutions','project_organizations','publication_researchers','publication_institutions','course_researchers','event_institutions'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public read %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "admins write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;
