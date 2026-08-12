# GeoAcademic Radar v6.1 — Data Frontier Recovery

This patch fixes a specific v6 stall: detail URLs that already existed in `sources`
could be upgraded to `html-*-detail` but were not reprocessed. Because the page
content was unchanged, later fetches also stopped before normalization.

Changes:
- Recover already-fetched detail sources directly from stored raw records.
- Reclassify those raw records from the detail adapter and queue NORMALIZE.
- Fetch only detail sources that have no stored raw record.
- Relax child-link detection for real-world staff/project/event URLs that do not
  repeat the category keyword in every detail URL.
- Use a new `deep-discovery-v6.1` reseed marker so v6-seeded indexes can be
  revisited once with the corrected logic.
- Continuous worker runs one bounded detail-recovery pass at startup.

No database migration and no secret/model/concurrency changes.
