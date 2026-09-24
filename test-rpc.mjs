import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://rqalvagtdcqurubrsdnc.supabase.co", "sb_publishable_8yJVc87WDX7VcPgmttVAPw_RgGNPqzY");
async function run() {
  try {
    const e = await supabase.rpc("geoacademic_open_engine_latest", { p_entity_type: "event", p_limit: 1, p_country: null });
    console.log("event:", e);
    const o = await supabase.rpc("geoacademic_open_engine_latest", { p_entity_type: "opportunity", p_limit: 1, p_country: null });
    console.log("opportunity:", o);
  } catch (err) {
    console.error(err);
  }
}
run();
