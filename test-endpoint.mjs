import https from "https";

const secret = process.env.INGESTION_HOOK_SECRET;
if (!secret) {
  console.error("Missing INGESTION_HOOK_SECRET environment variable");
  process.exit(1);
}

const options = {
  hostname: "geoacademic-web.fly.dev",
  port: 443,
  path: "/api/public/hooks/ingest-batch",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ingestion-secret": secret,
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log("SUCCESS: ingestion hook accepted the request");
    } else if (res.statusCode === 401) {
      console.log("Unauthorized: verify the configured secret");
    }
    if ((res.statusCode ?? 999) <= 500) {
      console.log("Response:", data.substring(0, 200));
    }
  });
});

req.on("error", (error) => {
  console.error("Error:", error.message);
});

req.write(JSON.stringify({ action: "worker-status" }));
req.end();
