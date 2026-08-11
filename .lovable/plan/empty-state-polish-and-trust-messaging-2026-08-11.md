# Empty-state polish and trust messaging

## Goal
Replace bare "0"/"—" stat displays with a consistent empty-state component, and elevate the existing trust copy into a visible homepage block.

## What we'll change

### 1. Reusable `EmptyState` component
Create `src/components/EmptyState.tsx` that renders:
- A short "Sourcing now" label
- One line reusing the existing trust copy: "Every record links back to an official source and carries a verification status. Nothing here is inferred."

Use it wherever a stat currently shows `0` or `"—"`.

### 2. Homepage (`src/routes/index.tsx`)
- Stat tiles: Institutions, Researchers, Positions, Publications, Projects, Events
- "Latest signals" count when `events?.length === 0`
- Replace the thin sidebar trust strip with a dedicated, larger trust block placed near the hero/CTA area
- Keep the exact trust wording, no rewrite

### 3. Jobs page (`src/routes/jobs.index.tsx`)
- CategoryTabs counts: Academic track, Industry track, Both tracks
- Stat tiles: Open now, Closing soon, Dated calls, Institutions & employers

## Out of scope
- No data model, schema, or migration changes
- No new routes
- No changes to `/matcher`
- No email capture or new backend calls

## Verification
- Run `tsgo` to confirm type safety
- Spot-check homepage and `/jobs` to confirm empty states render correctly when counts are zero
