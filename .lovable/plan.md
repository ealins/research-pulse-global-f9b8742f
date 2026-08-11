# Rename "Academic", fix hub labels, make whole cards clickable

## 1. Naming: stop calling everything "Academic"

The site now covers academic *and* industry positions, so the top-level naming changes to
field-neutral wording:

- Homepage H1 / nav label: "Academic Pulse" -> **"Research Pulse"**
- Homepage eyebrow: "Global academic intelligence" -> "Global research & industry intelligence"
- Sidebar group "Careers" keeps its name; the "Academic & industry jobs" item stays as-is
  (it is already explicit).
- Homepage title/meta and description updated to match ("Research Pulse — GeoAcademic Radar",
  wording covering academia and industry). Brand name GeoAcademic Radar is unchanged.
- Sub-headings that say "academic" where the content is mixed (e.g. Countries description,
  Countries page title/meta "Academic capacity by nation" -> "Research capacity by nation")
  are reworded. No route paths change.

## 2. Hub label consistency (sphere spokes)

The ring spokes on the homepage must read exactly like the sidebar destinations:

| Spoke now | Becomes |
| --- | --- |
| PhD Matcher | Matcher |
| Deadlines | Events & deadlines |
| Jobs & PhDs | Jobs |
| World Monitor / Trends / Collaboration | unchanged (match nav) |

Also align "Trends" -> "Research trends" and "Collaboration" -> "Collaboration graph" so the
sphere and the sidebar never disagree.

## 3. Whole tile clickable everywhere

Currently only the heading link inside a card is clickable. Change to: the entire card is the
click target, with the heading still visually the link.

Approach: a small shared `CardLink` wrapper (renders a TanStack `Link` covering the card via an
absolutely-positioned overlay, so nested links/buttons inside the card still work and keyboard
focus lands once per card). Applied to:

- `/countries` country cards (whole card -> country page; the six stat cells stay readable)
- `/institutions`, `/researchers`, `/projects`, `/publications`, `/programmes`, `/events`,
  `/jobs`, `/topics` listing cards
- Homepage "Latest signals" cards: whole card opens the record's source link (the existing
  "Source" link stays visible)
- Homepage stat tiles (Institutions, Researchers, Positions, Publications, Projects, Events)
  and the "Latest signals" section heading link to their respective sections
- `/top` cards

Hover/focus states use the existing `panel-hover` treatment plus a visible focus ring.

## Out of scope
- No schema, data model, or query changes
- No changes to `/matcher` internals
- No new routes; existing URLs stay valid

## Technical notes
- `CardLink` lives in `src/components/CardLink.tsx`; card root gets `relative`, the overlay link
  gets `absolute inset-0` with an `aria-label`, and inner interactive elements get `relative z-10`.
- Stat tiles gain optional `to`/`params` props on `StatTile` in `AppShell.tsx`; when absent they
  render exactly as today.
- Verify with `tsgo` plus a preview pass on `/`, `/countries`, and `/jobs`.
