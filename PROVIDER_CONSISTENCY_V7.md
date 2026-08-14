# GeoAcademic Radar v7 — Provider replacement + data consistency

## What this release changes

This release removes OpenAlex from the active provider path while keeping legacy database columns/files for backward compatibility.

Provider flow:

1. **ROR** is the institution identity gate. Only `chosen: true` affiliation matches are accepted automatically.
2. A verified ROR identity promotes an institution from demo/seed to source-backed.
3. **OpenAIRE Graph v3** imports domain-relevant funded projects and publications for that ROR institution.
4. **Crossref** is the publication fallback when an OpenAIRE query returns no matching publications. Crossref queries use the exact ROR affiliation filter; there is no fuzzy institution-name fallback.
5. University websites remain the primary source for current people, jobs, events, programmes and pages that providers do not cover.

No additional AI credential is required. The existing NVIDIA model router is unchanged.

## Queue reliability

- Added `IMPORT_PROJECTS` to the provider queue.
- Provider imports are not queued until an institution has a verified ROR identity and is real (`is_demo = false`).
- Successful ROR promotion automatically queues publication + project imports.
- Provider task de-duplication now works by institution as well as by source.
- ROR/OpenAIRE/Crossref 429/503 capacity responses are deferred without consuming a retry attempt.
- Provider draining uses concurrency 2 and a default batch of 12; NVIDIA is not involved.
- Non-Error objects are serialized instead of becoming `[object Object]` in future task errors.
- The normal queue operating-mode counter only counts DISCOVER/FETCH/NORMALIZE, so provider retries no longer make the crawler look busy when it is idle.

## Public data consistency

Public truth is now strict real-only data:

- public list/detail relationships are filtered to `is_demo = false`;
- programme details no longer expose demo programmes, projects, calls or researchers;
- atlas, JSON-LD and sitemap paths are real-only;
- pulse country lookup will not resolve through a demo institution;
- `global_search()` excludes demo institutions, researchers, opportunities, projects, publications and events;
- `refresh_topic_momentum()` excludes demo publications, projects, opportunities and institutions.

Demo rows are **not deleted**. They remain available internally/history, but public production surfaces must not silently fall back to them.

## Pipeline health consistency

- The Canonical stage is now the sum of all real canonical entity tables rather than the positions count.
- The health page exposes the per-entity real counts.
- Active retries/failed sources set the pipeline to `DEGRADED`.
- Terminal DEAD tasks and blocked sources remain visible diagnostics but no longer pretend to be live queue work by themselves.
- The migration panel counts verified ROR identities instead of any non-empty legacy institution identifier.

## After deployment

Run **Enqueue backfill** once from the admin Real data migration panel. Existing RETRY provider tasks will execute the new ROR/OpenAIRE/Crossref code automatically. Old DEAD OpenAlex tasks remain as historical diagnostics; the backfill planner creates fresh provider work because DEAD tasks are not treated as open work.

Expected provider sequence after backfill:

`PROMOTE_INSTITUTION (ROR) -> IMPORT_PUBLICATIONS (OpenAIRE/Crossref) + IMPORT_PROJECTS (OpenAIRE)`
