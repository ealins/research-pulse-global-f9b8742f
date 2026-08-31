/**
 * Test the ingestion hook with the new INGESTION_HOOK_SECRET
 */

const BASE_URL = "http://localhost:5173";
const HOOK_SECRET = "geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production";

async function testHook(action = "worker-status") {
  console.log(`\n🔗 Testing ingestion hook: ${action}`);
  console.log(`📍 Target: ${BASE_URL}/api/public/hooks/ingest-batch`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/public/hooks/ingest-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${HOOK_SECRET}`,
      },
      body: JSON.stringify({ action, limit: 5 }),
    });

    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

async function main() {
  console.log("=== INGESTION HOOK TESTING ===");
  
  // Test 1: Worker status
  await testHook("worker-status");
  
  // Test 2: Drain (process queued tasks)
  await testHook("drain");
  
  // Test 3: Enqueue discovery
  await testHook("enqueue-discovery");
}

main().catch(console.error);
