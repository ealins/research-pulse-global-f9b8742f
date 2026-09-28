#!/usr/bin/env node

/**
 * Check GitHub Secrets Status
 * This tells you what secrets are needed vs what you have
 */

console.log("\n╔═══════════════════════════════════════════════════════╗");
console.log("║   GitHub Secrets Required Check                      ║");
console.log("╚═══════════════════════════════════════════════════════╝\n");

console.log("📋 Required Secrets for Data Ingestion:\n");

const required = [
  {
    name: "INGESTION_HOOK_SECRET",
    value: "[stored in GitHub Actions; never print secret values]",
    required: true,
    usedBy: "geoacademic-ingestion.yml"
  },
  {
    name: "GEOACADEMIC_DATABASE_URL",
    value: "[stored in GitHub Actions]",
    required: true,
    usedBy: "geoacademic-seed-sources.yml"
  },
  {
    name: "Google_API_Key",
    value: "[stored in GitHub Actions]",
    required: false,
    usedBy: "geoacademic-ingestion.yml / Cloud Run semantic review"
  }
]

required.forEach((secret, i) => {
  const icon = secret.required ? "❗" : "ℹ️";
  console.log(`${icon} ${i + 1}. ${secret.name}`);
  console.log(`   Used by: ${secret.usedBy}`);
  console.log(`   Value: ${secret.value}`);
  console.log("");
});

console.log("═".repeat(60));
console.log("\n📍 TO CHECK YOUR CURRENT SECRETS:\n");
console.log("1. Open: https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions");
console.log("2. Look at the 'Repository secrets' list");
console.log("3. Compare with the list above\n");

console.log("═".repeat(60));
console.log("\n📝 COPY-PASTE VALUES:\n");

console.log("Secrets are intentionally not printed by this script.");
console.log("");
console.log("Secret: GEOACADEMIC_DATABASE_URL");
console.log("Get from: https://supabase.com/dashboard/project/rqalvagtdcqurubrsdnc/settings/database");
console.log("Look for: 'Connection string' → URI tab");
console.log("");

console.log("═".repeat(60));
console.log("\n🚀 AFTER ADDING SECRETS, TEST WITH:\n");
console.log("node scripts/test-github-workflows.mjs");
console.log("");
