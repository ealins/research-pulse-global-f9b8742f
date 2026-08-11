// Server-only ingestion engine. Never imported by client code.
// Pipeline: DISCOVER -> FETCH -> RAW STORAGE -> CLASSIFY -> EXTRACT/NORMALIZE -> CANONICAL -> PROVENANCE
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UA = "GeoAcademicRadarBot/1.0 (+https://geoacademic.app; academic source indexing)";
const FETCH_TIMEOUT_MS = 20_000;

/** Keyword vocabulary (English + German) used for discovery scoring and classification. */
const CATEGORY_RULES: { category: string; kind: string; words: string[] }[] = [
  { category: "vacancies", kind: "VACANCY", words: ["vacanc", "job", "stellenangebot", "stellen", "career", "offene-stellen", "open-position", "promotion", "doktorand", "phd-position", "recruit"] },
  { category: "people", kind: "RESEARCHER", words: ["people", "staff", "team", "mitarbeiter", "personen", "professor", "faculty", "members"] },
  { category: "projects", kind: "PROJECT", words: ["project", "projekte", "forschungsprojekt", "research-project"] },
  { category: "publications", kind: "PUBLICATION", words: ["publication", "publikation", "veroeffentlichung", "veröffentlichung", "papers", "bibliograph"] },
  { category: "events", kind: "EVENT", words: ["event", "veranstaltung", "conference", "tagung", "photogrammetric-week", "photogrammetrische-woche", "workshop", "colloqui", "kolloqui", "summer-school"] },
  { category: "courses", kind: "COURSE", words: ["course", "lehre", "lehrveranstaltung", "teaching", "module", "vorlesung"] },
  { category: "programmes", kind: "PROGRAMME", words: ["study", "studium", "studiengang", "degree", "master", "bachelor", "programme", "program"] },
  { category: "research_groups", kind: "RESEARCH_GROUP", words: ["research-group", "arbeitsgruppe", "group", "abteilung", "chair", "lehrstuhl"] },
  { category: "research", kind: "RESEARCH_NEWS", words: ["research", "forschung", "news", "aktuelles", "topics", "forschungsschwerpunkt"] },
  { category: "department", kind: "DEPARTMENT", words: ["institute", "institut", "department", "fakult"] },
];

const DOMAIN_WORDS = [
  "photogrammet", "remote-sensing", "fernerkundung", "geoinformat", "geodes", "geomatic",
  "computer-vision", "point-cloud", "punktwolke", "lidar", "sar", "earth-observation", "geoai", "mapping",
];

export type Classification = { classification: string; confidence: number };

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function classifyUrlAndText(url: string, title: string, text: string): Classification {
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
    if (score > best.confidence) best = { classification: rule.kind, confidence: Math.min(0.95, score) };
  }
  if (best.confidence < 0.2) return { classification: "GENERAL", confidence: 0.1 };
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
  return DOMAIN_WORDS.some((w) => s.includes(w)) || categoryForUrl(url) !== null;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", ...(init?.headers ?? {}) },
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
    const res = await timedFetch(`${origin}/robots.txt`, { headers: { accept: "text/plain" } });
    if (res.ok) {
      const txt = await res.text();
      let applies = false;
      for (const raw of txt.split("\n")) {
        const line = raw.split("#")[0]?.trim() ?? "";
        const [keyRaw, ...rest] = line.split(":");
        const key = (keyRaw ?? "").trim().toLowerCase();
        const value = rest.join(":").trim();
        if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("geoacademic");
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

export function extractLinks(html: string, baseUrl: string): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const abs = new URL(href, baseUrl);
      abs.hash = "";
      if (!abs.protocol.startsWith("http")) continue;
      out.push({ url: abs.toString(), label: decodeEntities(m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) });
    } catch {
      /* ignore malformed href */
    }
  }
  return out;
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
export async function discoverInstitutionSources(institutionId: string, maxSources = 150): Promise<DiscoveryResult> {
  const { data: inst, error } = await supabaseAdmin
    .from("institutions")
    .select("id, name, slug, official_url, research_url, careers_url")
    .eq("id", institutionId)
    .maybeSingle();
  if (error) throw error;
  if (!inst) throw new Error(`Institution ${institutionId} not found`);

  const seeds = [inst.research_url, inst.careers_url].filter((u): u is string => Boolean(u));
  if (seeds.length === 0 && inst.official_url) seeds.push(inst.official_url);

  const result: DiscoveryResult = { institution: inst.name, seeds, discovered: 0, inserted: 0, skipped: 0, errors: [] };
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
      candidates.set(new URL(finalUrl).toString(), { label: extractTitle(html) ?? inst.name, from: "seed" });
      for (const link of extractLinks(html, finalUrl)) {
        const u = new URL(link.url);
        const inScope = scopes.some((s) => u.host === s.host);
        if (!inScope) continue;
        if (/\.(pdf|jpg|jpeg|png|gif|zip|docx?|pptx?|xlsx?)$/i.test(u.pathname)) continue;
        if (!isDomainRelevant(u.toString(), link.label)) continue;
        if (!candidates.has(u.toString())) candidates.set(u.toString(), { label: link.label, from: finalUrl });
      }
    } catch (e) {
      result.errors.push({ url: seed, error: e instanceof Error ? e.message : String(e) });
    }
  }

  result.discovered = candidates.size;

  const CATEGORY_ORDER = ["vacancies", "people", "projects", "publications", "events", "programmes", "courses", "research_groups"];
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
      category === "vacancies" ? "careers_page" : category === "research_groups" ? "research_group" : "institution";
    const { data: existing } = await supabaseAdmin.from("sources").select("id").eq("url", url).maybeSingle();
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
        priority: category === "vacancies" ? 1 : category === "people" || category === "projects" ? 2 : 4,
        status: "PENDING",
        discovered_from: meta.from,
        trust_level: 5,
        active: true,
        notes: "Discovered by discover-academic-sources (institution-scoped crawl)",
      })
      .select("id")
      .maybeSingle();
    if (insErr) {
      result.errors.push({ url, error: insErr.message });
      continue;
    }
    result.inserted += 1;
    if (inserted) await enqueue("FETCH", { source_id: inserted.id, institution_id: inst.id });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* QUEUE                                                               */
/* ------------------------------------------------------------------ */

export async function enqueue(
  taskType: "DISCOVER" | "FETCH" | "CLASSIFY" | "EXTRACT" | "NORMALIZE" | "VERIFY",
  opts: { source_id?: string | undefined; institution_id?: string | undefined; payload?: Record<string, unknown> | undefined },
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
  }
  await supabaseAdmin.from("ingestion_tasks").insert({
    task_type: taskType,
    source_id: opts.source_id ?? null,
    institution_id: opts.institution_id ?? null,
    payload: (opts.payload ?? {}) as never,
  });
}

/** Runs a small batch of queued work. Exponential backoff, DEAD after max attempts. */
export async function runQueueBatch(limit = 8): Promise<{ processed: number; ok: number; failed: number; dead: number; details: string[] }> {
  const { data: tasks, error } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("*")
    .in("status", ["QUEUED", "RETRY"])
    .lte("run_after", new Date().toISOString())
    .order("run_after")
    .limit(limit);
  if (error) throw error;

  const out = { processed: 0, ok: 0, failed: 0, dead: 0, details: [] as string[] };
  for (const task of tasks ?? []) {
    out.processed += 1;
    await supabaseAdmin
      .from("ingestion_tasks")
      .update({ status: "PROCESSING", attempts: task.attempts + 1, started_at: new Date().toISOString(), last_error: null })
      .eq("id", task.id);
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
        detail = `NORMALIZE ${r.status}${r.reason ? `: ${r.reason}` : ""}`;
      } else {
        throw new Error(`Unsupported task ${task.task_type} (missing source/institution)`);
      }
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({ status: "COMPLETE", completed_at: new Date().toISOString() })
        .eq("id", task.id);
      out.ok += 1;
      out.details.push(detail);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const attempts = task.attempts + 1;
      const dead = attempts >= task.max_attempts;
      const backoffMinutes = Math.min(60 * 12, 2 ** attempts);
      await supabaseAdmin
        .from("ingestion_tasks")
        .update({
          status: dead ? "DEAD" : "RETRY",
          last_error: message.slice(0, 1000),
          run_after: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        })
        .eq("id", task.id);
      if (dead) out.dead += 1;
      else out.failed += 1;
      out.details.push(`FAILED ${task.task_type}: ${message.slice(0, 160)}`);
    }
  }
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

export async function fetchSource(sourceId: string): Promise<FetchOutcome> {
  const started = Date.now();
  const { data: source, error } = await supabaseAdmin
    .from("sources")
    .select("id, url, institution_id, adapter_key, category, refresh_frequency_hours")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const recordRun = async (success: boolean, changed: boolean, errorMessage: string | null) => {
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
      .update({ status: "BLOCKED", last_failure_at: new Date().toISOString(), last_error: "Disallowed by robots.txt" })
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
      .update({ status: "FAILED", last_failure_at: new Date().toISOString(), last_error: message.slice(0, 500) })
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
  const text = extractText(html);
  const hash = await sha256(text);
  const { classification, confidence } = classifyUrlAndText(finalUrl, title ?? "", text);

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
        payload: { title, length: text.length, category: source.category } as never,
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
    : Math.min(Math.round((source.refresh_frequency_hours ?? baseHours) * 1.5), baseHours * schedule.adaptive_backoff_max);

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
  // Unchanged content stops here: no extraction, no model call, no canonical write.
  if (changed) await enqueue("NORMALIZE", { source_id: source.id, institution_id: source.institution_id ?? undefined });


  // A vacancy listing page is an index, not a record: register each individual
  // posting it links to as its own source so every position keeps its own URL.
  if (source.category === "vacancies") {
    const host = new URL(finalUrl).host;
    const postings = extractLinks(html, finalUrl).filter((l) => {
      try {
        const u = new URL(l.url);
        return u.host === host && /\/(job|jobs|stelle|stellenangebot|position)\//i.test(u.pathname);
      } catch {
        return false;
      }
    });
    const seen = new Set<string>();
    for (const posting of postings.slice(0, 60)) {
      if (seen.has(posting.url)) continue;
      seen.add(posting.url);
      const { data: dup } = await supabaseAdmin.from("sources").select("id").eq("url", posting.url).maybeSingle();
      if (dup) continue;
      const { data: child } = await supabaseAdmin
        .from("sources")
        .insert({
          url: posting.url,
          canonical_url: posting.url,
          name: (posting.label || posting.url).slice(0, 200),
          source_type: "careers_page" as never,
          adapter_key: "html-vacancy",
          institution_id: source.institution_id,
          category: "vacancies",
          priority: 1,
          status: "PENDING",
          discovered_from: finalUrl,
          trust_level: 5,
          active: true,
          notes: "Individual posting linked from a vacancy listing page",
        })
        .select("id")
        .maybeSingle();
      if (child) await enqueue("FETCH", { source_id: child.id, institution_id: source.institution_id ?? undefined });
    }
  }

  return { url: source.url, final_url: finalUrl, http_status: status, changed, classification, raw_record_id: rawId };

}

/* ------------------------------------------------------------------ */
/* NORMALIZATION -> CANONICAL                                          */
/* ------------------------------------------------------------------ */

const DATE_RE =
  /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

function parseDeadline(text: string): string | null {
  const windowText = text.slice(0, 8000);
  const cue = /(deadline|bewerbungsfrist|application by|apply by|closing date|bewerbungsschluss)/i.exec(windowText);
  const scope = cue ? windowText.slice(cue.index, cue.index + 200) : "";
  const m = DATE_RE.exec(scope);
  if (!m) return null;
  if (m[3]) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
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
  const days = Math.ceil((new Date(`${deadline}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "closed";
  if (days <= 14) return "closing_soon";
  return "open";
}

export type NormalizeResult = { status: "NORMALIZED" | "SKIPPED" | "FAILED"; reason?: string | undefined; entity_id?: string | undefined };

/* ------------------------------------------------------------------ */
/* SINGLE-POSTING GATE                                                 */
/* ------------------------------------------------------------------ */

/** Words that mark a page as a careers *landing/listing* page, not one posting. */
const LISTING_TITLE = /^(careers?|jobs?|vacancies|open (job )?positions?|positions?|recruitment|stellenangebote|stellen|job ?board|work (with|for) us|join (our team|us)|life at|our people|talent|employment)\b/i;
const NON_POSTING = /(meet [a-z]|faces|blog|news|resources?|contact|use ?cases?|products?|solutions?|api\b|webinar|podcast|events?|privacy|imprint|impressum|cookie|newsletter|about us|our story|benefits|culture|diversity|internship programme overview)/i;
/** A real posting names a role in its title. */
const ROLE_TITLE = /(phd|ph\.d|doctoral|doktorand|promotionsstelle|post ?doc|postdoctoral|professor|professur|juniorprofessur|lecturer|research(er)?|scientist|engineer|ingenieur|developer|analyst|technician|techniker|specialist|consultant|surveyor|geomatics|remote sensing|photogrammetr|gis\b|wissenschaftliche[rn]? mitarbeiter|w\/?m\/?d|m\/?w\/?d|f\/?m\/?d|assistant|associate|fellow|intern(ship)?|trainee|manager|lead|head of)/i;
/** A real posting reads like a job ad. */
const POSTING_BODY = /(application deadline|apply by|closing date|deadline for applications|bewerbungsfrist|bewerbungen? bis|reference number|kennziffer|ref\.? no|job id|requisition|full[- ]time|part[- ]time|vollzeit|teilzeit|fixed[- ]term|befristet|salary|remuneration|entgeltgruppe|verg[uü]tung|tv-?l|tv-?[oö]d|e ?13|start(ing)? date|eintrittstermin|your (tasks|profile|responsibilities)|ihre aufgaben|ihr profil|we offer|wir bieten|required qualifications|qualification[s]? required|how to apply|submit your application|bewerbungsunterlagen)/i;

/**
 * True only when a fetched page really is ONE vacancy posting.
 * Careers hubs, marketing and resource pages under a /careers/ path must never
 * become an opportunity row — that is how the domain loses credibility.
 */
export function looksLikeSinglePosting(url: string, title: string, text: string): { ok: boolean; reason?: string } {
  const t = (title || "").trim();
  const body = text || "";
  const path = pathOf(url);
  if (!t) return { ok: false, reason: "no title" };
  if (LISTING_TITLE.test(t)) return { ok: false, reason: "careers listing/landing page title" };
  if (NON_POSTING.test(t)) return { ok: false, reason: "marketing/resource page, not a posting" };
  if (/^\/?(careers?|jobs?|vacancies|stellenangebote|stellen|recruitment)\/?$/i.test(path)) {
    return { ok: false, reason: "careers index path" };
  }
  if (body.length < 600) return { ok: false, reason: "page too thin to be a posting" };
  if (!ROLE_TITLE.test(t)) return { ok: false, reason: "title does not name a role" };
  if (!POSTING_BODY.test(body)) return { ok: false, reason: "no job-ad signals (deadline, contract, tasks, salary)" };
  return { ok: true };
}

export async function normalizeSource(sourceId: string): Promise<NormalizeResult> {
  const { data: raw } = await supabaseAdmin
    .from("raw_records")
    .select("id, final_url, page_title, text_content, classification, institution_id, source_id, content_hash")
    .eq("source_id", sourceId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!raw) return { status: "SKIPPED", reason: "no raw record for source" };

  const mark = async (status: string, error: string | null) => {
    await supabaseAdmin.from("raw_records").update({ normalization_status: status, normalization_error: error }).eq("id", raw.id);
  };

  const rawTitle = (raw.page_title ?? "").trim();

  // Non-vacancy record types now have their own gates + extractors.
  if (raw.classification !== "VACANCY") {
    if (!rawTitle) {
      await mark("SKIPPED", "no page title to extract from");
      return { status: "SKIPPED", reason: "no page title" };
    }
    const { normalizeNonVacancy } = await import("./extraction/canonical.server");
    const outcome = await normalizeNonVacancy(raw, rawTitle.split(/\s*[|·–—]\s*/)[0]?.trim() || rawTitle);
    await mark(outcome.status, outcome.status === "NORMALIZED" ? null : (outcome.reason ?? null));
    return outcome;
  }

  if (!raw.institution_id) {
    await mark("FAILED", "missing institution");
    return { status: "FAILED", reason: "missing institution" };
  }
  const title = (raw.page_title ?? "")
    // Strip site chrome that job portals append to <title>.
    .replace(/\s*[|·–—-]\s*[^|·–—-]*(university|universit\u00e4t|hochschule|institut\w*|careers?|karriere)[^|·–—-]*$/gi, "")
    .replace(/\s*(job\s*details?|stellendetails|stellenanzeige|job\s*description)\s*$/i, "")
    .trim();
  if (!title) {
    await mark("FAILED", "missing title");
    return { status: "FAILED", reason: "missing title" };
  }

  const text = raw.text_content ?? "";
  const gate = looksLikeSinglePosting(raw.final_url ?? "", title, text);
  if (!gate.ok) {
    await mark("SKIPPED", `not a single vacancy posting: ${gate.reason}`);
    return { status: "SKIPPED", reason: `not a single vacancy posting: ${gate.reason}` };
  }
  const rolling = /(rolling|laufend|jederzeit|until filled|bis zur besetzung)/i.test(text);
  const deterministicDeadline = parseDeadline(text);
  // Only the posting's own title decides the type: body text mentioning a
  // doctoral programme must not turn a staff role into a PhD position.
  const isPhd = /(phd|ph\.d|doctoral researcher|doktorand|promotionsstelle)/i.test(title);
  const slug = slugify(title) || slugify(raw.final_url ?? raw.id);

  // Semantic enrichment runs AFTER the deterministic gate and can only add
  // validated detail. If the model rejects the page as not a real single
  // posting, we skip it — but it can never promote a page the gate refused.
  const { enrichVacancy } = await import("./extraction/enrich.server");
  const enriched = await enrichVacancy({
    url: raw.final_url ?? "",
    title,
    text,
    sourceId: raw.source_id,
    rawRecordId: raw.id,
    contentHash: raw.content_hash,
  });
  const ex = enriched.extraction;
  if (ex && !ex.is_single_real_position) {
    await mark("SKIPPED", `intelligence engine rejected: ${ex.rejection_reason ?? "not a single real position"}`);
    return { status: "SKIPPED", reason: `intelligence engine rejected: ${ex.rejection_reason ?? "not a single real position"}` };
  }

  const deadline = deterministicDeadline ?? ex?.application_deadline ?? null;
  const status = deriveStatus(deadline, rolling);
  const usedModel = Boolean(ex);

  const { data: existing } = await supabaseAdmin
    .from("opportunities")
    .select("id")
    .eq("official_source_url", raw.final_url ?? "")
    .maybeSingle();

  // Two postings can share a title (e.g. the same role advertised per language),
  // so keep slugs unique by appending a stable suffix from the source URL.
  let uniqueSlug = slug;
  const { data: slugOwner } = await supabaseAdmin.from("opportunities").select("id").eq("slug", slug).maybeSingle();
  if (slugOwner && slugOwner.id !== existing?.id) {
    const suffix = (await sha256(raw.final_url ?? raw.id)).slice(0, 6);
    uniqueSlug = `${slug.slice(0, 70)}-${suffix}`;
  }

  const payload = {
    title: title.slice(0, 300),
    slug: uniqueSlug,
    normalized_title: title.toLowerCase().slice(0, 300),
    institution_id: raw.institution_id,
    opportunity_type: ((ex?.opportunity_type ?? (isPhd ? "phd" : "other")) as string) as never,
    sector: ex?.sector ?? "academic",
    description: (ex?.summary ?? text).slice(0, 2000),
    requirements: ex?.requirements ?? null,
    funding_type: ex?.funding_type ?? null,
    salary_text: ex?.salary_text ?? null,
    supervisor_name: ex?.supervisor_name ?? null,
    city: ex?.city ?? null,
    country: ex?.country ?? null,
    start_date: ex?.start_date ?? null,
    application_url: ex?.application_url ?? raw.final_url,
    official_source_url: raw.final_url,
    status: status as never,
    confidence: (deadline ? "medium" : "low") as never,
    verification_status: "auto_discovered" as never,
    last_checked_at: new Date().toISOString(),
    application_deadline: deadline,
    is_demo: false,
    extracted_by: usedModel ? "NVIDIA_NEMOTRON" : "DETERMINISTIC",
    extraction_model: usedModel ? "nvidia/nemotron-3-ultra-550b-a55b" : null,
    extraction_confidence: ex?.confidence ?? null,
    extraction_timestamp: usedModel ? new Date().toISOString() : null,
  };


  let entityId = existing?.id;
  if (entityId) {
    const { error } = await supabaseAdmin.from("opportunities").update(payload).eq("id", entityId);
    if (error) {
      await mark("FAILED", error.message);
      return { status: "FAILED", reason: error.message };
    }
  } else {
    const { data: ins, error } = await supabaseAdmin.from("opportunities").insert(payload).select("id").maybeSingle();
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
    if (!evidence) {
      await supabaseAdmin.from("record_sources").insert({
        entity_type: "opportunity",
        entity_id: entityId,
        source_id: raw.source_id,
        source_url: raw.final_url ?? "",
        source_type: "careers_page" as never,
        original_title: raw.page_title,
        claim: "Vacancy page fetched from the institution's own website",
        verification_status: "auto_discovered" as never,
        confidence: "medium" as never,
        is_primary: true,
        last_checked_at: new Date().toISOString(),
      });
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
    const twin = (twins ?? []).find((t) => t.normalized_title && payload.normalized_title.startsWith(t.normalized_title.slice(0, 25)));
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
          match_reason: "Near-identical title at the same institution (likely language variant of one posting)",
          score: 0.8,
        });
      }
    }
  }

  await mark("NORMALIZED", null);
  return { status: "NORMALIZED", entity_id: entityId };
}
