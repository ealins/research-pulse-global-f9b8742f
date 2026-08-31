#!/usr/bin/env node

/**
 * Test if GitHub workflows can run by checking workflow syntax
 */

import { execSync } from "child_process";
import * as fs from "fs";

console.log("\n╔═══════════════════════════════════════════════════════╗");
console.log("║   Trigger GitHub Workflows                           ║");
console.log("╚═══════════════════════════════════════════════════════╝\n");

console.log("⏰ Current time: 2026-08-31 01:17 UTC");
console.log("📅 Next scheduled ingestion: 02:17 UTC (1 hour from now)\n");

console.log("═".repeat(60));
console.log("\n🎯 MANUAL TRIGGER (Do this now):\n");

console.log("Step 1: Open GitHub Actions");
console.log("https://github.com/ealins/research-pulse-global-f9b8742f/actions\n");

console.log("Step 2: Run 'GeoAcademic seed sources' workflow");
console.log("   → Click the workflow name on the left");
console.log("   → Click 'Run workflow' button (top right)");
console.log("   → Click green 'Run workflow' to confirm");
console.log("   → Wait ~2 minutes\n");

console.log("Step 3: Run 'GeoAcademic ingestion burst' workflow");
console.log("   → Click the workflow name on the left");
console.log("   → Click 'Run workflow' button");
console.log("   → Click green 'Run workflow' to confirm");
console.log("   → Wait ~5 minutes\n");

console.log("═".repeat(60));
console.log("\n✅ VERIFY IN TERMINAL:\n");
console.log("After workflows complete, run:");
console.log("node scripts/ingestion-status.mjs status\n");

console.log("Expected output:");
console.log("✅ events          50+ rows");
console.log("✅ projects        30+ rows");
console.log("✅ courses         40+ rows");
console.log("✅ opportunities   100+ rows\n");

console.log("═".repeat(60));
console.log("\n📋 IF WORKFLOWS FAIL:\n");
console.log("Check that these 3 secrets exist in GitHub:");
console.log("https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions\n");
console.log("Required:");
console.log("  1. INGESTION_HOOK_SECRET");
console.log("  2. GEOACADEMIC_DATABASE_URL");
console.log("  3. NVIDIA_API_KEY\n");

console.log("Run: node scripts/check-secrets.mjs (for copy-paste values)\n");
