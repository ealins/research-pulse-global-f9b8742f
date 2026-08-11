import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Building2, Users, FlaskConical, ScrollText, GraduationCap, Briefcase } from "lucide-react";

import { AppShell, PageHeader, StatTile, TopicPills } from "@/components/layout/AppShell";
import { EvidenceDrawer, staleness } from "@/components/EvidenceDrawer";
import { institutionDetailQuery } from "@/lib/detail-queries";
import { STATUS_LABEL, TYPE_LABEL, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/institutions/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${pretty} — Institution profile — GeoAcademic Radar` },
        {
          name: "description",
          content: `${pretty}: departments, people, funded projects, publications, taught programmes and open geospatial positions.`,
        },
        { property: "og:title", content: `${pretty} — Institution profile` },
        {
          property: "og:description",
          content: `Departments, people, projects, publications and open positions at ${pretty}, each with source provenance.`,
        },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: InstitutionDetail,
});

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Users;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
        <span className="mono-num text-muted-foreground/70">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nothing recorded yet. Absence here means we have no sourced record — not that none exists.
        </p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );
}

function InstitutionDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(institutionDetailQuery(slug));

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
          title="No such institution record"
          description="We hold no record under this identifier. It may have been merged into another entry."
        />
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <Link to="/institutions" className="text-sm text-primary hover:underline">
            ← Back to institutions
          </Link>
        </div>
      </AppShell>
    );
  }

  const i = data.institution;
  const fresh = staleness(i.last_verified_at);
  const topics = (i.institution_topics ?? []).map((t: any) => t.research_topics?.name);
  const liveJobs = data.opportunities.filter((o: any) =>
    ["open", "closing_soon", "rolling", "possibly_open"].includes(o.status),
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow={[i.city, i.country].filter(Boolean).join(" · ") || "Institution"}
        title={i.name}
        description={
          i.description ??
          "No institutional description recorded. Use the official links below as the authoritative source."
        }
        actions={
          <div className="flex flex-col items-end gap-2">
            <EvidenceDrawer
              entityType="institution"
              entityId={i.id}
              title={i.name}
              verification={i.verification_status}
              lastVerified={i.last_verified_at}
              isDemo={i.is_demo}
            />
            <span className={`text-[0.68rem] ${fresh.tone}`}>{fresh.label}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          {i.official_url ? (
            <a
              href={i.official_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Official site
            </a>
          ) : null}
          {i.research_url ? (
            <a
              href={i.research_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Research pages
            </a>
          ) : null}
          {i.careers_url ? (
            <a
              href={i.careers_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <Briefcase className="h-3.5 w-3.5" /> Careers page
            </a>
          ) : null}
          {i.institution_identifier ? (
            <span className="mono-num rounded-md border border-border bg-muted/40 px-2 py-1 text-[0.65rem] text-muted-foreground">
              ROR {i.institution_identifier}
            </span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <StatTile label="Live positions" value={liveJobs.length} tone="growth" />
          <StatTile label="Researchers" value={data.researchers.length} tone="signal" />
          <StatTile label="Projects" value={data.projects.length} />
          <StatTile label="Publications held" value={data.publications.length} />
        </div>

        {topics.length ? (
          <div className="mt-6">
            <TopicPills topics={topics} />
          </div>
        ) : null}

        <Section title="Open positions" icon={Briefcase} count={liveJobs.length}>
          <ul className="space-y-2">
            {liveJobs.map((o: any) => (
              <li key={o.id} className="panel panel-hover flex flex-wrap items-center gap-3 p-3">
                <Link
                  to="/jobs/$slug"
                  params={{ slug: o.slug }}
                  className="flex-1 text-sm text-foreground hover:text-primary"
                >
                  {o.title}
                </Link>
                <span className="text-[0.68rem] text-muted-foreground">
                  {TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type} ·{" "}
                  {STATUS_LABEL[o.status] ?? o.status} · deadline{" "}
                  {formatDate(o.application_deadline)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Departments & groups" icon={Building2} count={data.departments.length + data.groups.length}>
          <div className="grid gap-2 md:grid-cols-2">
            {[...data.departments, ...data.groups].map((d: any) => (
              <div key={d.id} className="panel p-3">
                <p className="text-sm text-foreground">{d.name}</p>
                {d.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {d.description}
                  </p>
                ) : null}
                {d.website ? (
                  <a
                    href={d.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-[0.68rem] text-primary hover:underline"
                  >
                    Official page
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Section>

        <Section title="People" icon={Users} count={data.researchers.length}>
          <div className="grid gap-2 md:grid-cols-2">
            {data.researchers.map((r: any) => (
              <Link
                key={r.id}
                to="/researchers/$slug"
                params={{ slug: r.slug }}
                className="panel panel-hover p-3"
              >
                <p className="text-sm text-foreground">
                  {r.academic_title ? `${r.academic_title} ` : ""}
                  {r.full_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.current_position ?? "Position not recorded"}
                </p>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Funded projects" icon={FlaskConical} count={data.projects.length}>
          <ul className="space-y-2">
            {data.projects.map((p: any) => (
              <li key={p.id} className="panel panel-hover p-3">
                <Link
                  to="/projects/$slug"
                  params={{ slug: p.slug }}
                  className="block text-sm text-foreground hover:text-primary"
                >
                  {p.acronym ? `${p.acronym} — ` : ""}
                  {p.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.status} · {formatDate(p.start_date)} → {formatDate(p.end_date)}
                  {p.funding_organization ? ` · ${p.funding_organization}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Taught programmes" icon={GraduationCap} count={data.courses.length}>
          <div className="grid gap-2 md:grid-cols-2">
            {data.courses.map((c: any) => (
              <div key={c.id} className="panel p-3">
                <p className="text-sm text-foreground">{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[c.degree_type, c.language, c.duration].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Recent publications" icon={ScrollText} count={data.publications.length}>
          <ul className="space-y-2">
            {data.publications.map((p: any) => (
              <li key={p.id} className="panel panel-hover p-3">
                <Link
                  to="/publications/$id"
                  params={{ id: p.id }}
                  className="block text-sm leading-snug text-foreground hover:text-primary"
                >
                  {p.title}
                </Link>
                <p className="mono-num mt-1 text-[0.68rem] text-muted-foreground">
                  {[p.venue, p.year].filter(Boolean).join(" · ")}
                  {p.citation_count != null ? ` · ${p.citation_count} citations` : ""}
                  {p.is_open_access ? " · open access" : ""}
                </p>
                {p.doi ? (
                  <a
                    href={`https://doi.org/${p.doi}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-[0.68rem] text-primary hover:underline"
                  >
                    doi.org/{p.doi}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </AppShell>
  );
}
