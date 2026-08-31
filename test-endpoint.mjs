import https from "https";

const secret = "a1906a4c280fc73cac7916f4e5e117a6a56069dc093999ea82722eab77eb96e2";

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
    console.log("✓ Status:", res.statusCode);
    if (res.statusCode === 200) {
      console.log("✓✓✓ SUCCESS! Secret is working!");
    } else if (res.statusCode === 401) {
      console.log("✗ Still unauthorized");
    }
    if (res.statusCode <= 500) {
      console.log("Response:", data.substring(0, 200));
    }
  });
});

req.on("error", (error) => {
  console.error("✗ Error:", error.message);
});

req.write(JSON.stringify({ action: "worker-status" }));
req.end();
