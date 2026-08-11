import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Target } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, StatTile } from "@/components/layout/AppShell";
import {
  daysUntil,
  formatDate,
  opportunitiesQuery,
  STATUS_LABEL,
  TYPE_LABEL,
  topicsQuery,
} from "@/lib/radar-queries";
import { Slider } from "@/components/ui/slider";
import { CategoryTabs } from "@/components/CategoryTabs";
import { SECTOR_LABEL } from "@/lib/relevance-queries";
import { Link } from "@tanstack/react-router";

type MatchMode = "academic" | "industry";

export const Route = createFileRoute("/matcher")({
  validateSearch: (search: Record<string, unknown>): { mode: MatchMode } => ({
    mode: search["mode"] === "industry" ? "industry" : "academic",
  }),
  head: () => ({
    meta: [
      { title: "Matcher — academic & industry fit | GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Weight your interests once, then compare academic fit and industry fit across tracked geospatial positions.",
      },
      { property: "og:title", content: "Matcher — academic & industry fit" },
      {
        property: "og:description",
        content:
          "Rank open academic and industry positions against your weighted interests, with transparent arithmetic scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatcherPage,
});

const OPEN_STATUSES = new Set(["open", "closing_soon", "rolling", "possibly_open"]);

const ACADEMIC_TYPES = new Set(["phd", "doctoral_researcher", "postdoc", "research_assistant"]);

function MatcherPage() {
  const { data: topics } = useQuery(topicsQuery);
  const { data: opportunities } = useQuery(opportunitiesQuery);
  const { mode } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [openOnly, setOpenOnly] = useState(true);

  const selected = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = selected.reduce((sum, [, w]) => sum + w, 0);

  const pool = useMemo(
    () => (opportunities ?? []).filter((o) => o.sector === mode),
    [opportunities, mode],
  );

  const ranked = useMemo(() => {
    const rows = pool.filter((o) => !openOnly || OPEN_STATUSES.has(o.status));
    if (!totalWeight) return [];
    return rows
      .map((o) => {
        const slugs = new Set(
          (o.opportunity_topics ?? []).map((t) => t.research_topics?.slug).filter(Boolean),
        );
        const matched = selected.filter(([slug]) => slugs.has(slug));
        const raw = matched.reduce((sum, [, w]) => sum + w, 0);
        // Academic fit rewards research-track roles; industry fit rewards named employers
        // and stated seniority, since those signal a real production role.
        const bonus =
          mode === "academic"
            ? (ACADEMIC_TYPES.has(o.opportunity_type) ? 0.08 : 0) +
              (o.supervisor_name ? 0.04 : 0)
            : (o.employer_name ? 0.06 : 0) + (o.seniority ? 0.06 : 0);
        const fit = Math.min(100, Math.round((raw / totalWeight) * 100 * (1 + bonus)));
        return { o, fit, matched: matched.map(([slug]) => slug) };
      })
      .filter((r) => r.fit > 0)
      .sort((a, b) => b.fit - a.fit || (daysUntil(a.o.application_deadline) ?? 999) - (daysUntil(b.o.application_deadline) ?? 999));
  }, [pool, openOnly, selected, totalWeight, mode]);

  const topicName = (slug: string) => topics?.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Personal fit"
        title="Matcher"
        description="Set a weight for each interest once, then compare two career tracks. Positions are ranked by the share of your weighted interests they actually cover, with a small track-specific bonus — arithmetic on tracked topic links, not a hidden model."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <CategoryTabs
          className="mb-6"
          tabs={[
            {
              key: "academic",
              label: "Academic fit",
              count: (opportunities ?? []).filter((o) => o.sector === "academic").length,
            },
            {
              key: "industry",
              label: "Industry fit",
              count: (opportunities ?? []).filter((o) => o.sector === "industry").length,
            },
          ]}
          active={mode}
          onSelect={(key) => navigate({ search: { mode: key as MatchMode } })}
        />
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Interests weighted" value={selected.length} tone="signal" />
          <StatTile label="Weight total" value={totalWeight} />
          <StatTile
            label={mode === "academic" ? "Academic calls matched" : "Industry roles matched"}
            value={ranked.length}
            tone="growth"
          />
          <StatTile
            label="Best fit"
            value={ranked[0] ? `${ranked[0].fit}%` : "—"}
            hint="Share of weighted interests covered"
          />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
          <aside className="panel h-fit p-5">
            <h2 className="font-display text-sm font-semibold text-foreground">
              Weight your interests
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              0 means ignore. Higher weights pull matching positions up the list.
            </p>
            <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Only live calls
            </label>
            <ul className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
              {topics?.map((t) => {
                const value = weights[t.slug] ?? 0;
                return (
                  <li key={t.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs ${value > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {t.name}
                      </span>
                      <span className="mono-num text-[0.7rem] text-primary">{value}</span>
                    </div>
                    <Slider
                      className="mt-2"
                      min={0}
                      max={5}
                      step={1}
                      value={[value]}
                      onValueChange={([v]) =>
                        setWeights((w) => ({ ...w, [t.slug]: v ?? 0 }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </aside>

          <div>
            {!totalWeight ? (
              <div className="panel flex flex-col items-center justify-center gap-3 p-14 text-center">
                <Target className="h-7 w-7 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Give at least one interest a weight above zero to see ranked positions.
                </p>
              </div>
            ) : ranked.length === 0 ? (
              <div className="panel p-14 text-center text-sm text-muted-foreground">
                No tracked {mode === "academic" ? "academic call" : "industry role"} covers those
                interests right now. Widen your weights, switch track, or turn off “only live
                calls”.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {ranked.map(({ o, fit, matched }) => {
                  const days = daysUntil(o.application_deadline);
                  return (
                    <li key={o.id} className="panel panel-hover rise-in p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-wider">
                            <span className="rounded-full border border-primary/40 bg-primary/12 px-2.5 py-0.5 text-primary">
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                            <span className="text-muted-foreground">
                              {TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type}
                            </span>
                            <span className="text-signal">{SECTOR_LABEL[o.sector] ?? o.sector}</span>
                            {o.seniority ? (
                              <span className="text-muted-foreground">{o.seniority}</span>
                            ) : null}
                          </div>
                          <Link
                            to="/jobs/$slug"
                            params={{ slug: o.slug }}
                            className="mt-2 block text-[0.95rem] font-semibold text-foreground hover:text-primary"
                          >
                            {o.title}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {o.institutions?.name ?? o.employer_name ?? "Employer not stated"} ·{" "}
                            {[o.city, o.country].filter(Boolean).join(", ") || "Location not stated"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="mono-num font-display text-2xl font-semibold text-primary">
                            {fit}%
                          </p>
                          <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                            interest fit
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{ width: `${fit}%` }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {matched.map((slug) => (
                          <span
                            key={slug}
                            className="rounded-md border border-growth/40 bg-growth/10 px-2 py-0.5 text-[0.65rem] text-growth"
                          >
                            {topicName(slug)}
                          </span>
                        ))}
                      </div>

                      <div className="mono-num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.7rem] text-muted-foreground">
                        <span>
                          Deadline: {formatDate(o.application_deadline)}
                          {days !== null && days >= 0 ? ` (${days} d left)` : ""}
                        </span>
                        <span>
                          {mode === "academic"
                            ? (o.supervisor_name ?? "Supervisor not stated")
                            : (o.employer_name ?? "Employer not stated")}
                        </span>
                        <span>{o.funding_type ?? "Funding not stated"}</span>
                      </div>

                      <div className="mt-3.5 flex flex-wrap items-center gap-3">
                        <ProvenanceChips
                          verification={o.verification_status}
                          confidence={o.confidence}
                          isDemo={o.is_demo}
                        />
                        {o.application_url ? (
                          <a
                            href={o.application_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Apply via source <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
