import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { openEngine } from "@/lib/open-engine-client";

const DEPLOYMENT_MARKER = "ssr-prefetch-v1";

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
          // Public availability is defined by the RLS-protected Supabase surface.
          // Open Engine feeds are folded into the visible event/opportunity counts
          // because those entities currently live in the Open Engine read model,
          // not the legacy public tables counted by public_surface_counts().
          const [publicSurface, engineHealth, engineEvents, engineOpportunities, rawHealth, fetchQueue] = await Promise.all([
            supabaseAdmin.rpc("public_surface_counts"),
            openEngine
              .health()
              .then((value) => ({ ok: Boolean(value?.ok) }))
              .catch((error) => {
                console.warn("[data-health] Open Engine health check failed", error);
                return { ok: false };
              }),
            openEngine
              .latest("event", 200)
              .then((value) => ({ ok: true, count: value.items.length }))
              .catch((error) => {
                console.warn("[data-health] Open Engine event count failed", error);
                return { ok: false, count: 0 };
              }),
            openEngine
              .latest("opportunity", 200)
              .then((value) => ({ ok: true, count: value.items.length }))
              .catch((error) => {
                console.warn("[data-health] Open Engine opportunity count failed", error);
                return { ok: false, count: 0 };
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
              .select("status, task_type")
              .eq("task_type", "FETCH")
              .in("status", ["QUEUED", "RETRY", "PROCESSING"])
              .then(({ data, error }) => ({
                ok: !error,
                queued: (data ?? []).filter((row) => row.status === "QUEUED").length,
                retry: (data ?? []).filter((row) => row.status === "RETRY").length,
                processing: (data ?? []).filter((row) => row.status === "PROCESSING").length,
              })),
          ]);

          if (publicSurface.error) {
            throw new Error(`public_surface_counts: ${publicSurface.error.message}`);
          }

          const counts = {
            ...(publicSurface.data ?? {}),
            events: engineEvents.ok ? engineEvents.count : Number((publicSurface.data as any)?.events ?? 0),
            opportunities: engineOpportunities.ok
              ? engineOpportunities.count
              : Number((publicSurface.data as any)?.opportunities ?? 0),
          };

          return json({
            ok: true,
            checked_at: checkedAt,
            deployment_marker: DEPLOYMENT_MARKER,
            public_surface_counts: counts,
            open_engine: {
              ok: engineHealth.ok && engineEvents.ok && engineOpportunities.ok,
              events: engineEvents.count,
              opportunities: engineOpportunities.count,
            },
            ingestion: {
              ok: rawHealth.ok && fetchQueue.ok,
              latest_fetched_at: rawHealth.latest_fetched_at,
              fetch_queue: {
                queued: fetchQueue.queued,
                retry: fetchQueue.retry,
                processing: fetchQueue.processing,
              },
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
