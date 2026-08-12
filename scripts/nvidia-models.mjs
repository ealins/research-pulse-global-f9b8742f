const key = process.env.Nvidia || process.env.NVIDIA_API_KEY || "";
if (!key) {
  console.error('Missing NVIDIA key. Set "Nvidia" in .env or the current shell.');
  process.exit(1);
}

const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
  headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
});

const text = await response.text();
if (!response.ok) {
  console.error(`NVIDIA /v1/models failed: HTTP ${response.status}`);
  console.error(text.slice(0, 800));
  process.exit(1);
}

const payload = JSON.parse(text);
const ids = Array.isArray(payload.data) ? payload.data.map((m) => m?.id).filter(Boolean) : [];
const nemotron = ids.filter((id) => String(id).toLowerCase().includes("nemotron"));

console.log(`NVIDIA models visible to this key: ${ids.length}`);
console.log("Nemotron models:");
for (const id of nemotron.sort()) console.log(`  ${id}`);

const wanted = [
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3-ultra-550b-a55b",
];
console.log("\nGeoAcademic routing models:");
for (const id of wanted) console.log(`  ${ids.includes(id) ? "OK" : "NOT LISTED"}  ${id}`);
