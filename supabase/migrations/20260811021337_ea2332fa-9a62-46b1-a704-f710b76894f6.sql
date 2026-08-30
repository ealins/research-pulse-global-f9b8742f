
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.verification_status AS ENUM ('verified','auto_discovered','needs_review','possibly_outdated','closed','archived','unverified');
CREATE TYPE public.confidence_level AS ENUM ('high','medium','low');
CREATE TYPE public.opportunity_status AS ENUM ('open','closing_soon','rolling','possibly_open','closed','archived');
CREATE TYPE public.opportunity_type AS ENUM ('phd','doctoral_researcher','research_assistant','postdoc','other');
CREATE TYPE public.project_status AS ENUM ('planned','active','recently_completed','completed','unknown');
CREATE TYPE public.source_type AS ENUM ('institution','careers_page','research_group','api','rss','conference','society','project','publication_database','other');
CREATE TYPE public.institution_type AS ENUM ('university','research_institute','university_lab','government_agency','company','consortium','other');
CREATE TYPE public.pulse_category AS ENUM ('PHD','PROJECT','PAPER','DATASET','DISSERTATION','EVENT','PEOPLE','STANDARD','FUNDING');
CREATE TYPE public.org_type AS ENUM ('funder','industry','society','government','ngo','other');

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT public.has_role(auth.uid(),'admin');
$$;

CREATE TABLE public.research_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  category text,
  description text,
  parent_id uuid REFERENCES public.research_topics(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  abbreviation text,
  country text,
  country_code text,
  continent text,
  city text,
  latitude double precision,
  longitude double precision,
  official_url text,
  careers_url text,
  research_url text,
  institution_identifier text,
  openalex_id text,
  description text,
  institution_type public.institution_type NOT NULL DEFAULT 'university',
  active boolean NOT NULL DEFAULT true,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX institutions_country_idx ON public.institutions(country);
CREATE INDEX institutions_name_trgm ON public.institutions USING gin (name gin_trgm_ops);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  website text,
  description text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);
CREATE INDEX departments_institution_idx ON public.departments(institution_id);

CREATE TABLE public.research_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  website text,
  description text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, slug)
);
CREATE INDEX research_groups_institution_idx ON public.research_groups(institution_id);

CREATE TABLE public.researchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  normalized_name text,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  research_group_id uuid REFERENCES public.research_groups(id) ON DELETE SET NULL,
  academic_title text,
  current_position text,
  orcid text,
  openalex_author_id text,
  semantic_scholar_id text,
  official_profile_url text,
  google_scholar_url text,
  research_summary text,
  active boolean NOT NULL DEFAULT true,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX researchers_orcid_key ON public.researchers(orcid) WHERE orcid IS NOT NULL;
CREATE UNIQUE INDEX researchers_openalex_key ON public.researchers(openalex_author_id) WHERE openalex_author_id IS NOT NULL;
CREATE INDEX researchers_institution_idx ON public.researchers(institution_id);
CREATE INDEX researchers_name_trgm ON public.researchers USING gin (full_name gin_trgm_ops);

CREATE TABLE public.researcher_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id uuid NOT NULL REFERENCES public.researchers(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  role text NOT NULL,
  is_leadership boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_to date,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX researcher_roles_researcher_idx ON public.researcher_roles(researcher_id);
CREATE INDEX researcher_roles_department_idx ON public.researcher_roles(department_id);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  org_type public.org_type NOT NULL DEFAULT 'other',
  country text,
  website text,
  description text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['research_topics','institutions','departments','research_groups','researchers','researcher_roles','organizations']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public read %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "admins write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    EXECUTE format('CREATE TRIGGER touch_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;

