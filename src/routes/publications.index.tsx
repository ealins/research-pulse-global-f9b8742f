import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ExternalLink, Quote, Unlock } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, TopicPills } from "@/components/layout/AppShell";
import { publicationAbstractQuery, publicationsQuery } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { CardLink } from "@/components/CardLink";

export const Route = createFileRoute("/publications/")({
  head: () => ({
    meta: [
      { title: "Publications — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Recent photogrammetry, remote sensing and geoinformatics papers with DOIs, venues, citation counts and open-access status.",
      },
      { property: "og:title", content: "Publications — GeoAcademic Radar" },
      {
        property: "og:description",
        content: "Tracked papers with DOI-level provenance across the geospatial research field.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
    ],
  }),
  component: PublicationsPage,
});

function PublicationsPage() {
  const { data, isLoading, error } = useQuery(publicationsQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Literature"
        title="Publications"
        description="Papers are identified by DOI where one exists. Citation counts carry the source that reported them and are never averaged across providers."
      />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {error ? (
          <p className="text-sm text-destructive">Publications could not be loaded.</p>
        ) : null}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {data?.map((p) => (
              <li key={p.id} className="panel panel-hover rise-in relative p-5">
                <CardLink to="/publications/$id" params={{ id: p.id }} label={`${p.title}: open publication`} />
                <div className="flex flex-wrap items-center gap-2 text-[0.65rem]">
                  <span className="mono-num rounded-md border border-border bg-muted/50 px-2 py-0.5 text-muted-foreground">
                    {p.year ?? "Year not stated"}
                  </span>
                  <span className="text-muted-foreground">{p.venue ?? "Venue not stated"}</span>
                  {p.is_open_access ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-growth/40 bg-growth/10 px-2 py-0.5 text-growth">
                      <Unlock className="h-3 w-3" /> Open access
                    </span>
                  ) : null}
                  {p.citation_count !== null ? (
                    <span className="mono-num inline-flex items-center gap-1 text-muted-foreground">
                      <Quote className="h-3 w-3" /> {p.citation_count} · {p.citation_source ?? "source not stated"}
                    </span>
                  ) : null}
                </div>
                <Link
                  to="/publications/$id"
                  params={{ id: p.id }}
                  className="mt-2 block text-[0.95rem] font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {p.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.authors_text ?? "Authors not stated"}
                </p>
                <AbstractToggle id={p.id} />

                <div className="mt-3">
                  <TopicPills
                    topics={(p.publication_topics ?? []).map((t) => t.research_topics?.name)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ProvenanceChips
                    verification={p.verification_status}
                    confidence={p.confidence}
                    isDemo={p.is_demo}
                  />
                  {p.doi ? (
                    <a
                      href={`https://doi.org/${p.doi}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mono-num relative z-10 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      doi:{p.doi} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : p.landing_url ? (
                    <a
                      href={p.landing_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="relative z-10 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Landing page <ExternalLink className="h-3 w-3" />
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

/** Lazily loads a single abstract, so the list request stays lightweight. */
function AbstractToggle({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ ...publicationAbstractQuery(id), enabled: open });

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative z-10 inline-flex items-center gap-1 text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline"
      >
        {open ? "Hide abstract" : "Show abstract"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        isLoading ? (
          <Skeleton className="mt-2 h-12 w-full" />
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            {data ?? "No abstract recorded. Follow the DOI for the authoritative text."}
          </p>
        )
      ) : null}
    </div>
  );
}
