import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Academic Pulse — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Live intelligence feed for photogrammetry, remote sensing and geoinformatics: PhD positions, publications, projects and events with full provenance.",
      },
      { property: "og:title", content: "Academic Pulse — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Live intelligence feed for photogrammetry, remote sensing and geoinformatics, with source links on every record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcademicPulse,
});

const CATEGORY_LABEL: Record<string, string> = {
  PHD: "PhD / position",
  PAPER: "Publication",
  PROJECT: "Project",
  EVENT: "Event",
  PEOPLE: "People",
  DATASET: "Dataset",
  DISSERTATION: "Dissertation",
  STANDARD: "Standard",
  FUNDING: "Funding",
};

function usePulse() {
  return useQuery({
    queryKey: ["pulse-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulse_events")
        .select(
          "id, category, title, summary, event_date, importance, link_url, source_url, verification_status, confidence, is_demo, country",
        )
        .order("importance", { ascending: false })
        .order("event_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useCounts() {
  return useQuery({
    queryKey: ["pulse-counts"],
    queryFn: async () => {
      const tables = ["institutions", "researchers", "opportunities", "publications"] as const;
      const results = await Promise.all(
        tables.map(async (t) => {
          const { count, error } = await supabase
            .from(t)
            .select("id", { count: "exact", head: true });
          if (error) throw error;
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(results) as Record<(typeof tables)[number], number>;
    },
  });
}

function AcademicPulse() {
  const { data: events, isLoading, error } = usePulse();
  const { data: counts } = useCounts();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          GeoAcademic Radar
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          Academic Pulse
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Global intelligence feed for photogrammetry, remote sensing and geoinformatics. Every
          record carries a source link and a verification status — nothing is asserted without
          provenance.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {(
          [
            ["Institutions", counts?.institutions],
            ["Researchers", counts?.researchers],
            ["Open positions", counts?.opportunities],
            ["Publications", counts?.publications],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {value ?? "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Latest signals
        </h2>

        {error ? (
          <p className="mt-4 text-sm text-destructive">
            The feed could not be loaded. Please try again.
          </p>
        ) : null}

        {isLoading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {events?.map((e) => (
              <li key={e.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                  {e.country ? (
                    <span className="text-xs text-muted-foreground">{e.country}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {e.event_date ? new Date(e.event_date).toLocaleDateString() : "Date not stated"}
                  </span>
                  <Badge variant="outline">
                    {e.verification_status === "verified" ? "Verified" : "Not verified"}
                  </Badge>
                  {e.is_demo ? <Badge variant="outline">Demonstration data</Badge> : null}
                </div>
                <h3 className="mt-2 text-base font-medium leading-snug text-foreground">
                  {e.title}
                </h3>
                {e.summary ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.summary}</p>
                ) : null}
                {e.link_url ?? e.source_url ? (
                  <a
                    href={(e.link_url ?? e.source_url) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-block text-xs font-medium text-primary underline underline-offset-4"
                  >
                    Open source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !error && (events?.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No signals recorded yet.</p>
        ) : null}
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        <Link to="/" className="underline underline-offset-4">
          GeoAcademic Radar
        </Link>{" "}
        — records are collected from official institutional and society sources and are never
        inferred or invented.
      </footer>
    </main>
  );
}
