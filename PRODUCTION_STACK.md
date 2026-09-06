# GeoAcademic Production Stack

This document intentionally contains **no credential values**. Production credentials belong only in GitHub Actions secrets or the relevant hosting provider secret manager.

## Current architecture

- **Web:** TanStack Start / Vite, built as a Cloudflare Worker (`research-pulse-global`).
- **Primary database:** Supabase Postgres.
- **Open Engine ingestion:** scheduled GitHub Actions writing to the `geoacademic_engine` schema.
- **Public Open Engine reads:** external API when healthy, with a least-privilege Supabase RPC fallback.
- **Production health:** `.github/workflows/production-smoke.yml`.
- **Data quality:** `.github/workflows/geoacademic-data-qa.yml`.
- **Standalone external API QA:** manual-only `.github/workflows/geoacademic-api-qa.yml`.
- **Oracle API deployment:** manual-only `.github/workflows/geoacademic-open-engine-deploy.yml` and requires configured Oracle secrets.

## Required secret names

Store values outside Git. Never paste their values into documentation, scripts, issues, or commits.

```text
GEOACADEMIC_DATABASE_URL
GEOACADEMIC_S3_ENDPOINT
GEOACADEMIC_S3_ACCESS_KEY
GEOACADEMIC_S3_SECRET_KEY
GEOACADEMIC_S3_BUCKET
INGESTION_HOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
NVIDIA_API_KEY
```

Optional provider/deployment secrets may include Oracle and Cloudflare credentials where those workflows are enabled.

## Cloudflare production requirement

The repository default build target is Cloudflare-compatible. `wrangler.jsonc` intentionally contains the Worker name only; custom-domain routing is managed in Cloudflare rather than committed as a repo route override.

For Workers Builds, production must **deploy** the generated Worker to active traffic rather than merely upload a version. The production deploy command should be `npx wrangler deploy` (or an equivalent active-deployment configuration).

## Data safety

Public fallback RPCs execute with caller permissions and expose only curated public read models. Service-role credentials must remain server-only. Database QA rejects duplicate canonical identities, malformed JSONB payloads, missing deterministic event dates, missing/duplicate slugs, and off-scope public opportunities.

## Credential rotation

Any credential that has ever appeared in Git history must be treated as compromised and rotated at its provider. Redacting the current branch does not invalidate a historical secret.
