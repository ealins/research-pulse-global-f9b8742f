import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, GraduationCap } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, StatTile } from "@/components/layout/AppShell";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { countrySlug, degreeLabel, programmeDetailQuery } from "@/lib/category-queries";
import { STATUS_LABEL, TYPE_LABEL, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/programmes/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    return {
      meta: [
        { title: `${pretty} — Programme synopsis | GeoAcademic Radar` },
        {
          name: "description",
          content: `On-site synopsis of the ${pretty} programme: level, language, duration, research topics, host institution and related PhD calls.`,
        },
        { property: "og:title", content: `${pretty} — Programme synopsis` },
        {
          property: "og:description",
          content: `Structured summary of a geospatial degree programme with provenance and related opportunities.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProgrammeDetail,
  errorComponent: () => (
    <AppShell>
      <div className="p-8 text-sm text-destructive">This programme could not be loaded.</div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-sm text-muted-foreground">No such programme is tracked.</div>
    </AppShell>
  ),
});

function ProgrammeDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(programmeDetailQuery(slug));

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-6xl space-y-3 p-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">
          Programme not found.{" "}
          <Link to="/programmes" className="text-primary hover:underline">
            Back to the catalogue
          </Link>
        </div>
      </AppShell>
    );
  }

  const c = data.course;
  const inst = c.institutions;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${degreeLabel(c.degree_type)} · ${data.family}`}
        title={c.title}
        description={
          inst
            ? `${inst.name}${inst.city ? `, ${inst.city}` : ""}${inst.country ? ` — ${inst.country}` : ""}`
            : "Host institution not stated"
        }
        actions={<EvidenceDrawer entityType="course" entityId={c.id} title={c.title} />}
      />

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatTile label="Level" value={c.degree_type ?? "Not stated"} tone="signal" />
          <StatTile label="Language" value={c.language ?? "Not stated"} />
          <StatTile label="Duration" value={c.duration ?? "Not stated"} />
          <StatTile label="Open calls at host" value={data.calls.length} tone="deadline" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <section className="panel p-5">
              <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Synopsis
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">
                {c.summary ??
                  "No summary has been recorded for this programme yet. Nothing is inferred — read the official programme page."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ProvenanceChips verification={c.verification_status} isDemo={c.is_demo} />
                <span className="mono-num text-[0.68rem] text-muted-foreground">
                  {c.last_verified_at
                    ? `Last verified ${formatDate(c.last_verified_at)}`
                    : "Not verified against the official page yet"}
                </span>
              </div>
              {(c.website || inst?.official_url) ? (
                <a
                  href={c.website ?? inst?.official_url ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Official page <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </section>

            <section className="panel p-5">
              <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Research topics covered
              </h2>
              {(c.course_topics ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No topics linked yet.</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(c.course_topics ?? []).map((t) =>
                    t.research_topics ? (
                      <li key={t.research_topics.slug} className="rounded-md border border-border/70 p-3">
                        <Link
                          to="/topics/$slug"
                          params={{ slug: t.research_topics.slug }}
                          className="text-sm font-medium text-foreground hover:text-primary"
                        >
                          {t.research_topics.name}
                        </Link>
                        {t.research_topics.category ? (
                          <p className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                            {t.research_topics.category}
                          </p>
                        ) : null}
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </section>

            {data.projects.length > 0 ? (
              <section className="panel p-5">
                <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Research you could join at this institution
                </h2>
                <ul className="mt-3 space-y-2">
                  {data.projects.map((p) => (
                    <li key={p.id} className="rounded-md border border-border/70 p-3">
                      <Link
                        to="/projects/$slug"
                        params={{ slug: p.slug }}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {p.name}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-[0.72rem] text-muted-foreground">
                        {p.summary ?? p.status}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            {inst ? (
              <section className="panel p-5">
                <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Host institution
                </h2>
                <Link
                  to="/institutions/$slug"
                  params={{ slug: inst.slug }}
                  className="mt-2 block text-sm font-semibold text-foreground hover:text-primary"
                >
                  {inst.name}
                </Link>
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  {inst.city ? `${inst.city}, ` : ""}
                  {inst.country ? (
                    <Link
                      to="/countries/$slug"
                      params={{ slug: countrySlug(inst.country) }}
                      className="hover:text-primary"
                    >
                      {inst.country}
                    </Link>
                  ) : null}
                </p>
                {c.departments?.name ? (
                  <p className="mt-2 text-[0.72rem] text-muted-foreground">
                    Department: {c.departments.name}
                  </p>
                ) : null}
                {inst.description ? (
                  <p className="mt-3 line-clamp-5 text-[0.75rem] leading-relaxed text-foreground/80">
                    {inst.description}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="panel p-5">
              <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Live calls at this institution
              </h2>
              {data.calls.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing open right now.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.calls.map((o) => (
                    <li key={o.id} className="rounded-md border border-border/70 p-3">
                      <Link
                        to="/jobs/$slug"
                        params={{ slug: o.slug }}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {o.title}
                      </Link>
                      <p className="mono-num mt-1 text-[0.68rem] text-muted-foreground">
                        {TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type} ·{" "}
                        {STATUS_LABEL[o.status] ?? o.status} ·{" "}
                        {o.application_deadline ? formatDate(o.application_deadline) : "rolling"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.siblings.length > 0 ? (
              <section className="panel p-5">
                <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" /> Other programmes here
                </h2>
                <ul className="mt-3 space-y-2">
                  {data.siblings.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/programmes/$slug"
                        params={{ slug: s.slug }}
                        className="text-sm text-foreground/85 hover:text-primary"
                      >
                        {s.title}
                      </Link>
                      <p className="mono-num text-[0.65rem] text-muted-foreground">
                        {s.degree_type} · {s.language ?? "n/a"} · {s.duration ?? "n/a"}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
