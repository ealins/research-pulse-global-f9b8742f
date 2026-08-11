import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Filter, MapPin, Timer, UserRound } from "lucide-react";

import { AppShell, PageHeader, ProvenanceChips, StatTile, TopicPills } from "@/components/layout/AppShell";
import {
  STATUS_LABEL,
  TYPE_LABEL,
  daysUntil,
  formatDate,
  opportunitiesQuery,
} from "@/lib/radar-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs & PhD Radar — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "PhD positions, doctoral researcher posts, postdocs and research assistant jobs in photogrammetry, remote sensing and geoinformatics — each with deadline, supervisor and official source link.",
      },
      { property: "og:title", content: "Jobs & PhD Radar — GeoAcademic Radar" },
      {
        property: "og:description",
        content:
          "Academic vacancies in photogrammetry, remote sensing and geoinformatics, with deadlines and official source links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

const STATUS_TONE: Record<string, string> = {
  open: "border-growth/40 bg-growth/10 text-growth",
  closing_soon: "border-deadline/40 bg-deadline/15 text-deadline",
  rolling: "border-primary/40 bg-primary/10 text-primary",
  possibly_open: "border-signal/40 bg-signal/10 text-signal",
  closed: "border-border bg-muted/60 text-muted-foreground",
  archived: "border-border bg-muted/60 text-muted-foreground",
};

function JobsPage() {
  const { data, isLoading, error } = useQuery(opportunitiesQuery);
  const [status, setStatus] = useState<string>("live");
  const [type, setType] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [q, setQ] = useState("");

  const countries = useMemo(
    () => Array.from(new Set((data ?? []).map((o) => o.country).filter(Boolean) as string[])).sort(),
    [data],
  );

  const rows = useMemo(() => {
    const live = ["open", "closing_soon", "rolling", "possibly_open"];
    return (data ?? []).filter((o) => {
      if (status === "live" && !live.includes(o.status)) return false;
      if (status !== "live" && status !== "all" && o.status !== status) return false;
      if (type !== "all" && o.opportunity_type !== type) return false;
      if (country !== "all" && o.country !== country) return false;
      if (q.trim()) {
        const hay = [
          o.title,
          o.description,
          o.supervisor_name,
          o.institutions?.name,
          ...o.opportunity_topics.map((t) => t.research_topics?.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [data, status, type, country, q]);

  const closingSoon = (data ?? []).filter((o) => o.status === "closing_soon").length;
  const openNow = (data ?? []).filter((o) => o.status === "open").length;
  const withDeadline = (data ?? []).filter(
    (o) => (daysUntil(o.application_deadline) ?? -1) >= 0,
  ).length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Opportunity radar"
        title="Jobs & PhD positions"
        description="Doctoral, postdoctoral and research staff vacancies across photogrammetry, remote sensing and geoinformatics. Statuses are deliberately cautious — a position is only 'open' when the source says so."
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Open now" value={openNow} tone="growth" />
          <StatTile label="Closing soon" value={closingSoon} tone="deadline" hint="Within 14 days" />
          <StatTile label="Dated calls" value={withDeadline} tone="signal" />
          <StatTile label="Tracked total" value={data?.length ?? "—"} />
        </section>

        <section className="panel mt-8 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, topic, supervisor…"
              className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
            />
            <Select value={status} onChange={setStatus} label="Status">
              <option value="live">Live calls</option>
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select value={type} onChange={setType} label="Type">
              <option value="all">All types</option>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select value={country} onChange={setCountry} label="Country">
              <option value="all">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </section>

        {error ? (
          <p className="mt-6 text-sm text-destructive">Positions could not be loaded.</p>
        ) : null}

        {isLoading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((o) => {
              const d = daysUntil(o.application_deadline);
              return (
                <li key={o.id} className="panel panel-hover rise-in p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wider ${
                        STATUS_TONE[o.status] ?? STATUS_TONE.closed
                      }`}
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                      {TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type}
                    </span>
                    <ProvenanceChips
                      verification={o.verification_status}
                      confidence={o.confidence}
                      isDemo={o.is_demo}
                    />
                  </div>

                  <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground">
                    {o.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {o.institutions?.name ?? "Institution not stated"}
                  </p>

                  {o.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                      {o.description}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                    <Meta icon={Timer} label="Deadline">
                      {o.application_deadline ? (
                        <>
                          {formatDate(o.application_deadline)}
                          {d !== null && d >= 0 ? (
                            <span className="mono-num ml-1 text-deadline">({d} d left)</span>
                          ) : null}
                        </>
                      ) : (
                        "Rolling / not stated"
                      )}
                    </Meta>
                    <Meta icon={UserRound} label="Supervisor">
                      {o.supervisor_name ?? "Not stated"}
                    </Meta>
                    <Meta icon={MapPin} label="Location">
                      {[o.city, o.country].filter(Boolean).join(", ") || "Not stated"}
                    </Meta>
                    <Meta icon={Timer} label="Funding">
                      {o.funding_type ?? "Not stated"}
                    </Meta>
                  </div>

                  <div className="mt-4">
                    <TopicPills
                      topics={o.opportunity_topics.map((t) => t.research_topics?.name)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {o.application_url ? (
                      <a
                        href={o.application_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Apply via source <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {o.official_source_url ? (
                      <a
                        href={o.official_source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        Official source <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    <span className="self-center text-[0.68rem] text-muted-foreground">
                      Last checked{" "}
                      {o.last_checked_at
                        ? new Date(o.last_checked_at).toLocaleDateString()
                        : "not recorded"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoading && rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No positions match these filters. Widen the status filter to see closed and archived
            calls.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
      >
        {children}
      </select>
    </label>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Timer;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-foreground/85">{children}</p>
    </div>
  );
}
