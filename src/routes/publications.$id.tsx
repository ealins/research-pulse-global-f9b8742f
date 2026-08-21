import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink, Quote, Unlock, Users } from "lucide-react";

import { AppShell, PageHeader, StatTile, TopicPills } from "@/components/layout/AppShell";
import { EvidenceDrawer, staleness } from "@/components/EvidenceDrawer";
import { publicationDetailQuery } from "@/lib/detail-queries";
import { formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { loadPublicationLd, publicationJsonLd } from "@/lib/jsonld";

export const Route = createFileRoute("/publications/$id")({
  loader: ({ params }) => loadPublicationLd(params.id).catch(() => null),
  head: ({ params, loaderData }) => {
    const ref = params.id.slice(0, 8);
    const title = loaderData?.title ?? `Publication ${ref}`;
    return {
      meta: [
        { title: `${title} — GeoAcademic Radar` },
        {
          name: "description",
          content: `${title}: DOI, venue, year, authors, affiliations, citations and open-access status.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: `DOI, venue, authors and citation provenance for geospatial publication record ${ref}.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
        { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      ],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(publicationJsonLd(loaderData)),
            },
          ]
        : [],
    };
  },
  component: PublicationDetail,
});

function PublicationDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(publicationDetailQuery(id));

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl space-y-4 px-6 py-10">
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
          title="No such publication record"
          description="We hold no paper under this identifier."
        />
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <Link to="/publications" className="text-sm text-primary hover:underline">
            ← Back to publications
          </Link>
        </div>
      </AppShell>
    );
  }

  const p = data.publication as any;
  const fresh = staleness(p.last_verified_at);
  const topics = (p.publication_topics ?? []).map((t: any) => t.research_topics?.name);

  return (
    <AppShell>
      <PageHeader
        eyebrow={[p.venue, p.year].filter(Boolean).join(" · ") || "Publication"}
        title={p.title}
        description={p.abstract ?? "No abstract recorded. Follow the DOI for the authoritative text."}
        actions={
          <div className="flex flex-col items-end gap-2">
            <EvidenceDrawer
              entityType="publication"
              entityId={p.id}
              title={p.title}
              verification={p.verification_status}
              lastVerified={p.last_verified_at}
              isDemo={p.is_demo}
            />
            <span className={`text-[0.68rem] ${fresh.tone}`}>{fresh.label}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          {p.doi ? (
            <a
              href={`https://doi.org/${p.doi}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mono-num inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> doi:{p.doi}
            </a>
          ) : null}
          {p.landing_url ? (
            <a
              href={p.landing_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Landing page
            </a>
          ) : null}
          {p.is_open_access ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-growth/40 bg-growth/10 px-2.5 py-1 text-[0.68rem] text-growth">
              <Unlock className="h-3 w-3" /> Open access
            </span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <StatTile label="Year" value={p.year ?? "not stated"} tone="signal" />
          <StatTile
            label="Citations"
            value={p.citation_count ?? "not stated"}
            tone="growth"
          />
          <StatTile label="Published" value={formatDate(p.publication_date)} />
          <StatTile label="Record source" value={p.source ?? "not stated"} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <Quote className="mr-1 inline h-3 w-3" />
          Citation count as reported by {p.citation_source ?? "an unstated provider"} — never averaged
          across providers.
        </p>

        <p className="mt-4 text-sm text-foreground/80">{p.authors_text ?? "Authors not stated"}</p>

        {topics.length ? (
          <div className="mt-6">
            <TopicPills topics={topics} />
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Tracked authors
            <span className="mono-num text-muted-foreground/70">{data.authors.length}</span>
          </h2>
          {data.authors.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No author records linked yet — see the author string above.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {data.authors.map((a: any) => (
                <Link
                  key={a.id}
                  to="/researchers/$slug"
                  params={{ slug: a.slug }}
                  className="panel panel-hover p-3"
                >
                  <p className="text-sm text-foreground">
                    {a.author_position ? `${a.author_position}. ` : ""}
                    {a.full_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[a.current_position, a.institutions?.name].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Affiliations
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {[
              ...(p.institutions ? [p.institutions] : []),
              ...data.institutions.filter((i: any) => i.id !== p.institutions?.id),
            ].map((i: any) => (
              <Link
                key={i.id}
                to="/institutions/$slug"
                params={{ slug: i.slug }}
                className="panel panel-hover p-3"
              >
                <p className="text-sm text-foreground">{i.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{i.country ?? ""}</p>
              </Link>
            ))}
            {!p.institutions && data.institutions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No affiliation recorded.</p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
