#!/usr/bin/env node
/**
 * GeoAcademic Ingestion Status & Control
 * Commands: status | setup | local-test
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { config } from "dotenv";

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const c = {
  r: "\x1b[0m", b: "\x1b[1m", g: "\x1b[32m", 
  red: "\x1b[31m", y: "\x1b[33m", blu: "\x1b[36m"
};

async function showStatus() {
  console.clear();
  console.log(`\n${c.b}╔═══════════════════════════════════════════════════════╗${c.r}`);
  console.log(`${c.b}║   GeoAcademic Data Status                            ║${c.r}`);
  console.log(`${c.b}╚═══════════════════════════════════════════════════════╝${c.r}\n`);

  const tables = ["events", "projects", "courses", "opportunities", "publications"];
  let hasData = false;

  for (const table of tables) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
    const rows = count ?? 0;
    hasData = hasData || rows > 0;
    const icon = rows > 0 ? "✅" : "⏳";
    const col = rows > 0 ? c.g : c.r;
    console.log(`${col}${icon} ${table.padEnd(15)} ${rows} rows${c.r}`);
  }

  console.log("");
  if (hasData) {
    console.log(`${c.g}🎉 Data is being ingested!${c.r}`);
  } else {
    console.log(`${c.y}🔴 Database empty - run: node scripts/ingestion-status.mjs setup${c.r}`);
  }
  console.log("");
}

async function showSetup() {
  console.clear();
  console.log(`\n${c.b}╔═══════════════════════════════════════════════════════╗${c.r}`);
  console.log(`${c.b}║   GitHub Actions Setup Instructions                  ║${c.r}`);
  console.log(`${c.b}╚═══════════════════════════════════════════════════════╝${c.r}\n`);

  console.log(`${c.b}Step 1: Add GitHub Secrets${c.r}`);
  console.log("URL: https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions\n");

  console.log(`${c.blu}Secret 1: INGESTION_HOOK_SECRET${c.r}`);
  console.log("geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production\n");

  console.log(`${c.blu}Secret 2: GEOACADEMIC_DATABASE_URL${c.r}`);
  console.log("Get from: Supabase Dashboard → Settings → Database → Connection String\n");

  console.log(`${c.blu}Secret 3: NVIDIA_API_KEY${c.r}`);
  console.log("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\n");

  console.log(`${c.b}Step 2: Seed Sources${c.r}`);
  console.log("https://github.com/ealins/research-pulse-global-f9b8742f/actions");
  console.log("→ Select: 'GeoAcademic seed sources'");
  console.log("→ Click: 'Run workflow'\n");

  console.log(`${c.b}Step 3: Start Ingestion${c.r}`);
  console.log("https://github.com/ealins/research-pulse-global-f9b8742f/actions");
  console.log("→ Select: 'GeoAcademic ingestion burst'");
  console.log("→ Click: 'Run workflow'\n");

  console.log(`${c.y}⏱️  Timeline: ~15 minutes to live data${c.r}\n`);
}

async function testLocalHook() {
  console.log(`\n${c.blu}🔗 Testing local hook...${c.r}\n`);

  const env = fs.readFileSync(".env", "utf-8");
  const match = env.match(/INGESTION_HOOK_SECRET=(.+)/);
  const secret = match ? match[1].trim() : null;

  if (!secret) {
    console.log(`${c.red}❌ INGESTION_HOOK_SECRET not in .env${c.r}`);
    return;
  }

  try {
    const res = await fetch("http://localhost:5173/api/public/hooks/ingest-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ action: "worker-status", limit: 1 }),
    });

    const data = await res.json();
    console.log(`${res.ok ? c.g : c.y}Status: ${res.status}${c.r}`);
    console.log(JSON.stringify(data, null, 2) + "\n");
  } catch (error) {
    console.log(`${c.red}❌ Connection failed: ${error.message}${c.r}`);
    console.log(`${c.y}Make sure dev server is running: npm run dev${c.r}\n`);
  }
}

const cmd = process.argv[2] || "status";
if (cmd === "status") await showStatus();
else if (cmd === "setup") await showSetup();
else if (cmd === "local-test") await testLocalHook();
else console.log("Commands: status | setup | local-test");
