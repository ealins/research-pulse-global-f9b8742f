import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_STATUSES = ["verified", "auto_discovered", "possibly_outdated"] as const;

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

          const tables = [
            "institutions",
            "researchers",
            "opportunities",
            "publications",
            "projects",
            "events",
            "pulse_events",
          ] as const;

          const totals = Object.fromEntries(
            await Promise.all(
              tables.map(async (table) => {
                const { count, error } = await supabaseAdmin
                  .from(table)
                  .select("id", { count: "exact" })
                  .eq("is_demo", false)
                  .limit(1);
                if (error) throw new Error(`${table}: ${error.message}`);
                return [table, count ?? 0] as const;
              }),
            ),
          );

          const publicCounts = Object.fromEntries(
            await Promise.all(
              [
                "institutions",
                "researchers",
                "opportunities",
                "publications",
                "projects",
                "events",
              ].map(async (table) => {
                let query = supabaseAdmin
                  .from(table as "institutions")
                  .select("id", { count: "exact" })
                  .eq("is_demo", false)
                  .in("verification_status", PUBLIC_STATUSES)
                  .limit(1);

                if (table === "opportunities") {
                  query = query
                    .in("status", ["open", "closing_soon", "rolling", "possibly_open"])
                    .in("confidence", ["high", "medium"])
                    .not("official_source_url", "is", null);
                }

                const { count, error } = await query;
                if (error) throw new Error(`${table}: ${error.message}`);
                return [table, count ?? 0] as const;
              }),
            ),
          );

          return json({
            ok: true,
            checked_at: new Date().toISOString(),
            non_demo_totals: totals,
            public_candidate_counts: publicCounts,
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
