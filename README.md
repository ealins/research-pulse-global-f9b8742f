# GeoSphere

> Production operations, required secrets, authentication redirects, and the verification lifecycle are documented in [OPERATIONS.md](./OPERATIONS.md).

Build GeoAcademic Radar — a Global Academic Intelligence Platform for Photogrammetry, Remote Sensing and Geoinformatics

I already have a prototype called GeoAcademic Radar. Rebuild it as a production-quality, database-driven web application rather than a static dashboard.

The application is primarily for:

prospective PhD students

Master's students searching for PhD supervisors

early-career researchers

academics

researchers following developments in photogrammetry, remote sensing, geoinformatics, GeoAI and 3D geospatial research

This should NOT be a general news website.

Its purpose is to answer:

What is happening academically right now in Photogrammetry, Remote Sensing and Geoinformatics, who is doing it, where are they doing it, what projects are active, what are researchers publishing, what PhD positions are available, and where should I apply?

1. PRODUCT NAME

GeoAcademic Radar

Subtitle:

Global Academic Intelligence for Photogrammetry, Remote Sensing & Geoinformatics

Primary research domains:

Photogrammetry

Remote Sensing

Geoinformatics

GeoAI

Computer Vision

3D Reconstruction

LiDAR

Point Clouds

SAR

InSAR

Hyperspectral Remote Sensing

Multispectral Remote Sensing

Earth Observation

UAV Remote Sensing

Visual SLAM

Neural Rendering

NeRF

Gaussian Splatting

3D City Models

CityGML

GeoBIM

Digital Twins

Spatial AI

Geospatial Knowledge Graphs

Semantic 3D Modelling

2. CORE PRINCIPLE: NEVER FABRICATE CURRENT ACADEMIC INFORMATION

This is extremely important.

Never generate a professor, position, project, publication, deadline, department head, metric or partnership simply because it sounds plausible.

Every externally derived record must maintain provenance:

source URL

source organization

source type

date discovered

last checked

last verified

verification status

original title

canonical entity linked to it

Display a visible:

Last verified: [date]

where appropriate.

Use statuses such as:

Verified

Automatically discovered

Needs review

Possibly outdated

Closed

Archived

If information cannot be confirmed, show:

Not currently verified

instead of guessing.

3. BACKEND

Use Supabase as the backend.

Create:

PostgreSQL database

authentication

Row Level Security

server-side functions / API integrations

scheduled ingestion architecture

admin roles

standard user roles

Do not expose API secrets in frontend code.

External API requests requiring credentials must run server-side.

Architecture must be modular so individual data providers can later be replaced without redesigning the UI.

4. DATABASE MODEL

Do NOT store the entire application as JSON blobs.

Create relational tables.

institutions

Fields including:

id

name

abbreviation

country

city

latitude

longitude

official_url

careers_url

research_url

institution_identifier

description

institution_type

active

created_at

updated_at

departments

id

institution_id

name

website

description

researchers

id

full_name

institution_id

department_id

academic_title

current_position

ORCID

OpenAlex author ID

Semantic Scholar ID

official_profile_url

Google Scholar URL if manually verified

research_summary

active

last_verified_at

Do not treat department head as a permanent field.

Create:

researcher_roles

researcher_id

institution_id

department_id

role

valid_from

valid_to

source_id

This allows historical changes in department leadership.

5. RESEARCH TAXONOMY

Create a controlled research taxonomy.

Examples:

Photogrammetry
Computer Vision
GeoAI
Earth Observation
SAR
InSAR
LiDAR
Point Clouds
3D Reconstruction
Visual SLAM
NeRF
Gaussian Splatting
Hyperspectral
UAV Mapping
3D City Models
CityGML
GeoBIM
Digital Twins
Spatial Databases
Knowledge Graphs
Semantic Modelling

Create many-to-many relationships between:

researchers

institutions

projects

publications

PhD positions

and research topics.

6. PUBLICATIONS

Create a publications table containing:

DOI

title

publication date

year

venue

authors

citation count where available

open-access status where available

source

external identifier

abstract when legally available

associated institution

associated researchers

research topics

Primary bibliometric source should be OpenAlex.

Design connectors for:

OpenAlex

Crossref

Semantic Scholar

ORCID

Do not assume metrics from different providers are directly comparable.

Store:

metric source

metric value

retrieval date

separately.

7. PUBLICATION INTELLIGENCE

Do more than show a publication list.

Calculate transparent signals such as:

Recent Publication Velocity

Publications during:

last 12 months

previous 12 months

last 36 months

Research Topic Momentum

Determine which research topics are increasing within the tracked academic network.

Examples:

Gaussian Splatting

foundation models for Earth observation

multimodal EO

SAR foundation models

semantic digital twins

GeoAI

knowledge graphs

neural SLAM

Do NOT claim that a trend is globally increasing unless supported by the underlying dataset.

Call it:

GeoAcademic Radar Trend Signal

Explain exactly how it was calculated.

8. RESEARCH PROJECT DATABASE

Create projects.

Fields:

project name

acronym

institution

researchers

start date

end date

status

funding organization

funding amount if publicly available

research topics

project website

project summary

participating institutions

industry partners

source

last verified

Statuses:

Planned

Active

Recently completed

Completed

Unknown

Projects must appear on both institution and professor profiles.

9. PHD / RESEARCH JOB INTELLIGENCE

This is one of the MOST IMPORTANT parts of the application.

Create a proper opportunities table.

Fields:

title

institution

department

supervisor

research group

country

city

opportunity type

PhD / Research Assistant / Doctoral Researcher / Postdoc

research topics

project

description

requirements

funding type

salary if explicitly published

start date

application deadline

application URL

official source URL

date first discovered

last checked

status

confidence

source

Statuses:

OPEN

Deadline has not passed and source remains active.

CLOSING SOON

Deadline within 14 days.

ROLLING

Explicitly accepts ongoing applications.

POSSIBLY OPEN

Source exists but current availability cannot be confirmed.

CLOSED

Deadline passed.

ARCHIVED

Old opportunity retained as research-funding intelligence.

Never label a vacancy OPEN solely because the page still exists.

10. OPPORTUNITY SOURCES

Design connectors/adapters for:

Official university career pages

Department / laboratory vacancies pages

EURAXESS

Research-project recruitment pages

Prefer:

official institutional source > established academic portal > third-party source

Do not rely on uncontrolled scraping when an API, RSS feed or official structured source exists.

Create a modular source adapter system.

Each adapter should record:

successful sync

records discovered

duplicates detected

records changed

records removed/closed

errors

response time

last sync

11. DEDUPLICATION

This is essential.

The same PhD vacancy or publication may appear on several websites.

Implement duplicate detection.

For publications prefer:

DOI → provider identifiers → normalized title.

For researchers prefer:

ORCID → OpenAlex author ID → institution + normalized name.

For institutions prefer canonical identifiers.

For opportunities use:

institution + normalized title + supervisor + deadline + canonical URL.

Show only one canonical record while keeping all source links.

12. ACADEMIC PULSE

Create a homepage section called:

Academic Pulse

This replaces conventional "news".

Rank events such as:

new PhD opening

PhD deadline approaching

newly funded project

new major research project

new publication

highly cited recent paper

new dissertation

new dataset

new benchmark

new open-source research tool

professor moves institution

new laboratory created

major academic appointment

research award

new research standard

ISPRS activity

IEEE GRSS activity

major workshop

major conference

special issue / call for papers

Every feed card must state its category.

Examples:

PHD
PROJECT
PAPER
DATASET
DISSERTATION
EVENT
PEOPLE
STANDARD
FUNDING

Users must be able to filter the Academic Pulse.

13. INSTITUTE EXPLORER

Create a sophisticated Institution Explorer.

Seed it initially with:

Wuhan University

Technical University of Munich

University of Stuttgart

University of Twente / ITC

TU Delft

ETH Zurich

Leibniz University Hannover

Karlsruhe Institute of Technology

University of Zurich

University College London

NUS Urban Analytics Lab

But design the application for hundreds or thousands of institutions.

Filters:

country

continent

research field

university

laboratory

professor

active PhD opening

current project

SAR

photogrammetry

computer vision

GeoAI

LiDAR

3D city models

digital twins

Search must be global and fast.

14. INSTITUTION PROFILE PAGE

Route:

/institutions/:slug

Display:

Overview

institution

department

research group

current leadership

university URL

location

Research Areas

Key Professors

Active Research Projects

Open PhD Positions

Recently Closed PhD Positions

Recent Publications

Publication Momentum

Major Collaborators

Industry Partnerships

Funders

Upcoming Events

Previous Important Events

Courses / Degree Programmes

Relevant MSc programmes

Relevant PhD programmes

Source coverage

Last updated

15. PROFESSOR / RESEARCHER PROFILE PAGE

Route:

/researchers/:slug

Show:

name

academic position

institution

department

official profile

ORCID

research topics

recent publications

citation information with source

publication trend

active projects

recent projects

collaborators

students / doctoral supervision only when reliably available

current PhD openings

past PhD openings

associated courses

research events

professional society roles

Also calculate:

Research Fit

based on the logged-in user's selected interests.

Example:

Research fit: 92%

Then explain:

Strong match: GeoAI

Strong match: 3D reconstruction

Moderate match: LiDAR

Weak match: SAR

Do not present the score as an objective academic quality ranking.

16. PHD MATCHER

Create a dedicated:

Find My PhD Lab

Let users choose or weight interests.

Example sliders:

Photogrammetry
Computer Vision
GeoAI
SAR/InSAR
LiDAR
3D Reconstruction
3D City Models
Digital Twins
Knowledge Graphs
Environmental EO

Also ask:

preferred countries

Europe only / worldwide

salaried PhD preferred

university-funded / externally funded

desired start year

methodological vs application-oriented research

Then rank research-group fit, not university prestige.

Default weighting:

Research-topic fit: 40%

Current opportunity availability: 20%

Recent publication activity in selected topic: 15%

Active relevant projects: 10%

Supervisor alignment: 10%

Industry/professional ecosystem: 5%

All weights should be editable.

Display a breakdown explaining why each recommendation was generated.

17. EVENTS INTELLIGENCE

Create:

/events

Track:

ISPRS Congress

ISPRS Geospatial Week

ISPRS workshops

Photogrammetric Week

IGARSS

IEEE GRSS events

ASPRS events

EuroSDR workshops

3D GeoInfo

Smart Data / Smart Cities

point-cloud workshops

relevant CV / geospatial AI workshops

Fields:

title

organization

location

start date

end date

abstract deadline

paper deadline

registration deadline

topics

website

recurrence

source

verification status

Provide:

Calendar view
Timeline view
Research-topic filter
Deadline filter

18. RESEARCH TRENDS PAGE

Create:

/trends

Do not manually hardcode trend scores.

Compute trends from collected data.

Show:

Emerging topics

Publication growth

Institutions entering a research topic

Researchers publishing rapidly in a topic

Active funded projects by topic

Geographic distribution

PhD demand by topic

Possible findings might include:

foundation models for EO

multimodal geospatial AI

Gaussian Splatting for mapping

neural rendering

SAR foundation models

semantic urban digital twins

geospatial knowledge graphs

But only display such results if supported by current stored data.

19. COLLABORATION GRAPH

Create an interactive academic network page.

Nodes can represent:

universities

researchers

projects

industry partners

funding agencies

Edges:

co-authorship

joint project

institutional partnership

industry collaboration

supervision

funding

Allow filtering.

Example:

TUM ↔ City of Munich
TU Delft ↔ Kadaster
Twente ↔ ESA
Stuttgart ↔ EuroSDR

Only create edges backed by a source.

20. USER ACCOUNTS

Allow users to sign up.

Users can save:

Research interests

Institutions

Professors

PhD positions

Events

Search filters

Countries

Create:

My Academic Radar

Show:

new opportunities matching interests

approaching deadlines

new papers from watched professors

new projects from watched labs

upcoming events

changes in watched institutions

21. ALERTS

Allow users to create alerts.

Examples:

“Tell me when a PhD involving SAR and GeoAI appears in Germany.”

“Watch Konrad Schindler's group.”

“Watch TU Delft 3D Geoinformation.”

“Notify me when a CityGML PhD appears in Europe.”

“Notify me of photogrammetry PhDs in Switzerland.”

Store alert rules in the database.

Design the backend so alert jobs can run periodically.

Do not repeatedly alert the user about the same unchanged item.

22. ADMIN INTELLIGENCE CONSOLE

Create a protected /admin route.

Dashboard cards:

Sources monitored
Successful syncs
Failed sources
Records awaiting review
New opportunities
Expired opportunities
Potential duplicates
Professor affiliation changes
Missing source evidence

Admin actions:

Verify
Reject
Merge duplicate
Edit
Archive
Refresh source
Add institution
Add researcher
Add source
Add research topic

Also display ingestion logs.

This application should remain manageable even with tens of thousands of records.

23. SOURCE MANAGEMENT

Create a sources table.

Types:

Institution

Careers page

Research group

API

RSS

Conference

Society

Project

Publication database

Fields:

URL

organization

type

trust level

refresh frequency

last successful fetch

last failed fetch

active

notes

Suggested refresh behaviour:

PhD vacancies: daily
Academic pulse sources: daily
Publications: weekly
Projects: weekly
Events: weekly
Professor affiliation/leadership: monthly

Make refresh schedules configurable rather than hardcoded.

24. DATA QUALITY

Create a visible confidence system.

Example:

High confidence

Official institutional source and recently verified.

Medium confidence

Reliable academic database but not confirmed by institutional page.

Low confidence

Older or incomplete external record.

Never hide uncertainty.

25. RESEARCH METRICS

Do NOT create a fake universal university ranking.

Instead provide multiple transparent signals.

Publication Momentum

Recent relevant publications.

Research Focus Strength

Share of publications/projects related to selected field.

Funding/Project Activity

Number of current relevant projects.

PhD Opportunity Signal

Current + recent doctoral recruitment.

Collaboration Signal

Current cross-institution / industry project activity.

Professional Activity

ISPRS, IEEE GRSS, EuroSDR and major academic-event involvement where verified.

Let the user decide what matters.

26. COURSE / STUDY INTELLIGENCE

Track relevant:

MSc programmes

doctoral programmes

graduate schools

summer schools

specialised modules

Examples:

Photogrammetry
Remote Sensing
GeoAI
Computer Vision
Geoinformatics
Geomatics
Earth Observation
3D GIS

Link courses to professors only when officially supported.

27. FRONTEND ROUTES

Build:

/

Academic Pulse

/institutions

Institution Explorer

/institutions/:slug

Institution page

/researchers

Researcher Explorer

/researchers/:slug

Professor page

/opportunities

PhD / research jobs

/projects

Research projects

/publications

Research output

/trends

Research trends

/events

Academic events

/network

Collaboration graph

/match

PhD Matcher

/watchlist

My Academic Radar

/admin

Admin Intelligence Console

28. DESIGN

Use my current GeoAcademic Radar HTML as the visual inspiration but improve it significantly.

Style:

sophisticated academic intelligence platform

dark-first design

professional rather than futuristic

deep navy background

restrained blue / cyan accents

excellent typography

subtle borders

minimal shadows

information-dense but readable

desktop-first research dashboard

fully mobile responsive

Avoid:

excessive gradients

giant hero sections

marketing-site layouts

excessive animations

oversized cards

fake AI imagery

This should feel closer to:

research intelligence software + academic database + professional analytics platform

than a startup landing page.

29. HOMEPAGE

Top section should immediately answer:

What's happening in my field?

Metrics:

Live PhD positions
New research projects
New publications this week
Upcoming academic deadlines
Institutions monitored
Researchers monitored

Then show:

Academic Pulse

Urgent PhD Deadlines

Research Trends

Active Institutions

Upcoming Conferences

Recommended Labs for You

30. SEARCH

Create one global search bar.

Search:

universities
professors
topics
papers
projects
PhD positions
events

Support typo tolerance where practical.

Add autocomplete.

31. PERFORMANCE

Do not download huge publication datasets directly into the browser.

Use server-side querying.

Add:

pagination
database indexes
lazy loading
cached aggregate metrics
loading skeletons
error states
empty states
retry behaviour

The architecture should remain usable when scaled from 10 institutions to 1,000+.

32. SECURITY

Use Row Level Security.

Roles:

anonymous
user
admin

Anonymous users can browse public academic data.

Users can manage only their own:

watchlists
alerts
preferences

Only admins can modify canonical academic intelligence records.

External API credentials must never appear in frontend JavaScript.

33. AUDITABILITY

Every manually modified canonical record should store:

created_at
updated_at
updated_by
verification_status
verification_date

For important entity changes such as:

department head
institution affiliation
job status

retain history instead of overwriting it silently.

34. IMPORTANT UX RULE

Whenever a user sees a claim such as:

“Current Department Head”

“PhD Open”

“Active Project”

“Research partnership”

allow them to inspect its source.

Provide a small:

Source ↗

or

Evidence

action.

Academic trustworthiness is more important than visual decoration.

35. FIRST IMPLEMENTATION

Do not attempt to populate the entire world immediately.

First build the complete scalable architecture and seed the database with the existing institutions from my prototype.

Use seed content only to demonstrate the interface.

Clearly label any non-verified demonstration content.

Then connect:

OpenAlex

Crossref

university official pages

EURAXESS

ORCID

optional Semantic Scholar enrichment

Build each integration through a modular provider/service architecture.

36. IMPORTANT ENGINEERING REQUIREMENTS

Do not create one giant React component.

Use reusable components and a clean service layer.

Separate:

UI
database access
external API connectors
normalization
deduplication
ranking
analytics
authentication

Use strongly typed models.

Validate incoming external data before writing it to canonical tables.

Store raw source information separately from cleaned canonical records where useful.

Do not delete historical information simply because a source changed.

37. INITIAL SUCCESS CRITERIA

I should be able to open GeoAcademic Radar and:

See what is happening academically in my research domain.

Discover currently open PhD positions.

Identify relevant professors.

Inspect their recent research.

See active research projects.

Compare academic groups.

Discover major upcoming events.

Identify emerging research themes.

Save laboratories and professors.

Receive personalised opportunity recommendations.

Verify where every important claim came from.

Understand why a particular lab is recommended to me.

The application must feel like a serious academic research intelligence system, not a manually maintained list of universities.

Before implementing the interface, first create the database schema, entity relationships, routes and data-flow architecture. Then implement the backend and frontend against that structure.

Preserve the useful information and visual character of my existing GeoAcademic Radar prototype, but replace its hard-coded data architecture with this scalable system.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://research-pulse-global.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76d38f94-603a-4537-ac89-d70f8a5082dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? Install [Bun](https://bun.sh/docs/installation).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install --frozen-lockfile
bun run dev
```
