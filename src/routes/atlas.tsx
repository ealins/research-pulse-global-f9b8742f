import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Globe2, MapPin } from "lucide-react";

import { countrySlug } from "@/lib/category-queries";
import { AppShell, PageHeader, StatTile } from "@/components/layout/AppShell";
import { Globe, type GlobeArc, type GlobePoint } from "@/components/Globe";
import { InstitutionSnapshot } from "@/components/InstitutionSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const atlasQuery = queryOptions({
  queryKey: ["atlas"],
  queryFn: async () => {
    const [institutions, opportunities, edges] = await Promise.all([
      supabase
        .from("institutions")
        .select("id, name, slug, country, city, latitude, longitude, institution_type"),
      supabase
        .from("opportunities")
        .select("id, institution_id, status, application_deadline")
        .in("status", ["open", "closing_soon", "rolling", "possibly_open"]),
      supabase
        .from("collaboration_edges")
        .select("source_entity_id, target_entity_id, weight")
        .order("weight", { ascending: false })
        .limit(120),
    ]);
    if (institutions.error) throw institutions.error;
    if (opportunities.error) throw opportunities.error;
    if (edges.error) throw edges.error;
    return {
      institutions: institutions.data ?? [],
      opportunities: opportunities.data ?? [],
      edges: edges.data ?? [],
    };
  },
});

export const Route = createFileRoute("/atlas")({
  head: () => ({
    meta: [
      { title: "World Monitor — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "A rotating world view of photogrammetry, remote sensing and geoinformatics research: institutions, live PhD calls and collaboration links by country.",
      },
      { property: "og:title", content: "World Monitor — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Global map of geospatial research capacity: where the institutions, open positions and collaborations are.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
    ],
  }),
  component: AtlasPage,
});

function AtlasPage() {
  const { data, isLoading } = useQuery(atlasQuery);
  const [selected, setSelected] = useState<string | null>(null);

  const liveByInstitution = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of data?.opportunities ?? []) {
      if (!o.institution_id) continue;
      map.set(o.institution_id, (map.get(o.institution_id) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const points: GlobePoint[] = useMemo(
    () =>
      (data?.institutions ?? [])
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({
          id: i.id,
          name: i.name,
          slug: i.slug,
          lat: i.latitude as number,
          lon: i.longitude as number,
          country: i.country,
          weight: liveByInstitution.get(i.id) ?? 1,
          live: (liveByInstitution.get(i.id) ?? 0) > 0,
        })),
    [data, liveByInstitution],
  );

  const arcs: GlobeArc[] = useMemo(
    () =>
      (data?.edges ?? []).map((e) => ({
        from: e.source_entity_id,
        to: e.target_entity_id,
        weight: Number(e.weight ?? 1),
      })),
    [data],
  );

  const byCountry = useMemo(() => {
    const map = new Map<string, { institutions: number; live: number }>();
    for (const i of data?.institutions ?? []) {
      const key = i.country ?? "Not stated";
      const row = map.get(key) ?? { institutions: 0, live: 0 };
      row.institutions += 1;
      row.live += liveByInstitution.get(i.id) ?? 0;
      map.set(key, row);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1].live - a[1].live || b[1].institutions - a[1].institutions,
    );
  }, [data, liveByInstitution]);

  const missing = (data?.institutions ?? []).filter((i) => i.latitude == null).length;
  const selectedInstitution = (data?.institutions ?? []).find((i) => i.id === selected);

  return (
    <AppShell>
      <PageHeader
        eyebrow="World monitor"
        title="Global geospatial research map"
        description="Every institution we hold coordinates for, drawn on a rotating globe. Green nodes have a live call open right now; arcs are recorded collaboration links. Drag to spin."
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile label="Institutions mapped" value={points.length} tone="signal" />
          <StatTile
            label="With live calls"
            value={points.filter((p) => p.live).length}
            tone="growth"
          />
          <StatTile label="Countries" value={byCountry.length} />
          <StatTile
            label="Missing coordinates"
            value={missing}
            tone="deadline"
            hint="Not plotted — we don't guess locations"
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="panel flex flex-col items-center p-6">
            {isLoading ? (
              <Skeleton className="h-[320px] w-[320px] rounded-full" />
            ) : (
              <>
                <Globe points={points} arcs={arcs} selectedId={selected} onSelect={setSelected} />
                <InstitutionSnapshot
                  slug={selectedInstitution?.slug ?? null}
                  open={Boolean(selectedInstitution)}
                  onOpenChange={(o) => {
                    if (!o) setSelected(null);
                  }}
                />
              </>
            )}
            {selectedInstitution ? (
              <div className="mt-4 w-full max-w-md rounded-md border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {selectedInstitution.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[selectedInstitution.city, selectedInstitution.country]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · {liveByInstitution.get(selectedInstitution.id) ?? 0} live calls
                </p>
                <Link
                  to="/institutions/$slug"
                  params={{ slug: selectedInstitution.slug }}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Open institution profile →
                </Link>
              </div>
            ) : (
              <p className="mt-4 max-w-md text-center text-xs text-muted-foreground">
                Click a node to see the institution. Positions are plotted from recorded
                coordinates only — nothing is inferred from a country name.
              </p>
            )}
          </div>

          <section>
            <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5" /> Capacity by country
            </h2>
            <ul className="mt-3 space-y-1.5">
              {byCountry.map(([country, row]) => {
                const max = byCountry[0]?.[1].institutions || 1;
                return (
                  <li key={country} className="panel panel-hover px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <Link
                        to="/countries/$slug"
                        params={{ slug: countrySlug(country) }}
                        className="text-foreground hover:text-primary"
                      >
                        {country}
                      </Link>
                      <span className="mono-num text-muted-foreground">
                        {row.institutions} inst · {row.live} live
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
                      <div
                        className="h-1 rounded-full bg-primary/70"
                        style={{ width: `${(row.institutions / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
