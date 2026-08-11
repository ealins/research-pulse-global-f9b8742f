import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NvidiaStatus = {
  provider: string;
  model: string;
  secret_configured: boolean;
  extraction_enabled: boolean;
  requests_today: number;
  success: number;
  failed: number;
  validation_failed: number;
  cached: number;
  retries: number;
  avg_latency_ms: number | null;
  last_success_at: string | null;
  last_error: { code: string | null; message: string | null; at: string } | null;
  recent: {
    id: string;
    operation: string;
    status: string;
    cached: boolean;
    attempt: number;
    latency_ms: number | null;
    http_status: number | null;
    error_code: string | null;
    created_at: string;
  }[];
};

export type NvidiaConnectionTest = {
  secret_configured: boolean;
  reachable: boolean;
  model_available: boolean;
  http_status: number | null;
  latency_ms: number;
  model: string;
  error_code: string | null;
  error_message: string | null;
  sample: string | null;
};

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const getNvidiaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NvidiaStatus> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { NVIDIA_MODEL, AI_PROVIDER, LLM_EXTRACTION_ENABLED } = await import("./llm-config.server");
    const { isNvidiaConfigured } = await import("./nvidia.server");

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("llm_processing_runs")
      .select("id, operation, status, cached, attempt, latency_ms, http_status, error_code, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    const all = rows ?? [];
    const success = all.filter((r) => r.status === "SUCCESS");
    const failed = all.filter((r) => r.status === "FAILED");
    const validationFailed = all.filter((r) => r.status === "VALIDATION_FAILED");
    const latencies = success.filter((r) => !r.cached && typeof r.latency_ms === "number").map((r) => r.latency_ms as number);
    const lastError = failed[0] ?? validationFailed[0] ?? null;

    return {
      provider: AI_PROVIDER,
      model: NVIDIA_MODEL,
      secret_configured: isNvidiaConfigured(),
      extraction_enabled: LLM_EXTRACTION_ENABLED,
      requests_today: all.length,
      success: success.length,
      failed: failed.length,
      validation_failed: validationFailed.length,
      cached: all.filter((r) => r.cached).length,
      retries: all.filter((r) => (r.attempt ?? 1) > 1).length,
      avg_latency_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      last_success_at: success[0]?.created_at ?? null,
      last_error: lastError
        ? { code: lastError.error_code, message: lastError.error_message, at: lastError.created_at }
        : null,
      recent: all.slice(0, 15) as NvidiaStatus["recent"],
    };
  });

export const testNvidiaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NvidiaConnectionTest> => {
    await assertAdmin(context as never);
    const { NVIDIA_MODEL } = await import("./llm-config.server");
    const { callNemotron, isNvidiaConfigured } = await import("./nvidia.server");

    const configured = isNvidiaConfigured();
    if (!configured) {
      return {
        secret_configured: false,
        reachable: false,
        model_available: false,
        http_status: null,
        latency_ms: 0,
        model: NVIDIA_MODEL,
        error_code: "NVIDIA_SECRET_NOT_CONFIGURED",
        error_message: "The NVIDIA API key is not configured on the server.",
        sample: null,
      };
    }

    const result = await callNemotron({
      system: 'Reply with exactly this JSON and nothing else: {"ok":true}',
      user: "Connection test.",
      operation: "CONNECTION_TEST",
      maxTokens: 24,
    });

    const modelRejected =
      result.httpStatus === 404 ||
      (result.errorMessage ?? "").toLowerCase().includes("model") ||
      (result.errorMessage ?? "").toLowerCase().includes("not found");

    return {
      secret_configured: true,
      reachable: result.httpStatus !== null,
      model_available: result.ok,
      http_status: result.httpStatus,
      latency_ms: result.latencyMs,
      model: NVIDIA_MODEL,
      error_code: result.errorCode,
      error_message: result.ok ? null : `${result.errorMessage ?? "unknown error"}${modelRejected ? " (model id may be unsupported)" : ""}`,
      sample: result.content?.slice(0, 200) ?? null,
    };
  });

export type VacancyTestRow = {
  url: string;
  title: string;
  deterministic: string;
  nemotron: string;
  final: string;
  confidence: number | null;
  geospatial: boolean | null;
  error: string | null;
};

/** Controlled precision test: runs stored pages through the full decision path. */
export const runVacancyExtractionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data, context }): Promise<{ rows: VacancyTestRow[] }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { selectCandidate } = await import("./llm-gating.server");
    const { enrichVacancy } = await import("./extraction/enrich.server");

    const limit = Math.min(12, Math.max(2, data.limit ?? 10));
    const half = Math.ceil(limit / 2);

    const { data: passing } = await supabaseAdmin
      .from("raw_records")
      .select("id, source_id, final_url, page_title, text_content, classification, content_hash, normalization_status")
      .eq("classification", "VACANCY")
      .eq("normalization_status", "NORMALIZED")
      .order("fetched_at", { ascending: false })
      .limit(half);

    const { data: rejected } = await supabaseAdmin
      .from("raw_records")
      .select("id, source_id, final_url, page_title, text_content, classification, content_hash, normalization_status")
      .eq("classification", "VACANCY")
      .eq("normalization_status", "SKIPPED")
      .order("fetched_at", { ascending: false })
      .limit(limit - half);

    const rows: VacancyTestRow[] = [];
    for (const raw of [...(passing ?? []), ...(rejected ?? [])]) {
      const url = raw.final_url ?? "";
      const title = raw.page_title ?? "";
      const text = raw.text_content ?? "";
      const decision = selectCandidate({ url, title, text, classification: raw.classification });

      if (decision.candidate !== "VACANCY_CANDIDATE") {
        rows.push({
          url,
          title,
          deterministic: `REJECTED — ${decision.reason}`,
          nemotron: "not called (cost gate)",
          final: "REJECTED",
          confidence: null,
          geospatial: null,
          error: null,
        });
        continue;
      }

      const outcome = await enrichVacancy({
        url,
        title,
        text,
        sourceId: raw.source_id,
        rawRecordId: raw.id,
        contentHash: raw.content_hash,
      });
      const ex = outcome.extraction;
      rows.push({
        url,
        title,
        deterministic: "ACCEPTED — single posting gate passed",
        nemotron: ex
          ? ex.is_single_real_position
            ? `ACCEPTED${outcome.cached ? " (cached)" : ""}`
            : `REJECTED — ${ex.rejection_reason ?? "not a single real position"}`
          : `unavailable — ${outcome.errorCode ?? "unknown"}`,
        final: ex ? (ex.is_single_real_position ? "ACCEPTED" : "REJECTED") : "ACCEPTED (deterministic only)",
        confidence: ex?.confidence ?? null,
        geospatial: ex?.geospatial_relevance ?? null,
        error: outcome.errorMessage,
      });
    }

    return { rows };
  });

export type EntityTestRow = {
  url: string;
  title: string;
  deterministic: string;
  nemotron: string;
  final: string;
  confidence: number | null;
  topics: string[];
  dropped: string[];
  error: string | null;
};

export type EntityKind = "PROJECT" | "PROGRAMME" | "RESEARCHER" | "EVENT";

/**
 * Controlled precision test per entity type. Runs stored pages through the
 * deterministic gate and the extractor WITHOUT writing canonical records.
 */
export const runEntityExtractionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entity: EntityKind; limit?: number }) => input)
  .handler(async ({ data, context }): Promise<{ rows: EntityTestRow[] }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gating = await import("./llm-gating.server");
    const entities = await import("./extraction/entities.server");

    const limit = Math.min(12, Math.max(2, data.limit ?? 10));
    const classifications = data.entity === "PROGRAMME" ? ["PROGRAMME", "COURSE"] : [data.entity];

    const { data: pages } = await supabaseAdmin
      .from("raw_records")
      .select("id, source_id, final_url, page_title, text_content, classification, content_hash")
      .in("classification", classifications)
      .not("text_content", "is", null)
      .order("fetched_at", { ascending: false })
      .limit(limit);

    const rows: EntityTestRow[] = [];
    for (const raw of pages ?? []) {
      const url = raw.final_url ?? "";
      const rawTitle = (raw.page_title ?? "").trim();
      const title = rawTitle.split(/\s*[|·–—]\s*/)[0]?.trim() || rawTitle;
      const text = raw.text_content ?? "";

      const gate =
        data.entity === "PROJECT"
          ? gating.projectGate(url, title, text)
          : data.entity === "PROGRAMME"
            ? gating.programmeGate(url, title, text)
            : data.entity === "RESEARCHER"
              ? gating.researcherGate(url, title, text)
              : gating.eventGate(url, title, text);

      if (!gate.ok) {
        rows.push({
          url,
          title,
          deterministic: `REJECTED — ${gate.reason}`,
          nemotron: "not called (cost gate)",
          final: "REJECTED",
          confidence: null,
          topics: [],
          dropped: [],
          error: null,
        });
        continue;
      }

      const input = {
        url,
        title,
        text,
        sourceId: raw.source_id,
        rawRecordId: raw.id,
        contentHash: raw.content_hash,
      };
      const out =
        data.entity === "PROJECT"
          ? await entities.extractProject(input)
          : data.entity === "PROGRAMME"
            ? await entities.extractProgramme(input)
            : data.entity === "RESEARCHER"
              ? await entities.extractResearcher(input)
              : await entities.extractEvent(input);

      const v = out.value as Record<string, unknown> | null;
      const accepted =
        v?.["is_single_real_project"] === true ||
        v?.["is_single_real_programme"] === true ||
        v?.["is_single_real_profile"] === true ||
        v?.["is_single_real_event"] === true;
      const label = (v?.["title"] as string) ?? (v?.["name"] as string) ?? (v?.["full_name"] as string) ?? "";

      rows.push({
        url,
        title,
        deterministic: "ACCEPTED — deterministic gate passed",
        nemotron: v
          ? accepted
            ? `ACCEPTED${out.cached ? " (cached)" : ""} — ${label}`
            : `REJECTED — ${(v["rejection_reason"] as string) ?? "not a single record"}`
          : `unavailable — ${out.errorCode ?? "unknown"}`,
        final: v ? (accepted ? "ACCEPTED" : "REJECTED") : "REJECTED (no usable extraction)",
        confidence: typeof v?.["confidence"] === "number" ? (v["confidence"] as number) : null,
        topics: Array.isArray(v?.["topics"]) ? (v["topics"] as string[]) : [],
        dropped: out.droppedFields ?? [],
        error: out.errorMessage,
      });
    }

    return { rows };
  });
