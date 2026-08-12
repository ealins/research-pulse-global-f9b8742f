/**
 * Optional continuous queue consumer for GeoAcademic Radar.
 *
 * Run locally with: npm run worker:ingest
 * Later, deploy this exact process to a persistent worker host (Render/Railway/
 * Fly/VPS). It calls the already-authenticated ingestion hook repeatedly; the
 * database's conditional task claiming prevents collisions with cron/manual runs.
 */
const BASE_URL = (process.env.GEOACADEMIC_BASE_URL || "https://geoacademic.app").replace(/\/$/, "");
const API_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const ACTIVE_DELAY_MS = Number(process.env.INGESTION_ACTIVE_DELAY_MS || 2000);
const IDLE_DELAY_MS = Number(process.env.INGESTION_IDLE_DELAY_MS || 60000);
const ERROR_DELAY_MS = Number(process.env.INGESTION_ERROR_DELAY_MS || 30000);
const RESEED_INTERVAL_MS = Number(process.env.INGESTION_RESEED_INTERVAL_MS || 6 * 60 * 60 * 1000);

if (!API_KEY) {
  console.error(
    "Missing SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in environment.",
  );
  process.exit(1);
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function drainOnce() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  try {
    const response = await fetch(`${BASE_URL}/api/public/hooks/ingest-batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: API_KEY,
      },
      body: JSON.stringify({ action: "drain", limit: 50, trigger: "continuous-worker" }),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function syncPulse() {
  const response = await fetch(`${BASE_URL}/api/public/hooks/ingest-batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: API_KEY,
    },
    body: JSON.stringify({ action: "sync-pulse", limit: 120, trigger: "continuous-worker" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`pulse sync HTTP ${response.status}`);
  return payload;
}

async function reseedHighValue() {
  const response = await fetch(`${BASE_URL}/api/public/hooks/ingest-batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: API_KEY,
    },
    body: JSON.stringify({
      action: "reseed-high-value",
      limit: 150,
      trigger: "continuous-worker",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`reseed HTTP ${response.status}`);
  return payload;
}

console.log(`GeoAcademic continuous worker -> ${BASE_URL}`);
console.log("Press Ctrl+C to stop. NVIDIA concurrency remains controlled by the server.");

try {
  const pulse = await syncPulse();
  console.log(`${new Date().toISOString()} PULSE checked=${pulse.checked ?? 0} projected=${pulse.projected ?? 0}`);
} catch (error) {
  console.error(`${new Date().toISOString()} pulse sync warning:`, error instanceof Error ? error.message : String(error));
}

let loops = 0;
let idleLoops = 0;
let lastReseedAt = 0;
while (!stopping) {
  try {
    const result = await drainOnce();
    const processed = Number(result.processed || 0);
    const group = result.task_group || (result.skipped ? "IDLE" : "UNKNOWN");
    const failures = Number(result.failed || 0) + Number(result.dead || 0);
    console.log(
      `${new Date().toISOString()} ${group} processed=${processed} normalized=${result.normalized ?? 0} skipped=${result.skipped ?? 0} ok=${result.ok ?? 0} failed=${result.failed ?? 0} dead=${result.dead ?? 0}`,
    );
    loops += 1;
    idleLoops = processed === 0 ? idleLoops + 1 : 0;

    // When the ordinary queue is empty, revisit a bounded set of high-value
    // directories that predate deep discovery. The server marks each source,
    // so this expands the frontier rather than looping over the same indexes.
    if (idleLoops >= 3 && Date.now() - lastReseedAt >= RESEED_INTERVAL_MS) {
      try {
        const reseed = await reseedHighValue();
        lastReseedAt = Date.now();
        idleLoops = 0;
        console.log(
          `${new Date().toISOString()} RESEED queued=${reseed.queued ?? 0} eligible=${reseed.eligible ?? 0} by_category=${JSON.stringify(reseed.by_category ?? {})}`,
        );
      } catch (error) {
        console.error(
          `${new Date().toISOString()} reseed warning:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (loops % 20 === 0) {
      try {
        const pulse = await syncPulse();
        console.log(`${new Date().toISOString()} PULSE checked=${pulse.checked ?? 0} projected=${pulse.projected ?? 0}`);
      } catch (error) {
        console.error(`${new Date().toISOString()} pulse sync warning:`, error instanceof Error ? error.message : String(error));
      }
    }
    await sleep(failures > 0 ? ERROR_DELAY_MS : processed > 0 ? ACTIVE_DELAY_MS : IDLE_DELAY_MS);
  } catch (error) {
    console.error(
      `${new Date().toISOString()} worker error:`,
      error instanceof Error ? error.message : String(error),
    );
    await sleep(ERROR_DELAY_MS);
  }
}

console.log("Worker stopped.");
