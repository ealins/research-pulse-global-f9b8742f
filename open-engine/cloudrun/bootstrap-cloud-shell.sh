#!/usr/bin/env bash
set -euo pipefail

REGION="${GCP_REGION:-europe-west3}"
SERVICE="${GCP_SERVICE:-geoacademic-api}"
RUNTIME_SA_NAME="${GCP_RUNTIME_SA:-geoacademic-run}"
DB_SCHEMA="${DB_SCHEMA:-geoacademic_engine}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud is required. Run this in Google Cloud Shell."
command -v python3 >/dev/null || die "python3 is required."
command -v curl >/dev/null || die "curl is required."
command -v openssl >/dev/null || die "openssl is required."

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "(unset)" ] || die "Select or create a Google Cloud project first."

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

cat <<EOF
GeoAcademic Google Cloud Run bootstrap
Project: $PROJECT_ID
Region:  $REGION

Use the Supabase SESSION POOLER connection string from Supabase -> Connect.
It normally uses port 5432 and works over IPv4 while supporting prepared statements.
The open engine will be installed in the isolated PostgreSQL schema: $DB_SCHEMA
EOF

if [ -z "${DATABASE_URL:-}" ]; then
  read -r -s -p "Paste Supabase Session Pooler DATABASE_URL: " DATABASE_URL
  echo
fi
[ -n "$DATABASE_URL" ] || die "DATABASE_URL is required."

if [ -z "${INTERNAL_API_TOKEN:-}" ]; then
  INTERNAL_API_TOKEN="$(openssl rand -hex 32)"
fi

log "Enabling Google Cloud APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

log "Creating runtime service account if needed"
if ! gcloud iam service-accounts describe "$RUNTIME_SA" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --display-name="GeoAcademic Cloud Run runtime" \
    --project "$PROJECT_ID" >/dev/null
fi

upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" \
      --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" \
      --replication-policy=automatic --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" >/dev/null
}

log "Storing runtime secrets in Secret Manager"
upsert_secret geoacademic-database-url "$DATABASE_URL"
upsert_secret geoacademic-internal-token "$INTERNAL_API_TOKEN"

log "Applying isolated open-engine schema to Supabase"
VENV="/tmp/geoacademic-cloudrun-venv"
rm -rf "$VENV"
python3 -m venv "$VENV"
"$VENV/bin/pip" -q install "asyncpg==0.30.0"
DATABASE_URL="$DATABASE_URL" DB_SCHEMA="$DB_SCHEMA" \
  "$VENV/bin/python" "$REPO_ROOT/open-engine/cloudrun/migrate.py"

log "Deploying FastAPI service to Cloud Run"
gcloud run deploy "$SERVICE" \
  --source "$REPO_ROOT/open-engine/backend" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --service-account "$RUNTIME_SA" \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=geoacademic-database-url:latest,INTERNAL_API_TOKEN=geoacademic-internal-token:latest" \
  --set-env-vars="DB_SCHEMA=$DB_SCHEMA,DB_POOL_MIN=1,DB_POOL_MAX=4,PUBLIC_CORS_ORIGINS=https://geoacademic.app" \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=40 \
  --timeout=60s \
  --min=0 \
  --max=2 \
  --quiet

SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
[ -n "$SERVICE_URL" ] || die "Cloud Run did not return a service URL."

log "Verifying Cloud Run API"
HEALTH="$(curl -fsS --retry 5 --retry-delay 2 "$SERVICE_URL/health")" || die "Cloud Run deployed but /health is not reachable."
printf '%s\n' "$HEALTH"

cat <<EOF

============================================================
GeoAcademic Cloud Run deployment completed.
============================================================

Cloud Run API:
  $SERVICE_URL

Lovable environment variable after you choose to switch traffic:
  VITE_GEOACADEMIC_API_URL=$SERVICE_URL

Do NOT switch Lovable yet if you still want to seed/test the open engine first.

Next, configure these GitHub repository secrets for scheduled ingestion:
  GEOACADEMIC_DATABASE_URL       (same Supabase Session Pooler URL)
  GEOACADEMIC_S3_ENDPOINT       (Supabase Storage S3 endpoint)
  GEOACADEMIC_S3_ACCESS_KEY     (server-side S3 access key)
  GEOACADEMIC_S3_SECRET_KEY     (server-side S3 secret)
  GEOACADEMIC_S3_BUCKET         (private raw snapshot bucket)

Optional AI worker secrets:
  OPENROUTER_API_KEY
  OPENROUTER_MODEL
  NVIDIA_API_KEY
  NVIDIA_MODEL

The existing Supabase public schema was not replaced. Open-engine tables live in:
  $DB_SCHEMA
EOF
