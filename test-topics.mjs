import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://rqalvagtdcqurubrsdnc.supabase.co", "sb_publishable_8yJVc87WDX7VcPgmttVAPw_RgGNPqzY");
async function run() {
  const p = await supabase.from("projects").select("id, name, project_topics(topic_id)").limit(2);
  console.log("projects:", JSON.stringify(p.data, null, 2));
  const pub = await supabase.from("publications").select("id, title, publication_topics(topic_id)").limit(2);
  console.log("publications:", JSON.stringify(pub.data, null, 2));
}
run();
