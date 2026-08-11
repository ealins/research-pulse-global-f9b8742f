// Structured-provider ingestion (OpenAlex / Crossref-backed metadata).
// Server-only. No language model is used to invent records here: every field
// comes from the provider payload. Nemotron is only ever used downstream for
// topic classification of already-real records.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { topicIdsFor } from "./extraction/topics.server";

const UA = "GeoAcademicRadarBot/1.0 (mailto:hello@geoacademic.app)";
const API = "https://api.openalex.org";

/** Domain queries used to keep imported works inside the platform's scope. */
export const DOMAIN_QUERIES = [
  "photogrammetry",
  "remote sensing",
  "geodesy",
  "geoinformatics",
  "earth observation",
  "lidar point cloud",
];

/** Signals that OpenAlex refused the call for quota reasons, so the task should retry later. */
export class ProviderBudgetError extends Error {
  constructor() {
    super("OPENALEX_BUDGET_EXHAUSTED");
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (res.status === 429) throw new ProviderBudgetError();
  if (!res.ok) return null;
  return (await res.json()) as T;
}

type CrossrefItem = {
  DOI?: string;
  title?: string[];
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  "is-referenced-by-count"?: number;
  URL?: string;
  subject?: string[];
};

/**
 * Crossref fallback for bibliographic records — free, no quota — used when
 * OpenAlex is unavailable. Same provenance rules: only provider-supplied fields.
 */
async function crossrefWorks(
  affiliation: string,
  query: string,
  sinceYear: number,
  rows: number,
): Promise<OaWork[]> {
  const url =
    `https://api.crossref.org/works?query.affiliation=${encodeURIComponent(affiliation)}` +
    `&query.bibliographic=${encodeURIComponent(query)}&filter=from-pub-date:${sinceYear}-01-01,type:journal-article` +
    `&rows=${rows}&sort=is-referenced-by-count&order=desc&select=DOI,title,issued,published,container-title,author,is-referenced-by-count,URL,subject`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as { message?: { items?: CrossrefItem[] } };
  return (body.message?.items ?? []).flatMap((it) => {
    const doi = it.DOI?.toLowerCase();
    const title = it.title?.[0]?.trim();
    if (!doi || !title) return [];
    const parts = it.published?.["date-parts"]?.[0] ?? it.issued?.["date-parts"]?.[0] ?? [];
    const [y, m, d] = parts;
    const date = y ? `${y}-${String(m ?? 1).padStart(2, "0")}-${String(d ?? 1).padStart(2, "0")}` : null;
    return [
      {
        id: `https://api.crossref.org/works/${doi}`,
        doi: `https://doi.org/${doi}`,
        title,
        display_name: title,
        publication_date: date,
        publication_year: y ?? null,
        cited_by_count: it["is-referenced-by-count"] ?? null,
        open_access: null,
        primary_location: {
          landing_page_url: it.URL ?? `https://doi.org/${doi}`,
          source: { display_name: it["container-title"]?.[0] ?? null },
        },
        authorships: (it.author ?? []).map((a) => ({
          author: { display_name: a.name ?? [a.given, a.family].filter(Boolean).join(" ") || null },
        })),
        topics: (it.subject ?? []).map((sub) => ({ display_name: sub })),
      } satisfies OaWork,
    ];
  });
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\b(university|universität|universitaet|univ|of|the|for|und|and|de|di|del)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type OaInstitution = {
  id: string;
  ror: string | null;
  display_name: string;
  country_code: string | null;
  homepage_url: string | null;
  works_count?: number;
};

export type PromotionResult = {
  institution: string;
  matched: boolean;
  promoted: boolean;
  openalex_id?: string | null;
  ror?: string | null;
  reason?: string;
};

/**
 * Reconciles an EXISTING institution row against its authoritative OpenAlex /
 * ROR identity. Never creates a second institution: the same row id is kept so
 * all relationships survive. Identity requires a domain match OR a strong
 * normalized-name + country match.
 */
export async function promoteInstitution(institutionId: string): Promise<PromotionResult> {
  const { data: inst } = await supabaseAdmin
    .from("institutions")
    .select("id, name, abbreviation, country, country_code, official_url, openalex_id, institution_identifier, is_demo, verification_status")
    .eq("id", institutionId)
    .maybeSingle();
  if (!inst) return { institution: institutionId, matched: false, promoted: false, reason: "institution not found" };

  const search = encodeURIComponent(inst.name);
  const payload = await getJson<{ results: OaInstitution[] }>(`${API}/institutions?search=${search}&per_page=5`);
  const candidates = payload?.results ?? [];
  if (candidates.length === 0) return { institution: inst.name, matched: false, promoted: false, reason: "no OpenAlex candidate" };

  const ourHost = hostOf(inst.official_url);
  const ourName = normalizeName(inst.name);
  const ourCountry = (inst.country_code ?? "").toUpperCase();

  let match: OaInstitution | null = null;
  let evidence = "";
  for (const c of candidates) {
    const cHost = hostOf(c.homepage_url);
    if (ourHost && cHost && (ourHost === cHost || ourHost.endsWith(`.${cHost}`) || cHost.endsWith(`.${ourHost}`))) {
      match = c;
      evidence = `official domain match (${cHost})`;
      break;
    }
  }
  if (!match) {
    for (const c of candidates) {
      const sameCountry = !ourCountry || !c.country_code || c.country_code.toUpperCase() === ourCountry;
      if (sameCountry && normalizeName(c.display_name) === ourName) {
        match = c;
        evidence = "normalized name + country match";
        break;
      }
    }
  }
  if (!match) return { institution: inst.name, matched: false, promoted: false, reason: "no confident identity match" };

  const openalexId = match.id.replace(`${API}/`, "").replace("https://openalex.org/", "");
  const ror = match.ror ? match.ror.replace("https://ror.org/", "") : null;

  const update: Record<string, unknown> = {
    openalex_id: openalexId,
    verification_status: "verified",
    last_verified_at: new Date().toISOString(),
    is_demo: false,
  };
  if (ror && !inst.institution_identifier) update["institution_identifier"] = ror;
  if (!inst.country_code && match.country_code) update["country_code"] = match.country_code;
  if (!inst.official_url && match.homepage_url) update["official_url"] = match.homepage_url;

  await supabaseAdmin.from("institutions").update(update as never).eq("id", inst.id);

  const sourceUrl = `https://openalex.org/${openalexId}`;
  const { data: existingEvidence } = await supabaseAdmin
    .from("record_sources")
    .select("id")
    .eq("entity_type", "institution")
    .eq("entity_id", inst.id)
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (!existingEvidence) {
    await supabaseAdmin.from("record_sources").insert({
      entity_type: "institution",
      entity_id: inst.id,
      source_url: sourceUrl,
      source_organization: "OpenAlex",
      source_type: "api" as never,
      original_title: match.display_name,
      claim: `Institution identity confirmed via ${evidence}${ror ? `; ROR ${ror}` : ""}`,
      verification_status: "verified" as never,
      confidence: "high" as never,
      is_primary: false,
      last_checked_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    });
  }
  if (inst.is_demo) {
    await supabaseAdmin.from("entity_history").insert({
      entity_type: "institution",
      entity_id: inst.id,
      field: "is_demo",
      old_value: "true",
      new_value: "false",
      change_reason: `Promoted to source-backed record via OpenAlex (${evidence})`,
      source_url: sourceUrl,
    });
    await supabaseAdmin.from("academic_changes").insert({
      change_type: "INSTITUTION_PROMOTED",
      entity_type: "institution",
      entity_id: inst.id,
      title: inst.name,
      summary: `Seed record promoted to verified using OpenAlex identity (${evidence})`,
      details: { openalex_id: openalexId, ror, evidence } as never,
    });
  }

  return { institution: inst.name, matched: true, promoted: inst.is_demo, openalex_id: openalexId, ror };
}

type OaWork = {
  id: string;
  doi: string | null;
  title: string | null;
  display_name: string | null;
  publication_date: string | null;
  publication_year: number | null;
  cited_by_count: number | null;
  language?: string | null;
  open_access?: { is_oa: boolean | null } | null;
  primary_location?: { landing_page_url: string | null; source: { display_name: string | null } | null } | null;
  authorships?: { author: { display_name: string | null } | null }[];
  topics?: { display_name: string | null }[];
};

export type PublicationImportResult = {
  institution: string;
  queries: number;
  seen: number;
  inserted: number;
  updated: number;
  skipped: number;
};

/**
 * Imports real, provider-backed publications for one institution that already
 * carries an OpenAlex identity. Deduplicated on DOI first, then OpenAlex id.
 */
export async function importInstitutionPublications(
  institutionId: string,
  opts: { queries?: number; perQuery?: number; sinceYear?: number } = {},
): Promise<PublicationImportResult> {
  const { data: inst } = await supabaseAdmin
    .from("institutions")
    .select("id, name, openalex_id")
    .eq("id", institutionId)
    .maybeSingle();
  if (!inst?.openalex_id) {
    return { institution: inst?.name ?? institutionId, queries: 0, seen: 0, inserted: 0, updated: 0, skipped: 0 };
  }

  const perQuery = Math.min(50, opts.perQuery ?? 25);
  const since = opts.sinceYear ?? new Date().getUTCFullYear() - 4;
  const queries = DOMAIN_QUERIES.slice(0, Math.max(1, Math.min(DOMAIN_QUERIES.length, opts.queries ?? 3)));
  const out: PublicationImportResult = { institution: inst.name, queries: queries.length, seen: 0, inserted: 0, updated: 0, skipped: 0 };

  for (const q of queries) {
    const url =
      `${API}/works?filter=institutions.lineage:${inst.openalex_id},from_publication_date:${since}-01-01` +
      `&search=${encodeURIComponent(q)}&per_page=${perQuery}&sort=cited_by_count:desc`;
    let works: OaWork[] = [];
    try {
      works = (await getJson<{ results: OaWork[] }>(url))?.results ?? [];
    } catch {
      works = [];
    }
    if (works.length === 0) works = await crossrefWorks(inst.name, q, since, perQuery);
    for (const w of works) {
      out.seen += 1;
      const title = (w.title ?? w.display_name ?? "").trim();
      if (!title) {
        out.skipped += 1;
        continue;
      }
      const fromOpenAlex = w.id.startsWith("https://openalex.org/");
      const provider = fromOpenAlex ? "openalex" : "crossref";
      const providerLabel = fromOpenAlex ? "OpenAlex" : "Crossref";
      const externalId = w.id.replace("https://openalex.org/", "");
      const doi = w.doi ? w.doi.replace("https://doi.org/", "") : null;
      const evidenceUrl = fromOpenAlex ? `https://openalex.org/${externalId}` : `https://doi.org/${doi}`;

      let existingId: string | null = null;
      if (doi) {
        const { data } = await supabaseAdmin.from("publications").select("id").eq("doi", doi).maybeSingle();
        existingId = data?.id ?? null;
      }
      if (!existingId) {
        const { data } = await supabaseAdmin
          .from("publications")
          .select("id")
          .eq("source", provider)
          .eq("external_id", externalId)
          .maybeSingle();
        existingId = data?.id ?? null;
      }

      const authors = (w.authorships ?? [])
        .map((a) => a.author?.display_name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 25);
      const payloadRow = {
        doi,
        title: title.slice(0, 500),
        normalized_title: normalizeName(title).slice(0, 300),
        publication_date: w.publication_date,
        year: w.publication_year,
        venue: w.primary_location?.source?.display_name ?? null,
        authors_text: authors.join(", ") || null,
        citation_count: w.cited_by_count ?? null,
        citation_source: provider,
        is_open_access: w.open_access?.is_oa ?? null,
        source: provider,
        external_id: externalId,
        landing_url: w.primary_location?.landing_page_url ?? (doi ? `https://doi.org/${doi}` : null),
        institution_id: inst.id,
        verification_status: "verified" as never,
        confidence: "high" as never,
        last_verified_at: new Date().toISOString(),
        is_demo: false,
      };

      let pubId = existingId;
      if (existingId) {
        await supabaseAdmin.from("publications").update(payloadRow as never).eq("id", existingId);
        out.updated += 1;
      } else {
        const { data, error } = await supabaseAdmin
          .from("publications")
          .insert(payloadRow as never)
          .select("id")
          .maybeSingle();
        if (error || !data) {
          out.skipped += 1;
          continue;
        }
        pubId = data.id;
        out.inserted += 1;
        await supabaseAdmin.from("academic_changes").insert({
          change_type: "NEW_PUBLICATION",
          entity_type: "publication",
          entity_id: pubId,
          title: payloadRow.title,
          summary: `Imported from ${providerLabel} for ${inst.name}`,
          details: { external_id: externalId, doi, provider } as never,
        });
      }
      if (!pubId) continue;

      await supabaseAdmin
        .from("publication_institutions")
        .upsert({ publication_id: pubId, institution_id: inst.id } as never, {
          onConflict: "publication_id,institution_id",
          ignoreDuplicates: true,
        });

      const { data: haveEvidence } = await supabaseAdmin
        .from("record_sources")
        .select("id")
        .eq("entity_type", "publication")
        .eq("entity_id", pubId)
        .eq("source_url", evidenceUrl)
        .maybeSingle();
      if (!haveEvidence) {
        await supabaseAdmin.from("record_sources").insert({
          entity_type: "publication",
          entity_id: pubId,
          source_url: evidenceUrl,
          source_organization: providerLabel,
          source_type: "publication_database" as never,
          original_title: payloadRow.title,
          claim: `Bibliographic metadata supplied by ${providerLabel}`,
          verification_status: "verified" as never,
          confidence: "high" as never,
          is_primary: true,
          last_checked_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        });
      }

      // Topic linkage uses the provider's own topic labels mapped onto the
      // curated GeoAcademic taxonomy — no invention, no model call.
      const labels = [q, ...(w.topics ?? []).map((t) => t.display_name ?? "").filter(Boolean)];
      const topicIds = await topicIdsFor(labels);
      if (topicIds.length > 0) {
        await supabaseAdmin.from("publication_topics").upsert(
          topicIds.map((topic_id) => ({ publication_id: pubId, topic_id })) as never,
          { onConflict: "publication_id,topic_id", ignoreDuplicates: true },
        );
      }
    }
  }
  return out;
}
