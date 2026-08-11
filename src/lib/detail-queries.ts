import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

/* ---------- provenance ---------- */

export type RecordSource = {
  id: string;
  source_url: string;
  source_organization: string | null;
  source_type: string;
  original_title: string | null;
  claim: string | null;
  discovered_at: string;
  last_checked_at: string | null;
  last_verified_at: string | null;
  verification_status: string;
  confidence: string;
  is_primary: boolean;
};

export type HistoryEntry = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  source_url: string | null;
  changed_at: string;
};

export function evidenceQuery(entityType: string, entityId: string | undefined) {
  return queryOptions({
    queryKey: ["evidence", entityType, entityId],
    enabled: Boolean(entityId),
    queryFn: async () => {
      const [sources, history] = await Promise.all([
        supabase
          .from("record_sources")
          .select(
            `id, source_url, source_organization, source_type, original_title, claim,
             discovered_at, last_checked_at, last_verified_at, verification_status,
             confidence, is_primary`,
          )
          .eq("entity_type", entityType)
          .eq("entity_id", entityId!)
          .order("is_primary", { ascending: false }),
        supabase
          .from("entity_history")
          .select("id, field, old_value, new_value, change_reason, source_url, changed_at")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId!)
          .order("changed_at", { ascending: false })
          .limit(25),
      ]);
      if (sources.error) throw sources.error;
      if (history.error) throw history.error;
      return {
        sources: (sources.data ?? []) as RecordSource[],
        history: (history.data ?? []) as HistoryEntry[],
      };
    },
  });
}

export const sourceRegistryQuery = queryOptions({
  queryKey: ["source-registry"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sources")
      .select(
        `id, name, url, organization, source_type, adapter_key, trust_level,
         refresh_frequency_hours, active, notes, last_success_at`,
      )
      .order("trust_level", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
});

/* ---------- detail pages ---------- */

export function institutionDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["institution-detail", slug],
    queryFn: async () => {
      const { data: institution, error } = await supabase
        .from("institutions")
        .select(
          `id, name, slug, abbreviation, city, country, continent, institution_type,
           official_url, careers_url, research_url, institution_identifier, openalex_id,
           description, verification_status, last_verified_at, is_demo,
           institution_topics ( weight, research_topics ( name, slug ) )`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!institution) return null;

      const id = institution.id;
      const [departments, groups, researchers, opportunities, projects, publications, courses] =
        await Promise.all([
          supabase
            .from("departments")
            .select("id, name, slug, website, description, verification_status")
            .eq("institution_id", id)
            .order("name"),
          supabase
            .from("research_groups")
            .select("id, name, slug, website, description")
            .eq("institution_id", id)
            .order("name"),
          supabase
            .from("researchers")
            .select("id, full_name, slug, academic_title, current_position, verification_status")
            .eq("institution_id", id)
            .order("full_name"),
          supabase
            .from("opportunities")
            .select(
              "id, title, slug, opportunity_type, status, application_deadline, application_url, verification_status",
            )
            .eq("institution_id", id)
            .order("application_deadline", { ascending: true, nullsFirst: false }),
          supabase
            .from("projects")
            .select(
              "id, name, slug, acronym, status, start_date, end_date, funding_organization, website",
            )
            .eq("institution_id", id)
            .order("start_date", { ascending: false, nullsFirst: false }),
          supabase
            .from("publications")
            .select("id, title, doi, venue, year, citation_count, is_open_access, landing_url")
            .eq("institution_id", id)
            .order("year", { ascending: false, nullsFirst: false })
            .limit(25),
          supabase
            .from("courses")
            .select("id, title, slug, degree_type, language, duration, website")
            .eq("institution_id", id)
            .order("title"),
        ]);

      return {
        institution,
        departments: departments.data ?? [],
        groups: groups.data ?? [],
        researchers: researchers.data ?? [],
        opportunities: opportunities.data ?? [],
        projects: projects.data ?? [],
        publications: publications.data ?? [],
        courses: courses.data ?? [],
      };
    },
  });
}

export function researcherDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["researcher-detail", slug],
    queryFn: async () => {
      const { data: researcher, error } = await supabase
        .from("researchers")
        .select(
          `id, full_name, slug, academic_title, current_position, orcid, openalex_author_id,
           official_profile_url, google_scholar_url, research_summary, verification_status,
           last_verified_at, is_demo,
           institutions ( id, name, slug, country ),
           departments ( name, slug ),
           research_groups ( name, slug ),
           researcher_topics ( weight, research_topics ( name, slug ) )`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!researcher) return null;

      const id = researcher.id;
      const [roles, pubs, projects, supervising, courses] = await Promise.all([
        supabase
          .from("researcher_roles")
          .select(
            `role, is_leadership, valid_from, valid_to, verification_status,
             institutions ( name, slug ), departments ( name )`,
          )
          .eq("researcher_id", id)
          .order("valid_from", { ascending: false, nullsFirst: false }),
        supabase
          .from("publication_researchers")
          .select(
            `author_position,
             publications ( id, title, doi, venue, year, citation_count, is_open_access, landing_url )`,
          )
          .eq("researcher_id", id)
          .limit(50),
        supabase
          .from("project_researchers")
          .select(`role, projects ( id, name, slug, acronym, status, funding_organization, website )`)
          .eq("researcher_id", id),
        supabase
          .from("opportunities")
          .select(
            "id, title, slug, opportunity_type, status, application_deadline, application_url",
          )
          .eq("supervisor_id", id)
          .order("application_deadline", { ascending: true, nullsFirst: false }),
        supabase
          .from("course_researchers")
          .select(`courses ( id, title, slug, degree_type )`)
          .eq("researcher_id", id),
      ]);

      return {
        researcher,
        roles: roles.data ?? [],
        publications: (pubs.data ?? [])
          .map((r: any) => ({ ...r.publications, author_position: r.author_position }))
          .filter((p: any) => p?.id)
          .sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0)),
        projects: (projects.data ?? [])
          .map((r: any) => ({ ...r.projects, member_role: r.role }))
          .filter((p: any) => p?.id),
        supervising: supervising.data ?? [],
        courses: (courses.data ?? []).map((r: any) => r.courses).filter(Boolean),
      };
    },
  });
}

export function opportunityDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["opportunity-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          `id, title, slug, opportunity_type, description, requirements, funding_type,
           salary_text, city, country, start_date, application_deadline, application_url,
           official_source_url, supervisor_name, status, confidence, verification_status,
           first_discovered_at, last_checked_at, last_verified_at, is_demo,
           institutions ( id, name, slug, country, careers_url ),
           departments ( name, slug ),
           research_groups ( name ),
           researchers ( full_name, slug, current_position ),
           projects ( name, slug, acronym ),
           opportunity_topics ( research_topics ( name, slug ) )`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function topicDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["topic-detail", slug],
    queryFn: async () => {
      const { data: topic, error } = await supabase
        .from("research_topics")
        .select("id, name, slug, category, description")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!topic) return null;

      const id = topic.id;
      const [momentum, opportunities, publications, projects, researchers, institutions, events] =
        await Promise.all([
          supabase
            .from("topic_momentum")
            .select(
              `pubs_last_12m, pubs_prev_12m, pubs_last_36m, active_projects, open_opportunities,
               institutions_active, growth_ratio, trend_signal, computed_at`,
            )
            .eq("topic_id", id)
            .maybeSingle(),
          supabase
            .from("opportunity_topics")
            .select(
              `opportunities ( id, title, slug, opportunity_type, status, application_deadline,
                 institutions ( name, slug ) )`,
            )
            .eq("topic_id", id),
          supabase
            .from("publication_topics")
            .select(`publications ( id, title, doi, venue, year, citation_count, landing_url )`)
            .eq("topic_id", id),
          supabase
            .from("project_topics")
            .select(`projects ( id, name, slug, acronym, status, funding_organization )`)
            .eq("topic_id", id),
          supabase
            .from("researcher_topics")
            .select(
              `weight, researchers ( id, full_name, slug, current_position, institutions ( name, slug ) )`,
            )
            .eq("topic_id", id),
          supabase
            .from("institution_topics")
            .select(`weight, institutions ( id, name, slug, country )`)
            .eq("topic_id", id)
            .order("weight", { ascending: false }),
          supabase
            .from("event_topics")
            .select(`events ( id, title, slug, start_date, location, abstract_deadline )`)
            .eq("topic_id", id),
        ]);

      const pick = <T,>(rows: any[] | null, key: string): T[] =>
        (rows ?? []).map((r) => r[key]).filter(Boolean) as T[];

      return {
        topic,
        momentum: momentum.data,
        opportunities: pick<any>(opportunities.data, "opportunities"),
        publications: pick<any>(publications.data, "publications").sort(
          (a, b) => (b.year ?? 0) - (a.year ?? 0),
        ),
        projects: pick<any>(projects.data, "projects"),
        researchers: (researchers.data ?? [])
          .map((r: any) => ({ ...r.researchers, weight: r.weight }))
          .filter((r: any) => r?.id),
        institutions: (institutions.data ?? [])
          .map((r: any) => ({ ...r.institutions, weight: r.weight }))
          .filter((r: any) => r?.id),
        events: pick<any>(events.data, "events"),
      };
    },
  });
}

/* ---------- search ---------- */

export type SearchHit = {
  entity_type: string;
  entity_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  score: number;
};

export async function runGlobalSearch(q: string): Promise<SearchHit[]> {
  if (q.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("global_search", {
    q: q.trim(),
    max_results: 24,
  });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}

export function citationFor(kind: string, title: string, url: string) {
  const retrieved = new Date().toISOString().slice(0, 10);
  return `${title}. ${kind} record, GeoAcademic Radar. Retrieved ${retrieved} from ${url}`;
}
