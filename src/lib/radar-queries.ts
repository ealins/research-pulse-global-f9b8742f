import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import {
  LIVE_OPPORTUNITY_STATUSES,
  PUBLIC_CONFIDENCE_LEVELS,
  PUBLIC_VERIFICATION_STATUSES,
  canonicalCountry,
} from "@/lib/public-data";

export type OpportunityRow = {
  id: string;
  title: string;
  slug: string;
  city: string | null;
  country: string | null;
  opportunity_type: string;
  description: string | null;
  requirements: string | null;
  funding_type: string | null;
  salary_text: string | null;
  start_date: string | null;
  application_deadline: string | null;
  application_url: string | null;
  official_source_url: string | null;
  supervisor_name: string | null;
  sector: string;
  employer_name: string | null;
  seniority: string | null;
  status: string;
  confidence: string;
  verification_status: string;
  last_checked_at: string | null;
  is_demo: boolean;
  institutions: { name: string; slug: string; abbreviation: string | null } | null;
  opportunity_topics: { research_topics: { name: string; slug: string } | null }[];
};

const NON_POSTING_TITLE =
  /^(careers?|jobs?|vacancies|recruitment|work(?:ing)? (?:with|for|at) us|working at|join us|how we hire|search for your career)|academy|careers? in|employee stor(?:y|ies)|learning (?:&|and) development|leadership track|u[.]?gro programme|talent community|graduate programme|programme careers?|privacy|cookie|job alerts?|applicant|candidate privacy|equal opportunity/i;
const NON_POSTING_PATH =
  /\/(privacy|polic(?:y|ies)|how-we-hire|hiring-process|job-alerts?|candidate|applicant)(\/|$)/i;

/** Final public safety net for legacy rows written before the stricter crawler gate. */
export function isPlausibleOpportunity(row: OpportunityRow): boolean {
  if (!row.official_source_url || row.title.trim().length < 8) return false;
  if (["archived", "closed", "needs_review"].includes(row.verification_status)) return false;
  // Accuracy wins over coverage: unverified, low-confidence discoveries stay
  // in the review queue instead of appearing as live vacancies.
  if (row.confidence === "low") return false;
  if (NON_POSTING_TITLE.test(row.title.trim())) return false;
  try {
    return !NON_POSTING_PATH.test(new URL(row.official_source_url).pathname);
  } catch {
    return false;
  }
}

export const opportunitiesQuery = queryOptions({
  queryKey: ["opportunities"],
  queryFn: async (): Promise<OpportunityRow[]> => {
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        `id, title, slug, city, country, opportunity_type, description, requirements,
         funding_type, salary_text, start_date, application_deadline, application_url,
         official_source_url, supervisor_name, sector, employer_name, seniority,
         status, confidence, verification_status,
         last_checked_at, is_demo,
         institutions ( name, slug, abbreviation ),
         opportunity_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("status", LIVE_OPPORTUNITY_STATUSES)
      .in("verification_status", PUBLIC_VERIFICATION_STATUSES)
      .in("confidence", PUBLIC_CONFIDENCE_LEVELS)
      .not("official_source_url", "is", null)
      .order("is_demo", { ascending: true })
      .order("application_deadline", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return ((data ?? []) as unknown as OpportunityRow[])
      .map((row) => ({ ...row, country: canonicalCountry(row.country) }))
      .filter(isPlausibleOpportunity);
  },
});

export const pulseQuery = queryOptions({
  queryKey: ["pulse-events"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("pulse_events")
      .select(
        `id, category, title, summary, event_date, importance, link_url, source_url,
         verification_status, confidence, is_demo, country,
         pulse_event_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered"])
      .order("is_demo", { ascending: true })
      .order("importance", { ascending: false })
      .order("event_date", { ascending: false })
      .limit(60);
    if (error) throw error;
    return data ?? [];
  },
});

export const countsQuery = queryOptions({
  queryKey: ["entity-counts"],
  queryFn: async () => {
    // One database round trip keeps the hub counts consistent with the public
    // topic/relevance gates used by the list pages. Keep the legacy fallback so
    // a deployment remains usable while the accompanying migration is applied.
    const { data: surfaceCounts, error: surfaceCountsError } =
      await supabase.rpc("public_surface_counts");
    if (!surfaceCountsError && surfaceCounts && typeof surfaceCounts === "object") {
      const counts = surfaceCounts as Record<string, unknown>;
      return {
        institutions: Number(counts["institutions"] ?? 0),
        researchers: Number(counts["researchers"] ?? 0),
        opportunities: Number(counts["opportunities"] ?? 0),
        publications: Number(counts["publications"] ?? 0),
        projects: Number(counts["projects"] ?? 0),
        events: Number(counts["events"] ?? 0),
      };
    }

    const tables = [
      "institutions",
      "researchers",
      "opportunities",
      "publications",
      "projects",
      "events",
    ] as const;
    const entries = await Promise.all(
      tables.map(async (t) => {
        // NOTE: never use `head: true` here. PostgREST answers HEAD with a
        // Content-Length body, which Chromium rejects as net::ERR_ABORTED, so
        // every count would fail and the UI would fall back to empty states.
        const { count, error } = await supabase
          .from(t)
          .select("id", { count: "exact" })
          .eq("is_demo", false)
          .limit(1);
        if (error) throw error;
        return [t, count ?? 0] as const;
      }),
    );
    const { count: publicOpportunities, error: publicOpportunityError } = await supabase
      .from("opportunities")
      .select("id, opportunity_topics!inner(topic_id)", { count: "exact" })
      .eq("is_demo", false)
      .in("status", ["open", "closing_soon", "rolling", "possibly_open"])
      .in("verification_status", PUBLIC_VERIFICATION_STATUSES)
      .in("confidence", PUBLIC_CONFIDENCE_LEVELS)
      .not("official_source_url", "is", null)
      .limit(1);
    if (publicOpportunityError) throw publicOpportunityError;
    return {
      ...(Object.fromEntries(entries) as Record<(typeof tables)[number], number>),
      opportunities: publicOpportunities ?? 0,
    };
  },
});

export const openJobCountQuery = queryOptions({
  queryKey: ["open-job-count"],
  queryFn: async () => {
    const { count, error } = await supabase
      .from("opportunities")
      .select("id, opportunity_topics!inner(topic_id)", { count: "exact" })
      .in("status", ["open", "closing_soon", "rolling"])
      .in("verification_status", ["verified", "auto_discovered"])
      .in("confidence", PUBLIC_CONFIDENCE_LEVELS)
      .not("official_source_url", "is", null)
      .eq("is_demo", false)
      .limit(1);
    if (error) throw error;
    return count ?? 0;
  },
});

export const institutionsQuery = queryOptions({
  queryKey: ["institutions"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("institutions")
      .select(
        `id, name, slug, abbreviation, city, country, institution_type, official_url,
         research_url, description, verification_status, is_demo,
         institution_topics ( weight, research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .order("is_demo", { ascending: true })
      .order("name");
    if (error) throw error;
    return (data ?? []).map((event) => ({
      ...event,
      country: canonicalCountry(event.country),
    }));
  },
});

export const researchersQuery = queryOptions({
  queryKey: ["researchers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("researchers")
      .select(
        `id, full_name, slug, academic_title, current_position, official_profile_url,
         research_summary, verification_status, is_demo,
         institutions ( name, slug, country ),
         researcher_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .order("is_demo", { ascending: true })
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  },
});

export const trendsQuery = queryOptions({
  queryKey: ["topic-momentum"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("topic_momentum")
      .select(
        `id, pubs_last_12m, pubs_prev_12m, pubs_last_36m, active_projects,
         open_opportunities, institutions_active, growth_ratio, trend_signal, computed_at,
         research_topics ( name, slug, category )`,
      )
      .order("trend_signal", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("events")
      .select(
        `id, title, slug, organization, location, country, recurrence, summary, website,
         start_date, end_date, event_kind, abstract_deadline, paper_deadline,
         verification_status, is_demo,
         event_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .order("is_demo", { ascending: true })
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) throw error;
    // Filter client-side: exclude past events
    const today = new Date().toISOString().slice(0, 10);
    return ((data ?? []) as any[])
      .filter((e) => {
        if (e.end_date && e.end_date < today) return false;
        if (!e.end_date && e.start_date && e.start_date < today) return false;
        return true;
      })
      .map((event) => ({
        ...event,
        country: canonicalCountry(event.country),
      }));
  },
});

export const publicationsQuery = queryOptions({
  queryKey: ["publications"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("publications")
      .select(
        // NOTE: `abstract` is deliberately excluded — abstracts made this list
        // response ~500KB. They are fetched per row on expand.
        `id, title, doi, venue, year, publication_date, authors_text, citation_count,
         citation_source, is_open_access, landing_url, source,
         verification_status, confidence, is_demo,
         institutions!publications_institution_id_fkey ( name, slug ),
         publication_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .order("is_demo", { ascending: true })
      .order("year", { ascending: false, nullsFirst: false })
      .order("citation_count", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },
});

/** Abstract for a single publication, loaded only when the row is expanded. */
export function publicationAbstractQuery(id: string) {
  return queryOptions({
    queryKey: ["publication-abstract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("abstract")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data?.abstract ?? null;
    },
    staleTime: 10 * 60_000,
  });
}

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(
        `id, name, slug, acronym, status, start_date, end_date, funding_organization,
         funding_amount, funding_currency, website, summary, verification_status,
         confidence, is_demo,
         institutions!projects_institution_id_fkey ( name, slug, country ),
         project_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .in("status", ["planned", "active"])
      .order("is_demo", { ascending: true })
      .order("start_date", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const coursesQuery = queryOptions({
  queryKey: ["courses"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(
        `id, title, slug, degree_type, language, duration, website, summary,
         verification_status, confidence, is_demo,
         institutions ( name, slug, country ),
         course_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
      .neq("confidence", "low")
      .order("is_demo", { ascending: true })
      .order("title");
    if (error) throw error;
    return data ?? [];
  },
});

export const collaborationQuery = queryOptions({
  queryKey: ["collaboration-edges"],
  queryFn: async () => {
    const [edges, institutions] = await Promise.all([
      supabase
        .from("collaboration_edges")
        .select(
          "id, source_entity_id, target_entity_id, edge_type, weight, evidence_url, verification_status, is_demo",
        )
        .eq("is_demo", false)
        .order("weight", { ascending: false })
        .limit(400),
      supabase
        .from("institutions")
        .select("id, name, slug, abbreviation, country")
        .eq("is_demo", false),
    ]);
    if (edges.error) throw edges.error;
    if (institutions.error) throw institutions.error;
    return { edges: edges.data ?? [], institutions: institutions.data ?? [] };
  },
});

export const topicsQuery = queryOptions({
  queryKey: ["research-topics"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("research_topics")
      .select("id, name, slug, category, description")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  closing_soon: "Closing soon",
  rolling: "Rolling call",
  possibly_open: "Possibly open",
  closed: "Closed",
  archived: "Archived",
};

export const TYPE_LABEL: Record<string, string> = {
  phd: "PhD",
  doctoral_researcher: "Doctoral researcher",
  research_assistant: "Research assistant",
  postdoc: "Postdoc",
  other: "Other",
};

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function formatDate(date: string | null): string {
  if (!date) return "Not stated";
  return new Date(date).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
