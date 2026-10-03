if (!process.env.GEOACADEMIC_BASE_URL || /localhost|127\.0\.0\.1/i.test(process.env.GEOACADEMIC_BASE_URL)) {
  process.env.GEOACADEMIC_BASE_URL = "https://geoacademic.app";
}

await import("./job-review-worker.mjs");
