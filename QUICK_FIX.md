# Why Data Isn't Being Populated - Root Cause Summary

## The Problem (3 Issues)

### Issue 1: INGESTION_HOOK_SECRET Missing from GitHub Actions Secrets ❌

The ingestion system requires a shared secret for authentication. It's configured locally in `.env` but **NOT in GitHub repository secrets**, so automated workflows can't authenticate.

**Result:** Workflows return 503 "Ingestion hook is not configured"

### Issue 2: Ingestion Is NOT Automatic by Design ⚠️

Two separate workflows:
- **Seed Sources** - Manual trigger (`workflow_dispatch`) - registers initial URLs
- **Ingestion Burst** - Scheduled (`cron: "17 */2 * * *"`) - runs every 2 hours

They don't run in combo because:
- Seeding is one-time bootstrap; ingestion is continuous
- Task claiming prevents race conditions
- Designed for GitHub Free tier (12 runs/day max)

### Issue 3: Sources Were Never Seeded 🔴

The seed workflow has **never been triggered**, so no source URLs are registered. Without sources, ingestion has nothing to fetch.

---

## What You Need to Do (NOW)

### Step 1: Add GitHub Secrets (5 minutes)

Go to: https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions

Add these 3 secrets:

```
INGESTION_HOOK_SECRET=geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production

GEOACADEMIC_DATABASE_URL=postgresql://[user]:[password]@db.supabase.co:5432/postgres
(Get from: Supabase Dashboard → Project Settings → Database)

NVIDIA_API_KEY=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
```

### Step 2: Trigger Seed Workflow (2 minutes)

1. Go to: Actions tab
2. Select: "GeoAcademic seed sources"
3. Click: "Run workflow"
4. Wait for completion

This registers ISPRS, EGU, EarthObservations as sources.

### Step 3: Trigger Ingestion (5 minutes)

1. Go to: Actions tab
2. Select: "GeoAcademic ingestion burst"
3. Click: "Run workflow" (or wait for next scheduled 2-hour run)

This fetches data from registered sources.

### Step 4: Verify (1 minute)

```bash
npx tsx scripts/diagnose-data.ts
```

Should show non-zero counts.

---

## Timeline

- Seed workflow: ~2 minutes
- First ingestion: ~5 minutes
- Data visible: ~10 minutes total
- Ongoing: Every 2 hours automatically

---

## Lifecycle Filters Status

✅ **All lifecycle filters are working correctly:**
- Events: Exclude past events (end_date < today)
- Projects: Show only active/planned (hide completed)
- Courses: Exclude low-confidence records

Once data is ingested, the website will automatically show only lean, actionable data.
