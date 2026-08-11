# NVIDIA Nemotron as the Ingestion Intelligence Engine

Add NVIDIA Nemotron as the semantic layer of the existing ingestion pipeline. Nothing about discovery, fetching, the deterministic classifier or the strict single-posting vacancy gate changes — Nemotron runs *after* those gates and its output is validated before anything reaches canonical tables.

Two notes on your spec I'm carrying over deliberately:

1. **No new Edge Functions.** This app is TanStack Start; backend code runs in this project's own server runtime, so the NVIDIA client lives in a server-only module (`src/lib/nvidia.server.ts`) and the secret is read with `process.env["Nvidia"]` instead of `Deno.env.get`. Same guarantees: server-only, never logged, never returned, never in the browser bundle, never in a DB row.
2. **The model id is unverified.** `nvidia/nemotron-3-ultra-550b-a55b` will be used exactly as given. If NVIDIA rejects it, the connection test surfaces the raw HTTP status/message and I stop there and ask you rather than guessing another id — and never fall back to Lovable AI.

## Phase 1 — Client, config, logging, connection test

- `src/lib/nvidia.server.ts`: single `callNemotron({ system, user, operation, sourceId, rawRecordId, maxTokens, temperature })`. Reads the key inside the function; returns `{ content, httpStatus, latencyMs, model, provider, errorCode, errorMessage }`. Missing key → `NVIDIA_SECRET_NOT_CONFIGURED`, no request. Temperature defaults to 0.1. Retry on 429/5xx with exponential backoff, limit 3; concurrency capped at 2 by an in-module semaphore.
- `src/lib/llm-config.server.ts`: `AI_PROVIDER=NVIDIA`, `NVIDIA_MODEL`, `NVIDIA_SECRET_NAME=Nvidia`, `LLM_EXTRACTION_ENABLED`, `NVIDIA_MAX_CONCURRENCY=2`, `NVIDIA_RETRY_LIMIT=3`.
- Migration: new table `llm_processing_runs` with the exact fields you listed (provider, model, operation, source_id, raw_page_id, content_hash, timings, status, char counts, attempt, cached, error_code/message) plus GRANTs, RLS on, admin-only read policy. Every call — including cache hits and validation failures — writes a row. No secret is ever stored.
- Admin-only server fn `testNvidiaConnection` sends a tiny JSON-only prompt and returns secret-configured / reachable / model-available / status / latency / error. Its result is recorded in `llm_processing_runs`.
- `/admin/pipeline-health` gains an **NVIDIA Intelligence Engine** panel: connection status, model, requests today, success/fail/cached counts, retry + dead counts, average latency, last success, and a "Test NVIDIA" button. No secret values shown.

## Phase 2 — Candidate selection, cleaning, vacancy extraction

- `src/lib/llm-gating.server.ts` (deterministic, no LLM): maps a raw record to `VACANCY_CANDIDATE`, `PROGRAMME_CANDIDATE`, `PROJECT_CANDIDATE`, `RESEARCHER_CANDIDATE`, `EVENT_CANDIDATE`, `TOPIC_CLASSIFICATION_CANDIDATE` or `NOT_A_CANDIDATE`. Legal/cookie/privacy/login/search/homepage/marketing/careers-hub/listing/asset pages return `NOT_A_CANDIDATE` and never cost a request. Vacancy candidacy requires the existing `looksLikeSinglePosting` gate to pass first — Nemotron cannot overturn a rejection.
- `src/lib/content-clean.server.ts`: strips nav, cookie notices, footers, repeated menus, scripts/styles and boilerplate from stored `text_content`; section-aware prioritisation when over the char threshold (job pages: title, description, tasks, qualifications, contract, deadline, application, contact, salary). Records `original_chars`, `sent_chars`, `content_reduced`.
- Cache: before any call, look up `llm_processing_runs` by `(source_id, content_hash, operation, model)` with `status = SUCCESS`; reuse the stored validated result and log `cached = true`.
- `src/lib/extraction/vacancy.server.ts`: strict JSON-only system prompt, your exact response shape and `opportunity_type` enum, `null` for unsupported fields, evidence snippets quoted from supplied text only.
- `src/lib/extraction/validate.server.ts`: parse → schema check → business rules (enum values, confidence 0–1, real dates, non-empty title, `is_single_real_position === true`) → normalize → dedupe → upsert. Malformed or failing output never touches canonical tables; it is logged and the raw page is preserved.
- `normalizeSource` in `src/lib/ingest.server.ts` keeps its current deterministic path and gains an optional Nemotron enrichment step that only *adds* validated fields (deadline, department, supervisor, salary, contract, topics) and records `extracted_by`, `extraction_model`, `extraction_timestamp`, `extraction_confidence`. `record_sources` continues to point at the institution page — never at NVIDIA.
- Failures: log status/error/attempt, task → `RETRY`, then `DEAD` after 3; admin panel offers manual retry, inspect raw source, inspect model output, inspect validated result, reprocess.

## Phase 3 — Controlled vacancy test (gate before backlog)

Run 5 known-good postings and 5 known junk pages (careers hub, marketing page, employee story, product/API page, vacancy index) through the full path and report, per page: deterministic decision, Nemotron decision, final decision. Backlog stays paused. If precision drops versus the current 33-position baseline, I fix the prompt and re-test instead of resuming.

## Phase 4 — Other entity types, then resume the drain

After the vacancy test passes: project, programme, researcher, event extractors plus the GeoAcademic relevance classifier over your controlled topic list (genuine geospatial relevance required — an ML-mentioning software job is not GeoAI). Second controlled test on 10 programme / 10 project / 10 researcher pages. Publications stay structured-first (OpenAlex/Crossref/ORCID for facts; Nemotron only for relevance, topic mapping and grounded summaries). Only then resume the existing drain loop from current state.

## Preservation

No reset, no re-discovery, no refetching of the ~728 fetched pages, no reinsertion of deleted junk. Existing sources, raw pages, content hashes, queue state, canonical records and evidence links are all reused as-is.

## Final report

Before full backlog processing I'll report: connection results and latency; files/migrations added and changed; the 5+5 vacancy test table; validation stats (malformed JSON, schema failures, unsupported values, hallucinated fields, retries); cache stats (cached / needing processing / deterministically skipped); and explicit confirmation that sources, pages, the 33 clean positions and evidence links are intact.
