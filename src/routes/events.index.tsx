import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Repeat } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, StatTile, TopicPills } from "@/components/layout/AppShell";
import { CategoryTabs } from "@/components/CategoryTabs";
import { eventsQuery, formatDate, daysUntil } from "@/lib/radar-queries";
import { KIND_LABEL } from "@/lib/relevance-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Conferences, schools & deadlines — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Conferences, summer schools and workshops in photogrammetry, remote sensing and geoinformatics, grouped by kind with abstract deadlines and official links.",
      },
      { property: "og:title", content: "Conferences, schools & deadlines" },
      {
        property: "og:description",
        content:
          "Event calendar for photogrammetry, remote sensing and geoinformatics, grouped by conference, school and workshop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { data, isLoading, error } = useQuery(eventsQuery);
  const [kind, setKind] = useState("all");
  const [country, setCountry] = useState("all");

  const kinds = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data ?? []) map.set(e.event_kind, (map.get(e.event_kind) ?? 0) + 1);
    return [
      { key: "all", label: "All kinds", count: data?.length ?? 0 },
      ...[...map.entries()].map(([k, c]) => ({ key: k, label: KIND_LABEL[k] ?? k, count: c })),
    ];
  }, [data]);

  const countries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data ?? []) if (e.country) map.set(e.country, (map.get(e.country) ?? 0) + 1);
    return [
      { key: "all", label: "Everywhere" },
      ...[...map.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ key: c, label: c, count: n })),
    ];
  }, [data]);

  const rows = (data ?? []).filter(
    (e) => (kind === "all" || e.event_kind === kind) && (country === "all" || e.country === country),
  );

  const upcoming = (data ?? []).filter((e) => (daysUntil(e.start_date) ?? -1) >= 0).length;
  const openCfp = (data ?? []).filter((e) => (daysUntil(e.abstract_deadline) ?? -1) >= 0).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Calendar"
        title="Conferences, schools & deadlines"
        description="Congresses, summer schools, colloquia and workshops in the field, grouped by kind. Dates are only shown when the organiser has published them."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Tracked events" value={data?.length ?? "—"} />
          <StatTile label="Upcoming" value={upcoming} tone="signal" />
          <StatTile label="Open calls for papers" value={openCfp} tone="deadline" />
          <StatTile label="Countries" value={Math.max(countries.length - 1, 0)} />
        </section>

        <div className="mt-6 space-y-2">
          <CategoryTabs tabs={kinds} active={kind} onSelect={setKind} />
          <CategoryTabs tabs={countries.slice(0, 14)} active={country} onSelect={setCountry} />
        </div>

        {error ? <p className="mt-6 text-sm text-destructive">Events could not be loaded.</p> : null}
        {isLoading ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {rows.map((e) => (
              <li key={e.id} className="panel panel-hover rise-in flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/40 bg-primary/12 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-primary">
                    {KIND_LABEL[e.event_kind] ?? e.event_kind}
                  </span>
                  <span className="rounded-full border border-signal/40 bg-signal/12 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-signal">
                    {e.organization ?? "Organiser not stated"}
                  </span>
                  {e.recurrence ? (
                    <span className="inline-flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                      <Repeat className="h-3 w-3" /> {e.recurrence}
                    </span>
                  ) : null}
                </div>
                <Link
                  to="/events/$slug"
                  params={{ slug: e.slug }}
                  className="mt-2.5 text-base font-semibold text-foreground hover:text-primary"
                >
                  {e.title}
                </Link>
                {e.summary ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                    {e.summary}
                  </p>
                ) : null}
                <div className="mono-num mt-3 grid grid-cols-2 gap-2 text-[0.7rem] text-muted-foreground">
                  <span>Next date: {formatDate(e.start_date)}</span>
                  <span>Abstracts: {formatDate(e.abstract_deadline)}</span>
                  <span>Papers: {formatDate(e.paper_deadline)}</span>
                  <span>{e.location ?? "Location not stated"}</span>
                </div>
                <div className="mt-3">
                  <TopicPills topics={(e.event_topics ?? []).map((t) => t.research_topics?.name)} />
                </div>
                <div className="mt-auto pt-4">
                  <ProvenanceChips verification={e.verification_status} isDemo={e.is_demo} />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <Link
                      to="/events/$slug"
                      params={{ slug: e.slug }}
                      className="text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open synopsis
                    </Link>
                    {e.website ? (
                      <a
                        href={e.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      >
                        Official page <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No events match these filters.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
