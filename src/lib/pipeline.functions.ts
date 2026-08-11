import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StageCounts = {
  sources_total: number;
  sources_pending: number;
  sources_fetched: number;
  sources_failed: number;
  sources_blocked: number;
  raw_total: number;
  raw_classified: number;
  raw_normalized: number;
  raw_skipped: number;
  raw_failed: number;
  tasks_queued: number;
  tasks_retry: number;
  tasks_dead: number;
  tasks_complete: number;
  canonical_opportunities_real: number;
  canonical_opportunities_demo: number;
  canonical_institutions_real: number;
  canonical_institutions_demo: number;
  changes_total: number;
};

export type PipelineHealth = {
  env: { supabase_url: string; project_id: string };
  counts: StageCounts;
  bottleneck: { stage: string; reason: string };
  recent_runs: {
    id: string;
    adapter_key: string;
    success: boolean | null;
    started_at: string;
    response_time_ms: number | null;
    error_message: string | null;
  }[];
  recent_raw: {
    id: string;
    final_url: string | null;
    page_title: string | null;
    classification: string | null;
    classification_confidence: number | null;
    normalization_status: string | null;
    normalization_error: string | null;
    fetched_at: string;
  }[];
  failing_sources: { id: string; url: string; status: string | null; last_http_status: number | null; last_error: string | null }[];
  classification_breakdown: { classification: string; count: number }[];
};

/** Internal operational data: admin session required, enforced server-side. */
export const getPipelineHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PipelineHealth> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


  type AnyQuery = {
    select: (c: string, o: unknown) => AnyQuery;
    eq: (c: string, v: unknown) => AnyQuery;
    not: (c: string, op: string, v: unknown) => AnyQuery;
  };

  const count = async (table: string, filter?: { col: string; value?: unknown; notNull?: boolean }): Promise<number> => {
    let query = (supabaseAdmin.from(table as never) as unknown as AnyQuery).select("id", { count: "exact", head: true });
    if (filter?.notNull) query = query.not(filter.col, "is", null);
    else if (filter) query = query.eq(filter.col, filter.value);
    const { count: c, error } = (await (query as unknown as Promise<{ count: number | null; error: unknown }>)) as {
      count: number | null;
      error: unknown;
    };
    if (error) return 0;
    return c ?? 0;
  };

  const [
    sources_total,
    sources_pending,
    sources_fetched,
    sources_failed,
    sources_blocked,
    raw_total,
    raw_classified,
    raw_normalized,
    raw_skipped,
    raw_failed,
    tasks_queued,
    tasks_retry,
    tasks_dead,
    tasks_complete,
    canonical_opportunities_real,
    canonical_opportunities_demo,
    canonical_institutions_real,
    canonical_institutions_demo,
    changes_total,
  ] = await Promise.all([
    count("sources"),
    count("sources", { col: "status", value: "PENDING" }),
    count("sources", { col: "status", value: "FETCHED" }),
    count("sources", { col: "status", value: "FAILED" }),
    count("sources", { col: "status", value: "BLOCKED" }),
    count("raw_records"),
    count("raw_records", { col: "classification", notNull: true }),
    count("raw_records", { col: "normalization_status", value: "NORMALIZED" }),
    count("raw_records", { col: "normalization_status", value: "SKIPPED" }),
    count("raw_records", { col: "normalization_status", value: "FAILED" }),
    count("ingestion_tasks", { col: "status", value: "QUEUED" }),
    count("ingestion_tasks", { col: "status", value: "RETRY" }),
    count("ingestion_tasks", { col: "status", value: "DEAD" }),
    count("ingestion_tasks", { col: "status", value: "COMPLETE" }),
    count("opportunities", { col: "is_demo", value: false }),
    count("opportunities", { col: "is_demo", value: true }),
    count("institutions", { col: "is_demo", value: false }),
    count("institutions", { col: "is_demo", value: true }),
    count("academic_changes"),
  ]);


  const counts: StageCounts = {
    sources_total,
    sources_pending,
    sources_fetched,
    sources_failed,
    sources_blocked,
    raw_total,
    raw_classified,
    raw_normalized,
    raw_skipped,
    raw_failed,
    tasks_queued,
    tasks_retry,
    tasks_dead,
    tasks_complete,
    canonical_opportunities_real,
    canonical_opportunities_demo,
    canonical_institutions_real,
    canonical_institutions_demo,
    changes_total,
  };

  const bottleneck = (() => {
    if (sources_total === 0) return { stage: "DISCOVERY", reason: "No sources registered — discovery has never run." };
    if (raw_total === 0) return { stage: "FETCH", reason: "Sources exist but nothing has been fetched yet." };
    if (raw_classified === 0) return { stage: "CLASSIFY", reason: "Raw pages stored but none classified." };
    if (raw_normalized === 0)
      return { stage: "NORMALIZE", reason: "Pages are classified but no canonical record has been extracted yet." };
    if (canonical_opportunities_real === 0)
      return { stage: "CANONICAL", reason: "Normalization ran but no source-backed canonical record exists." };
    if (sources_blocked > sources_fetched)
      return { stage: "FETCH", reason: "More sources are blocked by robots/HTTP than successfully fetched." };
    return { stage: "HEALTHY", reason: "All stages have produced records." };
  })();

  const [runs, raws, failing, classes] = await Promise.all([
    supabaseAdmin
      .from("sync_runs")
      .select("id, adapter_key, success, started_at, response_time_ms, error_message")
      .order("started_at", { ascending: false })
      .limit(15),
    supabaseAdmin
      .from("raw_records")
      .select("id, final_url, page_title, classification, classification_confidence, normalization_status, normalization_error, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("sources")
      .select("id, url, status, last_http_status, last_error")
      .in("status", ["FAILED", "BLOCKED"])
      .order("updated_at", { ascending: false })
      .limit(15),
    supabaseAdmin.from("raw_records").select("classification").limit(1000),
  ]);

  const breakdown = new Map<string, number>();
  for (const row of classes.data ?? []) {
    const key = row.classification ?? "UNCLASSIFIED";
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1);
  }

  return {
    env: {
      supabase_url: process.env["SUPABASE_URL"] ?? "missing",
      project_id: process.env["SUPABASE_PROJECT_ID"] ?? "missing",
    },
    counts,
    bottleneck,
    recent_runs: (runs.data ?? []) as PipelineHealth["recent_runs"],
    recent_raw: (raws.data ?? []) as PipelineHealth["recent_raw"],
    failing_sources: (failing.data ?? []) as PipelineHealth["failing_sources"],
    classification_breakdown: Array.from(breakdown.entries())
      .map(([classification, c]) => ({ classification, count: c }))
      .sort((a, b) => b.count - a.count),
  };
  });


async function assertAdmin(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const runDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { institutionSlug: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { discoverInstitutionSources } = await import("./ingest.server");
    const { data: inst, error } = await supabaseAdmin
      .from("institutions")
      .select("id")
      .eq("slug", data.institutionSlug)
      .maybeSingle();
    if (error) throw error;
    if (!inst) throw new Error(`No institution with slug ${data.institutionSlug}`);
    return await discoverInstitutionSources(inst.id);
  });

export const runQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { runQueueBatch } = await import("./ingest.server");
    return await runQueueBatch(Math.min(20, Math.max(1, data.limit ?? 8)));
  });

export const requeueDeadTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("ingestion_tasks")
      .update({ status: "QUEUED", attempts: 0, run_after: new Date().toISOString(), last_error: null }, { count: "exact" })
      .in("status", ["DEAD", "RETRY"]);
    if (error) throw error;
    return { requeued: count ?? 0 };
  });

export type SchedulerJob = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_message: string | null;
  runs_24h: number;
};

export type SchedulerHealth = {
  jobs: SchedulerJob[];
  recent_ticks: {
    id: string;
    trigger: string;
    started_at: string;
    duration_ms: number | null;
    tasks_processed: number;
    tasks_ok: number;
    tasks_failed: number;
    nvidia_calls: number;
    nvidia_cached: number;
    error_message: string | null;
  }[];
};

/** Proof that autonomous processing is running: cron jobs + recorded ticks. */
export const getSchedulerHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchedulerHealth> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin !== true) throw new Error("Forbidden: admin role required");

    const { data: jobs } = await context.supabase.rpc("scheduler_status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticks } = await supabaseAdmin
      .from("pipeline_runs")
      .select("id, trigger, started_at, duration_ms, tasks_processed, tasks_ok, tasks_failed, nvidia_calls, nvidia_cached, error_message")
      .order("started_at", { ascending: false })
      .limit(10);

    return {
      jobs: (Array.isArray(jobs) ? jobs : []) as SchedulerJob[],
      recent_ticks: (ticks ?? []) as SchedulerHealth["recent_ticks"],
    };
  });
