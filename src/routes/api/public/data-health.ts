import { createFileRoute } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
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
          const [publicSurface, engineHealth, engineEvents, engineOpportunities] = await Promise.all([
            supabase.rpc("public_surface_counts"),
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
