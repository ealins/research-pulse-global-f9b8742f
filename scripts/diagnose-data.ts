/**
 * Data diagnostic script - check what's actually in the database
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqalvagtdcqurubrsdnc.supabase.co",
  "sb_publishable_8yJVc87WDX7VcPgmttVAPw_RgGNPqzY"
);

async function checkData() {
  console.log("=== DATABASE DATA DIAGNOSTIC ===\n");

  // Check raw tables without any filters
  const tables = ["events", "projects", "courses", "opportunities", "publications", "institutions", "researchers"];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    
    console.log(`${table}: ${error ? error.message : (count ?? 0)} rows`);
  }

  // Check if there's any data at all
  console.log("\n--- Sample data check ---");
  
  const { data: anyEvents } = await supabase
    .from("events")
    .select("id, title, start_date, end_date, verification_status, is_demo")
    .limit(3);
  
  console.log("\nEvents (any status):", anyEvents?.length || 0);
  if (anyEvents?.length) {
    console.log("Sample:", anyEvents);
  }

  const { data: anyProjects } = await supabase
    .from("projects")
    .select("id, name, status, verification_status, is_demo")
    .limit(3);
  
  console.log("\nProjects (any status):", anyProjects?.length || 0);
  if (anyProjects?.length) {
    console.log("Sample:", anyProjects);
  }
}

checkData().catch(console.error);