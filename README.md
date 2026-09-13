# GeoAcademic Radar

**Global Academic Intelligence for Photogrammetry, Remote Sensing, GeoAI & Geoinformatics**

[Live application](https://geoacademic.app) · [Operations](./OPERATIONS.md) · [Data pipeline](./DATA_PIPELINE.md)

GeoAcademic Radar is a public research-discovery platform for students, early-career researchers, and academics working across photogrammetry, remote sensing, geoinformatics, GeoAI, Earth observation, computer vision, 3D reconstruction, LiDAR, SAR/InSAR, digital twins, and related geospatial research fields.

The project addresses a practical problem: relevant academic information is fragmented across university career pages, research-group websites, conference sites, publication databases, project pages, and professional societies. GeoAcademic Radar brings those signals into one provenance-aware system so users can discover **who is working on what, where research is happening, which opportunities are open, and which academic signals are changing**.

> GeoAcademic Radar does not fabricate current academic information. Externally derived records are expected to retain source provenance, verification state, and recency information.

## What the platform covers

- **PhD and research opportunities** — doctoral researcher, research assistant, and postdoctoral openings from academic sources.
- **Academic events** — conferences, workshops, calls, deadlines, and relevant geospatial research events.
- **Institutions and research groups** — discover laboratories and universities by geography and research focus.
- **Researchers** — connect people with institutions, research topics, publications, projects, and opportunities.
- **Academic Pulse** — structured signals such as new opportunities, projects, publications, datasets, events, and research activity.
- **Research topics and trends** — transparent signals derived from collected data rather than manually invented rankings.
- **Provenance and verification** — records retain source URLs, source metadata, timestamps, confidence/verification state, and canonical identity.
- **Deduplication** — repeated records from multiple sources are resolved into canonical entities while preserving evidence.

## Why this project exists

Finding a suitable PhD laboratory or following a specialized research field often requires checking many disconnected sources manually. Generic job boards and news feeds do not model the relationships between **researchers, institutions, projects, publications, topics, events, and research opportunities**.

GeoAcademic Radar is designed as research infrastructure rather than a general news site. The long-term goal is a maintainable academic intelligence layer for the geospatial research ecosystem that can support:

- prospective PhD students identifying relevant laboratories and supervisors;
- Master's students exploring research directions;
- early-career researchers monitoring opportunities and events;
- academics following activity across institutions and topics;
- maintainers building reusable, auditable academic-data ingestion and QA workflows.

## Core data principles

### Provenance first

Every externally derived record should be traceable back to its evidence. The data model is designed around source URLs, discovery timestamps, verification timestamps, source organizations, and canonical entities.

### No invented academic facts

If a current position, deadline, project, researcher affiliation, metric, or event cannot be confirmed, the system should expose that uncertainty rather than generate a plausible answer.

### Prefer authoritative sources

The ingestion strategy prioritizes official institutional and research-group sources, structured APIs, RSS/feeds, established academic portals, and other attributable sources over uncontrolled scraping.

### Transparent quality control

Automated QA checks cover duplicate identities, missing source metadata, malformed structured data, slug/date integrity, and other data-quality failures before records are trusted by public surfaces.

## Architecture

GeoAcademic Radar is a full-stack, database-driven application with separate web, data, and ingestion layers.

### Web application

- TypeScript
- React
- TanStack Start / TanStack Router
- TanStack Query
- Vite
- Cloudflare Workers

### Data platform

- Supabase
- PostgreSQL
- authentication and Row Level Security
- relational research entities and source/evidence records
- public read models and RPC fallbacks

### Open Engine / ingestion

The ingestion and normalization layer is responsible for:

1. registering and scheduling academic sources;
2. fetching structured or semi-structured source data;
3. normalizing records into canonical research entities;
4. attaching provenance and evidence;
5. deduplicating repeated entities;
6. validating scope and data quality;
7. promoting verified records to public read models.

The pipeline is designed so individual source adapters can be added or replaced without redesigning the user-facing application.

## Research domains

The project focuses on domains including:

`Photogrammetry` · `Remote Sensing` · `Geoinformatics` · `GeoAI` · `Earth Observation` · `Computer Vision` · `3D Reconstruction` · `LiDAR` · `Point Clouds` · `SAR` · `InSAR` · `Hyperspectral Remote Sensing` · `UAV Mapping` · `Visual SLAM` · `NeRF` · `Gaussian Splatting` · `3D City Models` · `CityGML` · `GeoBIM` · `Digital Twins` · `Spatial AI` · `Knowledge Graphs`

## Data-quality workflow

The repository contains automated GitHub Actions for ingestion, Open Engine CI, database QA, deployment checks, and production smoke testing.

Database QA verifies conditions such as:

- duplicate external identities;
- duplicate title/source identities;
- missing titles or source URLs;
- missing or duplicate slugs;
- missing dates where required;
- malformed canonical, signal, or evidence JSON;
- records outside the intended academic scope.

Production smoke tests verify that the deployed application, public health endpoint, and server-rendered research surfaces are actually returning data rather than only checking that a deployment completed.

## Local development

Prerequisites:

- Bun 1.3+
- Node-compatible development environment
- Supabase project/environment configuration for data-backed features

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Build the application:

```bash
bun run build
```

Run linting:

```bash
bun run lint
```

Environment-variable examples are documented in [`.env.example`](./.env.example). Do not commit production credentials or service-role secrets.

## Repository documentation

- [`OPERATIONS.md`](./OPERATIONS.md) — production operations, secrets, authentication redirects, and verification lifecycle.
- [`DATA_PIPELINE.md`](./DATA_PIPELINE.md) — ingestion and data-flow architecture.
- [`ARCHITECTURE_UPGRADE.md`](./ARCHITECTURE_UPGRADE.md) — architecture evolution notes.
- [`AGENTS.md`](./AGENTS.md) — repository guidance for coding agents and maintainers.

## Current development priorities

The project is actively evolving. Current priorities include expanding reliable source coverage, improving normalization and deduplication, strengthening provenance and verification, extending researcher/project/publication coverage, improving research-fit discovery, and making the ingestion system easier for contributors to extend safely.

## Contributing

Contributions that improve source adapters, data quality, provenance, deduplication, tests, documentation, accessibility, or research-domain coverage are welcome.

When contributing data-source logic, please preserve the project's central rule: **a public academic claim should be attributable to evidence and should expose uncertainty when it cannot be verified.**

## Project links

- Website: https://geoacademic.app
- Repository: https://github.com/ealins/research-pulse-global-f9b8742f

---

GeoAcademic Radar is being developed as reusable research-discovery and academic-data infrastructure for the geospatial research community.
