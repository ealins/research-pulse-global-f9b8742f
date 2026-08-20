# GeoAcademic Radar operations

## Required server-side configuration

- `INGESTION_HOOK_SECRET`: a high-entropy random secret shared only by the web deployment and ingestion worker. The ingestion endpoint no longer accepts a public Supabase key.
- `ADMIN_BOOTSTRAP_EMAILS`: comma-separated email addresses allowed to claim the first admin role.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only database key.
- `NVIDIA_API_KEY`: server-only extraction-provider key when model enrichment is enabled.

Never prefix server secrets with `VITE_`.

## Supabase Auth redirects

Add these exact URLs to the Supabase Auth redirect allowlist:

- `https://geoacademic.app/auth/callback`
- The equivalent `/auth/callback` URL on the active Lovable preview/production domain, if that domain is used for sign-in.

## Continuous ingestion

Lovable hosts the web application but does not keep `scripts/ingestion-worker.mjs` alive as a permanent process. Deploy the worker to a persistent process host or call the authenticated hook from a scheduler. Configure the same `INGESTION_HOOK_SECRET` on both sides.

Run locally with:

```bash
npm run worker:ingest
```

The worker drains the conditional database queue; overlapping invocations are protected by task claiming.

## Trust lifecycle

- Strict schema.org records and official vacancy pages with explicit facts are verified immediately.
- Ambiguous model-extracted records remain automatically discovered on first fetch.
- A successful unchanged repeat fetch promotes source-backed records to verified.
- Opportunities not checked for 30 days become possibly outdated.
- Expired opportunities become closed, and known careers/privacy landing pages are archived by the repair migration.
