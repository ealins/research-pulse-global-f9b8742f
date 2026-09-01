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
          // This is a public health route. It must not require the service-role key:
          // Cloudflare production can validate the same RLS-protected data that the
          // browser is allowed to read using the publishable client.
          const [publicSurface, engineHealth] = await Promise.all([
            supabase.rpc("public_surface_counts"),
            openEngine.health(),
          ]);

          if (publicSurface.error) {
            throw new Error(`public_surface_counts: ${publicSurface.error.message}`);
          }
          if (!engineHealth?.ok) {
            throw new Error("Open Engine health check failed");
          }

          return json({
            ok: true,
            checked_at: checkedAt,
            public_surface_counts: publicSurface.data,
            open_engine: { ok: true },
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
