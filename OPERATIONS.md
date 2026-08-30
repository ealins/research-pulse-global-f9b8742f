# GeoAcademic Radar operations

## Required server-side configuration

- `INGESTION_HOOK_SECRET`: a high-entropy random secret shared only by the web deployment and ingestion worker. The ingestion endpoint no longer accepts a public Supabase key.
- `ADMIN_BOOTSTRAP_EMAILS`: comma-separated email addresses allowed to claim the first admin role.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only database key.
- `NVIDIA_API_KEY`: server-only extraction-provider key when model enrichment is enabled.

Never prefix server secrets with `VITE_`.

The web deployment and local tools must target the Supabase project linked in
`supabase/config.toml`. After changing the linked project, configure that
project's matching service-role key in the deployment and apply every migration
under `supabase/migrations/`. A project that exposes base tables but not
`ingestion_tasks`, `pipeline_runs`, `llm_processing_runs`, or the ingestion RPCs
is not migration-complete and cannot run the worker.

A quick production connectivity check is:

```bash
curl https://geoacademic.app/api/public/data-health
```

It must return HTTP 200 with `"ok":true` before starting an ingestion burst.
The check covers both public data tables and the queue/run tables and count RPC
needed by ingestion, so a base-only schema remains unhealthy.

Before any production migration, pause every worker that writes to this project
and confirm a usable restore point in **Supabase Dashboard → Database → Backups**.
Pro, Team, and Enterprise projects have managed backups; PITR is available only
when that add-on is enabled. For an additional off-site logical backup, use the
linked CLI after authentication (store `backups/` outside source control):

```bash
mkdir -p backups
bunx supabase@2.116.0 db dump --linked --role-only --file backups/roles.sql
bunx supabase@2.116.0 db dump --linked --file backups/schema.sql
bunx supabase@2.116.0 db dump --linked --data-only --use-copy --file backups/data.sql
```

Apply pending migrations from an authenticated operator environment:

```bash
bunx supabase@2.116.0 login
bunx supabase@2.116.0 link --project-ref rqalvagtdcqurubrsdnc
bunx supabase@2.116.0 migration list --linked
bunx supabase@2.116.0 db push --linked --dry-run
bunx supabase@2.116.0 db push --linked
```

Inspect the migration list and dry-run before the push. Do not use
`db reset --linked`, blindly add `--include-all`, or mark an existing migration
as applied merely to bypass a SQL error. Reconcile migration drift only after
verifying that the remote objects corresponding to each history entry already
exist. After the push, run the health check again before redeploying or
triggering the legacy ingestion workflow.

## Local production preview

`bun run build` emits the Cloudflare Nitro bundle under `.output/`. Preview that
bundle with Wrangler (the script pins a supported local compatibility date):

```bash
bun run preview
```

Do not replace this with `vite preview`: TanStack's generic preview middleware
looks for `dist/server/server.js`, which this Nitro target does not emit.

## Supabase Auth redirects

Add these exact URLs to the Supabase Auth redirect allowlist:

- `https://geoacademic.app/auth/callback`
- The equivalent `/auth/callback` URL on the active Lovable preview/production domain, if that domain is used for sign-in.

## Continuous ingestion

Lovable hosts the web application but does not keep `scripts/ingestion-worker.mjs` alive as a permanent process. Deploy the worker to a persistent process host or call the authenticated hook from a scheduler. Configure the same `INGESTION_HOOK_SECRET` on both sides.

Run locally with:

```bash
bun run worker:ingest
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
- relevance-gated global search across jobs, programmes and every knowledge-base entity;
- scheduled momentum and evidence-only collaboration refresh functions;
- removal of inactive/stale topic snapshots from the trend surface;
- queue and current-event indexes used by the worker and public pages.

The application includes a rolling-deploy fallback: before this migration is applied it will still refresh topic momentum, but collaboration edges and the single-query dashboard counts will remain on their compatibility paths.

## Trust lifecycle

- Strict schema.org records and official vacancy pages with explicit facts are verified immediately.
- Ambiguous model-extracted records remain automatically discovered on first fetch.
- A successful unchanged repeat fetch promotes source-backed records to verified.
- Opportunities not checked for 30 days become possibly outdated.
- Expired opportunities become closed, and known careers/privacy landing pages are archived by the repair migration.
