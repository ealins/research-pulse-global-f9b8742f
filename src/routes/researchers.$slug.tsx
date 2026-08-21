import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ScrollText, FlaskConical, Briefcase, GraduationCap, History } from "lucide-react";

import { AppShell, PageHeader, StatTile, TopicPills } from "@/components/layout/AppShell";
import { EvidenceDrawer, staleness } from "@/components/EvidenceDrawer";
import { researcherDetailQuery } from "@/lib/detail-queries";
import { STATUS_LABEL, TYPE_LABEL, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { loadResearcherLd, researcherJsonLd } from "@/lib/jsonld";

export const Route = createFileRoute("/researchers/$slug")({
  loader: ({ params }) => loadResearcherLd(params.slug).catch(() => null),
  head: ({ params, loaderData }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = loaderData?.name ?? pretty;
    return {
      meta: [
        { title: `${title} — Researcher profile — GeoAcademic Radar` },
        {
          name: "description",
          content: `${title}: positions, research topics, publications, funded projects and supervised geospatial vacancies.`,
        },
        { property: "og:title", content: `${title} — Researcher profile` },
        {
          property: "og:description",
          content: `Position, topics, publications and supervision record for ${title}, traceable to official sources.`,
        },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
        { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      ],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(researcherJsonLd(loaderData)),
            },
          ]
        : [],
    };
  },
  component: ResearcherDetail,
});

function ResearcherDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(researcherDetailQuery(slug));

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
          title="No such researcher record"
          description="We hold no sourced record under this identifier."
        />
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <Link to="/researchers" className="text-sm text-primary hover:underline">
            ← Back to researchers
          </Link>
        </div>
      </AppShell>
    );
  }

  const r: any = data.researcher;
  const fresh = staleness(r.last_verified_at);
  const topics = (r.researcher_topics ?? []).map((t: any) => t.research_topics?.name);
  const citations = data.publications.reduce(
    (sum: number, p: any) => sum + (p.citation_count ?? 0),
    0,
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow={r.institutions?.name ?? "Affiliation not recorded"}
        title={`${r.academic_title ? r.academic_title + " " : ""}${r.full_name}`}
        description={
          r.research_summary ??
          "No research summary recorded. The official profile page below is the authoritative statement of interests."
        }
        actions={
          <div className="flex flex-col items-end gap-2">
            <EvidenceDrawer
              entityType="researcher"
              entityId={r.id}
              title={r.full_name}
              verification={r.verification_status}
              lastVerified={r.last_verified_at}
              isDemo={r.is_demo}
            />
            <span className={`text-[0.68rem] ${fresh.tone}`}>{fresh.label}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <p className="text-sm text-foreground">
          {r.current_position ?? "Current position not recorded"}
          {r.institutions ? (
            <>
              {" · "}
              <Link
                to="/institutions/$slug"
                params={{ slug: r.institutions.slug }}
                className="text-primary hover:underline"
              >
                {r.institutions.name}
              </Link>
            </>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {r.official_profile_url ? (
            <a
              href={r.official_profile_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Official profile
            </a>
          ) : null}
          {r.orcid ? (
            <a
              href={`https://orcid.org/${r.orcid}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mono-num inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[0.68rem] hover:border-primary/40 hover:text-primary"
            >
              ORCID {r.orcid}
            </a>
          ) : null}
          {r.google_scholar_url ? (
            <a
              href={r.google_scholar_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
            >
              Scholar profile
            </a>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <StatTile label="Publications held" value={data.publications.length} tone="signal" />
          <StatTile label="Citations (as recorded)" value={citations} />
          <StatTile label="Projects" value={data.projects.length} />
          <StatTile label="Positions supervised" value={data.supervising.length} tone="growth" />
        </div>

        {topics.length ? (
          <div className="mt-6">
            <TopicPills topics={topics} />
          </div>
        ) : null}

        {data.roles.length ? (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Position history
            </h2>
            <ul className="mt-3 space-y-2">
              {data.roles.map((role: any, idx: number) => (
                <li key={idx} className="panel p-3 text-xs">
                  <p className="text-foreground">
                    {role.role}
                    {role.is_leadership ? " · leadership" : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {[role.institutions?.name, role.departments?.name].filter(Boolean).join(" · ")}
                    {" · "}
                    {formatDate(role.valid_from)} → {role.valid_to ? formatDate(role.valid_to) : "present"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.supervising.length ? (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" /> Positions under this supervisor
            </h2>
            <ul className="mt-3 space-y-2">
              {data.supervising.map((o: any) => (
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
                    {STATUS_LABEL[o.status] ?? o.status} · {formatDate(o.application_deadline)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.projects.length ? (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" /> Projects
            </h2>
            <ul className="mt-3 space-y-2">
              {data.projects.map((p: any) => (
                <li key={p.id} className="panel panel-hover p-3 text-xs">
                  <Link
                    to="/projects/$slug"
                    params={{ slug: p.slug }}
                    className="block text-sm text-foreground hover:text-primary"
                  >
                    {p.acronym ? `${p.acronym} — ` : ""}
                    {p.name}
                  </Link>
                  <p className="mt-1 text-muted-foreground">
                    {[p.member_role, p.status, p.funding_organization].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.courses.length ? (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Teaching
            </h2>
            <ul className="mt-3 space-y-2">
              {data.courses.map((c: any) => (
                <li key={c.id} className="panel p-3 text-xs text-foreground">
                  {c.title}
                  {c.degree_type ? (
                    <span className="text-muted-foreground"> · {c.degree_type}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5" /> Publications
          </h2>
          {data.publications.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No publications linked to this person in our records. This is a coverage gap, not a
              statement about output.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
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
                    {p.author_position ? ` · author #${p.author_position}` : ""}
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
          )}
        </section>
      </div>
    </AppShell>
  );
}
