import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, TopicPills } from "@/components/layout/AppShell";
import { coursesQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/programmes")({
  head: () => ({
    meta: [
      { title: "Degree Programmes — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "MSc and doctoral programmes in photogrammetry, remote sensing and geoinformatics, with degree type, language, duration and official programme pages.",
      },
      { property: "og:title", content: "Degree Programmes — GeoAcademic Radar" },
      {
        property: "og:description",
        content: "Study programmes feeding the photogrammetry and geoinformatics research pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgrammesPage,
});

function ProgrammesPage() {
  const { data, isLoading, error } = useQuery(coursesQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Education pipeline"
        title="Degree programmes"
        description="Master's and doctoral programmes that train the next cohort. Language and duration are copied from the official programme page."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {error ? <p className="text-sm text-destructive">Programmes could not be loaded.</p> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data?.map((c) => (
              <li key={c.id} className="panel panel-hover rise-in flex flex-col p-5">
                <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-primary">
                  {c.degree_type ?? "Degree not stated"}
                </span>
                <h2 className="mt-2.5 text-base font-semibold leading-snug text-foreground">
                  {c.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.institutions?.name ?? "Institution not stated"}
                  {c.institutions?.country ? ` · ${c.institutions.country}` : ""}
                </p>
                {c.summary ? (
                  <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-foreground/80">
                    {c.summary}
                  </p>
                ) : null}
                <div className="mono-num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
                  <span>{c.language ?? "Language not stated"}</span>
                  <span>{c.duration ?? "Duration not stated"}</span>
                </div>
                <div className="mt-3">
                  <TopicPills topics={(c.course_topics ?? []).map((t) => t.research_topics?.name)} />
                </div>
                <div className="mt-auto pt-4">
                  <ProvenanceChips verification={c.verification_status} isDemo={c.is_demo} />
                  {c.website ? (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Programme page <ExternalLink className="h-3 w-3" />
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
