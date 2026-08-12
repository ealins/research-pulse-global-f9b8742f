// Validation layer. Model output NEVER reaches canonical tables unvalidated.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { NVIDIA_MODEL, type LlmOperation } from "../llm-config.server";
import type { VacancyExtraction } from "./vacancy.server";

const OPPORTUNITY_TYPES = [
  "phd",
  "doctoral_researcher",
  "research_assistant",
  "postdoc",
  "other",
] as const;
const SECTORS = ["academic", "industry"] as const;

export type ValidationOutcome<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "MALFORMED_JSON" | "SCHEMA_FAILURE" | "BUSINESS_RULE_FAILURE";
      message: string;
    };

/** Models sometimes wrap JSON in fences or prose; take the outermost object. */
function extractJsonObject(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found in completion");
  return JSON.parse(trimmed.slice(start, end + 1));
}

const isIsoDate = (v: unknown): boolean =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

function nullableString(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 || t.toLowerCase() === "null" ? null : t.slice(0, max);
}

export function validateVacancy(completion: string): ValidationOutcome<VacancyExtraction> {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(completion) as Record<string, unknown>;
  } catch (e) {
    return {
      ok: false,
      code: "MALFORMED_JSON",
      message: e instanceof Error ? e.message : String(e),
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, code: "SCHEMA_FAILURE", message: "completion is not a JSON object" };
  }
  if (typeof parsed["is_single_real_position"] !== "boolean") {
    return {
      ok: false,
      code: "SCHEMA_FAILURE",
      message: "is_single_real_position must be a boolean",
    };
  }

  const confidenceRaw = parsed["confidence"];
  const confidence = typeof confidenceRaw === "number" ? confidenceRaw : Number(confidenceRaw);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return {
      ok: false,
      code: "BUSINESS_RULE_FAILURE",
      message: "confidence must be a number between 0 and 1",
    };
  }

  const type = nullableString(parsed["opportunity_type"], 40);
  if (type && !OPPORTUNITY_TYPES.includes(type as (typeof OPPORTUNITY_TYPES)[number])) {
    return {
      ok: false,
      code: "BUSINESS_RULE_FAILURE",
      message: `unsupported opportunity_type: ${type}`,
    };
  }
  const sector = nullableString(parsed["sector"], 20);
  if (sector && !SECTORS.includes(sector as (typeof SECTORS)[number])) {
    return { ok: false, code: "BUSINESS_RULE_FAILURE", message: `unsupported sector: ${sector}` };
  }

  for (const field of ["start_date", "application_deadline"]) {
    const v = parsed[field];
    if (v !== null && v !== undefined && v !== "" && !isIsoDate(v)) {
      return {
        ok: false,
        code: "BUSINESS_RULE_FAILURE",
        message: `${field} is not an ISO date: ${String(v)}`,
      };
    }
  }

  const title = nullableString(parsed["title"], 300);
  if (parsed["is_single_real_position"] === true && !title) {
    return { ok: false, code: "BUSINESS_RULE_FAILURE", message: "accepted position has no title" };
  }

  const topics = Array.isArray(parsed["topics"])
    ? (parsed["topics"] as unknown[])
        .map((t) => nullableString(t, 120))
        .filter((t): t is string => Boolean(t))
    : [];
  const evidence = Array.isArray(parsed["evidence"])
    ? (parsed["evidence"] as unknown[])
        .map((t) => nullableString(t, 400))
        .filter((t): t is string => Boolean(t))
    : [];

  return {
    ok: true,
    value: {
      is_single_real_position: parsed["is_single_real_position"] === true,
      rejection_reason: nullableString(parsed["rejection_reason"], 300),
      title,
      opportunity_type: type,
      sector,
      department: nullableString(parsed["department"], 200),
      supervisor_name: nullableString(parsed["supervisor_name"], 200),
      city: nullableString(parsed["city"], 120),
      country: nullableString(parsed["country"], 120),
      funding_type: nullableString(parsed["funding_type"], 200),
      salary_text: nullableString(parsed["salary_text"], 300),
      contract_type: nullableString(parsed["contract_type"], 200),
      start_date: isIsoDate(parsed["start_date"]) ? (parsed["start_date"] as string) : null,
      application_deadline: isIsoDate(parsed["application_deadline"])
        ? (parsed["application_deadline"] as string)
        : null,
      application_url: nullableString(parsed["application_url"], 800),
      requirements: nullableString(parsed["requirements"], 4000),
      summary: nullableString(parsed["summary"], 2000),
      geospatial_relevance: parsed["geospatial_relevance"] === true,
      topics,
      confidence,
      evidence,
    },
  };
}

/** Reuse a previous validated result for identical page content.
 *
 * Validated extraction is model-independent, so a previous Ultra/Super result
 * remains reusable after switching the routine path to Nano.
 */
export async function findCachedResult(input: {
  operation: LlmOperation;
  contentHash: string | null;
}): Promise<{ result: unknown; model: string } | null> {
  if (!input.contentHash) return null;
  const { data } = await supabaseAdmin
    .from("llm_processing_runs")
    .select("result, model")
    .eq("operation", input.operation)
    .eq("content_hash", input.contentHash)
    .eq("status", "SUCCESS")
    .not("result", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.result ? { result: data.result, model: data.model ?? NVIDIA_MODEL } : null;
}

export async function recordValidatedResult(input: {
  runId: string | null;
  result: unknown;
  status: "SUCCESS" | "VALIDATION_FAILED";
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (!input.runId) return;
  await supabaseAdmin
    .from("llm_processing_runs")
    .update({
      result: input.result as never,
      status: input.status,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.runId);
}

export async function logCacheHit(input: {
  operation: LlmOperation;
  contentHash: string | null;
  sourceId?: string | null;
  rawRecordId?: string | null;
  result: unknown;
  model?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("llm_processing_runs").insert({
    provider: "NVIDIA",
    model: input.model ?? NVIDIA_MODEL,
    operation: input.operation,
    source_id: input.sourceId ?? null,
    raw_page_id: input.rawRecordId ?? null,
    content_hash: input.contentHash ?? null,
    status: "SUCCESS",
    cached: true,
    latency_ms: 0,
    completed_at: new Date().toISOString(),
    result: input.result as never,
  } as never);
}
