# GeoAcademic Radar v6 — High-precision discovery frontier

This upgrade is focused on real-data generation, not raw queue throughput.

## What changes

- Rejects known low-value utility/document URLs before they become sources.
- Expands people, project, event, programme and course listings into detail pages.
- Expands research-group/chair pages into both researcher and project detail links.
- Adds a bounded `reseed-high-value` action for index pages fetched before deep discovery existed.
- The continuous worker automatically triggers that reseed after three idle polls, at most once every six hours per process.
- Idle polling backs off to 60 seconds and logs DEAD tasks explicitly.
- Public detail queries hide demo entities and demo-linked child records where the schema supports it.

## Safety

- No database migration.
- No deletion of raw or canonical records.
- No increase to NVIDIA concurrency.
- No refetch of every source; reseed is limited to high-value index categories and max 150 sources per worker reseed.
- Each reseeded source is marked `deep-discovery-v6` in source notes so it is not repeatedly requeued.
