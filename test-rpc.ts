import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://rqalvagtdcqurubrsdnc.supabase.co", "sb_publishable_8yJVc87WDX7VcPgmttVAPw_RgGNPqzY");
async function run() {
  console.log("Checking public_surface_counts...");
  const c = await supabase.rpc("public_surface_counts");
  console.log("public_surface_counts:", c);
  console.log("Checking geoacademic_open_engine_latest...");
  const e = await supabase.rpc("geoacademic_open_engine_latest", { p_entity_type: "event", p_limit: 1, p_country: null });
  console.log("geoacademic_open_engine_latest:", e);
}
run();
