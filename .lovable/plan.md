# Remove placeholder links, rebuild the programme catalogue on real sources

## What's wrong today

A database check shows fabricated `example.org` / `example.com` URLs across the seeded content:

| Table | Rows | With example.* links |
| --- | --- | --- |
| opportunities (jobs/PhDs) | 220 | 206 |
| courses (programmes) | 234 | 146 |
| pulse_events | 224 | 78 |
| projects | 83 | 73 |
| events | 24 | 4 |

Institutions, researchers, publications and record_sources are clean. Every course row is
flagged `is_demo`, and the catalogue is thin in several strong regions (France 3, Japan 3,
India 4, Poland 3) while the biggest geospatial teaching hubs are under-represented.

## 1. No more placeholder links

Rule: a link is either an authentic, resolvable official URL or it does not exist.

- Replace `example.*` URLs with the real official page where the record maps to a genuine,
  verifiable programme/position/project (see step 2).
- Where no authentic source can be established, clear the URL and let the existing
  provenance UI handle it: no link, `verification_status = 'unverified'`, and the
  "Sourcing now" / trust copy instead of a dead link.
- Records whose *entire* value was the fake link (synthetic job postings and pulse entries
  with no institution-backed claim) are deleted rather than shown link-less, so the site
  never presents an unsourced claim as a record.
- Add a guard so this cannot come back: a check constraint rejecting `example.com` /
  `example.org` hosts in URL columns on courses, opportunities, projects, events,
  pulse_events, record_sources.

## 2. A far more extensive, real programme catalogue

Rebuild `courses` around verifiable degree programmes in photogrammetry, remote sensing,
geodesy, geoinformatics, GIScience, surveying and Earth observation — each row carrying the
institution's own programme page as its source.

Target coverage (~180-220 programmes, all real):

- Europe: ITC/Twente, TU Delft, Wageningen, ETH Zurich, EPFL, TU Munich, Stuttgart, Bonn,
  Jena, Trier, Salzburg, Vienna TU, Graz, Ljubljana, Zagreb, Warsaw UT, Wroclaw, Prague CTU,
  Aalto, KTH, Lund, NTNU, Aalborg, DTU, UCL, Edinburgh, Leeds, Southampton, Bristol, Newcastle,
  Politecnico di Milano, Bologna, Padova, Sapienza, UPM, UPC, Valencia, Lisbon, Porto,
  ENSG/IGN, Strasbourg, Toulouse, Montpellier, KU Leuven, Ghent, Bern, Zurich, Copenhagen.
- Americas: Ohio State, Purdue, Wisconsin-Madison, Oregon State, Colorado Boulder, Texas A&M,
  Penn State, Arizona, Clark, Boise State, USC, Calgary, UNB, Waterloo, Laval, Toronto,
  Sao Paulo, UFPR, Chile, Buenos Aires.
- Asia-Pacific: Wuhan, Tongji, Tsinghua, Beijing Normal, HK PolyU, NUS, AIT Bangkok, IIT
  Bombay/Roorkee/Kanpur, IIRS, Seoul National, KAIST, Tokyo, Hokkaido, UNSW, Melbourne,
  Curtin, RMIT, Otago, Canterbury.
- Africa & Middle East: Cape Town, Stellenbosch, Pretoria, Nairobi, Cairo, KFUPM, Technion,
  Tel Aviv, KTU, ITU Istanbul.

Each programme gets: title, degree level (BSc / MSc / MEng / PhD / postgraduate certificate),
institution, department where stated, language, duration, a short factual synopsis written
from the official page, the official programme URL, plus a `record_sources` row so the
evidence drawer works. Topic links (photogrammetry, remote sensing, geodesy, GIScience,
SAR, lidar, cartography, spatial data science, UAV, Earth observation) so the existing
subject-family tabs and filters get real depth.

Verification: each URL is fetched during preparation; anything that doesn't resolve to the
institution's own domain is dropped rather than guessed. Rows sourced this way stop being
`is_demo` and become `verification_status = 'verified'` with `last_verified_at` set.

## 3. Jobs, projects and pulse cleanup

- Opportunities: keep only entries that can point at a live institutional vacancy or
  aggregator listing on an official domain (university job portals, EURAXESS, institute
  career pages). The rest are removed, and `/jobs` counters then fall back to the
  "Sourcing now" empty state already built.
- Projects: replace fake sites with the real project/funder page (CORDIS, DFG GEPRIS, NSF
  award pages, institute project pages) where the project is real; otherwise clear the URL.
- Pulse events: drop synthetic entries with no source; keep those we can attach to a real
  page.

## Out of scope

- No routing, layout, or Matcher changes.
- No schema redesign beyond the URL-guard constraints.
- No new external connectors or scrapers in this pass.

## Technical notes

- Data changes go through insert/update/delete statements; the URL check constraints go in a
  migration.
- Programme synopses are stored in `courses.summary` so `/programmes/$slug` keeps working
  unchanged.
- After the cleanup, re-check counts per table for remaining `example.` matches (expected: 0)
  and confirm `/programmes`, `/jobs`, `/countries` render with the new volumes.
