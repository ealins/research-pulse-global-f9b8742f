# GeoAcademic Radar — Global Academic Intelligence Platform

A production-grade, database-driven research intelligence platform for photogrammetry, remote sensing, geoinformatics, GeoAI and 3D geospatial research. Built for prospective PhD students, supervisor-seeking MSc students, early-career researchers and academics.

Phase 1 delivers the **complete scalable architecture plus all 14 routes**, seeded with clearly labelled demonstration data, and wires **OpenAlex** (publications/authors/topics) and **EURAXESS** (vacancies) as the first live connectors. Alerts are in-app only.

## Non-negotiable principle: no fabricated academic facts

Every externally derived record carries provenance: source URL, source organization, source type, date discovered, last checked, last verified, verification status, original title, and the canonical entity it links to. UI shows `Last verified: <date>` and an `Evidence ↗` affordance next to every claim (department head, PhD open, active project, partnership). Where nothing can be confirmed, the UI reads **Not currently verified** — never a guess. All seed rows are flagged `is_demo = true` and render a visible "Demonstration data — not verified" badge.

## Architecture

```text
Routes (UI)  ->  server functions (RPC)  ->  service layer
                                             ├── repositories (Supabase, RLS-scoped)
                                             ├── connectors/  openalex, crossref,
                                             │                semantic-scholar, orcid,
                                             │                euraxess, institution-pages
                                             ├── normalize/   provider -> staging DTO
                                             ├── dedupe/      identity resolution
                                             ├── ranking/     research fit, PhD matcher
                                             └── analytics/   momentum, trend signals

Ingestion:  source -> adapter -> raw_records (immutable) -> normalize
            -> dedupe -> canonical tables + record_sources (+ sync_runs log)
```

Raw payloads are stored separately from canonical records and never overwritten. Canonical updates to sensitive fields (leadership, affiliation, job status) append to history tables rather than mutating in place.

## Database model (relational, no JSON blobs)

Core entities: `institutions`, `departments`, `research_groups`, `researchers`, `researcher_roles` (time-ranged, so leadership history is preserved), `projects`, `publications`, `opportunities`, `events`, `courses`, `organizations` (funders/industry partners).

Taxonomy: `research_topics` (controlled vocabulary, ~22 seeded topics incl. Photogrammetry, GeoAI, SAR/InSAR, LiDAR, Point Clouds, 3D Reconstruction, Visual SLAM, NeRF, Gaussian Splatting, Hyperspectral, UAV Mapping, CityGML, GeoBIM, Digital Twins, Knowledge Graphs, Semantic Modelling) with join tables to researchers, institutions, projects, publications, opportunities and events.

Provenance & ops: `sources` (type, trust level, configurable refresh frequency, last success/failure), `record_sources` (canonical record ↔ source, confidence, verification status/date), `raw_records`, `sync_runs` (discovered / duplicates / changed / closed / errors / response time), `duplicate_candidates`, `entity_history`, `audit_log`.

Metrics stay provider-attributed: `entity_metrics(entity, metric, value, source, retrieved_at)` — never blended across providers. Aggregates (`topic_momentum`, `institution_signals`) are cached materialized rows refreshed by jobs.

User space: `profiles`, `user_roles` + `has_role()` security-definer function (roles never on profiles), `user_interests` (weighted), `watchlist_items`, `alert_rules`, `alert_deliveries` (dedupes repeat notifications), `saved_searches`.

## Deduplication

Publications: DOI → provider ID → normalized title + year. Researchers: ORCID → OpenAlex author ID → institution + normalized name. Institutions: canonical identifier (ROR/OpenAlex). Opportunities: institution + normalized title + supervisor + deadline + canonical URL. One canonical record surfaces; every source link is retained and shown.

## Opportunity status logic

`OPEN`, `CLOSING SOON` (≤14 days), `ROLLING`, `POSSIBLY OPEN`, `CLOSED`, `ARCHIVED`. A live page alone never yields `OPEN` — an unconfirmed deadline degrades to `POSSIBLY OPEN`. A daily job re-checks and transitions statuses.

## Computed signals (all explained in-UI)

- **Publication velocity** — counts for last 12 / previous 12 / last 36 months.
- **GeoAcademic Radar Trend Signal** — topic growth computed from stored publications, projects and opportunities only, with the formula shown and dataset scope stated.
- **Research Fit** — cosine-style overlap of user interest weights against a researcher's topic profile, broken down as Strong / Moderate / Weak per topic, explicitly labelled as fit, not quality.
- **PhD Matcher** — default weights topic fit 40%, opportunity availability 20%, recent publication activity 15%, active projects 10%, supervisor alignment 10%, ecosystem 5%; all editable, with a per-recommendation breakdown.
- Institution signals: publication momentum, research focus strength, funding/project activity, PhD opportunity signal, collaboration signal, professional activity. No composite ranking.

## Routes

`/` Academic Pulse home · `/institutions` explorer · `/institutions/:slug` · `/researchers` · `/researchers/:slug` · `/opportunities` · `/projects` · `/publications` · `/trends` · `/events` · `/network` · `/match` · `/watchlist` (auth) · `/admin` (admin-gated) · `/auth`.

Home leads with live counters (open PhD positions, new projects, new publications this week, upcoming deadlines, institutions and researchers monitored), then Academic Pulse feed with category chips (PHD, PROJECT, PAPER, DATASET, DISSERTATION, EVENT, PEOPLE, STANDARD, FUNDING) and filters, urgent deadlines, trend signals, active institutions, upcoming conferences, recommended labs.

Institution and researcher profiles carry the full section sets described in the brief, each section source-attributed. `/events` gets calendar + timeline views with topic and deadline filters. `/network` renders a filterable collaboration graph where every edge requires a source. `/admin` provides the ingestion dashboard (sources monitored, syncs, failures, review queue, new/expired opportunities, duplicate candidates, affiliation changes, missing evidence) plus verify / reject / merge / edit / archive / refresh / add-entity actions and full sync logs.

## Security

RLS on every table. Anonymous: read-only on public academic data (narrow `TO anon` SELECT policies, safe columns). Authenticated users: full control of their own watchlists, alerts, interests only. Admins: writes to canonical records, via `has_role()`. Explicit GRANTs accompany every new table. All external API calls run in server functions; no credential ever reaches the browser. Email/password plus Google sign-in.

## Performance

Server-side querying and pagination throughout; no bulk publication downloads to the client. Indexes on slugs, foreign keys, deadlines, topic joins, full-text search vectors. Cached aggregates for metrics. Skeletons, error states, empty states and retry on every data surface. Global search bar with autocomplete and trigram typo tolerance across institutions, researchers, topics, papers, projects, opportunities and events.

## Design

Dark-first academic intelligence aesthetic: deep navy canvas, restrained blue/cyan accents, tight typographic scale, hairline borders, minimal shadow, dense but legible tables and cards. Desktop-first research dashboard, fully responsive. No hero bloat, no gradients, no marketing layout, no AI imagery. All colors as semantic tokens in `src/styles.css`.

## Seed data

Wuhan University, TU Munich, University of Stuttgart, University of Twente / ITC, TU Delft, ETH Zurich, Leibniz University Hannover, Karlsruhe Institute of Technology, University of Zurich, UCL, NUS Urban Analytics Lab — with departments, the topic taxonomy, sources, and a small labelled demonstration set of researchers, projects, publications, opportunities and events sufficient to exercise every screen.

## Build order

1. Enable Lovable Cloud; migrations for taxonomy, core entities, provenance/ops, user space; RLS, grants, `has_role()`, seed inserts.
2. Typed models, repositories, server functions, service layer skeleton (connectors / normalize / dedupe / ranking / analytics).
3. Design system, shell, navigation, global search.
4. Public routes: home, institutions, researchers, opportunities, projects, publications, events.
5. Analytics routes: trends, network, match.
6. Auth, watchlist, alert rules, My Academic Radar.
7. Admin intelligence console + ingestion logs.
8. Live connectors: OpenAlex and EURAXESS end-to-end through staging → dedupe → canonical, with scheduled refresh and status re-checking.

## Technical notes

TanStack Start with file-based routes; TanStack Query via route loaders (`ensureQueryData` + `useSuspenseQuery`). All Supabase access through `createServerFn`; authenticated ones use `requireSupabaseAuth`. Ingestion endpoints live under `src/routes/api/public/*` with secret verification, callable by pg_cron on the stable project URL. Zod validates every external payload before it reaches canonical tables. Per-route `head()` metadata for SEO.
