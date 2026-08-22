#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${ENV_FILE:-.env.oracle}"
COMPOSE_FILE="docker-compose.oracle.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  echo "Copy .env.oracle.example to $ENV_FILE and replace every CHANGE_ME value."
  exit 1
fi

if grep -q "CHANGE_ME" "$ENV_FILE"; then
  echo "$ENV_FILE still contains CHANGE_ME values. Refusing to start."
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }
docker compose version >/dev/null

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${API_DOMAIN:?API_DOMAIN is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_ACCESS_KEY:?S3_ACCESS_KEY is required}"
: "${S3_SECRET_KEY:?S3_SECRET_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${INTERNAL_API_TOKEN:?INTERNAL_API_TOKEN is required}"

echo "Validating Oracle compose configuration..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

echo "Building GeoAcademic services..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build

echo "Starting GeoAcademic open engine..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "Waiting for API health..."
for attempt in $(seq 1 30); do
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api \
      python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5)" >/dev/null 2>&1; then
    echo "GeoAcademic API is healthy."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
    exit 0
  fi
  sleep 2
done

echo "API did not become healthy. Recent API logs:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=100 api
exit 1
