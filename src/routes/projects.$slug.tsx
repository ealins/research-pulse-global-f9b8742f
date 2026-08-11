import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, ExternalLink, FlaskConical, Users } from "lucide-react";

import { AppShell, PageHeader, StatTile, TopicPills } from "@/components/layout/AppShell";
import { EvidenceDrawer, staleness } from "@/components/EvidenceDrawer";
import { projectDetailQuery } from "@/lib/detail-queries";
import { STATUS_LABEL, TYPE_LABEL, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/projects/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-demo$/, "").replace(/-/g, " ");
    return {
      meta: [
        { title: `${pretty} — Research project — GeoAcademic Radar` },
        {
          name: "description",
          content: `${pretty}: lead institution, partners, team, funder, timeline, topics and attached positions.`,
        },
        { property: "og:title", content: `${pretty} — Research project` },
        {
          property: "og:description",
          content: `Funder, timeline, partners and people behind ${pretty}, with source provenance.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
        { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      ],
    };
  },
  component: ProjectDetail,
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
          Nothing recorded yet — absence means no sourced record, not that none exists.
        </p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );
}

function money(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return "Budget not stated";
  return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(amount),
  )} ${currency ?? ""}`.trim();
}

function ProjectDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(projectDetailQuery(slug));

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
          title="No such project record"
          description="We hold no project under this identifier."
        />
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <Link to="/projects" className="text-sm text-primary hover:underline">
            ← Back to projects
          </Link>
        </div>
      </AppShell>
    );
  }

  const p = data.project as any;
  const fresh = staleness(p.last_verified_at);
  const topics = (p.project_topics ?? []).map((t: any) => t.research_topics?.name);

  return (
    <AppShell>
      <PageHeader
        eyebrow={p.acronym ? `Project · ${p.acronym}` : "Research project"}
        title={p.name}
        description={p.summary ?? "No project summary recorded. Use the official project page below."}
        actions={
          <div className="flex flex-col items-end gap-2">
            <EvidenceDrawer
              entityType="project"
              entityId={p.id}
              title={p.name}
              verification={p.verification_status}
              lastVerified={p.last_verified_at}
              isDemo={p.is_demo}
            />
            <span className={`text-[0.68rem] ${fresh.tone}`}>{fresh.label}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          {p.institutions ? (
            <Link
              to="/institutions/$slug"
              params={{ slug: p.institutions.slug }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <Building2 className="h-3.5 w-3.5" /> {p.institutions.name}
            </Link>
          ) : null}
          {p.website ? (
            <a
              href={p.website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Official project page
            </a>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <StatTile label="Status" value={p.status.replace(/_/g, " ")} tone="signal" />
          <StatTile label="Start" value={formatDate(p.start_date)} />
          <StatTile label="End" value={formatDate(p.end_date)} />
          <StatTile label="Budget" value={money(p.funding_amount, p.funding_currency)} tone="growth" />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Funder: {p.organizations?.name ?? p.funding_organization ?? "not stated"}
          {p.departments?.name ? ` · Department: ${p.departments.name}` : ""}
        </p>

        {topics.length ? (
          <div className="mt-6">
            <TopicPills topics={topics} />
          </div>
        ) : null}

        <Section title="Team" icon={Users} count={data.people.length}>
          <div className="grid gap-2 md:grid-cols-2">
            {data.people.map((r: any) => (
              <Link
                key={r.id}
                to="/researchers/$slug"
                params={{ slug: r.slug }}
                className="panel panel-hover p-3"
              >
                <p className="text-sm text-foreground">{r.full_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[r.member_role, r.current_position, r.institutions?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="Partners"
          icon={FlaskConical}
          count={data.partners.length + data.organizations.length}
        >
          <div className="grid gap-2 md:grid-cols-2">
            {data.partners.map((inst: any) => (
              <Link
                key={inst.id}
                to="/institutions/$slug"
                params={{ slug: inst.slug }}
                className="panel panel-hover p-3"
              >
                <p className="text-sm text-foreground">{inst.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[inst.partner_role, inst.country].filter(Boolean).join(" · ")}
                </p>
              </Link>
            ))}
            {data.organizations.map((o: any) => (
              <div key={o.id} className="panel p-3">
                <p className="text-sm text-foreground">{o.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[o.partner_role, o.org_type?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Positions on this grant" icon={Briefcase} count={data.opportunities.length}>
          <ul className="space-y-2">
            {data.opportunities.map((o: any) => (
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
        </Section>
      </div>
    </AppShell>
  );
}
