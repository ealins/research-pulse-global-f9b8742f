import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight, SSR-safe fetchers used by route loaders purely to build
 * JSON-LD structured data in head(). They deliberately select a minimal
 * set of columns so they never slow the page down.
 */

const SITE = "https://geoacademic.app";

export type ResearcherLd = {
  name: string;
  jobTitle: string | null;
  affiliation: string | null;
  url: string | null;
  sameAs: string[];
  slug: string;
};

export async function loadResearcherLd(slug: string): Promise<ResearcherLd | null> {
  const { data } = await supabase
    .from("researchers")
    .select(
      `full_name, slug, academic_title, current_position, orcid, official_profile_url,
       google_scholar_url, institutions!researchers_institution_id_fkey ( name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const inst = (data as { institutions?: { name: string } | null }).institutions;
  return {
    name: data.full_name,
    slug: data.slug,
    jobTitle: data.current_position ?? data.academic_title ?? null,
    affiliation: inst?.name ?? null,
    url: data.official_profile_url ?? null,
    sameAs: [
      data.orcid ? `https://orcid.org/${data.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : null,
      data.google_scholar_url,
      data.official_profile_url,
    ].filter((v): v is string => Boolean(v)),
  };
}

export function researcherJsonLd(r: ResearcherLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: r.name,
    ...(r.jobTitle ? { jobTitle: r.jobTitle } : {}),
    ...(r.affiliation
      ? { affiliation: { "@type": "EducationalOrganization", name: r.affiliation } }
      : {}),
    url: `${SITE}/researchers/${r.slug}`,
    ...(r.sameAs.length ? { sameAs: r.sameAs } : {}),
  };
}

export type InstitutionLd = {
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  country: string | null;
  sameAs: string[];
};

export async function loadInstitutionLd(slug: string): Promise<InstitutionLd | null> {
  const { data } = await supabase
    .from("institutions")
    .select("name, slug, description, city, country, official_url, research_url, careers_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.name,
    slug: data.slug,
    description: data.description ?? null,
    city: data.city ?? null,
    country: data.country ?? null,
    sameAs: [data.official_url, data.research_url, data.careers_url].filter(
      (v): v is string => Boolean(v),
    ),
  };
}

export function institutionJsonLd(i: InstitutionLd) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: i.name,
    ...(i.description ? { description: i.description.slice(0, 400) } : {}),
    url: `${SITE}/institutions/${i.slug}`,
    ...(i.city || i.country
      ? {
          address: {
            "@type": "PostalAddress",
            ...(i.city ? { addressLocality: i.city } : {}),
            ...(i.country ? { addressCountry: i.country } : {}),
          },
        }
      : {}),
    ...(i.sameAs.length ? { sameAs: i.sameAs } : {}),
  };
}

export type JobLd = {
  title: string;
  slug: string;
  description: string | null;
  datePosted: string;
  validThrough: string | null;
  employer: string | null;
  city: string | null;
  country: string | null;
  employmentType: string | null;
  applicationUrl: string | null;
};

export async function loadJobLd(slug: string): Promise<JobLd | null> {
  const { data } = await supabase
    .from("opportunities")
    .select(
      `title, slug, description, requirements, first_discovered_at, application_deadline,
       employer_name, city, country, opportunity_type, application_url,
       institutions!opportunities_institution_id_fkey ( name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const inst = (data as { institutions?: { name: string } | null }).institutions;
  return {
    title: data.title,
    slug: data.slug,
    description: data.description ?? data.requirements ?? null,
    datePosted: data.first_discovered_at,
    validThrough: data.application_deadline ?? null,
    employer: data.employer_name ?? inst?.name ?? null,
    city: data.city ?? null,
    country: data.country ?? null,
    employmentType: data.opportunity_type ?? null,
    applicationUrl: data.application_url ?? null,
  };
}

export function jobJsonLd(j: JobLd) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: (j.description ?? j.title).slice(0, 1200),
    datePosted: j.datePosted,
    ...(j.validThrough ? { validThrough: j.validThrough } : {}),
    ...(j.employmentType ? { employmentType: j.employmentType.toUpperCase() } : {}),
    ...(j.employer
      ? { hiringOrganization: { "@type": "Organization", name: j.employer } }
      : {}),
    ...(j.city || j.country
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(j.city ? { addressLocality: j.city } : {}),
              ...(j.country ? { addressCountry: j.country } : {}),
            },
          },
        }
      : {}),
    url: `${SITE}/jobs/${j.slug}`,
    ...(j.applicationUrl ? { directApply: false, sameAs: j.applicationUrl } : {}),
  };
}

export type PublicationLd = {
  id: string;
  title: string;
  datePublished: string | null;
  authors: string[];
  venue: string | null;
  doi: string | null;
  landingUrl: string | null;
  abstract: string | null;
};

export async function loadPublicationLd(id: string): Promise<PublicationLd | null> {
  const { data } = await supabase
    .from("publications")
    .select("id, title, publication_date, year, authors_text, venue, doi, landing_url, abstract")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    datePublished: data.publication_date ?? (data.year ? String(data.year) : null),
    authors: (data.authors_text ?? "")
      .split(/;|,(?=\s*[A-Z])/)
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 25),
    venue: data.venue ?? null,
    doi: data.doi ?? null,
    landingUrl: data.landing_url ?? null,
    abstract: data.abstract ?? null,
  };
}

export function publicationJsonLd(p: PublicationLd) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: p.title,
    name: p.title,
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    ...(p.authors.length
      ? { author: p.authors.map((name) => ({ "@type": "Person", name })) }
      : {}),
    ...(p.venue ? { isPartOf: { "@type": "Periodical", name: p.venue } } : {}),
    ...(p.doi ? { identifier: `https://doi.org/${p.doi.replace(/^https?:\/\/doi\.org\//, "")}` } : {}),
    ...(p.abstract ? { abstract: p.abstract.slice(0, 600) } : {}),
    url: `${SITE}/publications/${p.id}`,
    ...(p.landingUrl ? { sameAs: p.landingUrl } : {}),
  };
}

export type EventLd = {
  name: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  country: string | null;
  organizer: string | null;
  website: string | null;
  summary: string | null;
};

export async function loadEventLd(slug: string): Promise<EventLd | null> {
  const { data } = await supabase
    .from("events")
    .select("title, slug, start_date, end_date, location, country, organization, website, summary")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.title,
    slug: data.slug,
    startDate: data.start_date ?? null,
    endDate: data.end_date ?? null,
    location: data.location ?? null,
    country: data.country ?? null,
    organizer: data.organization ?? null,
    website: data.website ?? null,
    summary: data.summary ?? null,
  };
}

export function eventJsonLd(e: EventLd) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.name,
    ...(e.startDate ? { startDate: e.startDate } : {}),
    ...(e.endDate ? { endDate: e.endDate } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.location ?? e.country ?? "See official programme",
      address: {
        "@type": "PostalAddress",
        ...(e.location ? { addressLocality: e.location } : {}),
        ...(e.country ? { addressCountry: e.country } : {}),
      },
    },
    ...(e.organizer ? { organizer: { "@type": "Organization", name: e.organizer } } : {}),
    ...(e.summary ? { description: e.summary.slice(0, 600) } : {}),
    url: `${SITE}/events/${e.slug}`,
    ...(e.website ? { sameAs: e.website } : {}),
  };
}
