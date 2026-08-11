// One-time backfill planner: turns ALREADY STORED raw pages and existing
// institution rows into queued work. Nothing here fetches the web, and nothing
// here calls a model — it only enqueues tasks that the deployed autonomous
// drain loop processes with the existing gates, cache and validators.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Skip reasons written before the entity extractors existed — safe to retry. */
const LEGACY_SKIP = "unsupported record type for canonical extraction";
const LEGACY_SKIP_ALT = "no extractor for classification";

/** Classifications that now have a gate + extractor + canonical writer. */
export const BACKFILL_CLASSIFICATIONS = ["PROJECT", "RESEARCHER", "EVENT", "PROGRAMME", "COURSE", "VACANCY"] as const;

export type BackfillPlan = {
  raw_candidates: number;
  queued: number;
  already_queued: number;
  by_classification: Record<string, number>;
};

/**
 * Enqueues NORMALIZE work for stored raw pages that have never been processed
 * successfully by the current extraction pipeline.
 */
export async function enqueueRawBackfill(limit = 400): Promise<BackfillPlan> {
  const plan: BackfillPlan = { raw_candidates: 0, queued: 0, already_queued: 0, by_classification: {} };

  const { data: raws } = await supabaseAdmin
    .from("raw_records")
    .select("id, source_id, classification, normalization_status, normalization_error, fetched_at")
    .in("classification", BACKFILL_CLASSIFICATIONS as unknown as string[])
    .order("fetched_at", { ascending: false })
    .limit(2000);

  const candidates = (raws ?? []).filter((r) => {
    if (!r.source_id) return false;
    const status = r.normalization_status ?? "PENDING";
    if (status === "NORMALIZED") return false;
    if (status === "PENDING") return true;
    const err = r.normalization_error ?? "";
    // Only retry skips that were caused by missing extractors, never real
    // rejections from the gates or the validator.
    return status === "SKIPPED" && (err.includes(LEGACY_SKIP) || err.includes(LEGACY_SKIP_ALT));
  });

  // One task per source: normalizeSource() always works on the newest raw page.
  const bySource = new Map<string, string>();
  for (const r of candidates) {
    if (!bySource.has(r.source_id as string)) bySource.set(r.source_id as string, r.classification ?? "UNKNOWN");
  }
  plan.raw_candidates = bySource.size;

  const { data: openTasks } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("source_id")
    .eq("task_type", "NORMALIZE")
    .in("status", ["QUEUED", "PROCESSING", "RETRY"]);
  const open = new Set((openTasks ?? []).map((t) => t.source_id).filter(Boolean) as string[]);

  const rows: { task_type: string; source_id: string; payload: Record<string, unknown> }[] = [];
  for (const [sourceId, classification] of bySource) {
    plan.by_classification[classification] = (plan.by_classification[classification] ?? 0) + 1;
    if (open.has(sourceId)) {
      plan.already_queued += 1;
      continue;
    }
    if (rows.length >= limit) continue;
    rows.push({ task_type: "NORMALIZE", source_id: sourceId, payload: { backfill: true, classification } });
  }

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabaseAdmin.from("ingestion_tasks").insert(chunk as never);
    if (!error) plan.queued += chunk.length;
  }
  return plan;
}

export type ProviderPlan = { promote_queued: number; publications_queued: number };

/**
 * Enqueues structured-provider work: institution identity reconciliation
 * (promotion of seed rows, never duplication) and OpenAlex publication import.
 */
export async function enqueueProviderBackfill(limit = 120): Promise<ProviderPlan> {
  const out: ProviderPlan = { promote_queued: 0, publications_queued: 0 };

  const { data: openTasks } = await supabaseAdmin
    .from("ingestion_tasks")
    .select("task_type, institution_id")
    .in("task_type", ["PROMOTE_INSTITUTION", "IMPORT_PUBLICATIONS"])
    .in("status", ["QUEUED", "PROCESSING", "RETRY"]);
  const openKey = new Set((openTasks ?? []).map((t) => `${t.task_type}:${t.institution_id}`));

  const { data: institutions } = await supabaseAdmin
    .from("institutions")
    .select("id, name, openalex_id, is_demo")
    .order("is_demo", { ascending: false })
    .limit(500);

  const rows: { task_type: string; institution_id: string; payload: Record<string, unknown> }[] = [];
  for (const inst of institutions ?? []) {
    if (rows.length >= limit) break;
    if (!inst.openalex_id && !openKey.has(`PROMOTE_INSTITUTION:${inst.id}`)) {
      rows.push({ task_type: "PROMOTE_INSTITUTION", institution_id: inst.id, payload: { backfill: true } });
      out.promote_queued += 1;
    }
    if (!openKey.has(`IMPORT_PUBLICATIONS:${inst.id}`)) {
      rows.push({ task_type: "IMPORT_PUBLICATIONS", institution_id: inst.id, payload: { backfill: true } });
      out.publications_queued += 1;
    }
  }

  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from("ingestion_tasks").insert(rows.slice(i, i + 100) as never);
  }
  return out;
}
