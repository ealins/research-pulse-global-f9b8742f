import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Tags } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { topicsQuery, trendsQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/topics/")({
  head: () => ({
    meta: [
      { title: "Topic taxonomy — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Photogrammetry, remote sensing and geoinformatics topics with definitions, grouped by category and linked to live activity.",
      },
      { property: "og:title", content: "Topic taxonomy — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Defined research topics used to classify positions, projects, publications and people across the geospatial domain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TopicsPage,
});

function TopicsPage() {
  const { data: topics, isLoading } = useQuery(topicsQuery);
  const { data: trends } = useQuery(trendsQuery);
  const [q, setQ] = useState("");

  const activity = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of trends ?? []) {
      const slug = (t as any).research_topics?.slug;
      if (slug) map.set(slug, t);
    }
    return map;
  }, [trends]);

  const grouped = useMemo(() => {
    const filtered = (topics ?? []).filter((t) =>
      q.trim() ? `${t.name} ${t.description ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true,
    );
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const key = t.category ?? "Uncategorised";
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [topics, q]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Vocabulary"
        title="Topic taxonomy"
        description="Every record in the platform is classified against this list. Definitions are stated so that a count of 'GeoAI positions' means something specific rather than whatever a keyword happened to match."
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter topics…"
            className="w-56 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          grouped.map(([category, list]) => (
            <section key={category} className="mb-10">
              <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Tags className="h-3.5 w-3.5" /> {category}
                <span className="mono-num text-muted-foreground/70">{list.length}</span>
              </h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {list.map((t) => {
                  const a = activity.get(t.slug);
                  return (
                    <Link
                      key={t.id}
                      to="/topics/$slug"
                      params={{ slug: t.slug }}
                      className="panel panel-hover p-4"
                    >
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {t.description ?? "No definition recorded yet."}
                      </p>
                      {a ? (
                        <p className="mono-num mt-3 text-[0.62rem] text-muted-foreground">
                          {a.pubs_last_12m} papers/12m · {a.active_projects} projects ·{" "}
                          {a.open_opportunities} open calls
                        </p>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
