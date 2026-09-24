
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) process.env[k.trim()] = v.trim();
}
const supabase = createClient("https://rqalvagtdcqurubrsdnc.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from("ingestion_tasks").select("id, task_type, status, source_id, started_at, payload").order("created_at", { ascending: false }).limit(2);
  console.log(data);
}
run();

