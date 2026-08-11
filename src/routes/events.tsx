import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Repeat } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, TopicPills } from "@/components/layout/AppShell";
import { eventsQuery, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Conferences & Events — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Conferences, congresses and workshops in photogrammetry, remote sensing and geoinformatics, with organiser, recurrence and official links.",
      },
      { property: "og:title", content: "Conferences & Events — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Event calendar for photogrammetry, remote sensing and geoinformatics, sourced from society websites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { data, isLoading, error } = useQuery(eventsQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Calendar"
        title="Conferences & events"
        description="Congresses, symposia and workshops in the field. Dates are only shown when the organiser has published them — otherwise the entry states the recurrence instead of guessing."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {error ? <p className="text-sm text-destructive">Events could not be loaded.</p> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data?.map((e) => (
              <li key={e.id} className="panel panel-hover rise-in flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-signal/40 bg-signal/12 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-signal">
                    {e.organization ?? "Organiser not stated"}
                  </span>
                  {e.recurrence ? (
                    <span className="inline-flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                      <Repeat className="h-3 w-3" /> {e.recurrence}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2.5 text-base font-semibold text-foreground">{e.title}</h2>
                {e.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{e.summary}</p>
                ) : null}
                <div className="mono-num mt-3 grid grid-cols-2 gap-2 text-[0.7rem] text-muted-foreground">
                  <span>Next date: {formatDate(e.start_date)}</span>
                  <span>Abstracts: {formatDate(e.abstract_deadline)}</span>
                  <span>Papers: {formatDate(e.paper_deadline)}</span>
                  <span>{e.location ?? "Location not stated"}</span>
                </div>
                <div className="mt-3">
                  <TopicPills topics={(e.event_topics ?? []).map((t) => t.research_topics?.name)} />
                </div>
                <div className="mt-auto pt-4">
                  <ProvenanceChips verification={e.verification_status} isDemo={e.is_demo} />
                  {e.website ? (
                    <a
                      href={e.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Official page <ExternalLink className="h-3 w-3" />
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
