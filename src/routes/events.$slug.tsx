import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, StatTile } from "@/components/layout/AppShell";
import { eventDetailQuery, KIND_LABEL, SECTOR_LABEL } from "@/lib/relevance-queries";
import { countrySlug } from "@/lib/category-queries";
import { daysUntil, formatDate, STATUS_LABEL } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEventLd, eventJsonLd } from "@/lib/jsonld";

export const Route = createFileRoute("/events/$slug")({
  loader: ({ params }) => loadEventLd(params.slug).catch(() => null),
  head: ({ params, loaderData }) => {
    const pretty = params.slug.replace(/-demo$/, "").replace(/-/g, " ");
    return {
      meta: [
        { title: `${pretty} — Event synopsis | GeoAcademic Radar` },
        {
          name: "description",
          content: `Dates, deadlines, location, topics and related open positions for ${pretty}, in photogrammetry, remote sensing and geoinformatics.`,
        },
        { property: "og:title", content: `${pretty} — Event synopsis` },
        {
          property: "og:description",
          content: `One-page synopsis of ${pretty}: dates, submission deadlines, topics and nearby open calls.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
        { name: "twitter:image", content: "https://geoacademic.app/og-geoacademic-radar.jpg" },
      ],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(eventJsonLd(loaderData)),
            },
          ]
        : [],
    };
  },
  component: EventDetail,
});

function EventDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(eventDetailQuery(slug));

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-6xl space-y-3 p-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">
          This event is not tracked yet.{" "}
          <Link to="/events" className="text-primary hover:underline">
            Back to the calendar
          </Link>
        </div>
      </AppShell>
    );
  }

  const { event } = data;
  const days = daysUntil(event.start_date);
  const cfp = daysUntil(event.abstract_deadline);

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${KIND_LABEL[event.event_kind] ?? event.event_kind} · ${event.organization ?? "Organiser not stated"}`}
        title={event.title}
        description={
          event.summary ??
          "No organiser summary is recorded for this event. Confirm scope and dates on the official page."
        }
      />
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Starts"
            value={formatDate(event.start_date)}
            hint={days !== null && days >= 0 ? `in ${days} days` : "Date passed or not stated"}
            tone="signal"
          />
          <StatTile
            label="Abstract deadline"
            value={formatDate(event.abstract_deadline)}
            hint={cfp !== null && cfp >= 0 ? `${cfp} days left` : "Closed or not stated"}
            tone="deadline"
          />
          <StatTile label="Paper deadline" value={formatDate(event.paper_deadline)} />
          <StatTile label="Recurrence" value={event.recurrence ?? "Not stated"} />
        </div>

        <div className="panel mt-6 flex flex-wrap items-center gap-4 p-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {event.location ?? "Location not stated"}
          </span>
          {event.country ? (
            <Link
              to="/countries/$slug"
              params={{ slug: countrySlug(event.country) }}
              className="text-primary hover:underline"
            >
              {event.country} synopsis
            </Link>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(event.start_date)} – {formatDate(event.end_date)}
          </span>
          <ProvenanceChips
            verification={event.verification_status}
            confidence={event.confidence}
            isDemo={event.is_demo}
          />
          {event.website ? (
            <a
              href={event.website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Official page <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        {(event.event_topics ?? []).length > 0 ? (
          <section className="mt-8">
            <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Topics in scope
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(event.event_topics ?? []).map((t) =>
                t.research_topics ? (
                  <Link
                    key={t.research_topics.slug}
                    to="/topics/$slug"
                    params={{ slug: t.research_topics.slug }}
                    className="rounded-md border border-signal/30 bg-signal/10 px-2.5 py-1 text-xs text-foreground/85 hover:border-primary/50 hover:text-primary"
                  >
                    {t.research_topics.name}
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        ) : null}

        {data.calls.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live positions in the host country
            </h2>
            <ul className="mt-3 grid gap-2 lg:grid-cols-2">
              {data.calls.map((c) => (
                <li key={c.id} className="panel panel-hover p-4">
                  <Link
                    to="/jobs/$slug"
                    params={{ slug: c.slug }}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {c.title}
                  </Link>
                  <p className="mono-num mt-1 text-[0.7rem] text-muted-foreground">
                    {SECTOR_LABEL[c.sector] ?? c.sector} · {STATUS_LABEL[c.status] ?? c.status} ·{" "}
                    {formatDate(c.application_deadline)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Other events in the calendar
          </h2>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {data.siblings.map((s) => (
              <li key={s.id} className="panel panel-hover p-4">
                <Link
                  to="/events/$slug"
                  params={{ slug: s.slug }}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {s.title}
                </Link>
                <p className="mono-num mt-1 text-[0.7rem] text-muted-foreground">
                  {KIND_LABEL[s.event_kind] ?? s.event_kind} · {formatDate(s.start_date)} ·{" "}
                  {s.location ?? "Location not stated"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
