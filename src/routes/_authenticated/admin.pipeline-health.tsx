import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Database, Download, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPipelineHealth, runDiscovery, runQueue, requeueDeadTasks } from "@/lib/pipeline.functions";
import { NvidiaEnginePanel } from "@/components/admin/NvidiaEnginePanel";
import { SchedulerPanel } from "@/components/admin/SchedulerPanel";
import { OperatingModePanel } from "@/components/admin/OperatingModePanel";
import { RealDataMigrationPanel } from "@/components/admin/RealDataMigrationPanel";


export const Route = createFileRoute("/_authenticated/admin/pipeline-health")({
  head: () => ({
    meta: [
      { title: "Pipeline health — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Live diagnostic of the ingestion pipeline: registered sources, fetched raw pages, classification results, normalization outcomes and canonical records.",
      },
      { property: "og:title", content: "Pipeline health — GeoAcademic Radar" },
      {
        property: "og:description",
        content: "Where the academic data pipeline stops: source, fetch, classify, normalize and canonical stage counts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PipelineHealthPage,
});

const STAGES = [
  { key: "DISCOVERY", label: "1. Discovery", desc: "Institution-scoped source registry" },
  { key: "FETCH", label: "2. Fetch", desc: "Robots-respecting HTTP retrieval" },
  { key: "CLASSIFY", label: "3. Classify", desc: "Page type + confidence" },
  { key: "NORMALIZE", label: "4. Normalize", desc: "Structured extraction" },
  { key: "CANONICAL", label: "5. Canonical", desc: "Source-backed records" },
] as const;

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" }) {
  const color =
    tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-400" : tone === "good" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function PipelineHealthPage() {
  const health = useServerFn(getPipelineHealth);
  const discover = useServerFn(runDiscovery);
  const queue = useServerFn(runQueue);
  const requeue = useServerFn(requeueDeadTasks);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => health(),
    refetchInterval: 20_000,
  });

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try {
      const result = await fn();
      toast.success(`${name} finished`, { description: JSON.stringify(result).slice(0, 300) });
      await refetch();
    } catch (e) {
      toast.error(`${name} failed`, { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts;
  const stageValue = (key: string): number => {
    if (!counts) return 0;
    if (key === "DISCOVERY") return counts.sources_total;
    if (key === "FETCH") return counts.raw_total;
    if (key === "CLASSIFY") return counts.raw_classified;
    if (key === "NORMALIZE") return counts.raw_normalized;
    return counts.canonical_opportunities_real;
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Pipeline health"
        description="Every number below is read live from the database. If a stage reads zero, that is exactly where ingestion stops — no record is ever invented to fill the gap."
      />

      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Diagnostic could not run</p>
              <p className="text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
            </div>
          </div>
        ) : null}

        {isLoading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-border/60 bg-card/40 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Database className="h-4 w-4 text-primary" /> Environment
              </h2>
              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">Backend URL</dt>
                  <dd className="mt-1 break-all font-mono text-foreground">{data.env.supabase_url}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">Project</dt>
                  <dd className="mt-1 break-all font-mono text-foreground">{data.env.project_id}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Where the pipeline stops</h2>
              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
                {STAGES.map((stage, idx) => {
                  const value = stageValue(stage.key);
                  const isBlock = data.bottleneck.stage === stage.key;
                  return (
                    <div key={stage.key} className="flex flex-1 items-center gap-2">
                      <div
                        className={`w-full rounded-lg border p-3 ${
                          isBlock
                            ? "border-destructive/60 bg-destructive/10"
                            : value > 0
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/60 bg-card/40"
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{stage.label}</div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
                        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{stage.desc}</div>
                        {isBlock ? (
                          <div className="mt-2 flex items-start gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Blocked here
                          </div>
                        ) : null}
                      </div>
                      {idx < STAGES.length - 1 ? (
                        <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{data.bottleneck.stage}:</span> {data.bottleneck.reason}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Stage counters</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                <Stat label="Sources" value={counts!.sources_total} />
                <Stat label="Pending fetch" value={counts!.sources_pending} tone="warn" />
                <Stat label="Fetched" value={counts!.sources_fetched} tone="good" />
                <Stat label="Failed" value={counts!.sources_failed} tone="bad" />
                <Stat label="Blocked (robots/HTTP)" value={counts!.sources_blocked} tone="bad" />
                <Stat label="Raw pages" value={counts!.raw_total} />
                <Stat label="Classified" value={counts!.raw_classified} />
                <Stat label="Normalized" value={counts!.raw_normalized} tone="good" />
                <Stat label="Skipped" value={counts!.raw_skipped} tone="warn" />
                <Stat label="Normalize failures" value={counts!.raw_failed} tone="bad" />
                <Stat label="Tasks queued" value={counts!.tasks_queued} />
                <Stat label="Tasks retrying" value={counts!.tasks_retry} tone="warn" />
                <Stat label="Tasks dead" value={counts!.tasks_dead} tone="bad" />
                <Stat label="Tasks complete" value={counts!.tasks_complete} tone="good" />
                <Stat label="Change log entries" value={counts!.changes_total} />
                <Stat label="Positions (source-backed)" value={counts!.canonical_opportunities_real} tone="good" />
                <Stat label="Positions (demo)" value={counts!.canonical_opportunities_demo} tone="warn" />
                <Stat label="Institutions (source-backed)" value={counts!.canonical_institutions_real} tone="good" />
                <Stat label="Institutions (demo)" value={counts!.canonical_institutions_demo} tone="warn" />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Run the pipeline</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Admin sign-in required. Discovery is scoped to one institution's own hosts and honours robots.txt.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => act("Discovery (University of Stuttgart)", () => discover({ data: { institutionSlug: "university-of-stuttgart" } }))}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Discover Stuttgart sources
                </Button>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("Queue run", () => queue({ data: { limit: 8 } }))}>
                  <Activity className="mr-1.5 h-3.5 w-3.5" /> Process 8 queued tasks
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("Requeue", () => requeue())}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Requeue failed tasks
                </Button>
              </div>
              {busy ? <p className="mt-2 text-xs text-muted-foreground">Running {busy}…</p> : null}
            </section>

            <NvidiaEnginePanel />

            <RealDataMigrationPanel />

            <OperatingModePanel />

            <SchedulerPanel />




            <section className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Classification breakdown</h2>
                <ul className="mt-3 space-y-1 text-sm">
                  {data.classification_breakdown.length === 0 ? (
                    <li className="text-muted-foreground">No raw pages classified yet.</li>
                  ) : (
                    data.classification_breakdown.map((c) => (
                      <li key={c.classification} className="flex justify-between rounded border border-border/50 px-3 py-1.5">
                        <span className="font-mono text-xs text-foreground">{c.classification}</span>
                        <span className="tabular-nums text-muted-foreground">{c.count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Sources failing or blocked</h2>
                <ul className="mt-3 space-y-1 text-sm">
                  {data.failing_sources.length === 0 ? (
                    <li className="text-muted-foreground">No failing sources.</li>
                  ) : (
                    data.failing_sources.map((s) => (
                      <li key={s.id} className="rounded border border-border/50 px-3 py-1.5">
                        <p className="break-all font-mono text-[11px] text-foreground">{s.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.status} {s.last_http_status ? `· HTTP ${s.last_http_status}` : ""} {s.last_error ? `· ${s.last_error}` : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Most recent raw pages</h2>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-card/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Page</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Conf.</th>
                      <th className="px-3 py-2 font-medium">Normalization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_raw.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted-foreground" colSpan={4}>
                          Nothing fetched yet.
                        </td>
                      </tr>
                    ) : (
                      data.recent_raw.map((r) => (
                        <tr key={r.id} className="border-t border-border/50">
                          <td className="max-w-[22rem] px-3 py-2">
                            <p className="truncate text-foreground">{r.page_title ?? "Untitled"}</p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground">{r.final_url}</p>
                          </td>
                          <td className="px-3 py-2 font-mono">{r.classification ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{r.classification_confidence?.toFixed(2) ?? "—"}</td>
                          <td className="px-3 py-2">
                            {r.normalization_status ?? "—"}
                            {r.normalization_error ? (
                              <span className="block text-[10px] text-muted-foreground">{r.normalization_error}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">Recent fetch runs</h2>
              <ul className="mt-3 space-y-1 text-xs">
                {data.recent_runs.length === 0 ? (
                  <li className="text-muted-foreground">No fetch runs recorded.</li>
                ) : (
                  data.recent_runs.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-3 rounded border border-border/50 px-3 py-1.5">
                      <span className={r.success ? "text-primary" : "text-destructive"}>{r.success ? "OK" : "FAIL"}</span>
                      <span className="font-mono text-muted-foreground">{r.adapter_key}</span>
                      <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
                      <span className="tabular-nums text-muted-foreground">{r.response_time_ms ?? "—"} ms</span>
                      {r.error_message ? <span className="text-destructive">{r.error_message}</span> : null}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
