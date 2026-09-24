
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) process.env[k.trim()] = v.trim();
}
process.env.GEOACADEMIC_BASE_URL = "http://localhost:8081";
process.env.REVIEW_RUNTIME_MS = "210000";
import("./scripts/job-review-worker.mjs");

