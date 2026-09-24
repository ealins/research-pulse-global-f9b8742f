
import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  const [k, v] = line.split("=");
  if (k && v) process.env[k.trim()] = v.trim();
}
import("./scripts/job-review-worker.mjs");

