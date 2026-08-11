import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Timer, MapPin, UserRound, AlertTriangle, CalendarPlus } from "lucide-react";

import { AppShell, PageHeader, StatTile, TopicPills } from "@/components/layout/AppShell";
import { EvidenceDrawer, staleness } from "@/components/EvidenceDrawer";
import { opportunityDetailQuery } from "@/lib/detail-queries";
import { STATUS_LABEL, TYPE_LABEL, daysUntil, formatDate } from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";
import { loadJobLd, jobJsonLd } from "@/lib/jsonld";

export const Route = createFileRoute("/jobs/$slug")({
  loader: ({ params }) => loadJobLd(params.slug).catch(() => null),
  head: ({ params, loaderData }) => {
    const pretty = params.slug.replace(/-demo$/, "").replace(/-/g, " ");
    return {
      meta: [
        { title: `${pretty} — Position — GeoAcademic Radar` },
        {
          name: "description",
          content: `${pretty}: requirements, funding, supervisor, deadline and the official application link.`,
        },
        { property: "og:title", content: `${pretty} — Position` },
        {
          property: "og:description",
          content: `Requirements, funding, supervisor and deadline for ${pretty}, with the official source link.`,
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
              children: JSON.stringify(jobJsonLd(loaderData)),
            },
          ]
        : [],
    };
  },
  component: OpportunityDetail,
});

function icsHref(title: string, date: string | null, url: string | null) {
  if (!date) return null;
  const d = date.replace(/-/g, "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GeoAcademic Radar//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${d}`,
    `SUMMARY:Application deadline — ${title.replace(/[,;]/g, " ")}`,
    url ? `URL:${url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

function OpportunityDetail() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(opportunityDetailQuery(slug));

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-7xl space-y-4 px-6 py-10">
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
          title="No such position record"
          description="This call may have been closed and archived, or merged with a duplicate."
        />
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <Link
            to="/jobs"
            search={{ sector: "academic" }}
            className="text-sm text-primary hover:underline"
          >
            ← Back to the jobs radar
          </Link>
        </div>
      </AppShell>
    );
  }

  const o: any = data;
  const left = daysUntil(o.application_deadline);
  const fresh = staleness(o.last_verified_at ?? o.last_checked_at);
  const topics = (o.opportunity_topics ?? []).map((t: any) => t.research_topics?.name);
  const ics = icsHref(o.title, o.application_deadline, o.application_url);

  return (
    <AppShell>
      <PageHeader
        eyebrow={`${TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type} · ${STATUS_LABEL[o.status] ?? o.status}`}
        title={o.title}
        description={
          o.institutions
            ? `${o.institutions.name}${o.departments?.name ? " · " + o.departments.name : ""}`
            : "Institution not recorded"
        }
        actions={
          <div className="flex flex-col items-end gap-2">
            <EvidenceDrawer
              entityType="opportunity"
              entityId={o.id}
              title={o.title}
              verification={o.verification_status}
              confidence={o.confidence}
              lastVerified={o.last_verified_at ?? o.last_checked_at}
              isDemo={o.is_demo}
            />
            <span className={`text-[0.68rem] ${fresh.tone}`}>{fresh.label}</span>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatTile
            label="Deadline"
            value={formatDate(o.application_deadline)}
            tone="deadline"
            hint={left == null ? "No deadline stated" : left < 0 ? "Passed" : `${left} days left`}
          />
          <StatTile label="Start" value={formatDate(o.start_date)} />
          <StatTile label="Funding" value={o.funding_type ?? "Not stated"} tone="growth" />
          <StatTile
            label="Location"
            value={[o.city, o.country].filter(Boolean).join(", ") || "Not stated"}
            tone="signal"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {o.application_url ? (
            <a
              href={o.application_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Apply on the official page
            </a>
          ) : null}
          {o.official_source_url ? (
            <a
              href={o.official_source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:border-primary/40 hover:text-primary"
            >
              Source announcement
            </a>
          ) : null}
          {ics ? (
            <a
              href={ics}
              download={`${o.slug}-deadline.ics`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:border-primary/40 hover:text-primary"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Add deadline to calendar
            </a>
          ) : null}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-md border border-deadline/30 bg-deadline/5 p-3 text-[0.7rem] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-deadline" />
          <span>
            Calls close without notice and wording changes. Confirm the deadline, eligibility and
            funding on the official page before you invest time — we mirror what the source said
            when we last checked it, nothing more.
          </span>
        </div>

        {topics.length ? (
          <div className="mt-6">
            <TopicPills topics={topics} />
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <section>
              <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {o.description ?? "No description recorded beyond the title."}
              </p>
            </section>
            <section>
              <h2 className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Requirements
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {o.requirements ?? "Not stated in the source we captured."}
              </p>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="panel p-4 text-xs">
              <p className="flex items-center gap-2 text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" /> Supervisor
              </p>
              {o.researchers ? (
                <Link
                  to="/researchers/$slug"
                  params={{ slug: o.researchers.slug }}
                  className="mt-1 block text-sm text-primary hover:underline"
                >
                  {o.researchers.full_name}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-foreground">
                  {o.supervisor_name ?? "Not stated"}
                </p>
              )}
            </div>
            {o.institutions ? (
              <div className="panel p-4 text-xs">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Host
                </p>
                <Link
                  to="/institutions/$slug"
                  params={{ slug: o.institutions.slug }}
                  className="mt-1 block text-sm text-primary hover:underline"
                >
                  {o.institutions.name}
                </Link>
              </div>
            ) : null}
            {o.projects ? (
              <div className="panel p-4 text-xs">
                <p className="text-muted-foreground">Linked project</p>
                <p className="mt-1 text-sm text-foreground">
                  {o.projects.acronym ? `${o.projects.acronym} — ` : ""}
                  {o.projects.name}
                </p>
              </div>
            ) : null}
            <div className="panel p-4 text-xs">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> Tracking
              </p>
              <p className="mono-num mt-1 leading-relaxed text-muted-foreground">
                first seen {formatDate(o.first_discovered_at?.slice(0, 10) ?? null)}
                <br />
                last checked {formatDate(o.last_checked_at?.slice(0, 10) ?? null)}
                <br />
                salary: {o.salary_text ?? "not stated"}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
