# GeoAcademic Open Engine

This directory is the independent data engine for GeoAcademic. Lovable remains the React/TanStack publisher only; ingestion, verification, storage, search projections and Pulse generation live here.

## Product contract

The engine serves two outputs from the same verified record:

1. **Latest entity feeds** for publications, programmes, projects, jobs, events, researchers and institutions.
2. **Pulse signals** for what changed now: new, updated, closing, rising, verified or otherwise important activity.

The Knowledge Base is the context layer. Pulse is the live monitor layer.

## Start locally

```bash
cd open-engine
cp .env.example .env
docker compose up --build
```

API: `http://localhost:8080`

Useful routes:

- `/health`
- `/v1/pulse/latest`
- `/v1/pulse/summary`
- `/v1/latest/publication`
- `/v1/latest/programme`
- `/v1/latest/project`
- `/v1/latest/opportunity`
- `/v1/latest/event`
- `/v1/latest/researcher`
- `/v1/latest/institution`
- `/v1/search?q=remote%20sensing`

## Scale path

The first deployment deliberately uses PostgreSQL as the durable queue with `FOR UPDATE SKIP LOCKED`. This keeps operations simple while preserving worker isolation. The public API is already independent of that queue, so Kafka can be inserted later between acquisition, extraction, verification and materialization without changing the Lovable frontend contract.

Raw page bodies are stored in S3-compatible object storage (MinIO locally). PostgreSQL stores canonical entities, provenance, current hashes, signals and task state. When public search volume outgrows PostgreSQL/pg_trgm, project verified entity changes into OpenSearch; FastAPI routes stay the same.

## Migration rule

Do not switch the production frontend all at once. Populate and verify this engine in parallel, compare counts/results with the current backend, then migrate each frontend query to `VITE_GEOACADEMIC_API_URL` section by section.
