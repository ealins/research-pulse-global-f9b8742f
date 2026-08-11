import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { trendsQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Research Trends — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Topic momentum in photogrammetry, remote sensing and geoinformatics, computed from tracked publications, projects and open positions — not editorial opinion.",
      },
      { property: "og:title", content: "Research Trends — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Computed topic momentum across photogrammetry, remote sensing and geoinformatics research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrendsPage,
});

function TrendsPage() {
  const { data, isLoading, error } = useQuery(trendsQuery);

  const max = Math.max(1, ...(data ?? []).map((t) => Number(t.trend_signal ?? 0)));
  const rising = (data ?? []).filter((t) => Number(t.growth_ratio ?? 0) > 1).length;
  const computedAt = data?.[0]?.computed_at;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Computed signals"
        title="Research trends"
        description="Momentum is derived from the records in the database: publication counts over rolling windows, active projects, open positions and the number of institutions working on a topic. No topic is boosted by hand."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Topics tracked" value={data?.length ?? "—"} />
          <StatTile label="Rising topics" value={rising} tone="growth" />
          <StatTile
            label="Top signal"
            value={data?.[0]?.research_topics?.name ?? "—"}
            tone="signal"
          />
          <StatTile
            label="Computed"
            value={computedAt ? new Date(computedAt).toLocaleDateString() : "—"}
            hint="From tracked records"
          />
        </section>

        {error ? <p className="mt-6 text-sm text-destructive">Trends could not be loaded.</p> : null}

        {isLoading ? (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-8 space-y-2.5">
            {data?.map((t) => {
              const signal = Number(t.trend_signal ?? 0);
              const growth = t.growth_ratio === null ? null : Number(t.growth_ratio);
              const Icon =
                growth === null ? Minus : growth > 1.05 ? TrendingUp : growth < 0.95 ? TrendingDown : Minus;
              const tone =
                growth === null
                  ? "text-muted-foreground"
                  : growth > 1.05
                    ? "text-growth"
                    : growth < 0.95
                      ? "text-destructive"
                      : "text-muted-foreground";
              return (
                <li key={t.id} className="panel panel-hover rise-in p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                        {t.research_topics?.category ?? "Topic"}
                      </p>
                      <h2 className="mt-1 text-sm font-semibold text-foreground">
                        {t.research_topics?.name}
                      </h2>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
                      <Icon className="h-4 w-4" />
                      <span className="mono-num">
                        {growth === null ? "No baseline" : `${growth.toFixed(2)}×`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-700"
                      style={{ width: `${Math.max(4, (signal / max) * 100)}%` }}
                    />
                  </div>

                  <div className="mono-num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground sm:grid-cols-5">
                    <span>{t.pubs_last_12m} pubs / 12m</span>
                    <span>{t.pubs_prev_12m} prev 12m</span>
                    <span>{t.active_projects} projects</span>
                    <span>{t.open_opportunities} positions</span>
                    <span>{t.institutions_active} institutions</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
