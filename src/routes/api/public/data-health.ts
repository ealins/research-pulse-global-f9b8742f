import { createFileRoute } from "@tanstack/react-router";

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
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const [
            institutions,
            researchers,
            opportunities,
            publications,
            projects,
            events,
            pulseEvents,
            ingestionTasks,
            pipelineRuns,
            llmProcessingRuns,
            publicSurface,
          ] = await Promise.all([
            supabaseAdmin
              .from("institutions")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("researchers")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("opportunities")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("publications")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("projects")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("events")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin
              .from("pulse_events")
              .select("id", { count: "exact" })
              .eq("is_demo", false)
              .limit(1),
            supabaseAdmin.from("ingestion_tasks").select("id").limit(1),
            supabaseAdmin.from("pipeline_runs").select("id").limit(1),
            supabaseAdmin.from("llm_processing_runs").select("id").limit(1),
            supabaseAdmin.rpc("public_surface_counts"),
          ]);

          const checks = [
            ["institutions", institutions],
            ["researchers", researchers],
            ["opportunities", opportunities],
            ["publications", publications],
            ["projects", projects],
            ["events", events],
            ["pulse_events", pulseEvents],
            ["ingestion_tasks", ingestionTasks],
            ["pipeline_runs", pipelineRuns],
            ["llm_processing_runs", llmProcessingRuns],
            ["public_surface_counts", publicSurface],
          ] as const;

          for (const [name, result] of checks) {
            if (result.error) throw new Error(`${name}: ${result.error.message}`);
          }

          return json({
            ok: true,
            checked_at: new Date().toISOString(),
            non_demo_totals: {
              institutions: institutions.count ?? 0,
              researchers: researchers.count ?? 0,
              opportunities: opportunities.count ?? 0,
              publications: publications.count ?? 0,
              projects: projects.count ?? 0,
              events: events.count ?? 0,
              pulse_events: pulseEvents.count ?? 0,
            },
            public_surface_counts: publicSurface.data,
          });
        } catch (error) {
          console.error("[data-health]", error);
          return json(
            {
              ok: false,
              checked_at: new Date().toISOString(),
              error: "Server data connection unavailable",
            },
            503,
          );
        }
      },
    },
  },
});
