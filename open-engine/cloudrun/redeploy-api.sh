#!/usr/bin/env bash
set -euo pipefail

REGION="${GCP_REGION:-europe-west3}"
SERVICE="${GCP_SERVICE:-geoacademic-api}"
RUNTIME_SA_NAME="${GCP_RUNTIME_SA:-geoacademic-run}"
DB_SCHEMA="${DB_SCHEMA:-geoacademic_engine}"
MAX_INSTANCES="${GCP_MAX_INSTANCES:-5}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud is required. Run this in Google Cloud Shell."
command -v curl >/dev/null || die "curl is required."
[[ "$MAX_INSTANCES" =~ ^[1-9][0-9]*$ ]] || die "GCP_MAX_INSTANCES must be a positive integer."

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "(unset)" ] || die "Select the GeoAcademic Google Cloud project first."
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

log "GeoAcademic Cloud Run code redeploy"
echo "Project:       $PROJECT_ID"
echo "Region:        $REGION"
echo "Service:       $SERVICE"
echo "Max instances: $MAX_INSTANCES"

for secret in geoacademic-database-url geoacademic-internal-token; do
  gcloud secrets describe "$secret" --project "$PROJECT_ID" >/dev/null 2>&1 \
    || die "Required Secret Manager secret '$secret' is missing in project $PROJECT_ID. Run the full bootstrap only if the project has not been provisioned."
done

gcloud iam service-accounts describe "$RUNTIME_SA" --project "$PROJECT_ID" >/dev/null 2>&1 \
  || die "Runtime service account $RUNTIME_SA is missing."

log "Deploying current backend code without rotating secrets"
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
  --max="$MAX_INSTANCES" \
  --quiet

SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
[ -n "$SERVICE_URL" ] || die "Cloud Run did not return a service URL."

log "Verifying deployed API"
HEALTH="$(curl -fsS --retry 5 --retry-delay 2 "$SERVICE_URL/health")" \
  || die "Cloud Run deployed but /health is not reachable."
printf '%s\n' "$HEALTH"

cat <<EOF

GeoAcademic Cloud Run API redeployed successfully.
API: $SERVICE_URL
Max instances: $MAX_INSTANCES

No database password was requested and no Secret Manager values were rotated.
EOF
