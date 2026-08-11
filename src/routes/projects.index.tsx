import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, TopicPills } from "@/components/layout/AppShell";
import { formatDate, projectsQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Research Projects — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Funded research projects in photogrammetry, remote sensing and geoinformatics, with funder, timeline, budget and official project pages.",
      },
      { property: "og:title", content: "Research Projects — GeoAcademic Radar" },
      {
        property: "og:description",
        content: "Funded geospatial research projects with funder and timeline provenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

const STATUS_TONE: Record<string, string> = {
  active: "border-growth/40 bg-growth/12 text-growth",
  planned: "border-signal/40 bg-signal/12 text-signal",
  recently_completed: "border-border bg-muted/50 text-muted-foreground",
  completed: "border-border bg-muted/50 text-muted-foreground",
  unknown: "border-border bg-muted/50 text-muted-foreground",
};

function money(amount: number | null, currency: string | null) {
  if (amount === null) return "Budget not stated";
  return `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(amount),
  )} ${currency ?? ""}`.trim();
}

function ProjectsPage() {
  const { data, isLoading, error } = useQuery(projectsQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Funded research"
        title="Research projects"
        description="Grants and consortium projects driving the field. Budgets and end dates are reproduced as the funder published them; missing values stay blank rather than estimated."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {error ? <p className="text-sm text-destructive">Projects could not be loaded.</p> : null}
        {isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data?.map((p) => (
              <li key={p.id} className="panel panel-hover rise-in flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-wider">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 ${
                      STATUS_TONE[p.status] ?? STATUS_TONE["unknown"]
                    }`}
                  >
                    {p.status.replace(/_/g, " ")}
                  </span>
                  {p.acronym ? (
                    <span className="mono-num rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 normal-case text-primary">
                      {p.acronym}
                    </span>
                  ) : null}
                </div>
                <Link
                  to="/projects/$slug"
                  params={{ slug: p.slug }}
                  className="mt-2.5 block text-base font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {p.name}
                </Link>
                {p.institutions?.slug ? (
                  <Link
                    to="/institutions/$slug"
                    params={{ slug: p.institutions.slug }}
                    className="mt-1 block text-xs text-muted-foreground hover:text-primary"
                  >
                    {p.institutions.name}
                  </Link>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Lead institution not stated</p>
                )}
                {p.summary ? (
                  <p className="mt-2.5 text-sm leading-relaxed text-foreground/80">{p.summary}</p>
                ) : null}
                <div className="mono-num mt-3 grid grid-cols-2 gap-2 text-[0.7rem] text-muted-foreground">
                  <span>Start: {formatDate(p.start_date)}</span>
                  <span>End: {formatDate(p.end_date)}</span>
                  <span>{p.funding_organization ?? "Funder not stated"}</span>
                  <span>{money(p.funding_amount, p.funding_currency)}</span>
                </div>
                <div className="mt-3">
                  <TopicPills
                    topics={(p.project_topics ?? []).map((t) => t.research_topics?.name)}
                  />
                </div>
                <div className="mt-auto pt-4">
                  <ProvenanceChips
                    verification={p.verification_status}
                    confidence={p.confidence}
                    isDemo={p.is_demo}
                  />
                  {p.website ? (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Project page <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
