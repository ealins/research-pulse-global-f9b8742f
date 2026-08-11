import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, Play } from "lucide-react";

import { getRealDataMigration, startRealDataBackfill } from "@/lib/pipeline.functions";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint ? <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** REAL DATA MIGRATION: how far stored raw content has been turned into canonical records. */
export function RealDataMigrationPanel() {
  const load = useServerFn(getRealDataMigration);
  const start = useServerFn(startRealDataBackfill);
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["real-data-migration"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    retry: false,
  });
  const enqueue = useMutation({
    mutationFn: () => start(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["real-data-migration"] }),
  });

  if (error) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/40 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4 text-primary" /> Real data migration
        </h2>
        <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-muted-foreground">
          Migration metrics need an admin session: {error instanceof Error ? error.message : String(error)}
        </p>
      </section>
    );
  }
  if (!data) return null;

  const i = data.institutions;

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4 text-primary" /> Real data migration
        </h2>
        <button
          type="button"
          onClick={() => enqueue.mutate()}
          disabled={enqueue.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" /> {enqueue.isPending ? "Enqueuing…" : "Enqueue backfill"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Turns already-stored raw pages into canonical records. No refetching, no new crawling — the deployed loop drains
        the queue on its own cadence.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Raw pages stored" value={data.raw_pages} />
        <Metric label="Semantically processed" value={data.raw_processed} />
        <Metric label="Awaiting extraction" value={data.raw_pending} />
        <Metric label="Manual-review candidates" value={data.manual_review} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Entity</th>
              <th className="py-1 pr-3 font-medium">Candidate pages</th>
              <th className="py-1 pr-3 font-medium">Real records</th>
              <th className="py-1 font-medium">Demo remaining</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {data.candidates.map((row) => (
              <tr key={row.classification} className="border-t border-border/40">
                <td className="py-1.5 pr-3 text-foreground">{row.label}</td>
                <td className="py-1.5 pr-3 tabular-nums">{row.candidates}</td>
                <td className="py-1.5 pr-3 tabular-nums text-primary">{row.created_real}</td>
                <td className="py-1.5 tabular-nums">{row.demo_remaining}</td>
              </tr>
            ))}
            <tr className="border-t border-border/40">
              <td className="py-1.5 pr-3 text-foreground">Publications (OpenAlex / Crossref)</td>
              <td className="py-1.5 pr-3 tabular-nums">{i.with_openalex_identity} institutions</td>
              <td className="py-1.5 pr-3 tabular-nums text-primary">{data.publications.provider_backed}</td>
              <td className="py-1.5 tabular-nums">{data.publications.demo_remaining}</td>
            </tr>
            <tr className="border-t border-border/40">
              <td className="py-1.5 pr-3 text-foreground">Institutions promoted</td>
              <td className="py-1.5 pr-3 tabular-nums">{i.total}</td>
              <td className="py-1.5 pr-3 tabular-nums text-primary">{i.source_backed}</td>
              <td className="py-1.5 tabular-nums">{i.demo_remaining}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="NVIDIA calls" value={data.model.calls} />
        <Metric label="Cache hits" value={data.model.cache_hits} />
        <Metric label="Validation rejects" value={data.model.validation_rejects} />
        <Metric
          label="Queued migration work"
          value={data.queue.normalize_open + data.queue.promote_open + data.queue.publications_open}
          hint={`${data.queue.normalize_open} extract · ${data.queue.promote_open} promote · ${data.queue.publications_open} publications`}
        />
      </div>
    </section>
  );
}
