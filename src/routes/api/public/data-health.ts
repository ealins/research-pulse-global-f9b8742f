import { createFileRoute } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { openEngine } from "@/lib/open-engine-client";

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
          // Open Engine is reported independently so a transient server-to-server
          // health request cannot turn otherwise healthy public data into a 503.
          const [publicSurface, engineResult] = await Promise.all([
            supabase.rpc("public_surface_counts"),
            openEngine
              .health()
              .then((value) => ({ ok: Boolean(value?.ok) }))
              .catch((error) => {
                console.warn("[data-health] Open Engine check failed", error);
                return { ok: false };
              }),
          ]);

          if (publicSurface.error) {
            throw new Error(`public_surface_counts: ${publicSurface.error.message}`);
          }

          return json({
            ok: true,
            checked_at: checkedAt,
            public_surface_counts: publicSurface.data,
            open_engine: engineResult,
          });
        } catch (error) {
          console.error("[data-health]", error);
          return json(
            {
              ok: false,
              checked_at: checkedAt,
              error: "Public data connection unavailable",
            },
            503,
          );
        }
      },
    },
  },
});
