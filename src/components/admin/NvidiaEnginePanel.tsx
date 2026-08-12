import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BrainCircuit, FlaskConical, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getNvidiaStatus,
  runEntityExtractionTest,
  runVacancyExtractionTest,
  testNvidiaConnection,
  type EntityKind,
  type EntityTestRow,
  type VacancyTestRow,
} from "@/lib/nvidia.functions";

const ENTITY_TESTS: { kind: EntityKind; label: string }[] = [
  { kind: "PROJECT", label: "Projects" },
  { kind: "PROGRAMME", label: "Programmes" },
  { kind: "RESEARCHER", label: "Researchers" },
  { kind: "EVENT", label: "Events" },
];

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "warn";
}) {
  const color =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "good"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Live monitor for the semantic extraction engine. Never displays secrets. */
export function NvidiaEnginePanel() {
  const status = useServerFn(getNvidiaStatus);
  const test = useServerFn(testNvidiaConnection);
  const runTest = useServerFn(runVacancyExtractionTest);
  const runEntityTest = useServerFn(runEntityExtractionTest);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<(VacancyTestRow | EntityTestRow)[] | null>(null);

  const { data, refetch, error } = useQuery({
    queryKey: ["nvidia-status"],
    queryFn: () => status(),
    refetchInterval: 30_000,
    retry: false,
  });

  const onTestConnection = async () => {
    setBusy("connection");
    try {
      const result = await test();
      if (result.model_available) {
        toast.success("Intelligence engine reachable", {
          description: `${result.model} · ${result.latency_ms} ms`,
        });
      } else {
        toast.error("Intelligence engine unavailable", {
          description:
            `${result.error_code ?? "error"}: ${result.error_message ?? "unknown"}`.slice(0, 300),
        });
      }
      await refetch();
    } catch (e) {
      toast.error("Connection test failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  const onPrecisionTest = async () => {
    setBusy("precision");
    try {
      const result = await runTest({ data: { limit: 10 } });
      setRows(result.rows);
      toast.success("Controlled extraction test finished", {
        description: `${result.rows.length} pages evaluated`,
      });
      await refetch();
    } catch (e) {
      toast.error("Extraction test failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  const onEntityTest = async (kind: EntityKind) => {
    setBusy(kind);
    try {
      const result = await runEntityTest({ data: { entity: kind, limit: 10 } });
      setRows(result.rows);
      toast.success(`${kind.toLowerCase()} test finished`, {
        description: `${result.rows.length} pages evaluated`,
      });
      await refetch();
    } catch (e) {
      toast.error("Extraction test failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" /> Intelligence engine (NVIDIA Nemotron)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Semantic extraction runs only after the deterministic gates. The model can reject a page
            but never promote one the gate refused, and nothing unvalidated reaches a canonical
            record.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onTestConnection}>
            <Plug className="mr-1.5 h-3.5 w-3.5" /> Test NVIDIA
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={onPrecisionTest}>
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Vacancies: 10-page test
          </Button>
          {ENTITY_TESTS.map((t) => (
            <Button
              key={t.kind}
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => onEntityTest(t.kind)}
            >
              <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> {t.label}: 10-page test
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-muted-foreground">
          Engine status needs an admin session:{" "}
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {data ? (
        <>
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-wide text-muted-foreground">Model</dt>
              <dd className="mt-1 break-all font-mono text-foreground">{data.model}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-muted-foreground">Key configured</dt>
              <dd
                className={`mt-1 font-mono ${data.secret_configured ? "text-primary" : "text-destructive"}`}
              >
                {data.secret_configured ? "yes" : "no — set the NVIDIA key"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Metric label="Requests (24h)" value={data.requests_today} />
            <Metric label="Succeeded" value={data.success} tone="good" />
            <Metric label="Cache hits" value={data.cached} tone="good" />
            <Metric label="Retried" value={data.retries} tone="warn" />
            <Metric label="Validation rejects" value={data.validation_failed} tone="warn" />
            <Metric label="Failed" value={data.failed} tone="bad" />
            <Metric
              label="Avg latency"
              value={data.avg_latency_ms === null ? "—" : `${data.avg_latency_ms} ms`}
            />
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            Last success:{" "}
            {data.last_success_at ? new Date(data.last_success_at).toLocaleString() : "none yet"}
            {data.last_error
              ? ` · Last error: ${data.last_error.code ?? "error"} — ${(data.last_error.message ?? "").slice(0, 160)}`
              : ""}
          </p>

          {data.recent.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-card/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Operation</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Attempt</th>
                    <th className="px-3 py-2 font-medium">Latency</th>
                    <th className="px-3 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">
                        {r.operation}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {r.model}
                      </td>
                      <td className="px-3 py-2">
                        {r.status}
                        {r.cached ? " (cached)" : ""}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.attempt}</td>
                      <td className="px-3 py-2 tabular-nums">{r.latency_ms ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.error_code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      {rows ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-card/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Page</th>
                <th className="px-3 py-2 font-medium">Deterministic gate</th>
                <th className="px-3 py-2 font-medium">Nemotron</th>
                <th className="px-3 py-2 font-medium">Final</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.url}-${i}`} className="border-t border-border/40 align-top">
                  <td className="max-w-[22rem] px-3 py-2">
                    <p className="text-foreground">{r.title || "(untitled)"}</p>
                    <p className="break-all font-mono text-[10px] text-muted-foreground">{r.url}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.deterministic}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.nemotron}</td>
                  <td
                    className={`px-3 py-2 font-medium ${r.final.startsWith("ACCEPTED") ? "text-primary" : "text-amber-400"}`}
                  >
                    {r.final}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.confidence === null ? "—" : r.confidence.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
