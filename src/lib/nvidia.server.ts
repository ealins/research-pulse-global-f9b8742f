// Server-only NVIDIA Nemotron client. The API key is read inside the call,
// never logged, never returned to callers, never written to the database.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AI_PROVIDER,
  LLM_DEFAULT_MAX_TOKENS,
  LLM_DEFAULT_TEMPERATURE,
  NVIDIA_BASE_URL,
  NVIDIA_MAX_CONCURRENCY,
  NVIDIA_MODEL,
  NVIDIA_RETRY_LIMIT,
  NVIDIA_SECRET_NAME,
  NVIDIA_TIMEOUT_MS,
  type LlmOperation,
} from "./llm-config.server";

export type NemotronCall = {
  system: string;
  user: string;
  operation: LlmOperation;
  sourceId?: string | null;
  rawRecordId?: string | null;
  contentHash?: string | null;
  contentReduced?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type NemotronResult = {
  ok: boolean;
  content: string | null;
  httpStatus: number | null;
  latencyMs: number;
  model: string;
  provider: string;
  attempt: number;
  errorCode: string | null;
  errorMessage: string | null;
  runId: string | null;
  finishReason?: string | null;
  outputTokens?: number | null;
};

/* ---------------- concurrency gate ---------------- */
let active = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < NVIDIA_MAX_CONCURRENCY) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiting.shift();
  if (next) next();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isNvidiaConfigured(): boolean {
  return Boolean(process.env["Nvidia"] ?? process.env[NVIDIA_SECRET_NAME]);
}

async function logRun(row: Record<string, unknown>): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("llm_processing_runs")
    .insert(row as never)
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Single entry point for every Nemotron request.
 * Every attempt — success, failure or missing secret — is recorded in
 * llm_processing_runs. Retries only on 429 / 5xx / network errors.
 */
export async function callNemotron(call: NemotronCall): Promise<NemotronResult> {
  const model = NVIDIA_MODEL;
  const base = {
    provider: AI_PROVIDER,
    model,
    operation: call.operation,
    source_id: call.sourceId ?? null,
    raw_page_id: call.rawRecordId ?? null,
    content_hash: call.contentHash ?? null,
    content_reduced: call.contentReduced ?? false,
    input_characters: call.system.length + call.user.length,
  };

  const apiKey = process.env["Nvidia"] ?? process.env[NVIDIA_SECRET_NAME];
  if (!apiKey) {
    const runId = await logRun({
      ...base,
      status: "FAILED",
      completed_at: new Date().toISOString(),
      latency_ms: 0,
      error_code: "NVIDIA_SECRET_NOT_CONFIGURED",
      error_message: `Secret "${NVIDIA_SECRET_NAME}" is not configured on the server.`,
    });
    return {
      ok: false,
      content: null,
      httpStatus: null,
      latencyMs: 0,
      model,
      provider: AI_PROVIDER,
      attempt: 0,
      errorCode: "NVIDIA_SECRET_NOT_CONFIGURED",
      errorMessage: `Secret "${NVIDIA_SECRET_NAME}" is not configured on the server.`,
      runId,
    };
  }

  let lastResult: NemotronResult | null = null;

  for (let attempt = 1; attempt <= NVIDIA_RETRY_LIMIT; attempt += 1) {
    const startedAt = new Date();
    const t0 = Date.now();
    await acquire();
    let httpStatus: number | null = null;
    let content: string | null = null;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let finishReason: string | null = null;
    let outputTokens: number | null = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NVIDIA_TIMEOUT_MS);
      const response = await fetch(NVIDIA_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: call.temperature ?? LLM_DEFAULT_TEMPERATURE,
          max_tokens: call.maxTokens ?? LLM_DEFAULT_MAX_TOKENS,
          // GeoAcademic Radar uses Nemotron for terse structured extraction,
          // not open-ended reasoning. Nemotron 3 enables thinking by default;
          // disabling it avoids spending most of the time/token budget before
          // the JSON payload is produced.
          chat_template_kwargs: { enable_thinking: false },
          messages: [
            { role: "system", content: call.system },
            { role: "user", content: call.user },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = response.status;
      const bodyText = await response.text();

      if (!response.ok) {
        errorCode = `HTTP_${response.status}`;
        errorMessage = bodyText.slice(0, 800);
      } else {
        try {
          const parsed = JSON.parse(bodyText) as {
            choices?: { message?: { content?: string }; finish_reason?: string }[];
            usage?: { completion_tokens?: number };
          };
          content = parsed.choices?.[0]?.message?.content ?? null;
          finishReason = parsed.choices?.[0]?.finish_reason ?? null;
          outputTokens = parsed.usage?.completion_tokens ?? null;
          if (!content) {
            errorCode = finishReason === "length" ? "OUTPUT_TRUNCATED" : "EMPTY_COMPLETION";
            errorMessage = `finish_reason=${finishReason ?? "unknown"} completion_tokens=${outputTokens ?? "?"} ${bodyText.slice(0, 300)}`;
          } else if (finishReason === "length" && !content.trimEnd().endsWith("}")) {
            // Truncated mid-JSON: treat as a failure rather than feeding a
            // half object into validation.
            errorCode = "OUTPUT_TRUNCATED";
            errorMessage = `finish_reason=length completion_tokens=${outputTokens ?? "?"}`;
            content = null;
          }
        } catch {
          errorCode = "UNPARSEABLE_RESPONSE";
          errorMessage = bodyText.slice(0, 400);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errorCode = message.includes("abort") ? "TIMEOUT" : "NETWORK_ERROR";
      errorMessage = message.slice(0, 500);
    } finally {
      release();
    }

    const latencyMs = Date.now() - t0;
    const ok = Boolean(content) && !errorCode;
    const runId = await logRun({
      ...base,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      status: ok ? "SUCCESS" : "FAILED",
      latency_ms: latencyMs,
      attempt,
      http_status: httpStatus,
      output_characters: content?.length ?? 0,
      error_code: errorCode,
      error_message: errorMessage,
    });

    lastResult = {
      ok,
      content,
      httpStatus,
      latencyMs,
      model,
      provider: AI_PROVIDER,
      attempt,
      errorCode,
      errorMessage,
      runId,
      finishReason,
      outputTokens,
    };

    if (ok) return lastResult;

    const retriable =
      errorCode === "NETWORK_ERROR" ||
      errorCode === "TIMEOUT" ||
      httpStatus === 429 ||
      (httpStatus !== null && httpStatus >= 500);
    if (!retriable || attempt === NVIDIA_RETRY_LIMIT) return lastResult;
    await sleep(1000 * 2 ** (attempt - 1));
  }

  return lastResult!;
}
