import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LIVE_STATUSES = ["open", "closing_soon", "rolling", "possibly_open"] as const;

export const SECTOR_LABEL: Record<string, string> = {
  academic: "Academic",
  industry: "Industry",
};

/** A single event, with its topics and sibling events by the same organiser. */
export function eventDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["event-detail", slug],
    queryFn: async () => {
      const { data: event, error } = await supabase
        .from("events")
        .select(
          `id, title, slug, organization, location, country, start_date, end_date,
           abstract_deadline, paper_deadline, registration_deadline, website, recurrence,
           summary, source, event_kind, verification_status, confidence, last_verified_at, is_demo,
           event_topics ( research_topics ( name, slug, category ) )`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!event) return null;

      const topicIds = (event.event_topics ?? [])
        .map((t) => t.research_topics?.slug)
        .filter(Boolean) as string[];

      const [siblings, calls] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, slug, start_date, location, event_kind")
          .neq("slug", slug)
          .order("start_date", { ascending: true, nullsFirst: false })
          .limit(8),
        event.country
          ? supabase
              .from("opportunities")
              .select("id, title, slug, sector, status, application_deadline, employer_name")
              .eq("country", event.country)
              .in("status", LIVE_STATUSES as unknown as ("open" | "closing_soon" | "rolling" | "possibly_open")[])
              .order("application_deadline", { ascending: true, nullsFirst: false })
              .limit(6)
          : Promise.resolve({ data: [], error: null }),
      ]);

      return { event, topicIds, siblings: siblings.data ?? [], calls: calls.data ?? [] };
    },
    staleTime: 60_000,
  });
}

export type TopJob = {
  id: string;
  title: string;
  slug: string;
  sector: string;
  seniority: string | null;
  employer_name: string | null;
  country: string | null;
  status: string;
  opportunity_type: string;
  application_deadline: string | null;
  institutions: { name: string; slug: string } | null;
};

/** The "most relevant right now" digest: top jobs, areas, courses, institutions, countries. */
export const topPicksQuery = queryOptions({
  queryKey: ["top-picks"],
  queryFn: async () => {
    const [academic, industry, areas, courses, institutions, events] = await Promise.all([
      supabase
        .from("opportunities")
        .select(
          `id, title, slug, sector, seniority, employer_name, country, status, opportunity_type,
           application_deadline, institutions ( name, slug )`,
        )
        .eq("sector", "academic")
        .in("status", LIVE_STATUSES as unknown as ("open" | "closing_soon" | "rolling" | "possibly_open")[])
        .order("application_deadline", { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from("opportunities")
        .select(
          `id, title, slug, sector, seniority, employer_name, country, status, opportunity_type,
           application_deadline, institutions ( name, slug )`,
        )
        .eq("sector", "industry")
        .in("status", LIVE_STATUSES as unknown as ("open" | "closing_soon" | "rolling" | "possibly_open")[])
        .order("application_deadline", { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from("topic_momentum")
        .select(
          `trend_signal, growth_ratio, pubs_last_12m, open_opportunities, active_projects,
           institutions_active, research_topics ( name, slug, category )`,
        )
        .order("trend_signal", { ascending: false })
        .limit(8),
      supabase
        .from("courses")
        .select(
          `id, title, slug, degree_type, language, duration,
           institutions ( name, slug, country )`,
        )
        .in("degree_type", ["MSc", "MEng", "PhD"])
        .order("title")
        .limit(400),
      supabase
        .from("institutions")
        .select("id, name, slug, country, city, institution_type")
        .eq("active", true)
        .limit(400),
      supabase
        .from("events")
        .select("id, title, slug, start_date, location, country, event_kind, abstract_deadline")
        .gte("start_date", new Date().toISOString().slice(0, 10))
        .order("start_date")
        .limit(6),
    ]);

    const err =
      academic.error ||
      industry.error ||
      areas.error ||
      courses.error ||
      institutions.error ||
      events.error;
    if (err) throw err;

    // Rank courses by how much live activity their host institution has.
    const { data: liveCalls } = await supabase
      .from("opportunities")
      .select("institution_id")
      .in("status", LIVE_STATUSES as unknown as ("open" | "closing_soon" | "rolling" | "possibly_open")[])
      .limit(1000);
    const callCount = new Map<string, number>();
    for (const c of liveCalls ?? []) {
      if (!c.institution_id) continue;
      callCount.set(c.institution_id, (callCount.get(c.institution_id) ?? 0) + 1);
    }

    const topCourses = (courses.data ?? [])
      .map((c) => ({ ...c, hostCalls: 0 }))
      .slice(0, 400);

    const instByName = new Map((institutions.data ?? []).map((i) => [i.name, i]));
    for (const c of topCourses) {
      const inst = c.institutions ? instByName.get(c.institutions.name) : undefined;
      c.hostCalls = inst ? (callCount.get(inst.id) ?? 0) : 0;
    }
    topCourses.sort((a, b) => b.hostCalls - a.hostCalls || a.title.localeCompare(b.title));

    return {
      academicJobs: (academic.data ?? []) as unknown as TopJob[],
      industryJobs: (industry.data ?? []) as unknown as TopJob[],
      areas: areas.data ?? [],
      courses: topCourses.slice(0, 8),
      events: events.data ?? [],
    };
  },
  staleTime: 60_000,
});
