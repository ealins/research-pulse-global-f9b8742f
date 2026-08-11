// Shared, server-only helpers for every extraction validator.
// Model output is untrusted text until it passes through these.

/** Models sometimes wrap JSON in fences or prose; take the outermost object. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found in completion");
  return JSON.parse(trimmed.slice(start, end + 1));
}

export const isIsoDate = (v: unknown): boolean =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function isoOrNull(v: unknown): string | null {
  return isIsoDate(v) ? (v as string) : null;
}

export function nullableString(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 || t.toLowerCase() === "null" || t.toLowerCase() === "n/a" ? null : t.slice(0, max);
}

export function stringArray(v: unknown, max = 200, limit = 30): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = nullableString(item, max);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export function unitNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export type ValidationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: "MALFORMED_JSON" | "SCHEMA_FAILURE" | "BUSINESS_RULE_FAILURE"; message: string };

export function fail<T>(
  code: "MALFORMED_JSON" | "SCHEMA_FAILURE" | "BUSINESS_RULE_FAILURE",
  message: string,
): ValidationOutcome<T> {
  return { ok: false, code, message };
}

/** Parse the completion into an object or return a MALFORMED_JSON outcome. */
export function parseObject<T>(completion: string): { ok: true; obj: Record<string, unknown> } | { ok: false; outcome: ValidationOutcome<T> } {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(completion);
  } catch (e) {
    return { ok: false, outcome: fail<T>("MALFORMED_JSON", e instanceof Error ? e.message : String(e)) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, outcome: fail<T>("SCHEMA_FAILURE", "completion is not a JSON object") };
  }
  return { ok: true, obj: parsed as Record<string, unknown> };
}

/**
 * Every extracted string field must actually appear in the source text.
 * This is the hallucination guard: a value the page never stated is dropped.
 */
export function supportedByText(value: string | null, text: string): boolean {
  if (!value) return true;
  const needle = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (needle.length < 4) return true;
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  if (hay.includes(needle)) return true;
  // Long summaries are paraphrases by design; only check short factual fields.
  if (needle.length > 120) return true;
  return false;
}

export function dropUnsupported<T extends Record<string, unknown>>(
  value: T,
  text: string,
  fields: (keyof T)[],
): { value: T; dropped: string[] } {
  const dropped: string[] = [];
  const out = { ...value };
  for (const field of fields) {
    const v = out[field];
    if (typeof v === "string" && !supportedByText(v, text)) {
      (out as Record<string, unknown>)[field as string] = null;
      dropped.push(String(field));
    }
  }
  return { value: out, dropped };
}
