# GeoAcademic enrichment refactor

## Objective

Reduce custom crawler code and converge on one bounded Cloud Run ingestion entrypoint while preserving Supabase as the canonical store and Cloudflare as the public application layer.

## Adopted now

### `ats-scrapers`

Use ATS-native APIs when an institution career URL can be resolved to a supported platform. ATS results are filtered to GeoAcademic's geospatial scope before they are written to `public.opportunities`, and provenance is recorded in `public.record_sources`.

The generic HTML pipeline remains the fallback for university career pages that are not backed by a recognized ATS.

### `trafilatura`

Use Trafilatura to turn fetched HTML into clean main-content text before an LLM fallback is considered. BeautifulSoup remains a deterministic fallback if Trafilatura cannot extract a page.

This reduces navigation/boilerplate tokens and should make AI extraction both cheaper and more precise.

### Public enrichment bridge

The existing TypeScript canonical writers for ROR/OpenAIRE/Crossref and non-vacancy normalization are reused through the authenticated `/api/public/hooks/ingest-batch` route. Cloud Run invokes bounded `drain-providers` and `drain` batches during the same scheduled execution.

This is a transition mechanism, not a second enrichment implementation: Cloud Run owns the cadence while the existing canonical writers remain authoritative. If `INGESTION_HOOK_SECRET` is not configured, this bridge is a safe no-op and the rest of ingestion continues.

## Existing components retained

- Cloud Scheduler owns the production cadence.
- `geoacademic-ingestion` remains the production Cloud Run Job.
- Supabase remains the canonical database and raw evidence store.
- Existing deterministic extractors, verification, provenance and lifecycle logic remain in place.
- ROR/OpenAIRE/Crossref provider logic remains authoritative while the provider path is consolidated. Do not duplicate it with a second provider implementation during this phase.

## Next integrations

### `dlt`

Adopt only when the existing ROR/OpenAIRE/Crossref provider path is moved into the Python Cloud Run enrichment runtime. Use it for incremental provider state, pagination and load checkpoints. Do not run a dlt provider pipeline in parallel with the current TypeScript provider importer.

### Crawl4AI

Use only for JavaScript-heavy university pages that fail normal HTTP + Trafilatura extraction. It must remain a fallback rather than the default crawler.

### Docling

Use for PDF/DOCX calls, vacancy descriptions, funding calls and programme documents after HTML/provider ingestion is stable.

### Splink

Use only for records that cannot be resolved through stable identifiers. Resolution precedence remains:

1. ROR for institutions
2. ORCID for researchers
3. DOI for publications
4. provider/grant IDs for projects
5. canonical source URL / ATS job ID for opportunities
6. probabilistic matching only after the exact identifiers above fail

## Success metrics

Crawler volume is not a product metric. Track:

- source-backed institutions
- canonical researchers
- linked publications
- linked projects
- current opportunities
- programmes/courses
- provenance coverage
- exact-identifier resolution rate
- rejected/duplicate ratio

The goal is fewer raw URLs and more verified, linked academic entities.
