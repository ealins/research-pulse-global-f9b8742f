import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { collaborationQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/collaboration")({
  head: () => ({
    meta: [
      { title: "Collaboration Graph — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "How institutions in photogrammetry, remote sensing and geoinformatics connect through shared topics, projects and co-authored papers — each edge carries its evidence link.",
      },
      { property: "og:title", content: "Collaboration Graph — GeoAcademic Radar" },
      {
        property: "og:description",
        content: "Evidence-backed institutional collaboration structure in geospatial research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollaborationPage,
});

function CollaborationPage() {
  const { data, isLoading, error } = useQuery(collaborationQuery);
  const [focus, setFocus] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.institutions.map((i) => [i.id, i]));
    const degree = new Map<string, number>();
    const strength = new Map<string, number>();
    for (const e of data.edges) {
      for (const id of [e.source_entity_id, e.target_entity_id]) {
        degree.set(id, (degree.get(id) ?? 0) + 1);
        strength.set(id, (strength.get(id) ?? 0) + Number(e.weight ?? 0));
      }
    }
    const nodes = [...degree.entries()]
      .map(([id, deg]) => ({
        id,
        deg,
        strength: strength.get(id) ?? 0,
        inst: byId.get(id),
      }))
      .filter((n) => n.inst)
      .sort((a, b) => b.deg - a.deg);
    const maxDeg = Math.max(1, ...nodes.map((n) => n.deg));
    const edges = data.edges
      .filter((e) => !focus || e.source_entity_id === focus || e.target_entity_id === focus)
      .map((e) => ({
        ...e,
        source: byId.get(e.source_entity_id),
        target: byId.get(e.target_entity_id),
      }))
      .filter((e) => e.source && e.target);
    return { nodes, edges, maxDeg };
  }, [data, focus]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Network structure"
        title="Collaboration graph"
        description="Edges are derived from evidence already in the database — shared research topics, joint projects and co-authorship. Every edge keeps the URL that justifies it."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Institutions in graph" value={model?.nodes.length ?? "—"} tone="signal" />
          <StatTile label="Edges" value={data?.edges.length ?? "—"} />
          <StatTile
            label="Most connected"
            value={model?.nodes[0]?.inst?.abbreviation ?? model?.nodes[0]?.inst?.name ?? "—"}
          />
          <StatTile
            label="Focus"
            value={
              focus
                ? (model?.nodes.find((n) => n.id === focus)?.inst?.abbreviation ?? "Selected")
                : "All"
            }
            hint="Click a node to filter"
          />
        </section>

        {error ? (
          <p className="mt-6 text-sm text-destructive">Collaboration graph could not be loaded.</p>
        ) : null}

        {isLoading ? (
          <Skeleton className="mt-6 h-96 w-full" />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_24rem]">
            <div className="panel p-5">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Connection intensity
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Bar length is the number of evidence-backed links each institution holds.
              </p>
              <ul className="mt-4 space-y-2">
                {model?.nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setFocus(focus === n.id ? null : n.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        focus === n.id
                          ? "border-primary/60 bg-primary/10"
                          : "border-transparent hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-medium text-foreground">
                          {n.inst?.name}
                        </span>
                        <span className="mono-num shrink-0 text-[0.7rem] text-muted-foreground">
                          {n.deg} links
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-signal"
                          style={{ width: `${(n.deg / (model?.maxDeg ?? 1)) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel h-fit p-5">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Edges {focus ? "for selection" : "(strongest first)"}
              </h2>
              <ul className="mt-4 max-h-[34rem] space-y-2.5 overflow-y-auto pr-1">
                {model?.edges.slice(0, 80).map((e) => (
                  <li key={e.id} className="rounded-lg border border-border/70 bg-muted/25 p-3">
                    <p className="text-xs text-foreground">
                      {e.source?.abbreviation ?? e.source?.name}{" "}
                      <span className="text-primary">↔</span>{" "}
                      {e.target?.abbreviation ?? e.target?.name}
                    </p>
                    <p className="mono-num mt-1 text-[0.68rem] text-muted-foreground">
                      {e.edge_type.replace(/_/g, " ")} · weight {Number(e.weight).toFixed(2)}
                    </p>
                    {e.evidence_url ? (
                      <a
                        href={e.evidence_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Evidence <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
