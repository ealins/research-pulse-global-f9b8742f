# Deploy GeoAcademic Open Engine

This production path keeps Lovable as the frontend publisher only. The data engine runs on any standard Linux VPS with Docker.

## 1. Create a generic Ubuntu server

Use any provider you want. Recommended starting size for the first public deployment: 4 vCPU, 8 GB RAM, 80+ GB SSD. The stack is portable because it is Docker Compose, PostgreSQL/PostGIS, FastAPI and MinIO.

Open inbound TCP 22, 80 and 443. UDP 443 is optional but enables HTTP/3 through Caddy.

## 2. Point the API hostname

Create a DNS A record:

- `api.geoacademic.app` -> your server IPv4 address

If you also have IPv6, add the matching AAAA record.

Do not point Lovable away from `geoacademic.app`; the website stays there.

## 3. Install Docker

Install Docker Engine with the Docker Compose plugin using your Linux distribution's normal package instructions.

Verify:

```bash
docker --version
docker compose version
```

## 4. Clone the repository

```bash
git clone https://github.com/ealins/research-pulse-global-f9b8742f.git
cd research-pulse-global-f9b8742f/open-engine
```

## 5. Configure production secrets

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Replace every `CHANGE_ME` value. Keep `.env.prod` only on the server; never commit it.

`POSTGRES_PASSWORD` should be long and URL-safe because it is embedded in the internal PostgreSQL connection URL.

## 6. Start the engine

```bash
chmod +x deploy.sh
./deploy.sh
```

Caddy automatically obtains HTTPS for `api.geoacademic.app` once DNS resolves to the server.

Verify:

```bash
curl https://api.geoacademic.app/health
curl https://api.geoacademic.app/v1/pulse/latest
curl https://api.geoacademic.app/v1/latest/publication
```

## 7. Seed sources

The engine includes a source seeder. Run it from the worker image once the initial source list is ready:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm fetch-worker python seed.py
```

The fetch workers use PostgreSQL task claiming, content hashes, ETag/Last-Modified metadata, robots checks and MinIO snapshots. Changed pages are queued for extraction; unchanged pages are only re-verified.

## 8. Scale ingestion without changing the frontend

Start with one fetch-worker service using internal concurrency. If backlog grows, horizontally scale the same container:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --scale fetch-worker=4
```

All replicas safely share the queue using `FOR UPDATE SKIP LOCKED`.

Later, Kafka and OpenSearch can be inserted behind the existing API contract without changing Lovable routes.

## 9. Connect Lovable only after data is healthy

Do not switch the frontend while the new engine is empty.

Once the API has useful verified data, set this Lovable build variable:

```text
VITE_GEOACADEMIC_API_URL=https://api.geoacademic.app
```

Then migrate Monitor, latest publications, programmes, projects, jobs, events, researchers and institutions section-by-section using `src/lib/open-engine-client.ts`.

## Operations

Status:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

Logs:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=200
```

Update deployment:

```bash
git pull
cd open-engine
./deploy.sh
```

Scale fetch workers:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --scale fetch-worker=8
```

Back up PostgreSQL and the MinIO volume before destructive maintenance.
