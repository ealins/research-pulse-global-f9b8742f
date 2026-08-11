import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Database, GitCompare, Gauge, AlertTriangle } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { sourceRegistryQuery } from "@/lib/detail-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology & provenance — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "How GeoAcademic Radar collects, verifies and scores academic records: source registry, verification statuses, deduplication rules and the exact momentum formula.",
      },
      { property: "og:title", content: "Methodology & provenance — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Source registry, verification statuses, deduplication rules and the momentum formula behind every number on the platform.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MethodologyPage,
});

const STATUSES: [string, string][] = [
  ["verified", "A human or automated check confirmed the claim against the official source within the recorded verification window."],
  ["auto_discovered", "Captured by a connector from a registered source, not yet re-checked by hand."],
  ["needs_review", "Conflicting or incomplete source evidence. Displayed, but flagged."],
  ["possibly_outdated", "The source page changed or stopped responding since last check."],
  ["closed", "The source states the call or role has ended."],
  ["archived", "Kept for the historical record; not part of live counts."],
  ["unverified", "Present in our database with no confirming source row. Treat as a lead, not a fact."],
];

function MethodologyPage() {
  const { data: sources, isLoading } = useQuery(sourceRegistryQuery);

  return (
    <AppShell>
      <PageHeader
        eyebrow="How this works"
        title="Methodology & provenance"
        description="This platform is only useful if you can check it. Nothing here is generated, inferred or estimated: every record traces to a registered source, and every computed number has a formula printed below."
      />

      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Non-negotiables
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              We never invent an institution, person, position, project or publication. If we have
              no source, the field reads “not stated” rather than being filled in.
            </li>
            <li>
              Every entity carries a source URL, discovery timestamp, last-checked timestamp and a
              verification status. Open the “Evidence” drawer on any record to see all of it.
            </li>
            <li>
              Absence is not evidence. An empty section means we hold no sourced record — it does
              not mean nothing exists.
            </li>
            <li>
              Deadlines, salaries and positions are mirrors of what the source said at capture time.
              The official page always wins.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-primary" /> Verification statuses
          </h2>
          <dl className="mt-3 space-y-2">
            {STATUSES.map(([status, meaning]) => (
              <div key={status} className="panel p-3">
                <dt className="mono-num text-xs uppercase tracking-wider text-primary">
                  {status.replace(/_/g, " ")}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitCompare className="h-4 w-4 text-primary" /> Deduplication
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>Publications are keyed on DOI first, then on normalised title plus year.</li>
            <li>Researchers are keyed on ORCID first, then normalised name plus institution.</li>
            <li>Institutions are keyed on ROR/OpenAlex identifier, then normalised name plus country.</li>
            <li>
              Positions use a deterministic dedupe key of institution, normalised title and
              deadline, so the same call syndicated across three job boards stays one record with
              three sources.
            </li>
            <li>
              Fuzzy candidates are queued rather than merged automatically; a merge is recorded and
              reversible.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-primary" /> Momentum & trend signal
          </h2>
          <div className="panel mono-num mt-3 p-4 text-xs leading-relaxed text-muted-foreground">
            growth_ratio = pubs_last_12m / max(pubs_prev_12m, 1)
            <br />
            trend_signal = growth_ratio × log(1 + pubs_last_12m)
            <br />
            &nbsp;&nbsp;+ 0.5 × active_projects + 0.5 × open_opportunities
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Caveats worth stating: counts reflect only publications, projects and calls we hold and
            have classified against a topic, so coverage bias is real — a topic can look quiet
            because our source list is thin, not because the field is. Small denominators inflate
            growth ratios. The signal is a reading aid for spotting movement, not a bibliometric
            ranking, and it must not be used for evaluation of people or institutions.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="h-4 w-4 text-primary" /> Source registry
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Trust level 5 means an authoritative first-party source (an institution's own page, a
            society, a funder). Lower levels are aggregators, which we use for discovery but not as
            the final word on a fact.
          </p>
          {isLoading ? (
            <Skeleton className="mt-3 h-40 w-full" />
          ) : (
            <div className="mt-3 space-y-2">
              {(sources ?? []).map((s: any) => (
                <div key={s.id} className="panel flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">
                      {s.name}
                      {s.organization ? (
                        <span className="text-muted-foreground"> · {s.organization}</span>
                      ) : null}
                    </p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 block truncate text-[0.65rem] text-primary hover:underline"
                    >
                      {s.url}
                    </a>
                  </div>
                  <span className="mono-num text-[0.62rem] text-muted-foreground">
                    trust {s.trust_level} · every {s.refresh_frequency_hours}h ·{" "}
                    {s.source_type.replace(/_/g, " ")}
                    {s.active ? "" : " · paused"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 flex items-start gap-2 rounded-md border border-deadline/30 bg-deadline/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-deadline" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Found something wrong? Records marked “demo data” exist to demonstrate structure while
            connectors are being wired and are labelled everywhere they appear. Anything else that
            looks incorrect can be traced through its Evidence drawer to the exact page it came
            from — start there, then tell us which claim and which source disagree.{" "}
            <Link to="/" className="text-primary hover:underline">
              Back to the pulse
            </Link>
            .
          </p>
        </section>
      </div>
    </AppShell>
  );
}
