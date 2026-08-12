# GeoAcademic ingestion architecture upgrade

This upgrade makes the existing stack faster without replacing TanStack, Supabase/Postgres, or NVIDIA.

## Runtime paths

1. **Structured first** — HTML is inspected for schema.org JSON-LD before scripts are stripped. A compact snapshot is stored in `raw_records.payload.structured`.
2. **Deterministic fast path** — strict single-entity JSON-LD for JobPosting, Event, Person, Course/EducationalOccupationalProgram, and Project can be normalized without an LLM.
3. **Vacancy fast path** — a page that already passes the single-posting gate and contains an explicit deadline/rolling status is canonicalized deterministically; Nemotron is only used when the posting is ambiguous.
4. **LLM fallback** — ambiguous non-vacancy pages still use the existing deterministic gates, Nemotron extraction, schema/business validation, controlled topics, and provenance.
5. **Structured providers** — OpenAlex/Crossref/ROR remain separate and should stay preferred for bibliographic/institution metadata.

No database migration is required because the structured snapshot uses the existing JSONB `raw_records.payload` column.

## Continuous worker

The existing queue table remains the durable source of work. `scripts/ingestion-worker.mjs` continuously calls the deployed drain endpoint so a large backlog is not forced to wait for a 10-minute cron tick.

Local run (Node 20+):

```powershell
npm run worker:ingest
```

Stop with `Ctrl+C`.

The worker reads only environment variables; it contains no keys. For permanent operation, run the same process on a persistent worker host. Do not try to turn a Vercel request into an infinite process.

The normal cron can remain enabled as a safety net. Queue rows are conditionally claimed, so overlapping consumers do not intentionally process the same task.

## Expected effect

- New structured pages can normalize in milliseconds with zero NVIDIA calls.
- High-confidence vacancy pages avoid unnecessary semantic enrichment.
- Nemotron is reserved for ambiguous pages and stays at server-side concurrency 2.
- A continuous worker can immediately request another batch after useful work instead of waiting ten minutes.
