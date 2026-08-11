import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  ExternalLink,
  GraduationCap,
  MapPin,
  Users,
  FlaskConical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvenanceChips } from "@/components/layout/AppShell";
import { institutionDetailQuery } from "@/lib/detail-queries";
import { daysUntil, formatDate, STATUS_LABEL } from "@/lib/radar-queries";

type Metric = {
  key: string;
  label: string;
  value: number;
  icon: typeof Users;
  tone: string;
};

/** A compact visual "snapshot" of one institution: metrics, topic strength and live calls. */
export function InstitutionSnapshot({
  slug,
  open,
  onOpenChange,
}: {
  slug: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    ...institutionDetailQuery(slug ?? ""),
    enabled: Boolean(slug) && open,
  });

  const inst = data?.institution as any;

  const metrics: Metric[] = useMemo(() => {
    if (!data) return [];
    const openCalls = data.opportunities.filter((o: any) =>
      ["open", "closing_soon", "rolling", "possibly_open"].includes(o.status),
    ).length;
    return [
      { key: "calls", label: "Open calls", value: openCalls, icon: Briefcase, tone: "text-deadline" },
      { key: "people", label: "Researchers", value: data.researchers.length, icon: Users, tone: "text-signal" },
      { key: "projects", label: "Projects", value: data.projects.length, icon: FlaskConical, tone: "text-primary" },
      { key: "pubs", label: "Publications", value: data.publications.length, icon: BookOpen, tone: "text-growth" },
      { key: "courses", label: "Programmes", value: data.courses.length, icon: GraduationCap, tone: "text-primary" },
    ];
  }, [data]);

  const maxMetric = Math.max(1, ...metrics.map((m) => m.value));

  const topics = useMemo(() => {
    const list = (inst?.institution_topics ?? []) as any[];
    return list
      .map((t) => ({
        name: t.research_topics?.name as string,
        slug: t.research_topics?.slug as string,
        weight: Number(t.weight) || 1,
      }))
      .filter((t) => t.name)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [inst]);

  const maxTopic = Math.max(1, ...topics.map((t) => t.weight));

  const liveCalls = ((data?.opportunities ?? []) as any[])
    .filter((o) => ["open", "closing_soon", "rolling", "possibly_open"].includes(o.status))
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        {isLoading || !inst ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-primary">
                Institution snapshot
              </p>
              <DialogTitle className="font-display text-xl leading-tight">{inst.name}</DialogTitle>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {[inst.city, inst.country, inst.continent].filter(Boolean).join(" · ")}
                {inst.abbreviation ? <span className="mono-num">{inst.abbreviation}</span> : null}
              </p>
              <div className="pt-1">
                <ProvenanceChips
                  verification={inst.verification_status}
                  isDemo={inst.is_demo}
                />
              </div>
            </DialogHeader>

            {/* metric bars — the "overall" read at a glance */}
            <div className="grid gap-2 sm:grid-cols-5">
              {metrics.map((m) => (
                <div key={m.key} className="panel p-3">
                  <m.icon className={`h-3.5 w-3.5 ${m.tone}`} />
                  <p className={`mono-num mt-1.5 text-2xl font-semibold ${m.tone}`}>{m.value}</p>
                  <p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-700"
                      style={{ width: `${(m.value / maxMetric) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {topics.length ? (
              <section>
                <h3 className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Research strength
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {topics.map((t) => (
                    <li key={t.slug} className="flex items-center gap-3">
                      <Link
                        to="/topics/$slug"
                        params={{ slug: t.slug }}
                        className="w-44 shrink-0 truncate text-xs text-foreground hover:text-primary"
                      >
                        {t.name}
                      </Link>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary transition-all duration-700"
                          style={{ width: `${(t.weight / maxTopic) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {liveCalls.length ? (
              <section>
                <h3 className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Live calls
                </h3>
                <ul className="mt-2 space-y-2">
                  {liveCalls.map((o: any) => {
                    const d = daysUntil(o.application_deadline);
                    return (
                      <li key={o.id} className="panel panel-hover flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <Link
                            to="/jobs/$slug"
                            params={{ slug: o.slug }}
                            className="block truncate text-xs font-medium text-foreground hover:text-primary"
                          >
                            {o.title}
                          </Link>
                          <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                            {STATUS_LABEL[o.status] ?? o.status} ·{" "}
                            {o.application_deadline ? formatDate(o.application_deadline) : "no deadline listed"}
                            {d !== null && d >= 0 ? ` · ${d}d left` : ""}
                          </p>
                        </div>
                        {o.application_url ? (
                          <a
                            href={o.application_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-0.5 shrink-0 text-[0.68rem] font-medium text-primary hover:underline"
                          >
                            Apply <ExternalLink className="inline h-3 w-3" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <p className="text-xs text-muted-foreground">
                No open calls recorded for this institution right now.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
              <Link
                to="/institutions/$slug"
                params={{ slug: inst.slug }}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Full profile <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              {inst.official_url ? (
                <a
                  href={inst.official_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-primary hover:underline"
                >
                  Official site <ExternalLink className="inline h-3 w-3" />
                </a>
              ) : null}
              {inst.careers_url ? (
                <a
                  href={inst.careers_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-primary hover:underline"
                >
                  Vacancies <ExternalLink className="inline h-3 w-3" />
                </a>
              ) : null}
              {inst.last_verified_at ? (
                <span className="text-[0.65rem] text-muted-foreground">
                  Last verified {formatDate(inst.last_verified_at)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
