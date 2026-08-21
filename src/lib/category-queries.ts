import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OPEN_STATUSES = [
  "open",
  "closing_soon",
  "rolling",
  "possibly_open",
] as const satisfies readonly ("open" | "closing_soon" | "rolling" | "possibly_open")[];

export function countrySlug(country: string): string {
  return country
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Programme families derived from the programme title + linked topics. */
export const PROGRAMME_FAMILIES = [
  {
    key: "photogrammetry-3d",
    label: "Photogrammetry & 3D",
    test: /photogramm|3d|point cloud|reconstruct|mapping|cartograph/i,
  },
  {
    key: "remote-sensing",
    label: "Remote sensing & EO",
    test: /remote sensing|earth observation|space|satellite|geoanalysis/i,
  },
  {
    key: "geoinformatics",
    label: "Geoinformatics & GIS",
    test: /geoinformat|geographic information|geo-information|spatial information|geomatics/i,
  },
  {
    key: "geodesy",
    label: "Geodesy & surveying",
    test: /geodes|geodetic|surveying|navigation/i,
  },
  {
    key: "geoai",
    label: "GeoAI & spatial data science",
    test: /data science|intelligence|robotics|machine learning|digital twin/i,
  },
] as const;

export function programmeFamily(title: string): string {
  for (const f of PROGRAMME_FAMILIES) if (f.test.test(title)) return f.label;
  return "Interdisciplinary";
}

export const DEGREE_ORDER = ["BSc", "MSc", "MEng", "PhD", "Certificate"];

export function degreeLabel(degree: string | null): string {
  switch (degree) {
    case "BSc":
      return "Bachelor";
    case "MSc":
      return "Master";
    case "MEng":
      return "Engineering master";
    case "PhD":
      return "Doctoral";
    case "Certificate":
      return "Diploma / certificate";
    default:
      return "Other";
  }
}

type Rollup = {
  country: string;
  slug: string;
  continent: string;
  institutions: number;
  openCalls: number;
  programmes: number;
  projects: number;
  publications: number;
  researchers: number;
  events: number;
  pulse: number;
  topInstitutions: { name: string; slug: string }[];
};

async function fetchLandscape() {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 3).toISOString().slice(0, 10);
  const [inst, opps, courses, projects, pubs, researchers, events] = await Promise.all([
    supabase
      .from("institutions")
      .select("id, name, slug, country, continent, city, institution_type")
      .eq("is_demo", false),
    supabase
      .from("opportunities")
      .select("id, institution_id, country, status, application_deadline")
      .eq("is_demo", false),
    supabase.from("courses").select("id, institution_id, degree_type").eq("is_demo", false),
    supabase.from("projects").select("id, institution_id, status").eq("is_demo", false),
    supabase
      .from("publications")
      .select("id, institution_id, publication_date, year")
      .eq("is_demo", false),
    supabase.from("researchers").select("id, institution_id").eq("is_demo", false),
    supabase.from("events").select("id, country, start_date").eq("is_demo", false),
  ]);
  const err =
    inst.error ||
    opps.error ||
    courses.error ||
    projects.error ||
    pubs.error ||
    researchers.error ||
    events.error;
  if (err) throw err;
  return {
    since,
    institutions: inst.data ?? [],
    opportunities: opps.data ?? [],
    courses: courses.data ?? [],
    projects: projects.data ?? [],
    publications: pubs.data ?? [],
    researchers: researchers.data ?? [],
    events: events.data ?? [],
  };
}

export type InstitutionPulse = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  continent: string | null;
  city: string | null;
  institution_type: string;
  openCalls: number;
  programmes: number;
  projects: number;
  publications: number;
  researchers: number;
  pulse: number;
};

function scoreInstitutions(l: Awaited<ReturnType<typeof fetchLandscape>>): InstitutionPulse[] {
  return l.institutions
    .map((i) => {
      const openCalls = l.opportunities.filter(
        (o) => o.institution_id === i.id && (OPEN_STATUSES as readonly string[]).includes(o.status),
      ).length;
      const programmes = l.courses.filter((c) => c.institution_id === i.id).length;
      const projects = l.projects.filter(
        (p) => p.institution_id === i.id && ["active", "planned"].includes(p.status),
      ).length;
      const publications = l.publications.filter(
        (p) => p.institution_id === i.id && (p.publication_date ?? "9999") >= l.since,
      ).length;
      const researchers = l.researchers.filter((r) => r.institution_id === i.id).length;
      return {
        id: i.id,
        name: i.name,
        slug: i.slug,
        country: i.country,
        continent: i.continent,
        city: i.city,
        institution_type: i.institution_type,
        openCalls,
        programmes,
        projects,
        publications,
        researchers,
        pulse: openCalls * 4 + projects * 2 + publications * 1.5 + researchers + programmes * 0.5,
      };
    })
    .sort((a, b) => b.pulse - a.pulse || a.name.localeCompare(b.name));
}

/** Institutions ranked by live academic pulse rather than alphabetically. */
export const institutionPulseQuery = queryOptions({
  queryKey: ["institution-pulse"],
  queryFn: async () => scoreInstitutions(await fetchLandscape()),
  staleTime: 60_000,
});

export const countriesRollupQuery = queryOptions({
  queryKey: ["countries-rollup"],
  queryFn: async () => {
    const l = await fetchLandscape();
    const ranked = scoreInstitutions(l);
    const map = new Map<string, Rollup>();
    for (const i of ranked) {
      if (!i.country) continue;
      const key = i.country;
      const row =
        map.get(key) ??
        ({
          country: key,
          slug: countrySlug(key),
          continent: i.continent ?? "Not stated",
          institutions: 0,
          openCalls: 0,
          programmes: 0,
          projects: 0,
          publications: 0,
          researchers: 0,
          events: 0,
          pulse: 0,
          topInstitutions: [],
        } satisfies Rollup);
      row.institutions += 1;
      row.openCalls += i.openCalls;
      row.programmes += i.programmes;
      row.projects += i.projects;
      row.publications += i.publications;
      row.researchers += i.researchers;
      row.pulse += i.pulse;
      if (row.topInstitutions.length < 3) row.topInstitutions.push({ name: i.name, slug: i.slug });
      map.set(key, row);
    }
    for (const e of l.events) {
      if (!e.country) continue;
      const row = map.get(e.country);
      if (row) row.events += 1;
    }
    return [...map.values()].sort((a, b) => b.pulse - a.pulse);
  },
  staleTime: 60_000,
});

export function countryDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["country-detail", slug],
    queryFn: async () => {
      const l = await fetchLandscape();
      const ranked = scoreInstitutions(l);
      const country = ranked.find((i) => i.country && countrySlug(i.country) === slug)?.country;
      if (!country) return null;
      const institutions = ranked.filter((i) => i.country === country);
      const ids = institutions.map((i) => i.id);

      const [opps, courses, events, researchers, projects, topics] = await Promise.all([
        supabase
          .from("opportunities")
          .select(
            `id, title, slug, opportunity_type, status, application_deadline, city, funding_type,
             verification_status, is_demo, institutions ( name, slug )`,
          )
          .or(`institution_id.in.(${ids.join(",")}),country.eq.${country}`)
          .eq("is_demo", false)
          .order("is_demo", { ascending: true })
          .order("application_deadline", { ascending: true, nullsFirst: false })
          .limit(60),
        supabase
          .from("courses")
          .select(
            `id, title, slug, degree_type, language, duration, summary,
             institutions ( name, slug )`,
          )
          .in("institution_id", ids)
          .eq("is_demo", false)
          .order("is_demo", { ascending: true })
          .order("title"),
        supabase
          .from("events")
          .select("id, title, slug, start_date, location, organization, website")
          .eq("country", country)
          .eq("is_demo", false)
          .order("is_demo", { ascending: true })
          .order("start_date"),
        supabase
          .from("researchers")
          .select(
            "id, full_name, slug, academic_title, current_position, institutions ( name, slug )",
          )
          .in("institution_id", ids)
          .eq("is_demo", false)
          .limit(40),
        supabase
          .from("projects")
          .select(
            "id, name, slug, status, funding_organization, institutions!projects_institution_id_fkey ( name, slug )",
          )
          .in("institution_id", ids)
          .eq("is_demo", false)
          .order("is_demo", { ascending: true })
          .order("start_date", { ascending: false, nullsFirst: false })
          .limit(30),
        supabase
          .from("institution_topics")
          .select("weight, institution_id, research_topics ( name, slug )")
          .in("institution_id", ids),
      ]);
      const err =
        opps.error ||
        courses.error ||
        events.error ||
        researchers.error ||
        projects.error ||
        topics.error;
      if (err) throw err;

      const topicCount = new Map<string, { name: string; slug: string; count: number }>();
      for (const t of topics.data ?? []) {
        const rt = t.research_topics;
        if (!rt) continue;
        const row = topicCount.get(rt.slug) ?? { name: rt.name, slug: rt.slug, count: 0 };
        row.count += 1;
        topicCount.set(rt.slug, row);
      }

      return {
        country,
        slug,
        continent: institutions[0]?.continent ?? null,
        institutions,
        opportunities: opps.data ?? [],
        courses: courses.data ?? [],
        events: events.data ?? [],
        researchers: researchers.data ?? [],
        projects: projects.data ?? [],
        topics: [...topicCount.values()].sort((a, b) => b.count - a.count).slice(0, 12),
        totals: {
          institutions: institutions.length,
          openCalls: institutions.reduce((s, i) => s + i.openCalls, 0),
          programmes: institutions.reduce((s, i) => s + i.programmes, 0),
          publications: institutions.reduce((s, i) => s + i.publications, 0),
          projects: institutions.reduce((s, i) => s + i.projects, 0),
          researchers: institutions.reduce((s, i) => s + i.researchers, 0),
          pulse: Math.round(institutions.reduce((s, i) => s + i.pulse, 0)),
        },
      };
    },
    staleTime: 60_000,
  });
}

export const programmeCatalogueQuery = queryOptions({
  queryKey: ["programme-catalogue"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(
        `id, title, slug, degree_type, language, duration, website, summary,
         verification_status, is_demo,
         institutions ( name, slug, country, city, continent ),
         course_topics!inner ( research_topics ( name, slug ) )`,
      )
      .eq("is_demo", false)
      .order("is_demo", { ascending: true })
      .order("title");
    if (error) throw error;
    return (data ?? []).map((c) => ({
      ...c,
      family: programmeFamily(c.title),
      country: c.institutions?.country ?? "Not stated",
    }));
  },
  staleTime: 60_000,
});

export function programmeDetailQuery(slug: string) {
  return queryOptions({
    queryKey: ["programme-detail", slug],
    queryFn: async () => {
      const { data: course, error } = await supabase
        .from("courses")
        .select(
          `id, title, slug, degree_type, language, duration, website, summary,
           verification_status, last_verified_at, is_demo, institution_id,
           institutions ( id, name, slug, country, city, continent, official_url, research_url, description, is_demo ),
           departments ( name, slug, website ),
           course_topics ( research_topics ( name, slug, category, description ) ),
           course_researchers ( researchers ( full_name, slug, academic_title, current_position, is_demo ) )`,
        )
        .eq("slug", slug)
        .eq("is_demo", false)
        .maybeSingle();
      if (error) throw error;
      if (!course || course.institutions?.is_demo) return null;

      const instId = course.institutions?.id;
      const [calls, siblings, projects] = await Promise.all([
        instId
          ? supabase
              .from("opportunities")
              .select("id, title, slug, opportunity_type, status, application_deadline")
              .eq("institution_id", instId)
              .eq("is_demo", false)
              .in("status", OPEN_STATUSES)
              .order("application_deadline", { ascending: true, nullsFirst: false })
              .limit(8)
          : Promise.resolve({ data: [], error: null }),
        instId
          ? supabase
              .from("courses")
              .select("id, title, slug, degree_type, language, duration")
              .eq("institution_id", instId)
              .eq("is_demo", false)
              .neq("slug", slug)
              .limit(8)
          : Promise.resolve({ data: [], error: null }),
        instId
          ? supabase
              .from("projects")
              .select("id, name, slug, status, summary")
              .eq("institution_id", instId)
              .eq("is_demo", false)
              .limit(6)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const courseResearchers = (course.course_researchers ?? []).filter(
        (link) => link.researchers && !link.researchers.is_demo,
      );

      return {
        course: { ...course, course_researchers: courseResearchers },
        family: programmeFamily(course.title),
        calls: calls.data ?? [],
        siblings: siblings.data ?? [],
        projects: projects.data ?? [],
      };
    },
    staleTime: 60_000,
  });
}
