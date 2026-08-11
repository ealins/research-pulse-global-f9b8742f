// Prompts, typed shapes and validators for the non-vacancy entity extractors.
// Same architecture as the proven vacancy path: strict JSON, schema validation,
// business rules, then a hallucination guard that drops any short factual field
// the page never actually stated.
import { runExtraction, type ExtractionInput, type ExtractionOutcome } from "./engine.server";
import {
  dropUnsupported,
  fail,
  isoOrNull,
  isIsoDate,
  nullableString,
  parseObject,
  stringArray,
  unitNumber,
  type ValidationOutcome,
} from "./shared.server";

const COMMON_RULES = `RULES — these are absolute:
1. Use ONLY the supplied page text. Never infer, complete or invent any fact.
2. If a field is not explicitly stated in the text, return null (or an empty array). Never guess.
3. Every evidence snippet must be copied verbatim from the supplied text.
4. Reply with ONE JSON object and nothing else — no prose, no markdown fences, no reasoning before or after it. Start your reply with "{".
5. "confidence" is a number from 0 to 1.
6. Be terse so the object always completes: "summary" at most 400 characters, at most 2 evidence snippets of at most 200 characters each, and at most 6 items in any array.`;


const ROLE = `You are the extraction engine of GeoAcademic Radar, a research intelligence platform for photogrammetry, remote sensing, geodesy, geoinformatics, GeoAI and Earth observation.`;

/* ------------------------------------------------------------------ */
/* RESEARCH PROJECTS                                                   */
/* ------------------------------------------------------------------ */

export const PROJECT_SYSTEM_PROMPT = `${ROLE}

${COMMON_RULES}

Return exactly this shape:
{
  "is_single_real_project": boolean,
  "rejection_reason": string | null,
  "title": string | null,
  "acronym": string | null,
  "institution": string | null,
  "department": string | null,
  "research_group": string | null,
  "principal_investigator": string | null,
  "researchers": string[],
  "partners": string[],
  "funders": string[],
  "funding_programme": string | null,
  "funding_amount": number | null,
  "funding_currency": string | null,
  "start_date": string | null,
  "end_date": string | null,
  "topics": string[],
  "project_url": string | null,
  "summary": string | null,
  "confidence": number,
  "evidence": string[]
}

Dates must be ISO (YYYY-MM-DD) or null; if only a year or month is given, use the first day (e.g. 2023 -> 2023-01-01).
Return "principal_investigator" ONLY when the text explicitly names a project lead, PI, coordinator or Projektleitung.
Return "funding_amount" ONLY when an explicit amount is stated; otherwise null.
Set "is_single_real_project" to false for project lists, institute overviews, news items or funding-programme pages, and give a short rejection_reason.`;

export type ProjectExtraction = {
  is_single_real_project: boolean;
  rejection_reason: string | null;
  title: string | null;
  acronym: string | null;
  institution: string | null;
  department: string | null;
  research_group: string | null;
  principal_investigator: string | null;
  researchers: string[];
  partners: string[];
  funders: string[];
  funding_programme: string | null;
  funding_amount: number | null;
  funding_currency: string | null;
  start_date: string | null;
  end_date: string | null;
  topics: string[];
  project_url: string | null;
  summary: string | null;
  confidence: number;
  evidence: string[];
};

function requireFlagAndConfidence(
  obj: Record<string, unknown>,
  flag: string,
): { ok: true; confidence: number } | { ok: false; outcome: ValidationOutcome<never> } {
  if (typeof obj[flag] !== "boolean") {
    return { ok: false, outcome: fail<never>("SCHEMA_FAILURE", `${flag} must be a boolean`) };
  }
  const confidence = unitNumber(obj["confidence"]);
  if (confidence === null) {
    return { ok: false, outcome: fail<never>("BUSINESS_RULE_FAILURE", "confidence must be a number between 0 and 1") };
  }
  return { ok: true, confidence };
}

function badDates(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    const v = obj[f];
    if (v !== null && v !== undefined && v !== "" && !isIsoDate(v)) return `${f} is not an ISO date: ${String(v)}`;
  }
  return null;
}

export function validateProject(completion: string, text: string): ValidationOutcome<ProjectExtraction> & { dropped?: string[] } {
  const parsedRes = parseObject<ProjectExtraction>(completion);
  if (!parsedRes.ok) return parsedRes.outcome;
  const obj = parsedRes.obj;

  const head = requireFlagAndConfidence(obj, "is_single_real_project");
  if (!head.ok) return head.outcome as ValidationOutcome<ProjectExtraction>;

  const dateError = badDates(obj, ["start_date", "end_date"]);
  if (dateError) return fail("BUSINESS_RULE_FAILURE", dateError);

  const title = nullableString(obj["title"], 300);
  const accepted = obj["is_single_real_project"] === true;
  if (accepted && !title) return fail("BUSINESS_RULE_FAILURE", "accepted project has no title");

  const amountRaw = obj["funding_amount"];
  const amount = typeof amountRaw === "number" && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;

  const value: ProjectExtraction = {
    is_single_real_project: accepted,
    rejection_reason: nullableString(obj["rejection_reason"], 300),
    title,
    acronym: nullableString(obj["acronym"], 60),
    institution: nullableString(obj["institution"], 200),
    department: nullableString(obj["department"], 200),
    research_group: nullableString(obj["research_group"], 200),
    principal_investigator: nullableString(obj["principal_investigator"], 200),
    researchers: stringArray(obj["researchers"], 200, 25),
    partners: stringArray(obj["partners"], 200, 25),
    funders: stringArray(obj["funders"], 200, 10),
    funding_programme: nullableString(obj["funding_programme"], 200),
    funding_amount: amount,
    funding_currency: nullableString(obj["funding_currency"], 8),
    start_date: isoOrNull(obj["start_date"]),
    end_date: isoOrNull(obj["end_date"]),
    topics: stringArray(obj["topics"], 120, 12),
    project_url: nullableString(obj["project_url"], 800),
    summary: nullableString(obj["summary"], 2000),
    confidence: head.confidence,
    evidence: stringArray(obj["evidence"], 400, 8),
  };

  const guarded = dropUnsupported(value, text, [
    "acronym",
    "department",
    "research_group",
    "principal_investigator",
    "funding_programme",
  ]);
  return { ok: true, value: guarded.value, dropped: guarded.dropped };
}

export function extractProject(input: ExtractionInput): Promise<ExtractionOutcome<ProjectExtraction>> {
  return runExtraction<ProjectExtraction>({
    operation: "PROJECT_EXTRACTION",
    system: PROJECT_SYSTEM_PROMPT,
    validate: validateProject,
    input,
  });
}

/* ------------------------------------------------------------------ */
/* STUDY PROGRAMMES                                                    */
/* ------------------------------------------------------------------ */

export const PROGRAMME_SYSTEM_PROMPT = `${ROLE}

${COMMON_RULES}

Return exactly this shape:
{
  "is_single_real_programme": boolean,
  "rejection_reason": string | null,
  "name": string | null,
  "degree_level": "bachelor" | "master" | "doctoral" | "certificate" | "other" | null,
  "degree_awarded": string | null,
  "institution": string | null,
  "department": string | null,
  "duration": string | null,
  "language": string | null,
  "application_start": string | null,
  "application_deadline": string | null,
  "topics": string[],
  "courses": string[],
  "professors": string[],
  "programme_url": string | null,
  "summary": string | null,
  "confidence": number,
  "evidence": string[]
}

Dates must be ISO (YYYY-MM-DD) or null.
Include "courses" only when the page explicitly lists modules or courses of THIS programme; include "professors" only when the page explicitly names teaching staff of THIS programme. Otherwise return empty arrays.
Set "is_single_real_programme" to false for generic "Study at ..." landing pages, faculty overviews, admissions-office pages or programme lists, and give a short rejection_reason.`;

export type ProgrammeExtraction = {
  is_single_real_programme: boolean;
  rejection_reason: string | null;
  name: string | null;
  degree_level: string | null;
  degree_awarded: string | null;
  institution: string | null;
  department: string | null;
  duration: string | null;
  language: string | null;
  application_start: string | null;
  application_deadline: string | null;
  topics: string[];
  courses: string[];
  professors: string[];
  programme_url: string | null;
  summary: string | null;
  confidence: number;
  evidence: string[];
};

const DEGREE_LEVELS = ["bachelor", "master", "doctoral", "certificate", "other"];

export function validateProgramme(completion: string, text: string): ValidationOutcome<ProgrammeExtraction> & { dropped?: string[] } {
  const parsedRes = parseObject<ProgrammeExtraction>(completion);
  if (!parsedRes.ok) return parsedRes.outcome;
  const obj = parsedRes.obj;

  const head = requireFlagAndConfidence(obj, "is_single_real_programme");
  if (!head.ok) return head.outcome as ValidationOutcome<ProgrammeExtraction>;

  const dateError = badDates(obj, ["application_start", "application_deadline"]);
  if (dateError) return fail("BUSINESS_RULE_FAILURE", dateError);

  const level = nullableString(obj["degree_level"], 30)?.toLowerCase() ?? null;
  if (level && !DEGREE_LEVELS.includes(level)) return fail("BUSINESS_RULE_FAILURE", `unsupported degree_level: ${level}`);

  const name = nullableString(obj["name"], 300);
  const accepted = obj["is_single_real_programme"] === true;
  if (accepted && !name) return fail("BUSINESS_RULE_FAILURE", "accepted programme has no name");
  if (accepted && !level) return fail("BUSINESS_RULE_FAILURE", "accepted programme has no degree level");

  const value: ProgrammeExtraction = {
    is_single_real_programme: accepted,
    rejection_reason: nullableString(obj["rejection_reason"], 300),
    name,
    degree_level: level,
    degree_awarded: nullableString(obj["degree_awarded"], 120),
    institution: nullableString(obj["institution"], 200),
    department: nullableString(obj["department"], 200),
    duration: nullableString(obj["duration"], 120),
    language: nullableString(obj["language"], 120),
    application_start: isoOrNull(obj["application_start"]),
    application_deadline: isoOrNull(obj["application_deadline"]),
    topics: stringArray(obj["topics"], 120, 12),
    courses: stringArray(obj["courses"], 200, 40),
    professors: stringArray(obj["professors"], 200, 20),
    programme_url: nullableString(obj["programme_url"], 800),
    summary: nullableString(obj["summary"], 2000),
    confidence: head.confidence,
    evidence: stringArray(obj["evidence"], 400, 8),
  };

  const guarded = dropUnsupported(value, text, ["degree_awarded", "department", "duration", "language"]);
  return { ok: true, value: guarded.value, dropped: guarded.dropped };
}

export function extractProgramme(input: ExtractionInput): Promise<ExtractionOutcome<ProgrammeExtraction>> {
  return runExtraction<ProgrammeExtraction>({
    operation: "PROGRAMME_EXTRACTION",
    system: PROGRAMME_SYSTEM_PROMPT,
    validate: validateProgramme,
    input,
  });
}

/* ------------------------------------------------------------------ */
/* RESEARCHER PROFILES                                                 */
/* ------------------------------------------------------------------ */

export const RESEARCHER_SYSTEM_PROMPT = `${ROLE}

${COMMON_RULES}
7. NEVER infer an e-mail address, an ORCID, a department or a supervisor relationship. Return null unless the text states it literally.

Return exactly this shape:
{
  "is_single_real_profile": boolean,
  "rejection_reason": string | null,
  "full_name": string | null,
  "academic_title": string | null,
  "current_position": string | null,
  "institution": string | null,
  "department": string | null,
  "research_group": string | null,
  "orcid": string | null,
  "research_areas": string[],
  "projects": string[],
  "courses": string[],
  "professional_roles": string[],
  "profile_url": string | null,
  "summary": string | null,
  "confidence": number,
  "evidence": string[]
}

"orcid" must match 0000-0000-0000-000X and appear literally in the text, otherwise null.
Set "is_single_real_profile" to false for staff directories, team overviews, group pages or news items, and give a short rejection_reason.`;

export type ResearcherExtraction = {
  is_single_real_profile: boolean;
  rejection_reason: string | null;
  full_name: string | null;
  academic_title: string | null;
  current_position: string | null;
  institution: string | null;
  department: string | null;
  research_group: string | null;
  orcid: string | null;
  research_areas: string[];
  projects: string[];
  courses: string[];
  professional_roles: string[];
  profile_url: string | null;
  summary: string | null;
  confidence: number;
  evidence: string[];
};

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i;

export function validateResearcher(completion: string, text: string): ValidationOutcome<ResearcherExtraction> & { dropped?: string[] } {
  const parsedRes = parseObject<ResearcherExtraction>(completion);
  if (!parsedRes.ok) return parsedRes.outcome;
  const obj = parsedRes.obj;

  const head = requireFlagAndConfidence(obj, "is_single_real_profile");
  if (!head.ok) return head.outcome as ValidationOutcome<ResearcherExtraction>;

  const fullName = nullableString(obj["full_name"], 200);
  const accepted = obj["is_single_real_profile"] === true;
  if (accepted && !fullName) return fail("BUSINESS_RULE_FAILURE", "accepted profile has no full name");

  // ORCID must be well formed AND literally present — never inferred.
  let orcid = nullableString(obj["orcid"], 30);
  if (orcid && (!ORCID_RE.test(orcid) || !text.includes(orcid))) orcid = null;

  const value: ResearcherExtraction = {
    is_single_real_profile: accepted,
    rejection_reason: nullableString(obj["rejection_reason"], 300),
    full_name: fullName,
    academic_title: nullableString(obj["academic_title"], 120),
    current_position: nullableString(obj["current_position"], 200),
    institution: nullableString(obj["institution"], 200),
    department: nullableString(obj["department"], 200),
    research_group: nullableString(obj["research_group"], 200),
    orcid,
    research_areas: stringArray(obj["research_areas"], 160, 20),
    projects: stringArray(obj["projects"], 200, 25),
    courses: stringArray(obj["courses"], 200, 25),
    professional_roles: stringArray(obj["professional_roles"], 200, 15),
    profile_url: nullableString(obj["profile_url"], 800),
    summary: nullableString(obj["summary"], 2000),
    confidence: head.confidence,
    evidence: stringArray(obj["evidence"], 400, 8),
  };

  const guarded = dropUnsupported(value, text, ["academic_title", "current_position", "department", "research_group"]);
  return { ok: true, value: guarded.value, dropped: guarded.dropped };
}

export function extractResearcher(input: ExtractionInput): Promise<ExtractionOutcome<ResearcherExtraction>> {
  return runExtraction<ResearcherExtraction>({
    operation: "RESEARCHER_EXTRACTION",
    system: RESEARCHER_SYSTEM_PROMPT,
    validate: validateResearcher,
    input,
  });
}

/* ------------------------------------------------------------------ */
/* ACADEMIC EVENTS                                                     */
/* ------------------------------------------------------------------ */

export const EVENT_SYSTEM_PROMPT = `${ROLE}

${COMMON_RULES}

Return exactly this shape:
{
  "is_single_real_event": boolean,
  "rejection_reason": string | null,
  "title": string | null,
  "event_kind": "conference" | "workshop" | "symposium" | "summer_school" | "seminar" | "other" | null,
  "organizer": string | null,
  "location": string | null,
  "country": string | null,
  "start_date": string | null,
  "end_date": string | null,
  "abstract_deadline": string | null,
  "paper_deadline": string | null,
  "registration_deadline": string | null,
  "topics": string[],
  "event_url": string | null,
  "summary": string | null,
  "confidence": number,
  "evidence": string[]
}

Dates must be ISO (YYYY-MM-DD) or null.
Set "is_single_real_event" to false for news articles that merely mention an event, event archives, event calendars or institute overviews, and give a short rejection_reason.`;

export type EventExtraction = {
  is_single_real_event: boolean;
  rejection_reason: string | null;
  title: string | null;
  event_kind: string | null;
  organizer: string | null;
  location: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  abstract_deadline: string | null;
  paper_deadline: string | null;
  registration_deadline: string | null;
  topics: string[];
  event_url: string | null;
  summary: string | null;
  confidence: number;
  evidence: string[];
};

const EVENT_KINDS = ["conference", "workshop", "symposium", "summer_school", "seminar", "other"];

export function validateEvent(completion: string, text: string): ValidationOutcome<EventExtraction> & { dropped?: string[] } {
  const parsedRes = parseObject<EventExtraction>(completion);
  if (!parsedRes.ok) return parsedRes.outcome;
  const obj = parsedRes.obj;

  const head = requireFlagAndConfidence(obj, "is_single_real_event");
  if (!head.ok) return head.outcome as ValidationOutcome<EventExtraction>;

  const dateError = badDates(obj, [
    "start_date",
    "end_date",
    "abstract_deadline",
    "paper_deadline",
    "registration_deadline",
  ]);
  if (dateError) return fail("BUSINESS_RULE_FAILURE", dateError);

  const kind = nullableString(obj["event_kind"], 30)?.toLowerCase() ?? null;
  if (kind && !EVENT_KINDS.includes(kind)) return fail("BUSINESS_RULE_FAILURE", `unsupported event_kind: ${kind}`);

  const title = nullableString(obj["title"], 300);
  const accepted = obj["is_single_real_event"] === true;
  if (accepted && !title) return fail("BUSINESS_RULE_FAILURE", "accepted event has no title");

  const start = isoOrNull(obj["start_date"]);
  const end = isoOrNull(obj["end_date"]);
  if (start && end && end < start) return fail("BUSINESS_RULE_FAILURE", "end_date is before start_date");

  const value: EventExtraction = {
    is_single_real_event: accepted,
    rejection_reason: nullableString(obj["rejection_reason"], 300),
    title,
    event_kind: kind,
    organizer: nullableString(obj["organizer"], 200),
    location: nullableString(obj["location"], 200),
    country: nullableString(obj["country"], 120),
    start_date: start,
    end_date: end,
    abstract_deadline: isoOrNull(obj["abstract_deadline"]),
    paper_deadline: isoOrNull(obj["paper_deadline"]),
    registration_deadline: isoOrNull(obj["registration_deadline"]),
    topics: stringArray(obj["topics"], 120, 12),
    event_url: nullableString(obj["event_url"], 800),
    summary: nullableString(obj["summary"], 2000),
    confidence: head.confidence,
    evidence: stringArray(obj["evidence"], 400, 8),
  };

  const guarded = dropUnsupported(value, text, ["organizer", "location", "country"]);
  return { ok: true, value: guarded.value, dropped: guarded.dropped };
}

export function extractEvent(input: ExtractionInput): Promise<ExtractionOutcome<EventExtraction>> {
  return runExtraction<EventExtraction>({
    operation: "EVENT_EXTRACTION",
    system: EVENT_SYSTEM_PROMPT,
    validate: validateEvent,
    input,
  });
}
