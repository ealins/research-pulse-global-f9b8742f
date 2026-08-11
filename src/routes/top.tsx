import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Briefcase, CalendarDays, GraduationCap, TrendingUp } from "lucide-react";

import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { KIND_LABEL, topPicksQuery } from "@/lib/relevance-queries";
import { countriesRollupQuery, degreeLabel } from "@/lib/category-queries";
import { formatDate, daysUntil, STATUS_LABEL, TYPE_LABEL } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/top")({
  head: () => ({
    meta: [
      { title: "Top picks right now — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "The most relevant things in photogrammetry, remote sensing and geoinformatics this week: top academic and industry positions, fastest-growing research areas, strongest master's programmes and nearest deadlines.",
      },
      { property: "og:title", content: "Top picks right now — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "A curated shortlist of the most relevant positions, research areas, programmes and deadlines in the geospatial research domain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TopPage,
});

function Block({
  icon: Icon,
  title,
  hint,
  to,
  children,
}: {
  icon: typeof Briefcase;
  title: string;
  hint: string;
  to: { label: string; el: React.ReactNode };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Icon className="h-4 w-4 text-primary" /> {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        {to.el}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SeeAll({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
      {children} <ArrowUpRight className="h-3.5 w-3.5" />
    </span>
  );
}

function TopPage() {
  const { data, isLoading } = useQuery(topPicksQuery);
  const { data: countries } = useQuery(countriesRollupQuery);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-7xl space-y-3 p-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  const academic = data?.academicJobs ?? [];
  const industry = data?.industryJobs ?? [];
  const areas = data?.areas ?? [];
  const courses = data?.courses ?? [];
  const events = data?.events ?? [];
  const topCountries = (countries ?? []).slice(0, 8);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Relevance first"
        title="Top picks right now"
        description="Not an archive — a shortlist. The nearest academic and industry deadlines, the research areas gaining the most momentum, the programmes attached to the busiest labs, and the next submission dates."
      />
      <div className="mx-auto w-full max-w-7xl px-6 pb-14 pt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Academic calls shortlisted" value={academic.length} tone="signal" />
          <StatTile label="Industry roles shortlisted" value={industry.length} tone="growth" />
          <StatTile label="Rising research areas" value={areas.length} />
          <StatTile label="Deadlines this quarter" value={events.length} tone="deadline" />
        </div>

        <Block
          icon={Briefcase}
          title="Top academic positions"
          hint="Live doctoral, postdoc and research staff calls with the nearest deadlines."
          to={{
            label: "jobs",
            el: (
              <Link to="/jobs" search={{ sector: "academic" }}>
                <SeeAll>All academic jobs</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {academic.map((j) => {
              const d = daysUntil(j.application_deadline);
              return (
                <li key={j.id} className="panel panel-hover p-4">
                  <Link
                    to="/jobs/$slug"
                    params={{ slug: j.slug }}
                    className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
                  >
                    {j.title}
                  </Link>
                  <p className="mt-1 text-[0.72rem] text-muted-foreground">
                    {j.institutions?.name ?? j.employer_name ?? "Institution not stated"} ·{" "}
                    {TYPE_LABEL[j.opportunity_type] ?? j.opportunity_type} ·{" "}
                    {STATUS_LABEL[j.status] ?? j.status}
                  </p>
                  <p className="mono-num mt-1.5 text-[0.7rem] text-deadline">
                    {formatDate(j.application_deadline)}
                    {d !== null && d >= 0 ? ` · ${d} days left` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block
          icon={Briefcase}
          title="Top industry roles"
          hint="Positions at mapping, satellite and geospatial software employers."
          to={{
            label: "industry",
            el: (
              <Link to="/jobs" search={{ sector: "industry" }}>
                <SeeAll>All industry roles</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {industry.map((j) => (
              <li key={j.id} className="panel panel-hover p-4">
                <Link
                  to="/jobs/$slug"
                  params={{ slug: j.slug }}
                  className="text-sm font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {j.title}
                </Link>
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  {j.employer_name ?? j.institutions?.name ?? "Employer not stated"} ·{" "}
                  {j.seniority ?? "Level not stated"} · {j.country ?? "Location not stated"}
                </p>
                <p className="mono-num mt-1.5 text-[0.7rem] text-deadline">
                  {formatDate(j.application_deadline)}
                </p>
              </li>
            ))}
          </ul>
        </Block>

        <Block
          icon={TrendingUp}
          title="Top research areas"
          hint="Ranked by the trend signal computed from publications, projects and open calls."
          to={{
            label: "trends",
            el: (
              <Link to="/trends">
                <SeeAll>Full trend table</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {areas.map((a, i) =>
              a.research_topics ? (
                <li key={a.research_topics.slug} className="panel panel-hover p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/topics/$slug"
                      params={{ slug: a.research_topics.slug }}
                      className="text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {a.research_topics.name}
                    </Link>
                    <span className="mono-num text-xs text-muted-foreground">#{i + 1}</span>
                  </div>
                  <p className="mono-num mt-2 text-lg font-semibold text-signal">
                    {Number(a.trend_signal ?? 0).toFixed(1)}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    {a.pubs_last_12m} papers (12m) · {a.open_opportunities} calls ·{" "}
                    {a.active_projects} projects
                  </p>
                </li>
              ) : null,
            )}
          </ul>
        </Block>

        <Block
          icon={GraduationCap}
          title="Top programmes to study"
          hint="Master's, engineering and doctoral programmes hosted by the labs with the most live activity."
          to={{
            label: "programmes",
            el: (
              <Link to="/programmes">
                <SeeAll>Full catalogue</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id} className="panel panel-hover p-4">
                <Link
                  to="/programmes/$slug"
                  params={{ slug: c.slug }}
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  {c.title}
                </Link>
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  {degreeLabel(c.degree_type)} · {c.institutions?.name ?? "Institution not stated"} ·{" "}
                  {c.institutions?.country ?? "Country not stated"}
                </p>
                <p className="mono-num mt-1.5 text-[0.68rem] text-muted-foreground">
                  {c.language ?? "Language not stated"} · {c.duration ?? "Duration not stated"} ·{" "}
                  {c.hostCalls} live calls at host
                </p>
              </li>
            ))}
          </ul>
        </Block>

        <Block
          icon={CalendarDays}
          title="Next deadlines and events"
          hint="Upcoming conferences, schools and workshops with published dates."
          to={{
            label: "events",
            el: (
              <Link to="/events">
                <SeeAll>Full calendar</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 lg:grid-cols-3">
            {events.map((e) => (
              <li key={e.id} className="panel panel-hover p-4">
                <Link
                  to="/events/$slug"
                  params={{ slug: e.slug }}
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  {e.title}
                </Link>
                <p className="mono-num mt-1.5 text-[0.7rem] text-muted-foreground">
                  {KIND_LABEL[e.event_kind] ?? e.event_kind} · {formatDate(e.start_date)} ·{" "}
                  {e.location ?? "Location not stated"}
                </p>
                <p className="mono-num mt-1 text-[0.68rem] text-deadline">
                  Abstracts {formatDate(e.abstract_deadline)}
                </p>
              </li>
            ))}
          </ul>
        </Block>

        <Block
          icon={TrendingUp}
          title="Top countries by academic pulse"
          hint="Where the tracked activity actually concentrates."
          to={{
            label: "countries",
            el: (
              <Link to="/countries">
                <SeeAll>All countries</SeeAll>
              </Link>
            ),
          }}
        >
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {topCountries.map((c, i) => (
              <li key={c.slug} className="panel panel-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/countries/$slug"
                    params={{ slug: c.slug }}
                    className="text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {c.country}
                  </Link>
                  <span className="mono-num text-xs text-muted-foreground">#{i + 1}</span>
                </div>
                <p className="mono-num mt-2 text-lg font-semibold text-primary">
                  {Math.round(c.pulse)}
                </p>
                <p className="mt-1 text-[0.68rem] text-muted-foreground">
                  {c.institutions} institutions · {c.openCalls} calls · {c.programmes} programmes
                </p>
              </li>
            ))}
          </ul>
        </Block>
      </div>
    </AppShell>
  );
}
