import { createFileRoute } from "@tanstack/react-router";

type Body = { action?: "enqueue-discovery" | "drain"; limit?: number; trigger?: string };

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Batch ingestion driver for the institution backlog.
 * Auth: `apikey` header must match the project publishable/anon key.
 *   POST { action: "enqueue-discovery", limit } -> queues DISCOVER tasks for institutions without sources
 *   POST { action: "drain", limit }             -> processes queued FETCH/CLASSIFY/NORMALIZE work
 */
export const Route = createFileRoute("/api/public/hooks/ingest-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = [
          process.env["SUPABASE_PUBLISHABLE_KEY"],
          process.env["SUPABASE_ANON_KEY"],
        ].filter((v): v is string => Boolean(v));
        if (!key || !expected.includes(key)) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: Body = {};
        try {
          body = (await request.json()) as Body;
        } catch {
          body = {};
        }
        const action = body.action ?? "drain";
        const limit = Math.min(50, Math.max(1, body.limit ?? 8));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enqueue, runQueueBatch } = await import("@/lib/ingest.server");

        if (action === "enqueue-discovery") {
          const { data: withSources } = await supabaseAdmin
            .from("sources")
            .select("institution_id")
            .not("institution_id", "is", null);
          const covered = new Set((withSources ?? []).map((r) => r.institution_id as string));

          const { data: pendingTasks } = await supabaseAdmin
            .from("ingestion_tasks")
            .select("institution_id")
            .eq("task_type", "DISCOVER")
            .in("status", ["QUEUED", "PROCESSING", "RETRY"]);
          for (const t of pendingTasks ?? []) {
            if (t.institution_id) covered.add(t.institution_id);
          }

          const { data: institutions, error } = await supabaseAdmin
            .from("institutions")
            .select("id, name, official_url, research_url, careers_url")
            .not("official_url", "is", null)
            .limit(500);
          if (error) return json({ error: error.message }, 500);

          // Institutions with a dedicated research/careers URL crawl best, so go first.
          const backlog = (institutions ?? [])
            .filter((i) => !covered.has(i.id))
            .sort((a, b) => {
              const score = (i: { research_url: string | null; careers_url: string | null }) =>
                (i.research_url ? 2 : 0) + (i.careers_url ? 1 : 0);
              return score(b) - score(a);
            });
          const targets = backlog.slice(0, limit);
          for (const inst of targets) {
            await enqueue("DISCOVER", { institution_id: inst.id });
          }
          return json({
            action,
            queued: targets.length,
            names: targets.map((t) => t.name),
            remaining: backlog.length - targets.length,
          });
        }

        // Every autonomous tick is recorded so /admin/pipeline-health can prove
        // that scheduled processing is really running.
        const startedAt = new Date();
        const { data: run } = await supabaseAdmin
          .from("pipeline_runs")
          .insert({ trigger: body.trigger ?? "cron", started_at: startedAt.toISOString() } as never)
          .select("id")
          .maybeSingle();

        try {
          const result = await runQueueBatch(limit);
          const { data: llm } = await supabaseAdmin
            .from("llm_processing_runs")
            .select("cached")
            .gte("created_at", startedAt.toISOString());
          const calls = llm ?? [];
          if (run?.id) {
            await supabaseAdmin
              .from("pipeline_runs")
              .update({
                finished_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt.getTime(),
                tasks_processed: result.processed,
                tasks_ok: result.ok,
                tasks_failed: result.failed,
                tasks_dead: result.dead,
                nvidia_calls: calls.length,
                nvidia_cached: calls.filter((c) => c.cached).length,
                errors: result.failed + result.dead,
                details: { sample: result.details.slice(0, 20) } as never,
              })
              .eq("id", run.id);
          }
          return json({ action: "drain", run_id: run?.id ?? null, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (run?.id) {
            await supabaseAdmin
              .from("pipeline_runs")
              .update({
                finished_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt.getTime(),
                errors: 1,
                error_message: message.slice(0, 1000),
              })
              .eq("id", run.id);
          }
          return json({ error: message }, 500);
        }
      },
    },
  },
});
