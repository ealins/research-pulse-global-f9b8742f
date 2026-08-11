import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock } from "lucide-react";

import { getSchedulerHealth } from "@/lib/pipeline.functions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

/** Shows that the pipeline processes its backlog on a timer, unattended. */
export function SchedulerPanel() {
  const load = useServerFn(getSchedulerHealth);
  const { data, error } = useQuery({
    queryKey: ["scheduler-health"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    retry: false,
  });

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock className="h-4 w-4 text-primary" /> Autonomous processing
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Scheduled ticks work through the existing backlog on their own: fetch, deterministic gate, intelligence engine,
        validation, then canonical records. No manual trigger is needed.
      </p>

      {error ? (
        <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-muted-foreground">
          Scheduler status needs an admin session: {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-card/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Schedule</th>
                  <th className="px-3 py-2 font-medium">Active</th>
                  <th className="px-3 py-2 font-medium">Last run</th>
                  <th className="px-3 py-2 font-medium">Last status</th>
                  <th className="px-3 py-2 font-medium">Runs 24h</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                      No scheduled job registered yet.
                    </td>
                  </tr>
                ) : (
                  data.jobs.map((j) => (
                    <tr key={j.jobname} className="border-t border-border/40">
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">{j.jobname}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{j.schedule}</td>
                      <td className={`px-3 py-2 ${j.active ? "text-primary" : "text-amber-400"}`}>{j.active ? "yes" : "no"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmt(j.last_run_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{j.last_status ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{j.runs_24h}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-card/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Tick</th>
                  <th className="px-3 py-2 font-medium">Trigger</th>
                  <th className="px-3 py-2 font-medium">Tasks</th>
                  <th className="px-3 py-2 font-medium">OK / failed</th>
                  <th className="px-3 py-2 font-medium">Engine calls</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_ticks.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                      No automatic tick recorded yet — the first one appears within a few minutes.
                    </td>
                  </tr>
                ) : (
                  data.recent_ticks.map((t) => (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="px-3 py-2 text-muted-foreground">{fmt(t.started_at)}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{t.trigger}</td>
                      <td className="px-3 py-2 tabular-nums">{t.tasks_processed}</td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className="text-primary">{t.tasks_ok}</span> / <span className="text-amber-400">{t.tasks_failed}</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {t.nvidia_calls} {t.nvidia_cached ? `(${t.nvidia_cached} cached)` : ""}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{t.duration_ms === null ? "—" : `${t.duration_ms} ms`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
