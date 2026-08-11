import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, FlaskConical, ScrollText, Briefcase, CalendarDays } from "lucide-react";

import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { topicDetailQuery } from "@/lib/detail-queries";
import { STATUS_LABEL, TYPE_LABEL, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/topics/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Topic dossier — GeoAcademic Radar` },
      {
        name: "description",
        content:
          "Topic dossier: definition, momentum, leading institutions, active researchers, projects, publications and open positions for this geospatial research area.",
      },
      { property: "og:title", content: "Topic dossier — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Who works on this topic, where, with what funding, and which positions are open right now.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TopicDetail,
});

function TopicDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(topicDetailQuery(slug));

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-10">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Not found"
          title="No such topic"
          description="This topic is not part of the controlled vocabulary."
        />
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <Link to="/topics" className="text-sm text-primary hover:underline">
            ← Back to the taxonomy
          </Link>
        </div>
      </AppShell>
    );
  }

  const m: any = data.momentum;
  const live = data.opportunities.filter((o: any) =>
    ["open", "closing_soon", "rolling", "possibly_open"].includes(o.status),
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow={data.topic.category ?? "Topic"}
        title={data.topic.name}
        description={
          data.topic.description ??
          "No definition recorded yet. Counts below reflect records explicitly classified against this topic."
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile
            label="Papers last 12m"
            value={m?.pubs_last_12m ?? data.publications.length}
            tone="signal"
            hint={m ? `previous 12m: ${m.pubs_prev_12m}` : "from held records"}
          />
          <StatTile
            label="Growth ratio"
            value={m?.growth_ratio != null ? Number(m.growth_ratio).toFixed(2) : "n/a"}
            tone="growth"
            hint="last 12m ÷ previous 12m"
          />
          <StatTile label="Open calls" value={live.length} tone="deadline" />
          <StatTile
            label="Institutions active"
            value={m?.institutions_active ?? data.institutions.length}
          />
        </div>
        {m ? (
          <p className="mono-num mt-3 text-[0.65rem] text-muted-foreground">
            Momentum recomputed {formatDate(String(m.computed_at).slice(0, 10))} ·{" "}
            <Link to="/methodology" className="text-primary hover:underline">
              how this is calculated
            </Link>
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" /> Open positions
            </h2>
            {live.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No live calls classified here.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {live.map((o: any) => (
                  <li key={o.id} className="panel panel-hover p-3">
                    <Link
                      to="/jobs/$slug"
                      params={{ slug: o.slug }}
                      className="text-sm text-foreground hover:text-primary"
                    >
                      {o.title}
                    </Link>
                    <p className="mt-1 text-[0.68rem] text-muted-foreground">
                      {o.institutions?.name ?? "Institution not recorded"} ·{" "}
                      {TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type} ·{" "}
                      {STATUS_LABEL[o.status] ?? o.status} · {formatDate(o.application_deadline)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Leading institutions
            </h2>
            <ul className="mt-3 space-y-2">
              {data.institutions.map((i: any) => (
                <li key={i.id} className="panel panel-hover flex items-center gap-3 p-3">
                  <Link
                    to="/institutions/$slug"
                    params={{ slug: i.slug }}
                    className="flex-1 text-sm text-foreground hover:text-primary"
                  >
                    {i.name}
                  </Link>
                  <span className="mono-num text-[0.68rem] text-muted-foreground">
                    {i.country ?? ""} · w{Number(i.weight).toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Researchers
            </h2>
            <ul className="mt-3 space-y-2">
              {data.researchers.map((r: any) => (
                <li key={r.id} className="panel panel-hover p-3">
                  <Link
                    to="/researchers/$slug"
                    params={{ slug: r.slug }}
                    className="text-sm text-foreground hover:text-primary"
                  >
                    {r.full_name}
                  </Link>
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    {[r.current_position, r.institutions?.name].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" /> Projects
            </h2>
            <ul className="mt-3 space-y-2">
              {data.projects.map((p: any) => (
                <li key={p.id} className="panel p-3 text-xs">
                  <p className="text-sm text-foreground">
                    {p.acronym ? `${p.acronym} — ` : ""}
                    {p.name}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {[p.status, p.funding_organization].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5" /> Publications
            </h2>
            <ul className="mt-3 space-y-2">
              {data.publications.slice(0, 20).map((p: any) => (
                <li key={p.id} className="panel p-3">
                  <p className="text-sm leading-snug text-foreground">{p.title}</p>
                  <p className="mono-num mt-1 text-[0.68rem] text-muted-foreground">
                    {[p.venue, p.year].filter(Boolean).join(" · ")}
                    {p.citation_count != null ? ` · ${p.citation_count} citations` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Events
            </h2>
            <ul className="mt-3 space-y-2">
              {data.events.map((e: any) => (
                <li key={e.id} className="panel p-3 text-xs">
                  <p className="text-sm text-foreground">{e.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    {[e.location, formatDate(e.start_date)].filter(Boolean).join(" · ")}
                    {e.abstract_deadline
                      ? ` · abstracts ${formatDate(e.abstract_deadline)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
