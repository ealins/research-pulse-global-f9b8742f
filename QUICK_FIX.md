# Historical data-population troubleshooting

> This note is retained for context, but the production pipeline has moved on from the original failure described here. Current ingestion uses repository secrets, scheduled workflows, the GeoAcademic open-engine database, and the Cloud Run API.

## What originally went wrong

The first production setup had three bootstrap problems:

1. Required ingestion/database credentials were not consistently configured in GitHub Actions.
2. Source seeding and ingestion were separate jobs, so ingestion could run successfully while having nothing useful to process.
3. The source registry had not yet been populated.

Those bootstrap problems are no longer an accurate explanation for an empty UI. Current workflow QA should be used to distinguish database/ingestion failures from API-routing or frontend failures.

## Required secrets

Store credentials only in GitHub Actions secrets or the relevant deployment secret manager. Never commit real values to this repository.

```text
INGESTION_HOOK_SECRET=<rotated secret stored in GitHub Actions>
GEOACADEMIC_DATABASE_URL=<Supabase/Postgres connection string stored in GitHub Actions>
NVIDIA_API_KEY=<optional model-provider key stored in GitHub Actions>
```

## Current verification path

1. Confirm **GeoAcademic Cloud ingestion** completes successfully.
2. Confirm **GeoAcademic ingestion burst** completes successfully.
3. Run **GeoAcademic API QA** and inspect both database counts and API checks.
4. The open-engine API must expose `/health` and `/v1/*`. Do not point `GEOACADEMIC_API_URL` or `VITE_GEOACADEMIC_API_URL` at the frontend application origin.
5. The canonical public open-engine API currently used by the application code is:

```text
https://geoacademic-api-xjh4s3mvyq-ey.a.run.app
```

## Security note

Earlier revisions of troubleshooting files in this repository contained plaintext credentials. Any credential that was ever committed must be considered exposed and rotated. Removing a value from the current branch does not erase it from Git history.
