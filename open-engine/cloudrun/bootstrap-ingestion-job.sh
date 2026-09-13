#!/usr/bin/env bash
set -euo pipefail

REGION="${GCP_REGION:-europe-west3}"
JOB="${GCP_INGESTION_JOB:-geoacademic-ingestion}"
SCHEDULER_JOB="${GCP_INGESTION_SCHEDULER:-geoacademic-ingestion-2h}"
RUNTIME_SA_NAME="${GCP_RUNTIME_SA:-geoacademic-run}"
SCHEDULER_SA_NAME="${GCP_SCHEDULER_SA:-geoacademic-scheduler}"
ARTIFACT_REPO="${GCP_ARTIFACT_REPO:-geoacademic}"
DB_SCHEMA="${DB_SCHEMA:-geoacademic_engine}"
SCHEDULE="${GCP_INGESTION_CRON:-43 */2 * * *}"
MAX_FETCH="${MAX_FETCH:-40}"
MAX_PROCESS="${MAX_PROCESS:-40}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud is required. Run this in Google Cloud Shell or an authenticated workstation."

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
[ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "(unset)" ] || die "Select a Google Cloud project first."

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/geoacademic-ingestion:latest"

required_env=(DATABASE_URL S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET)
for key in "${required_env[@]}"; do
  [ -n "${!key:-}" ] || die "$key is required for the one-time bootstrap."
done

log "Enabling required Google Cloud APIs"
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

log "Creating Artifact Registry repository if needed"
if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location "$REGION" \
    --description="GeoAcademic runtime images" \
    --project "$PROJECT_ID" >/dev/null
fi

ensure_sa() {
  local name="$1" display="$2"
  local email="${name}@${PROJECT_ID}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$email" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$name" --display-name="$display" --project "$PROJECT_ID" >/dev/null
  fi
}

ensure_sa "$RUNTIME_SA_NAME" "GeoAcademic Cloud Run runtime"
ensure_sa "$SCHEDULER_SA_NAME" "GeoAcademic Cloud Scheduler invoker"

upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" >/dev/null
}

log "Storing ingestion secrets in Secret Manager"
upsert_secret geoacademic-database-url "$DATABASE_URL"
upsert_secret geoacademic-s3-endpoint "$S3_ENDPOINT"
upsert_secret geoacademic-s3-access-key "$S3_ACCESS_KEY"
upsert_secret geoacademic-s3-secret-key "$S3_SECRET_KEY"
upsert_secret geoacademic-s3-bucket "$S3_BUCKET"

if [ -n "${OPENROUTER_API_KEY:-}" ]; then upsert_secret geoacademic-openrouter-api-key "$OPENROUTER_API_KEY"; fi
if [ -n "${NVIDIA_API_KEY:-}" ]; then upsert_secret geoacademic-nvidia-api-key "$NVIDIA_API_KEY"; fi

log "Building ingestion image with Cloud Build"
gcloud builds submit "$REPO_ROOT/open-engine" \
  --config "$REPO_ROOT/open-engine/cloudrun/cloudbuild-ingestion.yaml" \
  --substitutions "_IMAGE=$IMAGE" \
  --project "$PROJECT_ID" \
  --quiet

SECRET_FLAGS="DATABASE_URL=geoacademic-database-url:latest,S3_ENDPOINT=geoacademic-s3-endpoint:latest,S3_ACCESS_KEY=geoacademic-s3-access-key:latest,S3_SECRET_KEY=geoacademic-s3-secret-key:latest,S3_BUCKET=geoacademic-s3-bucket:latest"
if gcloud secrets describe geoacademic-openrouter-api-key --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_FLAGS+=",OPENROUTER_API_KEY=geoacademic-openrouter-api-key:latest"
fi
if gcloud secrets describe geoacademic-nvidia-api-key --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_FLAGS+=",NVIDIA_API_KEY=geoacademic-nvidia-api-key:latest"
fi

log "Deploying Cloud Run Job"
gcloud run jobs deploy "$JOB" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --service-account "$RUNTIME_SA" \
  --set-secrets "$SECRET_FLAGS" \
  --set-env-vars "DB_SCHEMA=$DB_SCHEMA,WORKER_CONCURRENCY=4,FETCH_TIMEOUT_SECONDS=25,AI_FALLBACK_ENABLED=true,OPENROUTER_MODEL=${OPENROUTER_MODEL:-},NVIDIA_MODEL=${NVIDIA_MODEL:-}" \
  --args="all,--max-fetch,$MAX_FETCH,--max-process,$MAX_PROCESS" \
  --cpu=1 \
  --memory=1Gi \
  --task-timeout=30m \
  --max-retries=2 \
  --tasks=1 \
  --quiet

gcloud run jobs add-iam-policy-binding "$JOB" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker" >/dev/null

SCHEDULER_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB}:run"

log "Creating or updating two-hour Cloud Scheduler trigger"
if gcloud scheduler jobs describe "$SCHEDULER_JOB" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$SCHEDULER_JOB" \
    --location "$REGION" \
    --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --time-zone "Etc/UTC" \
    --uri "$SCHEDULER_URI" \
    --http-method POST \
    --oauth-service-account-email "$SCHEDULER_SA" \
    --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
    --attempt-deadline 30m \
    --quiet
else
  gcloud scheduler jobs create http "$SCHEDULER_JOB" \
    --location "$REGION" \
    --project "$PROJECT_ID" \
    --schedule "$SCHEDULE" \
    --time-zone "Etc/UTC" \
    --uri "$SCHEDULER_URI" \
    --http-method POST \
    --oauth-service-account-email "$SCHEDULER_SA" \
    --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
    --attempt-deadline 30m \
    --quiet
fi

log "Running one verification execution now"
gcloud run jobs execute "$JOB" --region "$REGION" --project "$PROJECT_ID" --wait

cat <<EOF

Cloud Run ingestion is active.
Project:   $PROJECT_ID
Region:    $REGION
Job:       $JOB
Scheduler: $SCHEDULER_JOB
Schedule:  $SCHEDULE (UTC)
Image:     $IMAGE

GitHub Actions no longer needs to run production ingestion on a cron schedule.
EOF
