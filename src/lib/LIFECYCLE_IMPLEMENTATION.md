/**
 * Lifecycle Policy Implementation Summary
 * 
 * APPLIED FILTERS:
 * - Events: Excludes past events (end_date < today OR start_date < today)
 * - Projects: Only "planned" and "active" status visible (completed excluded)
 * - Courses: Low-confidence records excluded (neq "low")
 * - Opportunities: Already filtered by status, verification, confidence (no change needed)
 * - Publications: Verification-only filtering maintained
 */

export const LIFECYCLE_CHANGES_SUMMARY = {
  events: {
    filter: "Client-side exclusion of events with end_date < today or start_date < today",
    location: "src/lib/radar-queries.ts (eventsQuery)",
    impact: "Removes expired/past events from all event surfaces",
  },
  projects: {
    filter: 'Added .in("status", ["planned", "active"]) filter',
    locations: [
      "src/lib/radar-queries.ts (projectsQuery)",
      "src/lib/detail-queries.ts (institution projects)",
      "src/routes/sitemap[.]xml.ts",
    ],
    impact: "Hides completed projects; shows only active/planned",
  },
  courses: {
    filter: 'Added .neq("confidence", "low") filter',
    locations: [
      "src/lib/radar-queries.ts (coursesQuery)",
      "src/lib/detail-queries.ts (institution courses)",
    ],
    impact: "Excludes low-confidence courses from public view",
  },
  events_detail: {
    filter: "Added lifecycle check to exclude past events from detail view",
    location: "src/lib/relevance-queries.ts (eventDetailQuery)",
    impact: "404 on expired event detail pages; filters sibling events",
  },
  sitemap: {
    filter: "Added end_date/start_date filtering for events; status filtering for projects",
    location: "src/routes/sitemap[.]xml.ts",
    impact: "Sitemap only includes live pages",
  },
};
