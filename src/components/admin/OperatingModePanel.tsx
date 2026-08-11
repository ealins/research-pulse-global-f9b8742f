import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, PiggyBank, Timer } from "lucide-react";

import { getOperationsSummary } from "@/lib/pipeline.functions";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const hoursLabel = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} h`);

/** Shows the cost-conscious operating mode, per-source cadence and what the pipeline avoided paying for. */
export function OperatingModePanel() {
  const load = useServerFn(getOperationsSummary);
  const { data, error } = useQuery({
    queryKey: ["operations-summary"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    retry: false,
  });

  if (error) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gauge className="h-4 w-4 text-primary" /> Operating mode
        </h2>
        <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-muted-foreground">
          Operating metrics need an admin session: {error instanceof Error ? error.message : String(error)}
        </p>
      </section>
    );
  }

  if (!data) return null;

  const backlog = data.mode === "BACKLOG";
  const e = data.efficiency;

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Gauge className="h-4 w-4 text-primary" /> Operating mode
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            backlog ? "bg-amber-400/15 text-amber-300" : "bg-primary/15 text-primary"
          }`}
        >
          {backlog ? "Backlog mode" : "Steady state"}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" /> processes every {data.interval_minutes} min · {data.batch_size} tasks per tick
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {backlog
          ? `${data.due_tasks} tasks are due, above the switch-over point of ${data.config.backlog_threshold}, so the pipeline works through the queue on the faster cadence.`
          : `Only ${data.due_tasks} tasks are due, below the switch-over point of ${data.config.backlog_threshold}, so ticks stay cheap: an empty queue costs one database read and nothing else.`}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Tasks due now" value={data.due_tasks} />
        <Metric label="Tasks pending" value={data.pending_tasks} hint="Includes work scheduled for later" />
        <Metric label="Ticks (24h)" value={`${e.ticks_with_work} / ${e.ticks}`} hint="With work / total wake-ups" />
        <Metric label="Unchanged pages" value={`${e.unchanged_rate}%`} hint={`${e.fetches_unchanged} of ${e.fetches} fetches skipped extraction`} />
      </div>

      <h3 className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <PiggyBank className="h-3.5 w-3.5" /> Cost avoidance, last 24 h
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Deterministic rejects" value={e.deterministic_rejects} hint="Blocked before any model call" />
        <Metric label="Cache hits" value={`${e.cache_hit_rate}%`} hint={`${e.model_cached} of ${e.model_calls} calls served from cache`} />
        <Metric label="Model calls" value={e.model_calls} />
        <Metric label="Records normalized" value={e.normalized} />
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refresh cadence by source type</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-card/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Source type</th>
              <th className="px-3 py-2 font-medium">Re-checked every</th>
              <th className="px-3 py-2 font-medium">Sources</th>
              <th className="px-3 py-2 font-medium">Due now</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.category} className="border-t border-border/40">
                <td className="px-3 py-2 text-foreground">{c.label}</td>
                <td className="px-3 py-2">{hoursLabel(c.refresh_hours)}</td>
                <td className="px-3 py-2 tabular-nums">{c.sources}</td>
                <td className={`px-3 py-2 tabular-nums ${c.due_now > 0 ? "text-amber-300" : "text-muted-foreground"}`}>{c.due_now}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        A source is only re-fetched once its own interval has elapsed, and a page whose content is byte-for-byte unchanged never reaches
        the intelligence engine. Repeatedly unchanged pages back off up to {data.config.adaptive_backoff_max}× their base interval.
        Deadlines are updated daily by date arithmetic alone.
      </p>
    </section>
  );
}
