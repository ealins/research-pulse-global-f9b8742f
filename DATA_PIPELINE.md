# How Data Flows — Current Truth (2026-09-01)

Read this first. Most other `*.md` files at the repo root describe **historical**
states of the pipeline and should not be treated as current instructions
(`IMMEDIATE_ACTION.md`, `QUICK_FIX.md`, `READY_TO_INGEST.md`, `TECH_STACK_STATUS.md`,
`PRODUCTION_RUNBOOK.md`, `PRODUCTION_STACK.md`, `COMPLETE_TECH_STACK_SETUP.md`,
`ARCHITECTURE_UPGRADE.md`, and the `*_V5/V6/V7.md` files are a record of past
troubleshooting, not a how-to).

## 1. What the website reads, in priority order

The frontend (`src/lib/open-engine-client.ts`) tries these in order for every
feed/detail/search request:

| # | Source | Status 2026-09-01 |
|---|--------|-------------------|
| 1 | **Open-engine API** — Cloud Run `https://geoacademic-api-xjh4s3mvyq-ey.a.run.app` (override with `VITE_GEOACADEMIC_API_URL`) | **DOWN (503)** |
| 2 | **Supabase open-engine RPC fallback** — `geoacademic_open_engine_latest / _pulse / _entity / _search` in Supabase project `rqalvagtdcqurubrsdnc` (migration `20260901190400_open_engine_public_fallback.sql`) | **WORKING — has data** |
| 3 | Public snapshot JSON (`VITE_GEOACADEMIC_SNAPSHOT_URL`) | not configured |

Knowledge-base pages (institutions, projects, publications, researchers,
topics) additionally read the Supabase tables directly with the publishable
key.

**Database contents right now:** 15 institutions, 5 opportunities (none pass
the public-quality filters yet), 0 researchers / projects / publications /
events / courses. The open-engine RPC layer independently serves ~100 live
signals (events + positions), which is what the homepage, /jobs and /events
show.

## 2. Why the site showed no data until 2026-09-01

1. Source #1 (Cloud Run) was down → the frontend fell through to source #2.
2. Source #2 requires a working **publishable key**, but
   `src/integrations/supabase/public-config.ts` shipped a redacted placeholder
   (`sb_pub…PqzY`) — every Supabase request failed auth.
3. Result: empty states everywhere.

**Fix applied:** the real publishable key (public by design; it ships in the
browser bundle of the deployed site) was recovered from the deployed Fly
bundle and placed in `public-config.ts`. The fallback chain now works
end-to-end — verified by rendering the local site: homepage shows
Jobs 4, Events 36, Institutions 15 and a 100-item "Latest signals" feed.

## 3. How data gets in (ingestion)

Two generations exist in this repo:

- **Current generation — open-engine service** (`open-engine/` directory:
  `backend`, `worker`, `db`, deployable via Cloud Run or the Oracle OCI
  docker-compose files). Its worker crawls academic/industry sources, extracts
  deterministically (optionally with an NVIDIA LLM), stores entities/signals,
  which are synced into Supabase for the public RPC fallback used above.
- **Legacy generation — in-app ingestion** (still functional code):
  - `POST /api/public/hooks/ingest-batch` with `x-ingestion-secret` header
    (server-side, uses `SUPABASE_SERVICE_ROLE_KEY`, optional
    `NVIDIA_API_KEY` for LLM extraction);
  - GitHub Actions bursts (`.github/workflows/geoacademic-ingestion.yml` and
    friends) that call the same pipeline on a schedule.

## 4. Owner action items (cannot be fixed from the repo)

1. **Rotate `INGESTION_HOOK_SECRET`** (Fly secrets + GitHub Actions secrets).
   The old value was committed in plaintext historically; it is redacted at
   HEAD as of today but remains in git history — rotation is the only real fix.
2. **Restore the Cloud Run open-engine API** (or deploy `open-engine/` via the
   OCI docker-compose). Once it is up, the frontend automatically prefers it
   again; until then the Supabase fallback keeps the site fed.
3. **Grow the database** — researchers/projects/publications/events are empty
   and the 5 ingested opportunities don't pass the public-quality filters
   (`verification_status` + `confidence`). Running ingestion with an
   `NVIDIA_API_KEY` configured is what enriches and un-quarantines records.
4. **Apply the pending migration** `20260901210000_add_courses_confidence.sql`
   (adds the `confidence` column the app filters courses on) via the Supabase
   SQL editor or your migration CI.

## 5. Running locally

```bash
bun install
bun run dev      # http://localhost:8080 (or next free port)
bun run build    # production build to .output/
```

Public pages work with no `.env` (config falls back to
`public-config.ts`). Admin/ingestion endpoints additionally need a local
`.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INGESTION_HOOK_SECRET`
and optionally `NVIDIA_API_KEY` — never commit these.
