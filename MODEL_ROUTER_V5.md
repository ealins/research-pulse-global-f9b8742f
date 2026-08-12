# GeoAcademic v5 — adaptive Nemotron model router

This patch uses the existing `Nvidia` secret for all Nemotron tiers.
No new AI key is required.

Routing policy:
- CONNECTION_TEST: Nano
- RELEVANCE_CLASSIFICATION: Nano -> Super
- PROGRAMME/EVENT/VACANCY: Nano -> Super -> Ultra
- PROJECT/RESEARCHER: Super -> Ultra

All models run with thinking disabled. The strict validator remains the authority:
model output is never written to canonical tables without schema/business-rule
validation. A validated cache hit can be reused regardless of which tier created
it, preserving existing Ultra-era cache value.

Before deployment, verify that the current NVIDIA key can see the desired model
ids:

    npm run nvidia:models

Then build:

    npm run build

Files changed by this patch:
- src/lib/llm-config.server.ts
- src/lib/nvidia.server.ts
- src/lib/extraction/engine.server.ts
- src/lib/extraction/validate.server.ts
- src/lib/nvidia.functions.ts
- src/components/admin/NvidiaEnginePanel.tsx
- scripts/nvidia-models.mjs
- package.json
