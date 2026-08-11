import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, TopicPills } from "@/components/layout/AppShell";
import { institutionsQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/institutions")({
  head: () => ({
    meta: [
      { title: "Institutions — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Universities, institutes and labs active in photogrammetry, remote sensing and geoinformatics, with research focus areas and official links.",
      },
      { property: "og:title", content: "Institutions — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Institutional landscape of photogrammetry, remote sensing and geoinformatics research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstitutionsPage,
});

function InstitutionsPage() {
  const { data, isLoading, error } = useQuery(institutionsQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Institutional landscape"
        title="Institutions"
        description="Universities, research institutes and labs tracked by the radar, each with its stated research focus and official web presence."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {error ? <p className="text-sm text-destructive">Institutions could not be loaded.</p> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.map((i) => (
              <li key={i.id} className="panel panel-hover rise-in flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold leading-snug text-foreground">
                    {i.name}
                  </h2>
                  {i.abbreviation ? (
                    <span className="mono-num rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[0.65rem] text-primary">
                      {i.abbreviation}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[i.city, i.country].filter(Boolean).join(", ") || "Location not stated"} ·{" "}
                  {i.institution_type.replace(/_/g, " ")}
                </p>
                {i.description ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                    {i.description}
                  </p>
                ) : null}
                <div className="mt-3">
                  <TopicPills
                    topics={(i.institution_topics ?? [])
                      .slice()
                      .sort((a, b) => Number(b.weight) - Number(a.weight))
                      .map((t) => t.research_topics?.name)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 pt-1">
                  <ProvenanceChips verification={i.verification_status} isDemo={i.is_demo} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[0.7rem]">
                  {i.official_url ? (
                    <a
                      href={i.official_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Official site <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {i.research_url ? (
                    <a
                      href={i.research_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Research pages <ExternalLink className="h-3 w-3" />
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
