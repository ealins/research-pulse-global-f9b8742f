// Server-only ingestion engine. Never imported by client code.
// Pipeline: DISCOVER -> FETCH -> RAW STORAGE -> CLASSIFY -> EXTRACT/NORMALIZE -> CANONICAL -> PROVENANCE
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  extractStructuredSnapshot,
  structuredVacancyFromPayload,
} from "./extraction/structured.server";
import type { VacancyExtraction } from "./extraction/vacancy.server";

const UA =
  "GeoAcademicRadarBot/1.0 (+https://geoacademic.app; academic source indexing)";
const FETCH_TIMEOUT_MS = 20_000;

/** Keyword vocabulary (English + German) used for discovery scoring and classification. */
const CATEGORY_RULES: { category: string; kind: string; words: string[] }[] = [
  {
    category: "vacancies",
    kind: "VACANCY",
    words: [
      "vacanc",
      "job",
      "stellenangebot",
      "stellen",
      "career",
      "offene-stellen",
      "open-position",
      "promotion",
      "doktorand",
      "phd-position",
      "recruit",
    ],
  },
  {
    category: "people",
    kind: "RESEARCHER",
    words: [
      "people",
      "staff",
      "team",
      "mitarbeiter",
      "personen",
      "professor",
      "faculty",
      "members",
    ],
  },
  {
    category: "projects",
    kind: "PROJECT",
    words: ["project", "projekte", "forschungsprojekt", "research-project"],
  },
  {
    category: "publications",
    kind: "PUBLICATION",
    words: [
      "publication",
      "publikation",
      "veroeffentlichung",
      "veröffentlichung",
      "papers",
      "bibliograph",
    ],
  },
  {
    category: "events",
    kind: "EVENT",
    words: [
      "event",
      "veranstaltung",
      "conference",
      "tagung",
      "photogrammetric-week",
      "photogrammetrische-woche",
      "workshop",
      "colloqui",
      "kolloqui",
      "summer-school",
    ],
  },
  {
    category: "courses",
    kind: "COURSE",
    words: [
      "course",
      "lehre",
      "lehrveranstaltung",
      "teaching",
      "module",
      "vorlesung",
    ],
  },
  {
    category: "programmes",
    kind: "PROGRAMME",
    words: [
      "study",
      "studium",
      "studiengang",
      "degree",
      "master",
      "bachelor",
      "programme",
      "program",
    ],
  },
  {
    category: "research_groups",
    kind: "RESEARCH_GROUP",
    words: [
      "research-group",
      "arbeitsgruppe",
      "group",
      "abteilung",
      "chair",
      "lehrstuhl",
    ],
  },
  {
    category: "research",
    kind: "RESEARCH_NEWS",
    words: [
      "research",
      "forschung",
      "news",
      "aktuelles",
      "topics",
      "forschungsschwerpunkt",
    ],
  },
  {
    category: "department",
    kind: "DEPARTMENT",
    words: ["institute", "institut", "department", "fakult"],
  },
];

const DOMAIN_WORDS = [
  "photogrammet",
  "remote-sensing",
  "fernerkundung",
  "geoinformat",
  "geodes",
  "geomatic",
  "computer-vision",
  "point-cloud",
  "punktwolke",
  "lidar",
  "sar",
  "earth-observation",
  "geoai",
  "mapping",
];

export type Classification = { classification: string; confidence: number };

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function classifyUrlAndText(
  url: string,
  title: string,
  text: string,
): Classification {
  // Match on path + title only: the host (e.g. ifp.uni-stuttgart.de) would
  // otherwise tag every page of an institute with the same category.
  const path = pathOf(url);
  const heading = title.toLowerCase();
  const body = text.toLowerCase().slice(0, 6000);
  let best: Classification = { classification: "UNKNOWN", confidence: 0 };
  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const w of rule.words) {
      // The URL path is the strongest signal; institute names in titles would
      // otherwise label every page of an institute as a department page.
      if (path.includes(w)) score += 0.5;
      if (heading.includes(w)) score += 0.15;
      if (body.includes(w.replace(/-/g, " "))) score += 0.08;
    }
    if (score > best.confidence)
      best = { classification: rule.kind, confidence: Math.min(0.95, score) };
  }
  if (best.confidence < 0.2)
    return { classification: "GENERAL", confidence: 0.1 };
  return best;
}

function categoryForUrl(url: string): string | null {
  const u = pathOf(url);
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => u.includes(w))) return rule.category;
  }
  return null;
}

function isDomainRelevant(url: string, label: string): boolean {
  const s = `${pathOf(url)} ${label}`.toLowerCase().replace(/\s+/g, "-");
  return (
    DOMAIN_WORDS.some((w) => s.includes(w)) || categoryForUrl(url) !== null
  );
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

const robotsCache = new Map<string, string[]>();

/** Minimal robots.txt honouring: collects Disallow rules for `*` and our agent. */
export async function robotsDisallows(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: string[] = [];
  try {
    const res = await timedFetch(`${origin}/robots.txt`, {
      headers: { accept: "text/plain" },
    });
    if (res.ok) {
      const txt = await res.text();
      let applies = false;
      for (const raw of txt.split("\n")) {
        const line = raw.split("#")[0]?.trim() ?? "";
        const [keyRaw, ...rest] = line.split(":");
        const key = (keyRaw ?? "").trim().toLowerCase();
        const value = rest.join(":").trim();
        if (key === "user-agent")
          applies =
            value === "*" || value.toLowerCase().includes("geoacademic");
        else if (key === "disallow" && applies && value) rules.push(value);
      }
    }
  } catch {
    rules = [];
  }
  robotsCache.set(origin, rules);
  return rules;
}

export async function isAllowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const rules = await robotsDisallows(u.origin);
  return !rules.some((r) => u.pathname.startsWith(r));
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m?.[1] ? decodeEntities(m[1]).trim().slice(0, 300) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&szlig;/g, "ß");
}

export function extractText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

export function extractLinks(
  html: string,
  baseUrl: string,
): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    )
      continue;
    try {
      const abs = new URL(href, baseUrl);
      abs.hash = "";
      if (!abs.protocol.startsWith("http")) continue;
      out.push({
        url: abs.toString(),
        label: decodeEntities(m[2] ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 200),
      });
    } catch {
      /* ignore malformed href */
    }
  }
  return out;
}

/**
 * Rejects navigation/support/download URLs before they ever become sources.
 * These patterns were responsible for many of the recent false candidates
 * (feedback pages, salary PDFs, application forms and generic FAQs).
 */
function junkDiscoveryReason(url: string, label = ""): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "invalid-url";
  }
  const path = decodeURIComponent(u.pathname).toLowerCase();
  const haystack = `${path} ${u.search.toLowerCase()} ${label.toLowerCase()}`;

  if (
    /\.(?:pdf|docx?|xlsx?|pptx?|zip|jpg|jpeg|png|gif|svg)(?:\/|$)/i.test(path)
  )
    return "document-or-asset";
  if (
    /(?:\/|^)(?:feedback|print|login|logout|privacy|impressum|sitemap)(?:\/|$)/i.test(
      path,
    )
  )
    return "utility-page";
  if (
    /(?:faq|frequently[-_ ]asked|application[-_ ]?form|sollicitatieformulier|salary[-_ ]?scale|salarisschaal)/i.test(
      haystack,
    )
  )
    return "support-or-form";
  if (
    /[?&](?:download|attachment|format|output)=(?:1|true|pdf|doc|docx)/i.test(
      u.search,
    )
  )
    return "download-link";
  if (/\/(?:view|feedback)\/?$/i.test(path) && /\.(?:pdf|docx?)\//i.test(path))
    return "document-view";
  return null;
}

function isJunkDiscoveryUrl(url: string, label = ""): boolean {
  return junkDiscoveryReason(url, label) !== null;
}

const DETAIL_KIND_BY_CATEGORY: Record<string, string> = {
  vacancies: "VACANCY",
  people: "RESEARCHER",
  projects: "PROJECT",
  events: "EVENT",
  programmes: "PROGRAMME",
  courses: "COURSE",
};

function detailKindFromAdapter(adapterKey: string | null): string | null {
  if (!adapterKey) return null;
  const m =
    /^html-(vacancies|people|projects|events|programmes|courses)-detail$/.exec(
      adapterKey,
    );
  return m?.[1]
    ? (DETAIL_KIND_BY_CATEGORY[m[1]] ?? null)
    : adapterKey === "html-vacancy"
      ? "VACANCY"
      : null;
}

function likelyDetailLink(
  category: string,
  url: string,
  label: string,
  parentUrl: string,
): boolean {
  let child: URL;
  let parent: URL;
  try {
    child = new URL(url);
    parent = new URL(parentUrl);
  } catch {
    return false;
  }
  if (child.host !== parent.host || child.toString() === parent.toString())
    return false;
  if (isJunkDiscoveryUrl(child.toString(), label)) return false;

  const cleanLabel = label.replace(/\s+/g, " ").trim();
  const text = `${child.pathname} ${child.search} ${cleanLabel}`.toLowerCase();
  const generic =
    /^(more|read more|learn more|overview|home|back|next|previous|all|view all|people|team|staff|projects|events|courses|programmes?|research|news|contact)$/i;
  if (!cleanLabel || generic.test(cleanLabel)) return false;

  const depth = child.pathname.split("/").filter(Boolean).length;
  const parentDepth = parent.pathname.split("/").filter(Boolean).length;
  const deeper = depth > parentDepth;
  const detailQuery =
    /[?&](?:id|uid|pid|event(?:id)?|project(?:id)?|person(?:id)?|profile(?:id)?|detail|view|article|bbsidx|tx_[^=]*\[(?:uid|id)\])=/i.test(
      child.search,
    );
  const wordCount = cleanLabel.split(/\s+/).filter(Boolean).length;
  const informative = cleanLabel.length >= 8 && wordCount >= 2;
  const personLike =
    /^(?:(?:prof(?:essor)?\.?|dr\.?|ph\.?d\.?|pd)\s+)*(?:[\p{L}][\p{L}'’.-]+\s+){1,5}[\p{L}][\p{L}'’.-]+$/iu.test(
      cleanLabel,
    );

  // Parent listings are already category-scoped. Requiring the category word
  // again in every child URL dropped many legitimate records such as /john-doe,
  // /urban-digital-twin, or calendar links that differ only by ?id=. Structural
  // evidence is therefore accepted here; the deterministic entity gate still
  // decides whether the fetched page is a real record before any model call.
  switch (category) {
    case "people":
      return (
        /(people|staff|team|faculty|profile|person|member|researcher|professor|mitarbeiter)/i.test(
          text,
        ) || personLike
      );
    case "projects":
      return (
        /(project|projekt|research[-_/ ]?project)/i.test(text) ||
        detailQuery ||
        (deeper && informative) ||
        (depth === parentDepth && wordCount >= 3)
      );
    case "events":
      return (
        /(event|conference|workshop|seminar|colloqui|symposium|tagung|veranstaltung|summer[-_/ ]?school)/i.test(
          text,
        ) ||
        detailQuery ||
        (deeper && informative) ||
        (depth === parentDepth && wordCount >= 3)
      );
    case "programmes":
      return (
        /(programme|program|degree|study|studium|master|bachelor|doctoral|phd)/i.test(
          text,
        ) ||
        detailQuery ||
        (deeper && informative)
      );
    case "courses":
      return (
        /(course|module|lecture|class|teaching|lehre|vorlesung)/i.test(text) ||
        detailQuery ||
        (deeper && informative)
      );
    default:
      return false;
  }
}

/**
 * Expands high-value listing pages into individual detail sources. Detail
 * sources do not recurse, so one directory cannot explode into a site crawl.
 */
async function registerDetailSourcesFromLinks(input: {
  links: { url: string; label: string }[];
  finalUrl: string;
  category: string | null;
  institutionId: string | null;
  adapterKey: string | null;
}): Promise<number> {
  const category = input.category ?? "";
  if (input.adapterKey?.endsWith("-detail")) return 0;
  if (category === "vacancies") return 0; // vacancy expansion has stricter legacy logic below

  const allLinks = input.links
    .slice(0, 200)
    .filter((l) => !isJunkDiscoveryUrl(l.url, l.label));

  // Research-group/chair pages often contain both staff profiles and project
  // links. Expand both instead of treating the group page itself as a record.
  const targetCategories =
    category === "research_groups"
      ? (["people", "projects"] as const)
      : DETAIL_KIND_BY_CATEGORY[category]
        ? ([category] as const)
        : ([] as const);
  if (targetCategories.length === 0) return 0;

  const candidates: { url: string; label: string; category: string }[] = [];
  for (const targetCategory of targetCategories) {
    for (const link of allLinks) {
      if (
        likelyDetailLink(targetCategory, link.url, link.label, input.finalUrl)
      ) {
        candidates.push({ ...link, category: targetCategory });
      }
    }
  }

  let insertedCount = 0;
  const seen = new Set<string>();
  for (const link of candidates.slice(0, 100)) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);

    const { data: existing } = await supabaseAdmin
      .from("sources")
      .select("id, adapter_key, category, status, active, institution_id")
      .eq("url", link.url)
      .maybeSingle();

    if (existing) {
      const targetClassification =
        DETAIL_KIND_BY_CATEGORY[link.category] ?? null;
      const nextPriority =
        link.category === "people" ||
        link.category === "projects" ||
        link.category === "events"
          ? 1
          : 2;

      // Critical recovery path: v6 could discover a detail link that already
      // existed as a generic source, upgrade its adapter, and then stop. If its
      // content had already been fetched, the next fetch was unchanged and it
      // never entered NORMALIZE. Reuse the stored raw page instead of waiting
      // for the website to change.
      if (!existing.adapter_key?.endsWith("-detail")) {
        await supabaseAdmin
          .from("sources")
          .update({
            adapter_key: `html-${link.category}-detail`,
            category: link.category,
            priority: nextPriority,
          })
          .eq("id", existing.id);
      }

      const { data: latestRaw } = await supabaseAdmin
        .from("raw_records")
        .select(
          "id, normalization_status, classification, classification_confidence",
        )
        .eq("source_id", existing.id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        latestRaw &&
        targetClassification &&
        latestRaw.normalization_status !== "NORMALIZED"
      ) {
        await supabaseAdmin
          .from("raw_records")
          .update({
            classification: targetClassification,
            classification_confidence: Math.max(
              Number(latestRaw.classification_confidence ?? 0),
              0.72,
            ),
            normalization_status: "PENDING",
            normalization_error: null,
          } as never)
          .eq("id", latestRaw.id);
        await enqueue("NORMALIZE", {
          source_id: existing.id,
          institution_id:
            existing.institution_id ?? input.institutionId ?? undefined,
          payload: {
            classification: targetClassification,
            reason: "deep-discovery-v6.1-existing-detail",
          },
        });
      } else if (
        !latestRaw &&
        existing.status !== "BLOCKED" &&
        existing.active !== false
      ) {
        await enqueue("FETCH", {
          source_id: existing.id,
          institution_id:
            existing.institution_id ?? input.institutionId ?? undefined,
          payload: { reason: "deep-discovery-v6.1-existing-detail" },
        });
      }
      continue;
    }

    const { data: child, error } = await supabaseAdmin
      .from("sources")
      .insert({
        url: link.url,
        canonical_url: link.url,
        name: (link.label || link.url).slice(0, 200),
        source_type:
          link.category === "projects"
            ? ("project" as never)
            : ("institution" as never),
        adapter_key: `html-${link.category}-detail`,
        institution_id: input.institutionId,
        category: link.category,
        priority:
          link.category === "people" ||
          link.category === "projects" ||
          link.category === "events"
            ? 1
            : 2,
        status: "PENDING",
        discovered_from: input.finalUrl,
        trust_level: 5,
        active: true,
        notes: `Individual ${link.category} detail page expanded from an institutional listing`,
      })
      .select("id")
      .maybeSingle();
    if (error || !child) continue;
    insertedCount += 1;
    await enqueue("FETCH", {
      source_id: child.id,
      institution_id: input.institutionId ?? undefined,
    });
  }
  return insertedCount;
}

async function registerDetailSources(input: {
  html: string;
  finalUrl: string;
  category: string | null;
  institutionId: string | null;
  adapterKey: string | null;
}): Promise<number> {
  return registerDetailSourcesFromLinks({
    links: extractLinks(input.html, input.finalUrl),
    finalUrl: input.finalUrl,
    category: input.category,
    institutionId: input.institutionId,
    adapterKey: input.adapterKey,
  });
}

async function registerVacancySources(input: {
  links: { url: string; label: string }[];
  finalUrl: string;
  institutionId: string | null;
}): Promise<number> {
  const host = new URL(input.finalUrl).host.toLowerCase();
  const knownApplicantTrackingHost = (candidate: string) =>
    /(?:^|\.)(?:myworkdayjobs\.com|workdayjobs\.com|jobs\.lever\.co|greenhouse\.io|smartrecruiters\.com|personio\.(?:de|com)|successfactors\.(?:com|eu)|jobs\.sap\.com|taleo\.net|icims\.com|jobvite\.com|recruitee\.com|workable\.com|onlyfy\.io|jobylon\.com)$/i.test(
      candidate,
    );
  const canonicalJobUrl = (value: string): string | null => {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return null;
      url.hash = "";
      for (const key of [...url.searchParams.keys()]) {
        if (
          /^(?:utm_.+|fbclid|gclid|mc_[a-z]+|ref|referrer|source|campaign|trk|tracking)$/i.test(
            key,
          )
        ) {
          url.searchParams.delete(key);
        }
      }
      return url.toString();
    } catch {
      return null;
    }
  };
  const genericLabel =
    /^(?:apply|apply now|details|learn more|more|next|previous|search|view|view all|view jobs|all jobs|open positions?)$/i;
  const postings = input.links.flatMap((link) => {
    const canonical = canonicalJobUrl(link.url);
    if (!canonical || isJunkDiscoveryUrl(canonical, link.label)) return [];
    const url = new URL(canonical);
    const label = link.label.replace(/\s+/g, " ").trim();
    const signal = `${url.pathname} ${url.search} ${label}`;
    const sameHost = url.host.toLowerCase() === host;
    const atsHost = knownApplicantTrackingHost(url.hostname.toLowerCase());
    const detailSignal =
      /(?:\/(?:job|jobs|vacanc(?:y|ies)|position|stelle|stellenangebot|requisition)(?:\/|[-_]))|(?:[?&](?:jobid|job_id|job|reqid|req_id|requisitionid|positionid|postingid)=)|(?:\/(?:job|requisition)\/\d{3,})/i.test(
        signal,
      );
    const roleLabel =
      label.length >= 8 && !genericLabel.test(label) && ROLE_TITLE.test(label);
    if ((!sameHost && !atsHost) || (!detailSignal && !roleLabel)) return [];
    return [{ url: canonical, label }];
  });
  let inserted = 0;
  const seen = new Set<string>();
  for (const posting of postings.slice(0, 60)) {
    if (seen.has(posting.url)) continue;
    seen.add(posting.url);
    const [urlMatch, canonicalMatch] = await Promise.all([
      supabaseAdmin
        .from("sources")
        .select("id")
        .eq("url", posting.url)
        .maybeSingle(),
      supabaseAdmin
        .from("sources")
        .select("id")
        .eq("canonical_url", posting.url)
        .maybeSingle(),
    ]);
    if (urlMatch.data || canonicalMatch.data) continue;
    const { data: child } = await supabaseAdmin
      .from("sources")
      .insert({
        url: posting.url,
        canonical_url: posting.url,
        name: (posting.label || posting.url).slice(0, 200),
        source_type: "careers_page" as never,
        adapter_key: "html-vacancy",
        institution_id: input.institutionId,
        category: "vacancies",
        priority: 1,
        status: "PENDING",
        discovered_from: input.finalUrl,
        trust_level: 5,
        active: true,
        notes: "Individual posting linked from a vacancy listing page",
      })
      .select("id")
      .maybeSingle();
    if (!child) continue;
    inserted += 1;
    await enqueue("FETCH", {
      source_id: child.id,
      institution_id: input.institutionId ?? undefined,
    });
  }
  return inserted;
}

/* ------------------------------------------------------------------ */
/* DISCOVERY                                                           */
/* ------------------------------------------------------------------ */

export type DiscoveryResult = {
  institution: string;
  seeds: string[];
  discovered: number;
  inserted: number;
  skipped: number;
  errors: { url: string; error: string }[];
};

/**
 * Discovers academically relevant sources for one institution, scoped to the
 * institute host/path only — never the whole university domain.
 */
export async function discoverInstitutionSources(
  institutionId: string,
  maxSources = 150,
): Promise<DiscoveryResult> {
  const { data: inst, error } = await supabaseAdmin
    .from("institutions")
    .select("id, name, slug, official_url, research_url, careers_url")
    .eq("id", institutionId)
    .maybeSingle();
  if (error) throw error;
  if (!inst) throw new Error(`Institution ${institutionId} not found`);

  const seeds = [inst.research_url, inst.careers_url].filter((u): u is string =>
    Boolean(u),
  );
  if (seeds.length === 0 && inst.official_url) seeds.push(inst.official_url);

  const result: DiscoveryResult = {
    institution: inst.name,
    seeds,
    discovered: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };
  const scopes = seeds.map((s) => new URL(s));
  const candidates = new Map<string, { label: string; from: string }>();

  for (const seed of seeds) {
    try {
      if (!(await isAllowed(seed))) {
        result.errors.push({ url: seed, error: "blocked by robots.txt" });
        continue;
      }
      const res = await timedFetch(seed);
      if (!res.ok) {
        result.errors.push({ url: seed, error: `HTTP ${res.status}` });
        continue;
      }
      const html = await res.text();
      const finalUrl = res.url || seed;
      candidates.set(new URL(finalUrl).toString(), {
        label: extractTitle(html) ?? inst.name,
        from: "seed",
      });
      for (const link of extractLinks(html, finalUrl)) {
        const u = new URL(link.url);
        const inScope = scopes.some((s) => u.host === s.host);
        if (!inScope) continue;
        if (isJunkDiscoveryUrl(u.toString(), link.label)) continue;
        if (!isDomainRelevant(u.toString(), link.label)) continue;
        if (!candidates.has(u.toString()))
          candidates.set(u.toString(), { label: link.label, from: finalUrl });
      }
    } catch (e) {
      result.errors.push({
        url: seed,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  result.discovered = candidates.size;

  const CATEGORY_ORDER = [
    "vacancies",
    "people",
    "projects",
    "publications",
    "events",
    "programmes",
    "courses",
    "research_groups",
  ];
  const ranked = Array.from(candidates.entries()).sort((a, b) => {
    const rank = (u: string) => {
      const idx = CATEGORY_ORDER.indexOf(categoryForUrl(u) ?? "");
      return idx === -1 ? CATEGORY_ORDER.length : idx;
    };
    return rank(a[0]) - rank(b[0]);
  });

  for (const [url, meta] of ranked.slice(0, maxSources)) {
    const category = categoryForUrl(url) ?? "research";
    const sourceType =
      category === "vacancies"
        ? "careers_page"
        : category === "research_groups"
          ? "research_group"
          : "institution";
    const { data: existing } = await supabaseAdmin
      .from("sources")
      .select("id")
      .eq("url", url)
      .maybeSingle();
    if (existing) {
      result.skipped += 1;
      continue;
    }
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("sources")
      .insert({
        url,
        canonical_url: url,
        name: (meta.label || url).slice(0, 200),
        organization: inst.name,
        source_type: sourceType as never,
        adapter_key: "html-generic",
        institution_id: inst.id,
        category,
        priority:
          category === "vacancies"
            ? 1
            : category === "people" || category === "projects"
              ? 2
              : 4,
        status: "PENDING",
        discovered_from: meta.from,
        trust_level: 5,
        active: true,
        notes:
          "Discovered by discover-academic-sources (institution-scoped crawl)",
      })
      .select("id")
      .maybeSingle();
    if (insErr) {
      result.errors.push({ url, error: insErr.message });
      continue;
    }
    result.inserted += 1;
    if (inserted)
      await enqueue("FETCH", {
        source_id: inserted.id,
        institution_id: inst.id,
      });
  }
  return result;
}

const HIGH_VALUE_RESEED_CATEGORIES = new Set([
  "people",
  "projects",
  "events",
  "vacancies",
  "programmes",
  "courses",
  "research_groups",
]);

const RESEED_PRIORITY: Record<string, number> = {
  people: 0,
  projects: 1,
  events: 2,
  vacancies: 3,
  research_groups: 4,
  programmes: 5,
  courses: 6,
};

/**
 * One-time/bounded deep-discovery reseed for listing/index sources that were
 * fetched before detail-page expansion existed. No raw records are deleted.
 * Each source is marked in notes after being queued so an idle worker does not
 * continuously refetch the same directory.
 */
export async function enqueueHighValueReseed(limit = 150): Promise<{
  scanned: number;
  eligible: number;
  queued: number;
  by_category: Record<string, number>;
}> {
  const marker = "deep-discovery-v6.1";
  const { data: sources, error } = await supabaseAdmin
    .from("sources")
    .select(
      "id, url, category, adapter_key, institution_id, notes, status, active, last_success_at",
    )
    .eq("active", true)
    .limit(5000);
  if (error) throw error;

  const rows = (sources ?? [])
    .filter((source) => {
      const category = source.category ?? "";
      if (!HIGH_VALUE_RESEED_CATEGORIES.has(category)) return false;
      if (
        source.adapter_key?.endsWith("-detail") ||
        source.adapter_key === "html-vacancy"
      )
        return false;
      if (source.status === "BLOCKED") return false;
      if (isJunkDiscoveryUrl(source.url)) return false;
      if ((source.notes ?? "").includes(marker)) return false;
      return true;
    })
    .sort((a, b) => {
      const ap = RESEED_PRIORITY[a.category ?? ""] ?? 99;
      const bp = RESEED_PRIORITY[b.category ?? ""] ?? 99;
      if (ap !== bp) return ap - bp;
      const at = a.last_success_at ? new Date(a.last_success_at).getTime() : 0;
      const bt = b.last_success_at ? new Date(b.last_success_at).getTime() : 0;
      return at - bt;
    });

  const chosen = rows.slice(0, Math.max(1, Math.min(limit, 300)));
  const byCategory: Record<string, number> = {};
  let queued = 0;
  for (const source of chosen) {
    await enqueue("FETCH", {
      source_id: source.id,
      institution_id: source.institution_id ?? undefined,
      payload: { reason: marker, category: source.category ?? null },
    });
    const nextNotes =
      `${source.notes ?? ""}${source.notes ? "\n" : ""}${marker}: queued ${new Date().toISOString()}`.slice(
        0,
        4000,
      );
    await supabaseAdmin
      .from("sources")
      .update({ notes: nextNotes })
      .eq("id", source.id);
    queued += 1;
    const category = source.category ?? "unknown";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }

  return {
    scanned: (sources ?? []).length,
    eligible: rows.length,
    queued,
    by_category: byCategory,
  };
}

/**
 * Repairs detail sources that v6 already discovered/upgraded but never sent
 * back through normalization because their stored page content was unchanged.
 * This is database-only when raw HTML/text is already present: no refetch and
 * no model call until the deterministic entity gate accepts the page.
 */
export async function enqueueExistingDetailRecovery(limit = 300): Promise<{
  scanned: number;
  normalize_queued: number;
  fetch_queued: number;
  already_normalized: number;
}> {
  const { data: sources, error } = await supabaseAdmin
    .from("sources")
    .select("id, adapter_key, institution_id, status, active")
    .eq("active", true)
    .like("adapter_key", "html-%-detail")
    .limit(Math.max(1, Math.min(limit, 1000)));
  if (error) throw error;

  let normalizeQueued = 0;
  let fetchQueued = 0;
  let alreadyNormalized = 0;

  for (const source of sources ?? []) {
    const classification = detailKindFromAdapter(source.adapter_key);
    if (!classification) continue;

    const { data: raw } = await supabaseAdmin
      .from("raw_records")
      .select(
        "id, normalization_status, classification, classification_confidence",
      )
      .eq("source_id", source.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (raw) {
      if (raw.normalization_status === "NORMALIZED") {
        alreadyNormalized += 1;
        continue;
      }
      await supabaseAdmin
        .from("raw_records")
        .update({
          classification,
          classification_confidence: Math.max(
            Number(raw.classification_confidence ?? 0),
            0.72,
          ),
          normalization_status: "PENDING",
          normalization_error: null,
        } as never)
        .eq("id", raw.id);
      await enqueue("NORMALIZE", {
        source_id: source.id,
        institution_id: source.institution_id ?? undefined,
        payload: { classification, reason: "detail-recovery-v6.1" },
      });
      normalizeQueued += 1;
      continue;
    }

    if (source.status !== "BLOCKED") {
      await enqueue("FETCH", {
        source_id: source.id,
        institution_id: source.institution_id ?? undefined,
        payload: { reason: "detail-recovery-v6.1" },
      });
      fetchQueued += 1;
    }
  }

  return {
    scanned: (sources ?? []).length,
    normalize_queued: normalizeQueued,
    fetch_queued: fetchQueued,
    already_normalized: alreadyNormalized,
  };
}

/* ------------------------------------------------------------------ */
/* QUEUE                                                               */
/* ------------------------------------------------------------------ */

export async function enqueue(
  taskType:
    | "DISCOVER"
    | "FETCH"
    | "CLASSIFY"
    | "EXTRACT"
    | "NORMALIZE"
    | "VERIFY"
    | "PROMOTE_INSTITUTION"
    | "IMPORT_PUBLICATIONS"
    | "IMPORT_PROJECTS",
  opts: {
    source_id?: string | undefined;
    institution_id?: string | undefined;
    payload?: Record<string, unknown> | undefined;
  },
): Promise<void> {
  if (opts.source_id) {
    const { data: dup } = await supabaseAdmin
      .from("ingestion_tasks")
      .select("id")
      .eq("task_type", taskType)
      .eq("source_id", opts.source_id)
      .in("status", ["QUEUED", "PROCESSING", "RETRY"])
      .maybeSingle();
    if (dup) return;
  } else if (
    opts.institution_id &&
    ["PROMOTE_INSTITUTION", "IMPORT_PUBLICATIONS", "IMPORT_PROJECTS"].includes(
      taskType,
    )
  ) {
    const { data: dup } = await supabaseAdmin
      .from("ingestion_tasks")
      .select("id")
      .eq("task_type", taskType)
      .eq("institution_id", opts.institution_id)
      .in("status", ["QUEUED", "PROCESSING", "RETRY"])
      .maybeSingle();
    if (dup) return;
  }
  await supabaseAdmin.from("ingestion_tasks").insert({
    task_type: taskType,
    source_id: opts.source_id ?? null,
    institution_id: opts.institution_id ?? null,
    payload: (opts.payload ?? {}) as never,
  });
}

const NORMALIZABLE_CLASSES = new Set([
  "PROJECT",
  "RESEARCHER",
  "EVENT",
  "VACANCY",
  "PROGRAMME",
  "COURSE",
]);

const NORMALIZE_CLASS_PRIORITY: Record<string, number> = {
  PROJECT: 0,
  RESEARCHER: 1,
  EVENT: 2,
  VACANCY: 3,
  PROGRAMME: 4,
  COURSE: 5,
  PUBLICATION: 6,
  RESEARCH_GROUP: 7,
  DEPARTMENT: 8,
  RESEARCH_NEWS: 9,
  GENERAL: 10,
  UNKNOWN: 11,
};

function queuedClassification(task: { payload?: unknown }): string {
  if (
    !task.payload ||
    typeof task.payload !== "object" ||
    Array.isArray(task.payload)
  )
    return "UNKNOWN";
  const value = (task.payload as Record<string, unknown>)["classification"];
  return typeof value === "string" ? value.toUpperCase() : "UNKNOWN";
}

/**
 * Runs a small batch of queued work. Exponential backoff, DEAD after max attempts.
 * NORMALIZE callers can opt into concurrency 2; fetch/provider work stays
 * sequential by default. Tasks are conditionally claimed before processing so
 * overlapping manual/cron runs cannot process the same queue row twice.
 *
 * NORMALIZE work is selected from a wider due-task window and sorted by
 * user-value classification before age. This drains PROJECT/RESEARCHER/EVENT
 * candidates before generic research/news pages without changing canonical
 * validation rules.
 */
export async function runQueueBatch(
  limit = 8,
  taskTypes?: string[],
  concurrency = 1,
): Promise<{
  processed: number;
  ok: number;
  failed: number;
  dead: number;
  normalized: number;
  skipped: number;
  details: string[];
}> {
  let query = supabaseAdmin
    .from("ingestion_tasks")
    .select("*")
    .in("status", ["QUEUED", "RETRY"])
    .lte("run_after", new Date().toISOString());
  if (taskTypes && taskTypes.length > 0)
    query = query.in("task_type", taskTypes);

  const normalizeOnly = taskTypes?.length === 1 && taskTypes[0] === "NORMALIZE";
  // Pull a wider candidate window for NORMALIZE so high-value academic pages
  // are not buried behind hundreds of generic pages with older run_after values.
  const candidateLimit = normalizeOnly
    ? Math.min(200, Math.max(limit * 6, 48))
    : limit;
  const { data: candidates, error } = await query
    .order("run_after")
    .limit(candidateLimit);
  if (error) throw error;

  let selected = [...(candidates ?? [])];
  if (normalizeOnly) {
    selected.sort((a, b) => {
      const fallbackPriority = NORMALIZE_CLASS_PRIORITY["UNKNOWN"] ?? 99;
      const ap =
        NORMALIZE_CLASS_PRIORITY[queuedClassification(a)] ?? fallbackPriority;
      const bp =
        NORMALIZE_CLASS_PRIORITY[queuedClassification(b)] ?? fallbackPriority;
      if (ap !== bp) return ap - bp;
      return new Date(a.run_after).getTime() - new Date(b.run_after).getTime();
    });
    selected = selected.slice(0, limit);
  }

  const out = {
    processed: 0,
    ok: 0,
    failed: 0,
    dead: 0,
    normalized: 0,
    skipped: 0,
    details: [] as string[],
  };
  const queue = selected;
  const workers = Math.max(
    1,
    Math.min(Math.floor(concurrency), queue.length || 1),
  );
  let cursor = 0;

  const processTask = async (task: (typeof queue)[number]) => {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: "PROCESSING",
        attempts: task.attempts + 1,
        started_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", task.id)
      .in("status", ["QUEUED", "RETRY"])
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return;

    out.processed += 1;
    try {
      let detail = "";
      if (task.task_type === "DISCOVER" && task.institution_id) {
        const r = await discoverInstitutionSources(task.institution_id);
        detail = `DISCOVER ${r.institution}: +${r.inserted}/${r.discovered}`;
      } else if (task.task_type === "FETCH" && task.source_id) {
        const r = await fetchSource(task.source_id);
        detail = `FETCH ${r.http_status} ${r.classification ?? "-"} ${r.url}`;
      } else if (task.task_type === "NORMALIZE" && task.source_id) {
        const r = await normalizeSource(task.source_id);
        if (r.status === "NORMALIZED") out.normalized += 1;
        if (r.status === "SKIPPED") out.skipped += 1;
        detail = `NORMALIZE ${r.status}${r.reason ? `: ${r.reason}` : ""}`;
      } else if (
        task.task_type === "PROMOTE_INSTITUTION" &&
        task.institution_id
      ) {
        const { promoteInstitution } = await import("./openalex.server");
        const r = await promoteInstitution(task.institution_id);
        if (r.matched) {
          await enqueue("IMPORT_PUBLICATIONS", {
            institution_id: task.institution_id,
            payload: { after_ror: true },
          });
          await enqueue("IMPORT_PROJECTS", {
            institution_id: task.institution_id,
            payload: { after_ror: true },
          });
        }
        detail = `PROMOTE ${r.institution}: ${r.matched ? `matched ${r.ror ?? r.provider_id ?? "ROR"}${r.promoted ? " (promoted)" : ""}` : `no match (${r.reason})`}`;
      } else if (
        task.task_type === "IMPORT_PUBLICATIONS" &&
        task.institution_id
      ) {
        const { importInstitutionPublications, promoteInstitution } =
          await import("./openalex.server");
        const { data: inst } = await supabaseAdmin
          .from("institutions")
          .select("institution_identifier, is_demo")
          .eq("id", task.institution_id)
          .maybeSingle();
        const hasRor = /^(?:https?:\/\/ror\.org\/)?0[a-z0-9]{8}$/i.test(
          (inst?.institution_identifier ?? "").trim(),
        );
        if (!hasRor || inst?.is_demo) {
          const promoted = await promoteInstitution(task.institution_id);
          if (!promoted.matched) {
            detail = `PUBLICATIONS ${promoted.institution}: waiting for verified ROR (${promoted.reason ?? "no match"})`;
          } else {
            const r = await importInstitutionPublications(task.institution_id);
            detail = `PUBLICATIONS ${r.institution}: +${r.inserted} new, ${r.updated} updated, ${r.seen} seen via ${r.provider}`;
          }
        } else {
          const r = await importInstitutionPublications(task.institution_id);
          detail = `PUBLICATIONS ${r.institution}: +${r.inserted} new, ${r.updated} updated, ${r.seen} seen via ${r.provider}`;
        }
      } else if (task.task_type === "IMPORT_PROJECTS" && task.institution_id) {
        const { importInstitutionProjects, promoteInstitution } =
          await import("./openalex.server");
        const { data: inst } = await supabaseAdmin
          .from("institutions")
          .select("institution_identifier, is_demo")
          .eq("id", task.institution_id)
          .maybeSingle();
        const hasRor = /^(?:https?:\/\/ror\.org\/)?0[a-z0-9]{8}$/i.test(
          (inst?.institution_identifier ?? "").trim(),
        );
        if (!hasRor || inst?.is_demo) {
          const promoted = await promoteInstitution(task.institution_id);
          if (!promoted.matched) {
            detail = `PROJECTS ${promoted.institution}: waiting for verified ROR (${promoted.reason ?? "no match"})`;
          } else {
            const r = await importInstitutionProjects(task.institution_id);
            detail = `PROJECTS ${r.institution}: +${r.inserted} new, ${r.updated} updated, ${r.seen} seen via OpenAIRE`;
          }
        } else {
          const r = await importInstitutionProjects(task.institution_id);
          detail = `PROJECTS ${r.institution}: +${r.inserted} new, ${r.updated} updated, ${r.seen} seen via OpenAIRE`;
        }
      } else {
        throw new Error(
          `Unsupported task ${task.task_type} (missing source/institution)`,
        );
      }
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({ status: "COMPLETE", completed_at: new Date().toISOString() })
        .eq("id", task.id);
      out.ok += 1;
      out.details.push(detail);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();
      // Provider rate/capacity deferrals are not data failures and must not burn retry attempts.
      if (e && typeof e === "object" && "retryAfterMinutes" in e) {
        const minutes = Math.max(
          1,
          Number((e as { retryAfterMinutes?: number }).retryAfterMinutes ?? 30),
        );
        await supabaseAdmin
          .from("ingestion_tasks")
          .update({
            status: "RETRY",
            attempts: task.attempts,
            last_error: message.slice(0, 1000),
            run_after: new Date(Date.now() + minutes * 60_000).toISOString(),
          })
          .eq("id", task.id);
        out.failed += 1;
        out.details.push(
          `DEFERRED ${task.task_type}: ${message.slice(0, 160)} (${minutes}m)`,
        );
        return;
      }
      const attempts = task.attempts + 1;
      const dead = attempts >= task.max_attempts;
      const backoffMinutes = Math.min(60 * 12, 2 ** attempts);
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({
          status: dead ? "DEAD" : "RETRY",
          last_error: message.slice(0, 1000),
          run_after: new Date(
            Date.now() + backoffMinutes * 60_000,
          ).toISOString(),
        })
        .eq("id", task.id);
      if (dead) out.dead += 1;
      else out.failed += 1;
      out.details.push(`FAILED ${task.task_type}: ${message.slice(0, 160)}`);
    }
  };

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        const task = queue[index];
        if (!task) return;
        await processTask(task);
      }
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* FETCH + RAW STORAGE + CLASSIFY                                      */
/* ------------------------------------------------------------------ */

export type FetchOutcome = {
  url: string;
  final_url: string | null;
  http_status: number;
  changed: boolean;
  classification: string | null;
  raw_record_id: string | null;
};

export type ExternalFetchLease = {
  task_id: string;
  source_id: string;
  lease_started_at: string;
  url: string;
  adapter_key: string | null;
  category: string | null;
  institution_id: string | null;
  refresh_frequency_hours: number;
  attempt: number;
  max_attempts: number;
};

export type ExternalFetchCompletion = {
  task_id: string;
  source_id: string;
  lease_started_at: string;
  success: boolean;
  http_status?: number;
  final_url?: string;
  page_title?: string | null;
  text_content?: string;
  links?: { url: string; label?: string }[];
  structured?: unknown;
  error?: string;
  blocked?: boolean;
  response_time_ms?: number;
};

const EXTERNAL_FETCH_LEASE_MS = 15 * 60_000;
const EXTERNAL_REVIEW_LEASE_MS = 20 * 60_000;
const REVIEW_BACKPRESSURE_HIGH_WATER = 120;

export type ExternalWorkerStatus = {
  due_fetch: number;
  due_vacancy_review: number;
  processing_vacancy_review: number;
  fetch_paused: boolean;
  review_high_water: number;
};

export async function getExternalWorkerStatus(): Promise<ExternalWorkerStatus> {
  const now = new Date().toISOString();
  const [
    { count: dueFetch, error: fetchError },
    { count: dueReview, error: reviewError },
    { count: processingReview, error: processingError },
  ] = await Promise.all([
    supabaseAdmin
      .from("ingestion_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_type", "FETCH")
      .in("status", ["QUEUED", "RETRY"])
      .lte("run_after", now),
    supabaseAdmin
      .from("ingestion_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_type", "NORMALIZE")
      .in("status", ["QUEUED", "RETRY"])
      .lte("run_after", now)
      .contains("payload", { classification: "VACANCY" }),
    supabaseAdmin
      .from("ingestion_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_type", "NORMALIZE")
      .eq("status", "PROCESSING")
      .contains("payload", { classification: "VACANCY" }),
  ]);
  if (fetchError) throw fetchError;
  if (reviewError) throw reviewError;
  if (processingError) throw processingError;
  const reviewBacklog = (dueReview ?? 0) + (processingReview ?? 0);
  return {
    due_fetch: dueFetch ?? 0,
    due_vacancy_review: dueReview ?? 0,
    processing_vacancy_review: processingReview ?? 0,
    fetch_paused: reviewBacklog >= REVIEW_BACKPRESSURE_HIGH_WATER,
    review_high_water: REVIEW_BACKPRESSURE_HIGH_WATER,
  };
}

/**
 * Claims FETCH work for a remote crawler. The lease timestamp is returned to
 * the worker and must be echoed on completion, preventing a late response from
 * overwriting a task that has already been recovered and leased again.
 */
export async function leaseExternalFetchTasks(
  limit = 8,
): Promise<ExternalFetchLease[]> {
  const now = new Date();
  const workerStatus = await getExternalWorkerStatus();
  if (workerStatus.fetch_paused) return [];
  const staleBefore = new Date(
    now.getTime() - EXTERNAL_FETCH_LEASE_MS,
  ).toISOString();

  const { data: stale, error: staleError } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("id, attempts, max_attempts")
    .eq("task_type", "FETCH")
    .eq("status", "PROCESSING")
    .lt("started_at", staleBefore)
    .limit(100);
  if (staleError) throw staleError;
  for (const task of stale ?? []) {
    const dead = task.attempts >= task.max_attempts;
    await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: dead ? "DEAD" : "RETRY",
        last_error: "External fetch lease expired before completion",
        run_after: now.toISOString(),
        started_at: null,
      })
      .eq("id", task.id)
      .eq("status", "PROCESSING")
      .lt("started_at", staleBefore);
  }

  const requested = Math.min(20, Math.max(1, Math.floor(limit)));
  const { data: candidates, error } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("id, source_id, attempts, max_attempts")
    .eq("task_type", "FETCH")
    .in("status", ["QUEUED", "RETRY"])
    .lte("run_after", now.toISOString())
    .order("run_after")
    .limit(requested * 3);
  if (error) throw error;

  const claimed: {
    id: string;
    source_id: string;
    started_at: string;
    attempts: number;
    max_attempts: number;
  }[] = [];
  for (const task of candidates ?? []) {
    if (claimed.length >= requested) break;
    if (!task.source_id) continue;
    const startedAt = new Date().toISOString();
    const { data: row, error: claimError } = await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: "PROCESSING",
        attempts: task.attempts + 1,
        started_at: startedAt,
        last_error: null,
      })
      .eq("id", task.id)
      .in("status", ["QUEUED", "RETRY"])
      .select("id, source_id, started_at, attempts, max_attempts")
      .maybeSingle();
    if (claimError) throw claimError;
    if (row?.source_id && row.started_at) {
      claimed.push({
        id: row.id,
        source_id: row.source_id,
        started_at: row.started_at,
        attempts: row.attempts,
        max_attempts: row.max_attempts,
      });
    }
  }
  if (claimed.length === 0) return [];

  const { data: sources, error: sourceError } = await supabaseAdmin
    .from("sources")
    .select(
      "id, url, adapter_key, category, institution_id, refresh_frequency_hours, active, status",
    )
    .in(
      "id",
      claimed.map((task) => task.source_id),
    );
  if (sourceError) throw sourceError;
  const byId = new Map((sources ?? []).map((source) => [source.id, source]));
  const leases: ExternalFetchLease[] = [];
  for (const task of claimed) {
    const source = byId.get(task.source_id);
    if (!source || source.active === false || source.status === "BLOCKED") {
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({
          status: "COMPLETE",
          completed_at: new Date().toISOString(),
          last_error: source
            ? "Source is inactive or blocked"
            : "Source no longer exists",
        })
        .eq("id", task.id)
        .eq("status", "PROCESSING")
        .eq("started_at", task.started_at);
      continue;
    }
    leases.push({
      task_id: task.id,
      source_id: source.id,
      lease_started_at: task.started_at,
      url: source.url,
      adapter_key: source.adapter_key,
      category: source.category,
      institution_id: source.institution_id,
      refresh_frequency_hours: source.refresh_frequency_hours,
      attempt: task.attempts,
      max_attempts: task.max_attempts,
    });
  }
  return leases;
}

function boundedResponseTime(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(10 * 60_000, Math.max(0, Math.round(value ?? 0)));
}

function externalUrl(value: string | undefined, fallback: string): string {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function externalLinks(
  value: ExternalFetchCompletion["links"],
): { url: string; label: string }[] {
  if (!Array.isArray(value)) return [];
  const links: { url: string; label: string }[] = [];
  for (const item of value.slice(0, 200)) {
    if (!item || typeof item.url !== "string") continue;
    try {
      const url = new URL(item.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      links.push({
        url: url.toString(),
        label:
          typeof item.label === "string" ? item.label.trim().slice(0, 200) : "",
      });
    } catch {
      // Ignore malformed worker output rather than failing the leased page.
    }
  }
  return links;
}

/** Stores a bounded page snapshot fetched by the external worker. */
export async function completeExternalFetch(
  input: ExternalFetchCompletion,
): Promise<{
  accepted: boolean;
  status: "COMPLETE" | "RETRY" | "DEAD" | "STALE";
  changed?: boolean;
  classification?: string | null;
  raw_record_id?: string | null;
}> {
  const { data: task, error: taskError } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("*")
    .eq("id", input.task_id)
    .maybeSingle();
  if (taskError) throw taskError;
  if (
    !task ||
    task.task_type !== "FETCH" ||
    task.source_id !== input.source_id ||
    task.status !== "PROCESSING" ||
    task.started_at !== input.lease_started_at
  ) {
    return { accepted: false, status: "STALE" };
  }

  const { data: source, error: sourceError } = await supabaseAdmin
    .from("sources")
    .select(
      "id, url, institution_id, adapter_key, category, refresh_frequency_hours",
    )
    .eq("id", task.source_id)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error(`Source ${task.source_id} not found`);

  const recordRun = async (
    success: boolean,
    changed: boolean,
    message: string | null,
  ) => {
    await supabaseAdmin.from("sync_runs").insert({
      source_id: source.id,
      adapter_key: source.adapter_key ?? "html-generic",
      started_at: task.started_at ?? new Date().toISOString(),
      finished_at: new Date().toISOString(),
      success,
      records_discovered: success ? 1 : 0,
      records_changed: changed ? 1 : 0,
      errors: success ? 0 : 1,
      error_message: message,
      response_time_ms: boundedResponseTime(input.response_time_ms),
    });
  };

  const statusCode = Math.min(
    599,
    Math.max(0, Math.round(input.http_status ?? 0)),
  );
  if (!input.success) {
    const message = (
      input.error ||
      (statusCode ? `HTTP ${statusCode}` : "External fetch failed")
    )
      .trim()
      .slice(0, 1000);
    // 429 is temporary rate limiting and must be retried with backoff. Marking
    // it BLOCKED permanently removed healthy career sites from future crawls.
    const blocked = input.blocked === true || statusCode === 403;
    await supabaseAdmin
      .from("sources")
      .update({
        status: blocked ? "BLOCKED" : "FAILED",
        last_http_status: statusCode || null,
        last_failure_at: new Date().toISOString(),
        last_error: message.slice(0, 500),
      })
      .eq("id", source.id);
    await recordRun(false, false, message);

    const dead = task.attempts >= task.max_attempts;
    const backoffMinutes = Math.min(60 * 12, 2 ** Math.max(1, task.attempts));
    const { data: updated } = await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: dead ? "DEAD" : "RETRY",
        last_error: message,
        run_after: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      })
      .eq("id", task.id)
      .eq("status", "PROCESSING")
      .eq("started_at", input.lease_started_at)
      .select("id")
      .maybeSingle();
    return { accepted: Boolean(updated), status: dead ? "DEAD" : "RETRY" };
  }

  const finalUrl = externalUrl(input.final_url, source.url);
  const title =
    typeof input.page_title === "string"
      ? input.page_title.trim().slice(0, 300)
      : null;
  const text =
    typeof input.text_content === "string"
      ? input.text_content.trim().slice(0, 20_000)
      : "";
  if (!text)
    throw new Error("External fetch completion did not include page text");
  const hash = await sha256(text);
  let { classification, confidence } = classifyUrlAndText(
    finalUrl,
    title ?? "",
    text,
  );
  const detailKind = detailKindFromAdapter(source.adapter_key);
  if (
    detailKind &&
    (classification === "GENERAL" ||
      classification === "UNKNOWN" ||
      confidence < 0.5)
  ) {
    classification = detailKind;
    confidence = Math.max(confidence, 0.72);
  }

  const { data: prior } = await supabaseAdmin
    .from("raw_records")
    .select("id, content_hash")
    .eq("source_id", source.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const changed = prior?.content_hash !== hash;
  let rawId = prior?.id ?? null;
  let structured: unknown = null;
  if (input.structured && typeof input.structured === "object") {
    try {
      const serialized = JSON.stringify(input.structured);
      if (serialized.length <= 50_000) structured = input.structured;
    } catch {
      structured = null;
    }
  }

  if (changed) {
    const { data: inserted, error: rawError } = await supabaseAdmin
      .from("raw_records")
      .insert({
        source_id: source.id,
        adapter_key: source.adapter_key ?? "html-generic",
        external_id: finalUrl,
        payload: {
          title,
          length: text.length,
          category: source.category,
          ...(structured ? { structured } : {}),
        } as never,
        source_url: source.url,
        final_url: finalUrl,
        http_status: statusCode || 200,
        page_title: title,
        text_content: text,
        content_hash: hash,
        classification,
        classification_confidence: confidence,
        institution_id: source.institution_id,
        normalization_status: "PENDING",
      })
      .select("id")
      .maybeSingle();
    if (rawError) throw rawError;
    rawId = inserted?.id ?? null;
  }

  const { loadSchedule, refreshHoursFor } = await import("./schedule.server");
  const schedule = await loadSchedule();
  const baseHours = refreshHoursFor(schedule, source.category);
  const nextHours = changed
    ? baseHours
    : Math.min(
        Math.round((source.refresh_frequency_hours ?? baseHours) * 1.5),
        baseHours * schedule.adaptive_backoff_max,
      );
  await supabaseAdmin
    .from("sources")
    .update({
      status: "FETCHED",
      last_http_status: statusCode || 200,
      canonical_url: finalUrl,
      last_success_at: new Date().toISOString(),
      refresh_frequency_hours: nextHours,
      last_error: null,
    })
    .eq("id", source.id);
  await recordRun(true, changed, null);
  const checkedAt = new Date().toISOString();
  const { refreshSourceTrust } = await import("./trust.server");
  await refreshSourceTrust({ sourceId: source.id, changed, checkedAt });

  if (changed && NORMALIZABLE_CLASSES.has(classification)) {
    await enqueue("NORMALIZE", {
      source_id: source.id,
      institution_id: source.institution_id ?? undefined,
      payload: { classification },
    });
  } else if (changed && rawId) {
    await supabaseAdmin
      .from("raw_records")
      .update({
        normalization_status: "SKIPPED",
        normalization_error: `no canonical extractor for ${classification}`,
      })
      .eq("id", rawId);
  }

  const links = externalLinks(input.links);
  await registerDetailSourcesFromLinks({
    links,
    finalUrl,
    category: source.category,
    institutionId: source.institution_id,
    adapterKey: source.adapter_key,
  });
  if (source.category === "vacancies") {
    await registerVacancySources({
      links,
      finalUrl,
      institutionId: source.institution_id,
    });
  }

  const { data: completed } = await supabaseAdmin
    .from("ingestion_tasks")
    .update({ status: "COMPLETE", completed_at: new Date().toISOString() })
    .eq("id", task.id)
    .eq("status", "PROCESSING")
    .eq("started_at", input.lease_started_at)
    .select("id")
    .maybeSingle();
  return {
    accepted: Boolean(completed),
    status: completed ? "COMPLETE" : "STALE",
    changed,
    classification,
    raw_record_id: rawId,
  };
}

export type ExternalReviewLease = {
  task_id: string;
  source_id: string;
  raw_record_id: string;
  lease_started_at: string;
  url: string;
  title: string;
  text_content: string;
  content_hash: string | null;
  structured: unknown;
  institution_id: string | null;
  institution_name: string | null;
  institution_type: string | null;
  requires_model: boolean;
  gate: { ok: boolean; reason?: string };
  attempt: number;
  max_attempts: number;
};

export type ExternalReviewCompletion = {
  task_id: string;
  source_id: string;
  raw_record_id: string;
  lease_started_at: string;
  success: boolean;
  extraction?: unknown;
  allow_server_model?: boolean;
  error?: string;
  model?: string;
  latency_ms?: number;
  input_characters?: number;
  output_characters?: number;
};

async function retryExternalReviewTask(
  task: {
    id: string;
    attempts: number;
    max_attempts: number;
    started_at: string | null;
  },
  leaseStartedAt: string,
  message: string,
): Promise<"RETRY" | "DEAD" | "STALE"> {
  const dead = task.attempts >= task.max_attempts;
  const backoffMinutes = Math.min(12 * 60, 2 ** Math.max(1, task.attempts));
  const { data } = await supabaseAdmin
    .from("ingestion_tasks")
    .update({
      status: dead ? "DEAD" : "RETRY",
      last_error: message.slice(0, 1_000),
      run_after: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      started_at: null,
    })
    .eq("id", task.id)
    .eq("status", "PROCESSING")
    .eq("started_at", leaseStartedAt)
    .select("id")
    .maybeSingle();
  return data ? (dead ? "DEAD" : "RETRY") : "STALE";
}

/** Claims only vacancy NORMALIZE tasks; all canonical writes stay server-side. */
export async function leaseExternalReviewTasks(
  limit = 4,
  modelAvailable = true,
): Promise<ExternalReviewLease[]> {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - EXTERNAL_REVIEW_LEASE_MS,
  ).toISOString();
  const { data: processing, error: staleError } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("id, attempts, max_attempts, started_at, payload")
    .eq("task_type", "NORMALIZE")
    .eq("status", "PROCESSING")
    .contains("payload", { classification: "VACANCY" })
    .lt("started_at", staleBefore)
    .limit(500);
  if (staleError) throw staleError;
  for (const task of processing ?? []) {
    const dead = task.attempts >= task.max_attempts;
    await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: dead ? "DEAD" : "RETRY",
        last_error: "External vacancy-review lease expired before completion",
        run_after: now.toISOString(),
        started_at: null,
      })
      .eq("id", task.id)
      .eq("status", "PROCESSING")
      .lt("started_at", staleBefore);
  }

  const requested = Math.min(10, Math.max(1, Math.floor(limit)));
  const { data: candidates, error } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("id, source_id, attempts, max_attempts, payload")
    .eq("task_type", "NORMALIZE")
    .in("status", ["QUEUED", "RETRY"])
    .contains("payload", { classification: "VACANCY" })
    .lte("run_after", now.toISOString())
    .order("run_after")
    .limit(requested * 4);
  if (error) throw error;

  const claimed: {
    id: string;
    source_id: string;
    started_at: string;
    attempts: number;
    max_attempts: number;
  }[] = [];
  for (const task of candidates ?? []) {
    if (claimed.length >= requested) break;
    if (!task.source_id) continue;
    const startedAt = new Date().toISOString();
    const { data: row, error: claimError } = await supabaseAdmin
      .from("ingestion_tasks")
      .update({
        status: "PROCESSING",
        attempts: task.attempts + 1,
        started_at: startedAt,
        last_error: null,
      })
      .eq("id", task.id)
      .in("status", ["QUEUED", "RETRY"])
      .select("id, source_id, started_at, attempts, max_attempts")
      .maybeSingle();
    if (claimError) throw claimError;
    if (row?.source_id && row.started_at) {
      claimed.push({
        id: row.id,
        source_id: row.source_id,
        started_at: row.started_at,
        attempts: row.attempts,
        max_attempts: row.max_attempts,
      });
    }
  }
  if (claimed.length === 0) return [];

  const sourceIds = claimed.map((task) => task.source_id);
  const [
    { data: rawRows, error: rawError },
    { data: sources, error: sourceError },
  ] = await Promise.all([
    supabaseAdmin
      .from("raw_records")
      .select(
        "id, source_id, final_url, page_title, text_content, content_hash, payload, classification, institution_id, fetched_at",
      )
      .in("source_id", sourceIds)
      .order("fetched_at", { ascending: false }),
    supabaseAdmin
      .from("sources")
      .select("id, institution_id")
      .in("id", sourceIds),
  ]);
  if (rawError) throw rawError;
  if (sourceError) throw sourceError;
  const rawBySource = new Map<string, (typeof rawRows)[number]>();
  for (const raw of rawRows ?? []) {
    if (raw.source_id && !rawBySource.has(raw.source_id))
      rawBySource.set(raw.source_id, raw);
  }
  const institutionIds = [
    ...new Set(
      (sources ?? [])
        .map((source) => source.institution_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: institutions, error: institutionError } = institutionIds.length
    ? await supabaseAdmin
        .from("institutions")
        .select("id, name, institution_type")
        .in("id", institutionIds)
    : { data: [], error: null };
  if (institutionError) throw institutionError;
  const institutionById = new Map(
    (institutions ?? []).map((row) => [row.id, row]),
  );
  const sourceById = new Map((sources ?? []).map((row) => [row.id, row]));

  const leases: ExternalReviewLease[] = [];
  for (const task of claimed) {
    const raw = rawBySource.get(task.source_id);
    if (!raw || raw.classification !== "VACANCY") {
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({
          status: "COMPLETE",
          completed_at: new Date().toISOString(),
          last_error: raw
            ? "Latest raw record is no longer a vacancy"
            : "Raw record is missing",
        })
        .eq("id", task.id)
        .eq("status", "PROCESSING")
        .eq("started_at", task.started_at);
      continue;
    }
    const title = (raw.page_title ?? "").trim().slice(0, 300);
    const text = (raw.text_content ?? "").trim().slice(0, 20_000);
    const url = raw.final_url ?? "";
    const gate = looksLikeSinglePosting(url, title, text);
    const structured = structuredVacancyFromPayload(raw.payload, url);
    const deterministicEvidence = Boolean(
      structured ||
      parseDeadline(text) ||
      /(rolling|laufend|jederzeit|until filled|bis zur besetzung)/i.test(text),
    );
    const source = sourceById.get(task.source_id);
    const institution = source?.institution_id
      ? institutionById.get(source.institution_id)
      : undefined;
    const requiresModel =
      gate.ok &&
      !(deterministicEvidence && hasStrongGeospatialEvidence(title, text));
    if (requiresModel && !modelAvailable) {
      // Do not burn retries when a free runner has not been given the optional
      // NVIDIA secret. Defer semantic pages and continue draining deterministic ones.
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({
          status: "RETRY",
          attempts: Math.max(0, task.attempts - 1),
          run_after: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
          started_at: null,
          last_error:
            "Waiting for NVIDIA_API_KEY on the external review worker",
        })
        .eq("id", task.id)
        .eq("status", "PROCESSING")
        .eq("started_at", task.started_at);
      continue;
    }
    leases.push({
      task_id: task.id,
      source_id: task.source_id,
      raw_record_id: raw.id,
      lease_started_at: task.started_at,
      url,
      title,
      text_content: text,
      content_hash: raw.content_hash,
      structured: raw.payload,
      institution_id: raw.institution_id,
      institution_name: institution?.name ?? null,
      institution_type: institution?.institution_type ?? null,
      requires_model: requiresModel,
      gate,
      attempt: task.attempts,
      max_attempts: task.max_attempts,
    });
  }
  return leases;
}

function evidenceIsSupported(
  extraction: VacancyExtraction,
  pageText: string,
): boolean {
  if (!extraction.is_single_real_position) return true;
  if (extraction.evidence.length === 0) return false;
  const normalizedPage = pageText.toLowerCase().replace(/\s+/g, " ");
  return extraction.evidence.every((snippet) => {
    const normalizedSnippet = snippet.toLowerCase().replace(/\s+/g, " ").trim();
    return (
      normalizedSnippet.length >= 8 &&
      normalizedPage.includes(normalizedSnippet)
    );
  });
}

/** Validates remote model output, then invokes the existing canonical writer. */
export async function completeExternalReview(
  input: ExternalReviewCompletion,
): Promise<{
  accepted: boolean;
  status: "COMPLETE" | "RETRY" | "DEAD" | "STALE";
  outcome?: NormalizeResult;
}> {
  const { data: task, error: taskError } = await supabaseAdmin
    .from("ingestion_tasks")
    .select(
      "id, task_type, source_id, status, started_at, attempts, max_attempts, payload",
    )
    .eq("id", input.task_id)
    .maybeSingle();
  if (taskError) throw taskError;
  if (
    !task ||
    task.task_type !== "NORMALIZE" ||
    task.source_id !== input.source_id ||
    task.status !== "PROCESSING" ||
    task.started_at !== input.lease_started_at ||
    queuedClassification(task) !== "VACANCY"
  ) {
    return { accepted: false, status: "STALE" };
  }

  const { data: raw, error: rawError } = await supabaseAdmin
    .from("raw_records")
    .select("id, text_content, content_hash")
    .eq("id", input.raw_record_id)
    .eq("source_id", input.source_id)
    .maybeSingle();
  if (rawError) throw rawError;
  if (!raw) {
    const status = await retryExternalReviewTask(
      task,
      input.lease_started_at,
      "Leased raw record no longer exists",
    );
    return { accepted: status !== "STALE", status };
  }
  const { data: latestRaw } = await supabaseAdmin
    .from("raw_records")
    .select("id")
    .eq("source_id", input.source_id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRaw?.id !== raw.id) {
    const status = await retryExternalReviewTask(
      task,
      input.lease_started_at,
      "A newer source snapshot arrived during review; review will restart",
    );
    return { accepted: status !== "STALE", status };
  }
  if (!input.success) {
    const status = await retryExternalReviewTask(
      task,
      input.lease_started_at,
      input.error?.trim() || "External vacancy review failed",
    );
    return { accepted: status !== "STALE", status };
  }

  let extraction: VacancyExtraction | null = null;
  if (input.extraction !== undefined && input.extraction !== null) {
    const { validateVacancy } = await import("./extraction/validate.server");
    const validation = validateVacancy(JSON.stringify(input.extraction));
    if (
      !validation.ok ||
      !evidenceIsSupported(
        validation.ok ? validation.value : ({} as VacancyExtraction),
        raw.text_content ?? "",
      )
    ) {
      const message = !validation.ok
        ? `${validation.code}: ${validation.message}`
        : "BUSINESS_RULE_FAILURE: evidence is missing or not present in the source page";
      await supabaseAdmin.from("llm_processing_runs").insert({
        provider: "NVIDIA",
        model: (input.model || "external-nemotron").slice(0, 200),
        operation: "VACANCY_EXTRACTION",
        source_id: input.source_id,
        raw_page_id: raw.id,
        content_hash: raw.content_hash,
        status: "VALIDATION_FAILED",
        completed_at: new Date().toISOString(),
        latency_ms: boundedResponseTime(input.latency_ms),
        error_code: "EXTERNAL_VALIDATION_FAILED",
        error_message: message.slice(0, 1_000),
      } as never);
      const status = await retryExternalReviewTask(
        task,
        input.lease_started_at,
        message,
      );
      return { accepted: status !== "STALE", status };
    }
    extraction = validation.value;
    await supabaseAdmin.from("llm_processing_runs").insert({
      provider: "NVIDIA",
      model: (input.model || "external-nemotron").slice(0, 200),
      operation: "VACANCY_EXTRACTION",
      source_id: input.source_id,
      raw_page_id: raw.id,
      content_hash: raw.content_hash,
      status: "SUCCESS",
      completed_at: new Date().toISOString(),
      input_characters: Math.min(
        20_000,
        Math.max(0, Math.round(input.input_characters ?? 0)),
      ),
      output_characters: Math.min(
        20_000,
        Math.max(0, Math.round(input.output_characters ?? 0)),
      ),
      latency_ms: boundedResponseTime(input.latency_ms),
      result: extraction as never,
    } as never);
  }

  // If GitHub has no NVIDIA secret, it can still orchestrate the queue while
  // the already-configured Lovable backend performs only the model request.
  // Supplying an extraction keeps the entire expensive review outside Lovable.
  const outcome = await normalizeSource(
    input.source_id,
    extraction || !input.allow_server_model
      ? { provided: true, extraction, model: input.model ?? null }
      : undefined,
  );
  if (outcome.status === "FAILED") {
    const status = await retryExternalReviewTask(
      task,
      input.lease_started_at,
      outcome.reason ?? "Canonical vacancy normalization failed",
    );
    return { accepted: status !== "STALE", status, outcome };
  }
  const { data: completed } = await supabaseAdmin
    .from("ingestion_tasks")
    .update({
      status: "COMPLETE",
      completed_at: new Date().toISOString(),
      started_at: null,
      last_error: outcome.reason ?? null,
    })
    .eq("id", task.id)
    .eq("status", "PROCESSING")
    .eq("started_at", input.lease_started_at)
    .select("id")
    .maybeSingle();
  return {
    accepted: Boolean(completed),
    status: completed ? "COMPLETE" : "STALE",
    outcome,
  };
}

export async function fetchSource(sourceId: string): Promise<FetchOutcome> {
  const started = Date.now();
  const { data: source, error } = await supabaseAdmin
    .from("sources")
    .select(
      "id, url, institution_id, adapter_key, category, refresh_frequency_hours",
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const recordRun = async (
    success: boolean,
    changed: boolean,
    errorMessage: string | null,
  ) => {
    await supabaseAdmin.from("sync_runs").insert({
      source_id: source.id,
      adapter_key: source.adapter_key ?? "html-generic",
      started_at: new Date(started).toISOString(),
      finished_at: new Date().toISOString(),
      success,
      records_discovered: success ? 1 : 0,
      records_changed: changed ? 1 : 0,
      errors: success ? 0 : 1,
      error_message: errorMessage,
      response_time_ms: Date.now() - started,
    });
  };

  if (!(await isAllowed(source.url))) {
    await supabaseAdmin
      .from("sources")
      .update({
        status: "BLOCKED",
        last_failure_at: new Date().toISOString(),
        last_error: "Disallowed by robots.txt",
      })
      .eq("id", source.id);
    await recordRun(false, false, "Disallowed by robots.txt");
    throw new Error("Disallowed by robots.txt");
  }

  let res: Response;
  try {
    res = await timedFetch(source.url);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("sources")
      .update({
        status: "FAILED",
        last_failure_at: new Date().toISOString(),
        last_error: message.slice(0, 500),
      })
      .eq("id", source.id);
    await recordRun(false, false, message);
    throw e;
  }

  const status = res.status;
  if (!res.ok) {
    const message = `HTTP ${status}`;
    await supabaseAdmin
      .from("sources")
      .update({
        status: status === 429 || status === 403 ? "BLOCKED" : "FAILED",
        last_http_status: status,
        last_failure_at: new Date().toISOString(),
        last_error: message,
      })
      .eq("id", source.id);
    await recordRun(false, false, message);
    throw new Error(message);
  }

  const html = await res.text();
  const finalUrl = res.url || source.url;
  const title = extractTitle(html);
  const structured = extractStructuredSnapshot(html, finalUrl);
  const text = extractText(html);
  const hash = await sha256(text);
  let { classification, confidence } = classifyUrlAndText(
    finalUrl,
    title ?? "",
    text,
  );
  const detailKind = detailKindFromAdapter(source.adapter_key);
  if (
    detailKind &&
    (classification === "GENERAL" ||
      classification === "UNKNOWN" ||
      confidence < 0.5)
  ) {
    classification = detailKind;
    confidence = Math.max(confidence, 0.72);
  }

  const { data: prior } = await supabaseAdmin
    .from("raw_records")
    .select("id, content_hash")
    .eq("source_id", source.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const changed = prior?.content_hash !== hash;
  let rawId = prior?.id ?? null;

  if (changed) {
    const { data: inserted, error: rawErr } = await supabaseAdmin
      .from("raw_records")
      .insert({
        source_id: source.id,
        adapter_key: source.adapter_key ?? "html-generic",
        external_id: finalUrl,
        payload: {
          title,
          length: text.length,
          category: source.category,
          ...(structured ? { structured } : {}),
        } as never,
        source_url: source.url,
        final_url: finalUrl,
        http_status: status,
        page_title: title,
        text_content: text,
        content_hash: hash,
        classification,
        classification_confidence: confidence,
        institution_id: source.institution_id,
        normalization_status: "PENDING",
      })
      .select("id")
      .maybeSingle();
    if (rawErr) throw rawErr;
    rawId = inserted?.id ?? null;
  }

  // Modest adaptive refresh: a page that comes back unchanged earns a longer
  // interval (capped), a page that changed returns to its category cadence.
  const { loadSchedule, refreshHoursFor } = await import("./schedule.server");
  const schedule = await loadSchedule();
  const baseHours = refreshHoursFor(schedule, source.category);
  const nextHours = changed
    ? baseHours
    : Math.min(
        Math.round((source.refresh_frequency_hours ?? baseHours) * 1.5),
        baseHours * schedule.adaptive_backoff_max,
      );

  await supabaseAdmin
    .from("sources")
    .update({
      status: "FETCHED",
      last_http_status: status,
      canonical_url: finalUrl,
      last_success_at: new Date().toISOString(),
      refresh_frequency_hours: nextHours,
      last_error: null,
    })
    .eq("id", source.id);
  await recordRun(true, changed, null);
  const checkedAt = new Date().toISOString();
  const { refreshSourceTrust } = await import("./trust.server");
  await refreshSourceTrust({ sourceId: source.id, changed, checkedAt });
  // Unchanged content stops here. Changed pages only enter semantic/canonical
  // normalization when a canonical writer actually exists for the class.
  // Generic research/news/department/publication-index pages are useful raw
  // evidence but should not occupy the extraction queue.
  if (changed && NORMALIZABLE_CLASSES.has(classification)) {
    await enqueue("NORMALIZE", {
      source_id: source.id,
      institution_id: source.institution_id ?? undefined,
      payload: { classification },
    });
  } else if (changed && rawId) {
    await supabaseAdmin
      .from("raw_records")
      .update({
        normalization_status: "SKIPPED",
        normalization_error: `no canonical extractor for ${classification}`,
      })
      .eq("id", rawId);
  }

  // Expand high-value institutional indexes into individual detail pages.
  // This is bounded and non-recursive: detail adapters never expand again.
  await registerDetailSources({
    html,
    finalUrl,
    category: source.category,
    institutionId: source.institution_id,
    adapterKey: source.adapter_key,
  });

  // A vacancy listing page is an index, not a record: register each individual
  // posting it links to as its own source so every position keeps its own URL.
  if (source.category === "vacancies") {
    await registerVacancySources({
      links: extractLinks(html, finalUrl),
      finalUrl,
      institutionId: source.institution_id,
    });
  }

  return {
    url: source.url,
    final_url: finalUrl,
    http_status: status,
    changed,
    classification,
    raw_record_id: rawId,
  };
}

/* ------------------------------------------------------------------ */
/* NORMALIZATION -> CANONICAL                                          */
/* ------------------------------------------------------------------ */

const DATE_RE =
  /(\d{1,2})[./](\d{1,2})[./](\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

function parseDeadline(text: string): string | null {
  const windowText = text.slice(0, 8000);
  const cue =
    /(deadline|bewerbungsfrist|application by|apply by|closing date|bewerbungsschluss)/i.exec(
      windowText,
    );
  const scope = cue ? windowText.slice(cue.index, cue.index + 200) : "";
  const m = DATE_RE.exec(scope);
  if (!m) return null;
  if (m[3])
    return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Deterministic status per spec: never OPEN just because a URL exists. */
function deriveStatus(deadline: string | null, rolling: boolean): string {
  if (rolling) return "rolling";
  if (!deadline) return "possibly_open";
  const days = Math.ceil(
    (new Date(`${deadline}T00:00:00Z`).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return "closed";
  if (days <= 14) return "closing_soon";
  return "open";
}

export type NormalizeResult = {
  status: "NORMALIZED" | "SKIPPED" | "FAILED";
  reason?: string | undefined;
  entity_id?: string | undefined;
};

/* ------------------------------------------------------------------ */
/* SINGLE-POSTING GATE                                                 */
/* ------------------------------------------------------------------ */

/** Words that mark a page as a careers *landing/listing* page, not one posting. */
const LISTING_TITLE =
  /^(careers?|jobs?|vacancies|open (job )?positions?|positions?|recruitment|stellenangebote|stellen|job ?board|work (with|for) us|join (our team|us)|life at|our people|talent|employment)\b/i;
const NON_POSTING =
  /(meet [a-z]|faces|blog|news|resources?|contact|use ?cases?|products?|solutions?|api\b|webinar|podcast|events?|privacy|imprint|impressum|cookie|newsletter|about us|our story|benefits|culture|diversity|academy|careers? in|working at|employee stor(?:y|ies)|learning (?:&|and) development|leadership track|u[.]?gro programme|talent community|graduate programme|programme careers?|internship programme overview|how we hire|hiring process|candidate privacy|applicant privacy|privacy policy|search for your career|job alerts?|equal opportunity|accommodation request)/i;
/** A real posting names a role in its title. */
const ROLE_TITLE =
  /(phd|ph\.d|doctoral|doktorand|promotionsstelle|post ?doc|postdoctoral|professor|professur|juniorprofessur|lecturer|research(er)?|scientist|engineer|ingenieur|developer|analyst|technician|techniker|specialist|consultant|surveyor|geomatics|remote sensing|photogrammetr|gis\b|wissenschaftliche[rn]? mitarbeiter|w\/?m\/?d|m\/?w\/?d|f\/?m\/?d|assistant|associate|fellow|intern(ship)?|trainee|manager|lead|head of)/i;
/** A real posting reads like a job ad. */
const POSTING_BODY =
  /(application deadline|apply by|closing date|deadline for applications|bewerbungsfrist|bewerbungen? bis|reference number|kennziffer|ref\.? no|job id|requisition|full[- ]time|part[- ]time|vollzeit|teilzeit|fixed[- ]term|befristet|salary|remuneration|entgeltgruppe|verg[uü]tung|tv-?l|tv-?[oö]d|e ?13|start(ing)? date|eintrittstermin|your (tasks|profile|responsibilities)|ihre aufgaben|ihr profil|we offer|wir bieten|required qualifications|qualification[s]? required|how to apply|submit your application|bewerbungsunterlagen)/i;
const STRONG_GEOSPATIAL =
  /(photogrammetr|remote sensing|fernerkundung|geoinformat|geospatial|geographic information systems?|\bgis\b|geodes[yi]|geomatic|earth observation|geoai|lidar|laser scann|point cloud|punktwolke|synthetic aperture radar|\bsar\b|spatial data|surveying|cartograph|mapping|satellite imagery)/i;

export function hasStrongGeospatialEvidence(
  title: string,
  text: string,
): boolean {
  return STRONG_GEOSPATIAL.test(`${title}\n${text.slice(0, 12_000)}`);
}

/**
 * True only when a fetched page really is ONE vacancy posting.
 * Careers hubs, marketing and resource pages under a /careers/ path must never
 * become an opportunity row — that is how the domain loses credibility.
 */
export function looksLikeSinglePosting(
  url: string,
  title: string,
  text: string,
): { ok: boolean; reason?: string } {
  const t = (title || "").trim();
  const body = text || "";
  const path = pathOf(url);
  if (!t) return { ok: false, reason: "no title" };
  if (LISTING_TITLE.test(t))
    return { ok: false, reason: "careers listing/landing page title" };
  if (NON_POSTING.test(t))
    return { ok: false, reason: "marketing/resource page, not a posting" };
  if (
    /^\/?(careers?|jobs?|vacancies|stellenangebote|stellen|recruitment)\/?$/i.test(
      path,
    )
  ) {
    return { ok: false, reason: "careers index path" };
  }
  if (
    /\/(privacy|policy|policies|how-we-hire|hiring-process|job-alerts?|candidate|applicant)(\/|$)/i.test(
      path,
    )
  ) {
    return { ok: false, reason: "policy or hiring-information path" };
  }
  if (body.length < 600)
    return { ok: false, reason: "page too thin to be a posting" };
  if (!ROLE_TITLE.test(t))
    return { ok: false, reason: "title does not name a role" };
  if (!POSTING_BODY.test(body))
    return {
      ok: false,
      reason: "no job-ad signals (deadline, contract, tasks, salary)",
    };
  return { ok: true };
}

export async function normalizeSource(
  sourceId: string,
  externalReview?: {
    provided: true;
    extraction: VacancyExtraction | null;
    model?: string | null;
  },
): Promise<NormalizeResult> {
  const { data: raw } = await supabaseAdmin
    .from("raw_records")
    .select(
      "id, final_url, page_title, text_content, classification, classification_confidence, institution_id, source_id, content_hash, payload",
    )
    .eq("source_id", sourceId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!raw) return { status: "SKIPPED", reason: "no raw record for source" };

  const mark = async (status: string, error: string | null) => {
    await supabaseAdmin
      .from("raw_records")
      .update({ normalization_status: status, normalization_error: error })
      .eq("id", raw.id);
  };

  const rawTitle = (raw.page_title ?? "").trim();

  // Non-vacancy record types now have their own gates + extractors.
  if (raw.classification !== "VACANCY") {
    if (!rawTitle) {
      await mark("SKIPPED", "no page title to extract from");
      return { status: "SKIPPED", reason: "no page title" };
    }
    const { normalizeNonVacancy } =
      await import("./extraction/canonical.server");
    const outcome = await normalizeNonVacancy(
      raw,
      rawTitle.split(/\s*[|·–—]\s*/)[0]?.trim() || rawTitle,
    );
    await mark(
      outcome.status,
      outcome.status === "NORMALIZED" ? null : (outcome.reason ?? null),
    );
    if (outcome.status === "NORMALIZED" && outcome.entity_id) {
      const typeByClass: Record<string, "project" | "researcher" | "event"> = {
        PROJECT: "project",
        RESEARCHER: "researcher",
        EVENT: "event",
      };
      const pulseType = typeByClass[raw.classification ?? ""];
      if (pulseType) {
        const { ensurePulseForEntity } = await import("./pulse.server");
        await ensurePulseForEntity(pulseType, outcome.entity_id);
      }
    }
    return outcome;
  }

  if (!raw.institution_id) {
    await mark("FAILED", "missing institution");
    return { status: "FAILED", reason: "missing institution" };
  }
  const { data: institution } = await supabaseAdmin
    .from("institutions")
    .select("name, institution_type")
    .eq("id", raw.institution_id)
    .maybeSingle();
  const title = (raw.page_title ?? "")
    // Strip site chrome that job portals append to <title>.
    .replace(
      /\s*[|·–—-]\s*[^|·–—-]*(university|universit\u00e4t|hochschule|institut\w*|careers?|karriere)[^|·–—-]*$/gi,
      "",
    )
    .replace(
      /\s*(job\s*details?|stellendetails|stellenanzeige|job\s*description)\s*$/i,
      "",
    )
    .trim();
  if (!title) {
    await mark("FAILED", "missing title");
    return { status: "FAILED", reason: "missing title" };
  }

  const text = raw.text_content ?? "";
  const gate = looksLikeSinglePosting(raw.final_url ?? "", title, text);
  if (!gate.ok) {
    await mark("SKIPPED", `not a single vacancy posting: ${gate.reason}`);
    return {
      status: "SKIPPED",
      reason: `not a single vacancy posting: ${gate.reason}`,
    };
  }
  const rolling =
    /(rolling|laufend|jederzeit|until filled|bis zur besetzung)/i.test(text);
  const deterministicDeadline = parseDeadline(text);
  // Only the posting's own title decides the type: body text mentioning a
  // doctoral programme must not turn a staff role into a PhD position.
  const isPhd =
    /(phd|ph\.d|doctoral researcher|doktorand|promotionsstelle)/i.test(title);
  const slug = slugify(title) || slugify(raw.final_url ?? raw.id);

  // Fast path: an official single-posting page with an explicit deadline or
  // schema.org JobPosting metadata does not need an LLM just to prove that it
  // exists. Nemotron is reserved for ambiguous postings that need semantic
  // interpretation. This keeps verification source-backed and dramatically
  // reduces model calls.
  const structuredJob = structuredVacancyFromPayload(
    raw.payload,
    raw.final_url ?? "",
  );
  const structuredDeadline = structuredJob?.application_deadline ?? null;
  const deterministicEvidence = Boolean(
    structuredJob || deterministicDeadline || rolling,
  );
  const deterministicEnough =
    deterministicEvidence && hasStrongGeospatialEvidence(title, text);

  let ex: VacancyExtraction | null = externalReview?.extraction ?? null;
  if (!deterministicEnough) {
    if (!externalReview?.provided) {
      const { enrichVacancy } = await import("./extraction/enrich.server");
      const enriched = await enrichVacancy({
        url: raw.final_url ?? "",
        title,
        text,
        sourceId: raw.source_id,
        rawRecordId: raw.id,
        contentHash: raw.content_hash,
      });
      ex = enriched.extraction;
    }
    if (!ex) {
      await mark(
        "FAILED",
        "semantic vacancy review is required but no validated result is available",
      );
      return {
        status: "FAILED",
        reason:
          "semantic vacancy review is required but no validated result is available",
      };
    }
    if (ex && !ex.is_single_real_position) {
      await mark(
        "SKIPPED",
        `intelligence engine rejected: ${ex.rejection_reason ?? "not a single real position"}`,
      );
      return {
        status: "SKIPPED",
        reason: `intelligence engine rejected: ${ex.rejection_reason ?? "not a single real position"}`,
      };
    }
    if (!ex.geospatial_relevance) {
      await mark(
        "SKIPPED",
        "intelligence engine rejected: role is not geospatially relevant",
      );
      return { status: "SKIPPED", reason: "role is not geospatially relevant" };
    }
    if (ex.confidence < 0.65) {
      await mark(
        "SKIPPED",
        `intelligence engine confidence too low (${ex.confidence.toFixed(2)})`,
      );
      return {
        status: "SKIPPED",
        reason: `intelligence engine confidence too low (${ex.confidence.toFixed(2)})`,
      };
    }
    if (!evidenceIsSupported(ex, text)) {
      await mark(
        "FAILED",
        "model evidence is missing or not supported by the fetched page",
      );
      return {
        status: "FAILED",
        reason:
          "model evidence is missing or not supported by the fetched page",
      };
    }
  }

  const deadline =
    deterministicDeadline ??
    structuredDeadline ??
    ex?.application_deadline ??
    null;
  const status = deriveStatus(deadline, rolling);
  const usedModel = !deterministicEnough && Boolean(ex);
  const usedStructured = Boolean(structuredJob);
  const verifiedAt = deterministicEnough ? new Date().toISOString() : null;
  const verificationStatus = deterministicEnough
    ? "verified"
    : ex && ex.confidence >= 0.86
      ? "auto_discovered"
      : "needs_review";

  const safeApplicationUrl = (() => {
    const candidate =
      ex?.application_url ?? structuredJob?.application_url ?? null;
    if (!candidate) return raw.final_url;
    try {
      const application = new URL(candidate, raw.final_url ?? undefined);
      if (!/^https?:$/.test(application.protocol)) return raw.final_url;
      const source = new URL(raw.final_url ?? application.toString());
      const supported =
        application.host === source.host ||
        text.includes(candidate) ||
        text.includes(application.toString());
      return supported ? application.toString() : raw.final_url;
    } catch {
      return raw.final_url;
    }
  })();
  const sector =
    institution?.institution_type === "company"
      ? "industry"
      : institution?.institution_type &&
          institution.institution_type !== "other"
        ? "academic"
        : (ex?.sector ?? "industry");

  const { data: existing } = await supabaseAdmin
    .from("opportunities")
    .select("id")
    .eq("official_source_url", raw.final_url ?? "")
    .maybeSingle();

  // Two postings can share a title (e.g. the same role advertised per language),
  // so keep slugs unique by appending a stable suffix from the source URL.
  let uniqueSlug = slug;
  const { data: slugOwner } = await supabaseAdmin
    .from("opportunities")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugOwner && slugOwner.id !== existing?.id) {
    const suffix = (await sha256(raw.final_url ?? raw.id)).slice(0, 6);
    uniqueSlug = `${slug.slice(0, 70)}-${suffix}`;
  }

  const payload = {
    title: title.slice(0, 300),
    slug: uniqueSlug,
    normalized_title: title.toLowerCase().slice(0, 300),
    institution_id: raw.institution_id,
    employer_name: institution?.name ?? null,
    opportunity_type: (ex?.opportunity_type ??
      (isPhd ? "phd" : "other")) as string as never,
    sector,
    description: (ex?.summary ?? structuredJob?.description ?? text).slice(
      0,
      2000,
    ),
    requirements: ex?.requirements ?? null,
    funding_type: ex?.funding_type ?? null,
    salary_text: ex?.salary_text ?? null,
    supervisor_name: ex?.supervisor_name ?? null,
    city: ex?.city ?? structuredJob?.city ?? null,
    country: ex?.country ?? structuredJob?.country ?? null,
    start_date: ex?.start_date ?? structuredJob?.start_date ?? null,
    application_url: safeApplicationUrl,
    official_source_url: raw.final_url,
    status: status as never,
    confidence: (deterministicEnough && usedStructured
      ? "high"
      : deterministicEnough || (ex?.confidence ?? 0) >= 0.86
        ? "medium"
        : "low") as never,
    verification_status: verificationStatus as never,
    last_checked_at: new Date().toISOString(),
    last_verified_at: verifiedAt,
    application_deadline: deadline,
    is_demo: false,
    extracted_by: usedModel
      ? "NVIDIA_NEMOTRON"
      : usedStructured
        ? "STRUCTURED_METADATA"
        : "DETERMINISTIC",
    extraction_model: usedModel
      ? (externalReview?.model ?? "nvidia/nemotron-routed")
      : null,
    extraction_confidence: ex?.confidence ?? null,
    extraction_timestamp: usedModel ? new Date().toISOString() : null,
  };

  let entityId = existing?.id;
  if (entityId) {
    const { error } = await supabaseAdmin
      .from("opportunities")
      .update(payload)
      .eq("id", entityId);
    if (error) {
      await mark("FAILED", error.message);
      return { status: "FAILED", reason: error.message };
    }
  } else {
    const { data: ins, error } = await supabaseAdmin
      .from("opportunities")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) {
      await mark("FAILED", error.message);
      return { status: "FAILED", reason: error.message };
    }
    entityId = ins?.id;
    if (entityId) {
      await supabaseAdmin.from("academic_changes").insert({
        change_type: isPhd ? "NEW_PHD" : "NEW_OPPORTUNITY",
        entity_type: "opportunity",
        entity_id: entityId,
        source_id: raw.source_id,
        title: payload.title,
        summary: `Discovered on ${raw.final_url}`,
        details: { status, deadline } as never,
      });
    }
  }

  if (entityId) {
    const { data: evidence } = await supabaseAdmin
      .from("record_sources")
      .select("id")
      .eq("entity_type", "opportunity")
      .eq("entity_id", entityId)
      .eq("source_url", raw.final_url ?? "")
      .maybeSingle();
    const evidencePayload = {
      source_id: raw.source_id,
      source_url: raw.final_url ?? "",
      source_type: "careers_page" as never,
      original_title: raw.page_title,
      claim: "Vacancy page fetched from the institution's own website",
      verification_status: verificationStatus as never,
      confidence: (deterministicEnough && usedStructured
        ? "high"
        : "medium") as never,
      is_primary: true,
      last_checked_at: new Date().toISOString(),
      last_verified_at: verifiedAt,
    };
    if (!evidence) {
      await supabaseAdmin.from("record_sources").insert({
        entity_type: "opportunity",
        entity_id: entityId,
        ...evidencePayload,
      });
    } else {
      await supabaseAdmin
        .from("record_sources")
        .update(evidencePayload)
        .eq("id", evidence.id);
    }
  }

  // Same posting published in several languages: flag, never silently merge.
  if (entityId) {
    const { data: twins } = await supabaseAdmin
      .from("opportunities")
      .select("id, normalized_title")
      .eq("institution_id", raw.institution_id)
      .neq("id", entityId)
      .limit(50);
    const twin = (twins ?? []).find(
      (t) =>
        t.normalized_title &&
        payload.normalized_title.startsWith(t.normalized_title.slice(0, 25)),
    );
    if (twin) {
      const { data: known } = await supabaseAdmin
        .from("duplicate_candidates")
        .select("id")
        .eq("entity_type", "opportunity")
        .eq("primary_id", twin.id)
        .eq("duplicate_id", entityId)
        .maybeSingle();
      if (!known) {
        await supabaseAdmin.from("duplicate_candidates").insert({
          entity_type: "opportunity",
          primary_id: twin.id,
          duplicate_id: entityId,
          match_reason:
            "Near-identical title at the same institution (likely language variant of one posting)",
          score: 0.8,
        });
      }
    }
  }

  if (entityId) {
    const { ensurePulseForEntity } = await import("./pulse.server");
    await ensurePulseForEntity("opportunity", entityId);
  }

  await mark("NORMALIZED", null);
  return { status: "NORMALIZED", entity_id: entityId };
}
