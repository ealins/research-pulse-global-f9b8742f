# GeoAcademic Radar operations

## Required server-side configuration

- `INGESTION_HOOK_SECRET`: a high-entropy random secret shared only by the web deployment and legacy ingestion worker.
- `ADMIN_BOOTSTRAP_EMAILS`: comma-separated email addresses allowed to claim the first admin role.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only database key.
- `NVIDIA_API_KEY`: server-only extraction-provider key when model enrichment is enabled.

Never prefix server secrets with `VITE_`.

The web deployment and local tools must target the Supabase project linked in `supabase/config.toml`. After changing the linked project, configure the matching service-role key and apply every migration under `supabase/migrations/`.

A quick production connectivity check is:

```bash
curl https://geoacademic.app/api/public/data-health
```

It must return HTTP 200 with `"ok":true` before starting ingestion.

## Production architecture

The intended production split is:

- **Cloudflare Workers**: TanStack Start web application and SSR at `https://geoacademic.app`.
- **Supabase PostgreSQL/Auth**: canonical records, provenance/evidence, user data, queues, read models and RPCs.
- **Google Cloud Run Job**: bounded Python ingestion and normalization.
- **Google Cloud Scheduler**: executes the Cloud Run ingestion job every two hours.
- **GitHub Actions**: CI, data QA, deployment checks and a temporary/manual ingestion fallback only.

Oracle is no longer part of the required production deployment path.

## Cloud Run ingestion job

The production ingestion container is defined by:

- `open-engine/Dockerfile.ingestion`
- `open-engine/cloudrun/run-ingestion-job.sh`
- `open-engine/cloudrun/batch_runner.py`
- `open-engine/cloudrun/qa_database.py`

Each Cloud Run execution performs the bounded ingestion cycle and then runs database QA. A failed QA exits the job non-zero so data-quality failures are visible in Cloud Run execution history.

The default bounded cycle remains:

```text
max fetch:   40
max process: 40
schedule:    43 */2 * * * UTC
```

### One-time Google Cloud bootstrap

Run this from Google Cloud Shell or another workstation where `gcloud` is authenticated to the intended project:

```bash
export DATABASE_URL='postgresql://...'
export S3_ENDPOINT='https://...'
export S3_ACCESS_KEY='...'
export S3_SECRET_KEY='...'
export S3_BUCKET='...'

# Optional AI enrichment
export OPENROUTER_API_KEY='...'
export OPENROUTER_MODEL='...'
export NVIDIA_API_KEY='...'
export NVIDIA_MODEL='...'

bash open-engine/cloudrun/bootstrap-ingestion-job.sh
```

The bootstrap script:

1. enables Cloud Run, Cloud Scheduler, Cloud Build, Artifact Registry, Secret Manager and IAM APIs;
2. creates the runtime and scheduler service accounts if needed;
3. stores ingestion secrets in Google Secret Manager;
4. builds `open-engine/Dockerfile.ingestion` using Cloud Build;
5. deploys the `geoacademic-ingestion` Cloud Run Job;
6. grants the scheduler service account permission to invoke the job;
7. creates/updates the `geoacademic-ingestion-2h` Cloud Scheduler trigger using `43 */2 * * *` UTC;
8. executes one job immediately and waits for completion.

Default region: `europe-west3`.

Override names or cadence with environment variables such as `GCP_REGION`, `GCP_INGESTION_JOB`, `GCP_INGESTION_SCHEDULER`, `GCP_INGESTION_CRON`, `MAX_FETCH`, and `MAX_PROCESS`.

## Transitional GitHub ingestion fallback

`.github/workflows/geoacademic-cloudrun-ingestion.yml` still carries the same two-hour cron **temporarily** so ingestion does not stop before the Cloud Run scheduler is actually provisioned and verified.

After the bootstrap succeeds and at least one Cloud Scheduler-triggered execution is confirmed in Google Cloud, remove the `schedule:` block from that workflow. The workflow should then remain only as a manual emergency fallback.

`.github/workflows/geoacademic-ingestion.yml` is already manual-only; its old Fly-based scheduled ingestion path is no longer part of normal production operation.

## Database migrations and backups

Before any production migration, pause writers and confirm a usable restore point in **Supabase Dashboard → Database → Backups**.

For an additional logical backup:

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

Do not use `db reset --linked` in production.

## Local production preview

`bun run build` emits the Cloudflare Nitro bundle under `.output/`.

```bash
bun run preview
```

Do not replace this with `vite preview`; the TanStack/Nitro target is different.

## Supabase Auth redirects

Allow:

- `https://geoacademic.app/auth/callback`
- any active preview-domain equivalent that is intentionally used for authentication.

## Trust lifecycle

- Strict schema.org records and official vacancy pages with explicit facts can be verified immediately.
- Ambiguous model-extracted records remain automatically discovered on first fetch.
- A successful unchanged repeat fetch may promote source-backed records to verified.
- Opportunities not checked for 30 days become possibly outdated.
- Expired opportunities become closed.
- Known non-opportunity landing pages should be archived rather than repeatedly surfaced.
