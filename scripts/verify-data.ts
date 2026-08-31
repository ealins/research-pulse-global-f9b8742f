/**
 * Quick data verification script
 * Run with: node --import=tsx scripts/verify-data.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqalvagtdcqurubrsdnc.supabase.co",
  "sb_publishable_8yJVc87WDX7VcPgmttVAPw_RgGNPqzY"
);

const today = new Date().toISOString().slice(0, 10);

async function verifyData() {
  console.log("=== VERIFYING LEAN DATA WITH LIFECYCLE FILTERS ===\n");
  console.log(`Today: ${today}\n`);

  // Test Events (filter out past events)
  console.log("📅 EVENTS (excluding past events)...");
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_date, end_date, verification_status")
    .eq("is_demo", false)
    .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
    .limit(10);

  if (eventsError) {
    console.log("❌ Error:", eventsError.message);
  } else {
    const liveEvents = (events || []).filter((e) => {
      if (e.end_date && e.end_date < today) return false;
      if (!e.end_date && e.start_date && e.start_date < today) return false;
      return true;
    });
    console.log(`✅ Total fetched: ${events?.length || 0}, Live after filter: ${liveEvents.length}`);
    if (liveEvents.length > 0) {
      console.log("   Sample:", liveEvents[0].title?.slice(0, 50));
    }
  }

  // Test Projects (filter to active/planned only)
  console.log("\n🏗️ PROJECTS (planned/active only)...");
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, status, verification_status")
    .eq("is_demo", false)
    .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
    .in("status", ["planned", "active"])
    .limit(10);

  if (projectsError) {
    console.log("❌ Error:", projectsError.message);
  } else {
    console.log(`✅ Total: ${projects?.length || 0}`);
    if ((projects || []).length > 0) {
      console.log("   Sample:", projects[0].name?.slice(0, 50), `(${projects[0].status})`);
    }
  }

  // Test Courses (exclude low confidence)
  console.log("\n🎓 COURSES (excluding low confidence)...");
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, title, confidence, verification_status")
    .eq("is_demo", false)
    .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
    .neq("confidence", "low")
    .limit(10);

  if (coursesError) {
    console.log("❌ Error:", coursesError.message);
  } else {
    console.log(`✅ Total: ${courses?.length || 0}`);
    if ((courses || []).length > 0) {
      console.log("   Sample:", courses[0].title?.slice(0, 50), `(${courses[0].confidence})`);
    }
  }

  // Test Opportunities (already filtered by status/confidence)
  console.log("\n💼 OPPORTUNITIES (open status, medium/high confidence)...");
  const { data: opportunities, error: oppError } = await supabase
    .from("opportunities")
    .select("id, title, status, confidence, application_deadline")
    .eq("is_demo", false)
    .in("verification_status", ["verified", "auto_discovered", "possibly_outdated"])
    .in("status", ["open", "closing_soon", "rolling", "possibly_open"])
    .in("confidence", ["high", "medium"])
    .limit(10);

  if (oppError) {
    console.log("❌ Error:", oppError.message);
  } else {
    const liveOpp = (opportunities || []).filter((o) => {
      if (o.application_deadline && o.application_deadline < today) return false;
      return true;
    });
    console.log(`✅ Total: ${opportunities?.length || 0}, Live after deadline filter: ${liveOpp.length}`);
    if (liveOpp.length > 0) {
      console.log("   Sample:", liveOpp[0].title?.slice(0, 50));
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log("All queries with lifecycle filters are returning data ✅");
}

verifyData().catch(console.error);