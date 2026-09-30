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
const OMNIROUTE_URL = (process.env.OMNIROUTE_URL || "https://omniroute.geoacademic.app/v1").replace(/\/$/, "");
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || "";
const OMNIROUTE_MODEL = process.env.OMNIROUTE_MODEL || "auto";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.Google_API_Key || "";
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || "gemini-2.5-flash";
const GOOGLE_URL = process.env.GOOGLE_URL || "https://generativelanguage.googleapis.com/v1beta/models";
const RUNTIME_MS = clamp(
  process.env.REVIEW_RUNTIME_MS,
  30_000,
  4 * 60_000,
  210_000,
);
const LEASE_LIMIT = clamp(process.env.REVIEW_LEASE_LIMIT, 1, 10, 4);
const CONCURRENCY = clamp(process.env.REVIEW_CONCURRENCY, 1, 8, 8);
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
    throw new Error("AI response has no JSON object");
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
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(
      `Hook ${action} HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return body;
}

async function extractWithAI(lease) {
  const pageText = String(lease.text_content || "").slice(0, 8_000);
  if (pageText.length < 120) throw new Error("Page text too short for review");
  const userContent = `SOURCE URL: ${lease.url || ""}
PAGE TITLE: ${lease.title || ""}
PAGE TEXT:
${pageText}`;
  const providers = [
    { name: "omniroute", url: `${OMNIROUTE_URL}/chat/completions`, model: OMNIROUTE_MODEL, apiKey: OMNIROUTE_API_KEY },
    { name: "google", url: `${GOOGLE_URL}/${GOOGLE_MODEL}:generateContent`, model: GOOGLE_MODEL, apiKey: GOOGLE_API_KEY },
  ];
  const errors = [];
  for (const provider of providers) {
    if (provider.name === "google" && !provider.apiKey) continue;
    try {
      let content = "";
      if (provider.name === "google") {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1800, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(55_000),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Google HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
        content = (body?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || "").join("");
      } else {
        const headers = { "content-type": "application/json", accept: "application/json" };
        if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
        const response = await fetch(provider.url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: provider.model,
            temperature: 0.1,
            max_tokens: 1800,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          }),
          signal: AbortSignal.timeout(55_000),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`OmniRoute HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
        content = body?.choices?.[0]?.message?.content || "";
      }
      if (!content) throw new Error(`${provider.name} returned no content`);
      return { extraction: validateBasicExtraction(parseJsonObject(content)), model: provider.model, provider: provider.name };
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.join("; ").slice(0, 900) || "No AI provider configured");
}

async function processLease(lease) {
  try {
    const modelResult = await extractWithAI(lease);
    return await callHook("complete-review", {
      completion: {
        task_id: lease.task_id,
        source_id: lease.source_id,
        raw_record_id: lease.raw_record_id,
        lease_started_at: lease.lease_started_at,
        success: true,
        model: modelResult.model,
        provider: modelResult.provider,
        extraction: modelResult.extraction,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      return await callHook("complete-review", {
        completion: {
          task_id: lease.task_id,
          source_id: lease.source_id,
          raw_record_id: lease.raw_record_id,
          lease_started_at: lease.lease_started_at,
          success: false,
          model: OMNIROUTE_MODEL,
          error: message.slice(0, 900),
        },
      });
    } catch (completionError) {
      const completionMessage =
        completionError instanceof Error ? completionError.message : String(completionError);
      throw new Error(`${message}; completion failed: ${completionMessage}`);
    }
  }
}

async function runWorker() {
  if (!HOOK_SECRET) throw new Error("Missing INGESTION_HOOK_SECRET");

  const deadline = Date.now() + RUNTIME_MS;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const leased = await callHook("lease-review", {
      limit: LEASE_LIMIT,
      model_available: true,
    });
    const leases = Array.isArray(leased?.leases) ? leased.leases : [];
    if (!leases.length) break;

    for (let index = 0; index < leases.length; index += CONCURRENCY) {
      const batch = leases.slice(index, index + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(processLease));
      for (const result of results) {
        processed += 1;
        if (result.status === "fulfilled") succeeded += 1;
        else {
          failed += 1;
          console.error(result.reason);
        }
      }
      if (Date.now() >= deadline) break;
    }
  }

  console.log(
    `REVIEW_WORKER processed=${processed} succeeded=${succeeded} failed=${failed} provider=omniroute model=${OMNIROUTE_MODEL}`,
  );
}

function selfTest() {
  const accepted = validateBasicExtraction({
    is_single_real_position: true,
    rejection_reason: null,
    title: "PhD position in InSAR",
    confidence: 0.92,
    evidence: ["PhD position in InSAR"],
    topics: ["InSAR"],
  });
  if (!accepted.is_single_real_position) throw new Error("self-test failed");
  console.log(`REVIEW_WORKER_SELF_TEST_OK provider=omniroute model=${OMNIROUTE_MODEL}`);
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  runWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
