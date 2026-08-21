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

## No-separate-host GitHub Actions mode

`.github/workflows/geoacademic-ingestion.yml` runs a bounded review-and-fetch burst every two hours. It uses GitHub's included Actions allowance instead of a continuously billed process host. Add these repository Actions secrets:

- `INGESTION_HOOK_SECRET`: exactly the same value configured in Lovable.
- `NVIDIA_API_KEY`: optional. When omitted, deterministic review still runs and the already-configured Lovable backend performs only ambiguous Nemotron calls. Adding it moves those model calls into the GitHub worker as well.

The workflow reviews vacancies first and only crawls when the vacancy-review backlog is below the server-enforced high-water mark. The fetch worker also runs bounded cross-section maintenance: it projects topic-qualified records into Research Pulse, refreshes topic momentum, and rebuilds evidence-backed collaboration edges. Generic NORMALIZE work for projects, researchers, events and programmes remains handled by the authenticated Lovable drain. GitHub never receives the Supabase service-role key. The workflow can also be started manually from the repository Actions tab to accelerate a one-time backlog drain.

This is scheduled burst processing, not an always-on daemon. If truly continuous ingestion is required without paid hosting, run the same scripts on an always-on self-hosted GitHub runner.

## Cross-section migration

Apply `supabase/migrations/20260821120000_cross_section_insights.sql` before relying on the combined insight refresh. It adds:

- one relevance-gated public count RPC for the home dashboard;
- scheduled momentum and collaboration refresh functions;
- queue and current-event indexes used by the worker and public pages.

The application includes a rolling-deploy fallback: before this migration is applied it will still refresh topic momentum, but collaboration edges and the single-query dashboard counts will remain on their compatibility paths.

## Trust lifecycle

- Strict schema.org records and official vacancy pages with explicit facts are verified immediately.
- Ambiguous model-extracted records remain automatically discovered on first fetch.
- A successful unchanged repeat fetch promotes source-backed records to verified.
- Opportunities not checked for 30 days become possibly outdated.
- Expired opportunities become closed, and known careers/privacy landing pages are archived by the repair migration.
