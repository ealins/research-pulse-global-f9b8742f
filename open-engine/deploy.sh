#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine + Compose plugin first." >&2
  exit 1
fi

if [[ ! -f .env.prod ]]; then
  echo "Missing open-engine/.env.prod" >&2
  echo "Copy .env.prod.example to .env.prod and replace every CHANGE_ME value." >&2
  exit 1
fi

if grep -q 'CHANGE_ME' .env.prod; then
  echo ".env.prod still contains CHANGE_ME placeholders." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.prod
set +a

: "${API_DOMAIN:?API_DOMAIN is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

docker compose --env-file .env.prod -f docker-compose.prod.yml build --pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --remove-orphans

echo
printf 'GeoAcademic Open Engine containers:\n'
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

echo
printf 'Waiting for HTTPS health endpoint: https://%s/health\n' "$API_DOMAIN"
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "https://${API_DOMAIN}/health"; then
    echo
    echo "Open Engine is healthy."
    exit 0
  fi
  sleep 4
done

echo "Deployment started, but the public health endpoint is not ready." >&2
echo "Check DNS for ${API_DOMAIN} and run:" >&2
echo "docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 caddy api" >&2
exit 1
