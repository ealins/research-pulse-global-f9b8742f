import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openEngine } from "@/lib/open-engine-client";

const DEPLOYMENT_MARKER = "continuous-ingestion-v2";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/public/data-health")({
  server: {
    handlers: {
      GET: async () => {
        const checkedAt = new Date().toISOString();
        try {
          // Live Supabase tables are authoritative for the public hub.
          // Open Engine is optional and must never make a healthy public surface fail.
          const [publicSurface, engineHealth, rawHealth, fetchQueue, pipelineRun] =
            await Promise.all([
              supabaseAdmin.rpc("public_surface_counts"),
              openEngine
                .health()
                .then((value) => ({ ok: Boolean(value?.ok) }))
                .catch((error) => {
                  console.warn("[data-health] Open Engine health check failed", error);
                  return { ok: false };
                }),
              supabaseAdmin
                .from("raw_records")
                .select("fetched_at")
                .order("fetched_at", { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data, error }) => ({
                  ok: !error,
                  latest_fetched_at: data?.fetched_at ?? null,
                })),
              supabaseAdmin
                .from("ingestion_tasks")
                .select("status, task_type, run_after")
                .eq("task_type", "FETCH")
                .in("status", ["QUEUED", "RETRY", "PROCESSING"])
                .then(({ data, error }) => ({
                  ok: !error,
                  queued: (data ?? []).filter((row) => row.status === "QUEUED").length,
                  retry: (data ?? []).filter((row) => row.status === "RETRY").length,
                  processing: (data ?? []).filter((row) => row.status === "PROCESSING").length,
                  oldest_due_at:
                    (data ?? [])
                      .filter((row) => row.status !== "PROCESSING" && row.run_after)
                      .map((row) => row.run_after as string)
                      .sort()[0] ?? null,
                })),
              supabaseAdmin
                .from("pipeline_runs")
                .select("id, finished_at, tasks_processed, tasks_failed, tasks_dead")
                .not("finished_at", "is", null)
                .order("finished_at", { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data, error }) => ({ ok: !error, latest: data ?? null })),
            ]);

          const counts = { ...(publicSurface.data ?? {}) };
          if (publicSurface.error) {
            console.warn(
              "[data-health] public_surface_counts failed; serving degraded payload",
              publicSurface.error,
            );
          }

          return json({
            ok: true,
            checked_at: checkedAt,
            deployment_marker: DEPLOYMENT_MARKER,
            public_surface_counts: counts,
            open_engine: {
              ok: engineHealth.ok,
              optional: true,
            },
            ingestion: {
              ok: rawHealth.ok && fetchQueue.ok && pipelineRun.ok,
              latest_fetched_at: rawHealth.latest_fetched_at,
              fetch_queue: {
                queued: fetchQueue.queued,
                retry: fetchQueue.retry,
                processing: fetchQueue.processing,
                oldest_due_at: fetchQueue.oldest_due_at,
              },
              latest_pipeline_run: pipelineRun.latest,
            },
          });
        } catch (error) {
          console.error("[data-health]", error);
          return json(
            {
              ok: false,
              checked_at: checkedAt,
              deployment_marker: DEPLOYMENT_MARKER,
              error: "Public data connection unavailable",
            },
            503,
          );
        }
      },
    },
  },
});
