import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";

import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { CategoryTabs } from "@/components/CategoryTabs";
import { countrySlug, institutionPulseQuery } from "@/lib/category-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/institutions/")({
  head: () => ({
    meta: [
      { title: "Institutions ranked by academic pulse | GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Universities, institutes and labs in photogrammetry, remote sensing and geoinformatics, ranked by live academic pulse.",
      },
      { property: "og:title", content: "Institutions ranked by academic pulse" },
      {
        property: "og:description",
        content:
          "Institutional landscape of geospatial research, sub-categorised by continent, type and activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
    ],
  }),
  component: InstitutionsPage,
});

const TYPE_TABS = [
  { key: "all", label: "All types" },
  { key: "university", label: "Universities" },
  { key: "research_institute", label: "Research institutes" },
  { key: "university_lab", label: "University labs" },
  { key: "government_agency", label: "Agencies" },
];

function InstitutionsPage() {
  const { data, isLoading, error } = useQuery(institutionPulseQuery);
  const [continent, setContinent] = useState("all");
  const [type, setType] = useState("all");
  const [activity, setActivity] = useState("all");
  const [q, setQ] = useState("");

  const rows = data ?? [];

  const continentTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of rows) counts.set(i.continent ?? "Not stated", (counts.get(i.continent ?? "Not stated") ?? 0) + 1);
    return [
      { key: "all", label: "Worldwide", count: rows.length },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, count: v })),
    ];
  }, [rows]);

  const typeTabs = useMemo(
    () =>
      TYPE_TABS.map((t) => ({
        ...t,
        count: t.key === "all" ? rows.length : rows.filter((i) => i.institution_type === t.key).length,
      })).filter((t) => t.count > 0),
    [rows],
  );

  const activityTabs = useMemo(
    () => [
      { key: "all", label: "Any activity", count: rows.length },
      { key: "hiring", label: "Hiring now", count: rows.filter((i) => i.openCalls > 0).length },
      { key: "teaching", label: "Teaching programmes", count: rows.filter((i) => i.programmes > 0).length },
      { key: "publishing", label: "Publishing (3y)", count: rows.filter((i) => i.publications > 0).length },
    ],
    [rows],
  );

  const filtered = rows.filter(
    (i) =>
      (continent === "all" || (i.continent ?? "Not stated") === continent) &&
      (type === "all" || i.institution_type === type) &&
      (activity === "all" ||
        (activity === "hiring" && i.openCalls > 0) ||
        (activity === "teaching" && i.programmes > 0) ||
        (activity === "publishing" && i.publications > 0)) &&
      (q.trim() === "" ||
        `${i.name} ${i.country ?? ""} ${i.city ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const max = filtered[0]?.pulse || 1;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Institutional landscape"
        title="Institutions"
        description="Ordered by live academic pulse — open calls, active projects, recent papers, people and taught programmes — not alphabetically. Sub-categorise by continent, type and current activity."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile label="Institutions tracked" value={rows.length} tone="signal" />
          <StatTile label="Hiring right now" value={rows.filter((i) => i.openCalls > 0).length} tone="deadline" />
          <StatTile label="With programmes" value={rows.filter((i) => i.programmes > 0).length} />
          <StatTile label="Matching filters" value={filtered.length} tone="growth" />
        </div>

        <div className="panel mt-6 space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search institution, city or country"
              className="pl-9"
            />
          </div>
          <CategoryTabs tabs={continentTabs} active={continent} onSelect={setContinent} />
          <CategoryTabs tabs={typeTabs} active={type} onSelect={setType} />
          <CategoryTabs tabs={activityTabs} active={activity} onSelect={setActivity} />
        </div>

        {error ? <p className="mt-6 text-sm text-destructive">Institutions could not be loaded.</p> : null}
        {isLoading ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((i, idx) => (
              <li key={i.id} className="panel panel-hover rise-in flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mono-num mt-0.5 text-[0.7rem] text-muted-foreground">{idx + 1}</span>
                    <Link
                      to="/institutions/$slug"
                      params={{ slug: i.slug }}
                      className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
                    >
                      {i.name}
                    </Link>
                  </div>
                  <span className="mono-num shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.62rem] text-primary">
                    {Math.round(i.pulse)}
                  </span>
                </div>

                <p className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {i.city ? `${i.city}, ` : ""}
                  {i.country ? (
                    <Link
                      to="/countries/$slug"
                      params={{ slug: countrySlug(i.country) }}
                      className="hover:text-primary"
                    >
                      {i.country}
                    </Link>
                  ) : (
                    "Location not stated"
                  )}
                  {" · "}
                  {i.institution_type.replace(/_/g, " ")}
                </p>

                <div className="mt-3 h-1 w-full rounded-full bg-muted">
                  <div
                    className="h-1 rounded-full bg-primary/70"
                    style={{ width: `${Math.max(4, (i.pulse / max) * 100)}%` }}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                  {[
                    ["Calls", i.openCalls],
                    ["Progs", i.programmes],
                    ["Projs", i.projects],
                    ["Papers", i.publications],
                    ["People", i.researchers],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-md border border-border/70 py-1.5">
                      <dd className="mono-num text-xs text-foreground">{value as number}</dd>
                      <dt className="text-[0.55rem] uppercase tracking-wider text-muted-foreground">
                        {label as string}
                      </dt>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap gap-3 text-[0.7rem]">
                  <Link
                    to="/institutions/$slug"
                    params={{ slug: i.slug }}
                    className="font-medium text-primary hover:underline"
                  >
                    On-site synopsis
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No institution matches these filters.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
