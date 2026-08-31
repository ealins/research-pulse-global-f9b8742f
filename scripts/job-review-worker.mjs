/**
 * Bounded GeoAcademic vacancy-review worker for GitHub Actions.
 *
 * The worker receives page snapshots through a secret-authenticated lease. It
 * never receives Supabase credentials and cannot write canonical rows itself.
 * Model output is validated again by the web application before persistence.
 */

const BASE_URL = (
  process.env.GEOACADEMIC_BASE_URL || "https://geoacademic.app"
).replace(/\/$/, "");
const HOOK_SECRET = process.env.INGESTION_HOOK_SECRET || "";
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || process.env.Nvidia || "";
const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL_NANO || "nvidia/nemotron-3-nano-30b-a3b";
const RUNTIME_MS = clamp(
  process.env.REVIEW_RUNTIME_MS,
  30_000,
  4 * 60_000,
  210_000,
);
const LEASE_LIMIT = clamp(process.env.REVIEW_LEASE_LIMIT, 1, 10, 4);
const CONCURRENCY = clamp(process.env.REVIEW_CONCURRENCY, 1, 2, 2);
const HOOK_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = `You extract job facts for GeoAcademic, which covers photogrammetry, remote sensing, geodesy, geoinformatics, GIS, GeoAI, Earth observation, LiDAR, SAR, point clouds and spatial data science.

Absolute rules:
1. Use only the supplied page. Never infer or invent facts.
2. Use null for unstated fields.
3. Every evidence item must be a verbatim continuous snippet from PAGE TEXT.
4. Return one JSON object only. No prose and no markdown.
5. Reject career hubs, vacancy lists, marketing pages, employee stories and product pages.
6. geospatial_relevance is true only when the role itself genuinely concerns the listed geospatial fields. Generic software/AI roles are false.

Return exactly:
{"is_single_real_position":boolean,"rejection_reason":string|null,"title":string|null,"opportunity_type":"phd"|"doctoral_researcher"|"research_assistant"|"postdoc"|"other"|null,"sector":"academic"|"industry"|null,"department":string|null,"supervisor_name":string|null,"city":string|null,"country":string|null,"funding_type":string|null,"salary_text":string|null,"contract_type":string|null,"start_date":string|null,"application_deadline":string|null,"application_url":string|null,"requirements":string|null,"summary":string|null,"geospatial_relevance":boolean,"topics":string[],"confidence":number,"evidence":string[]}

Dates are YYYY-MM-DD or null. confidence is 0..1.`;

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.floor(number)))
    : fallback;
}

function parseJsonObject(value) {
  const text = String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw new Error("Nemotron response has no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

function validateBasicExtraction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Extraction is not an object");
  }
  if (typeof value.is_single_real_position !== "boolean") {
    throw new Error("is_single_real_position must be boolean");
  }
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("confidence must be between 0 and 1");
  }
  if (value.is_single_real_position && typeof value.title !== "string") {
    throw new Error("accepted extraction has no title");
  }
  if (!Array.isArray(value.evidence) || !Array.isArray(value.topics)) {
    throw new Error("evidence and topics must be arrays");
  }
  return value;
}

async function callHook(action, payload = {}) {
  const response = await fetch(`${BASE_URL}/api/public/hooks/ingest-batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${HOOK_SECRET}`,
    },
    body: JSON.stringify({
      action,
      trigger: "github-actions-review",
      ...payload,
    }),
    signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
  });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { raw: text.slice(0, 500) };
  }
  if (
    !response.ok &&
    !(response.status === 409 && action === "complete-review")
  ) {
    throw new Error(
      `Hook ${action} HTTP ${response.status}: ${JSON.stringify(result).slice(0, 500)}`,
    );
  }
  return result;
}

async function extractWithNemotron(lease) {
  const pageText = String(lease.text_content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8_000);
  const user = `PAGE URL: ${lease.url}\nPAGE TITLE: ${lease.title}\nEMPLOYER: ${lease.institution_name || "not stated"}\n\nPAGE TEXT:\n"""\n${pageText}\n"""`;
  const startedAt = Date.now();
  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${NVIDIA_API_KEY}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        temperature: 0.05,
        max_tokens: 1_800,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `NVIDIA HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  const content = body?.choices?.[0]?.message?.content;
  const extraction = validateBasicExtraction(parseJsonObject(content));
  return {
    extraction,
    model: body?.model || NVIDIA_MODEL,
    latency_ms: Date.now() - startedAt,
    input_characters: SYSTEM_PROMPT.length + user.length,
    output_characters: String(content || "").length,
  };
}

async function reviewLease(lease) {
  const base = {
    task_id: lease.task_id,
    source_id: lease.source_id,
    raw_record_id: lease.raw_record_id,
    lease_started_at: lease.lease_started_at,
  };
  try {
    const modelResult =
      lease.requires_model && NVIDIA_API_KEY
        ? await extractWithNemotron(lease)
        : lease.requires_model
          ? { allow_server_model: true }
          : {};
    return await callHook("complete-review", {
      completion: { ...base, success: true, ...modelResult },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return await callHook("complete-review", {
      completion: { ...base, success: false, error: message.slice(0, 1_000) },
    });
  }
}

async function mapConcurrent(items, concurrency, callback) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await callback(items[index]);
      }
    }),
  );
  return results;
}

async function main() {
  if (!HOOK_SECRET) throw new Error("Missing INGESTION_HOOK_SECRET");
  const deadline = Date.now() + RUNTIME_MS;
  const totals = { leased: 0, complete: 0, retry: 0, dead: 0, stale: 0 };
  console.log(
    `GeoAcademic review burst -> ${BASE_URL} runtime=${Math.round(RUNTIME_MS / 1000)}s model=${NVIDIA_API_KEY ? NVIDIA_MODEL : "Lovable backend fallback"}`,
  );

  while (Date.now() < deadline - 10_000) {
    const response = await callHook("lease-review", {
      limit: LEASE_LIMIT,
      // The Lovable backend already has Nemotron configured and can act as a
      // fallback. Adding NVIDIA_API_KEY moves those calls out as well.
      model_available: true,
    });
    const leases = Array.isArray(response.leases) ? response.leases : [];
    if (leases.length === 0) break;
    totals.leased += leases.length;
    const results = await mapConcurrent(leases, CONCURRENCY, reviewLease);
    for (const result of results) {
      const key = String(result?.status || "stale").toLowerCase();
      if (key in totals) totals[key] += 1;
    }
    console.log(
      `${new Date().toISOString()} REVIEW leased=${leases.length} complete=${totals.complete} retry=${totals.retry} dead=${totals.dead}`,
    );
  }
  const status = await callHook("worker-status");
  console.log(
    `DONE leased=${totals.leased} complete=${totals.complete} retry=${totals.retry} dead=${totals.dead} remaining_review=${status.due_vacancy_review ?? "?"} fetch_paused=${status.fetch_paused ?? "?"}`,
  );
}

if (process.argv.includes("--self-test")) {
  validateBasicExtraction({
    is_single_real_position: false,
    confidence: 1,
    evidence: [],
    topics: [],
  });
  console.log("job-review-worker self-test passed");
} else {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
