import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { CategoryTabs } from "@/components/CategoryTabs";
import { countriesRollupQuery } from "@/lib/category-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/countries/")({
  head: () => ({
    meta: [
      { title: "Countries — Academic capacity by nation | GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Browse photogrammetry, remote sensing and geoinformatics research capacity country by country: institutions, live PhD calls, degree programmes and projects.",
      },
      { property: "og:title", content: "Academic capacity by country — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Country-level synopsis of institutions, open calls, programmes and projects in geospatial research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
    ],
  }),
  component: CountriesPage,
});

function CountriesPage() {
  const { data, isLoading, error } = useQuery(countriesRollupQuery);
  const [continent, setContinent] = useState("all");

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of data ?? []) counts.set(c.continent, (counts.get(c.continent) ?? 0) + 1);
    return [
      { key: "all", label: "All continents", count: data?.length ?? 0 },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ key: k, label: k, count: v })),
    ];
  }, [data]);

  const rows = (data ?? []).filter((c) => continent === "all" || c.continent === continent);
  const max = rows[0]?.pulse || 1;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Geography of the field"
        title="Countries"
        description="Every tracked country as a one-page entry point: which institutions carry the pulse, what is open to apply for right now, and which programmes and projects sit behind it."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <CategoryTabs tabs={tabs} active={continent} onSelect={setContinent} className="mb-6" />
        {error ? <p className="text-sm text-destructive">Country rollup could not be loaded.</p> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <li key={c.slug} className="panel panel-hover rise-in p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/countries/$slug"
                    params={{ slug: c.slug }}
                    className="font-display text-base font-semibold text-foreground hover:text-primary"
                  >
                    {c.country}
                  </Link>
                  <span className="mono-num rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] text-primary">
                    pulse {Math.round(c.pulse)}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  <Globe2 className="h-3 w-3" /> {c.continent}
                </p>
                <div className="mt-3 h-1 w-full rounded-full bg-muted">
                  <div
                    className="h-1 rounded-full bg-primary/70"
                    style={{ width: `${Math.max(4, (c.pulse / max) * 100)}%` }}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Institutions", c.institutions],
                    ["Open calls", c.openCalls],
                    ["Programmes", c.programmes],
                    ["Projects", c.projects],
                    ["Papers 3y", c.publications],
                    ["Researchers", c.researchers],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-md border border-border/70 py-1.5">
                      <dd className="mono-num text-sm text-foreground">{value as number}</dd>
                      <dt className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                        {label as string}
                      </dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 line-clamp-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                  {c.topInstitutions.map((i) => i.name).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
