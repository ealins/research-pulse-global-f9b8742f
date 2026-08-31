# GeoAcademic Data Ingestion Setup Guide

## Problem Summary
❌ Database is empty (0 rows in all tables)
❌ Ingestion not running
❌ INGESTION_HOOK_SECRET was missing from `.env`

## Root Cause Analysis

### 1. Missing INGESTION_HOOK_SECRET
The ingestion system has **three components** that all require the same secret:
- ✅ **Web application** (`src/routes/api/public/hooks/ingest-batch.ts`) - NOW CONFIGURED
- ❌ **GitHub Actions workflows** - NEEDS CONFIGURATION
- ❌ **Local ingestion worker** (`scripts/ingestion-worker.mjs`) - NEEDS CONFIGURATION

Without this secret, the hook returns 503 "Ingestion hook is not configured"

### 2. Two-Phase Bootstrap (Not Automatic by Design)

The system is intentionally **decoupled** for resilience:

```
Phase 1: Seed Sources (Manual - One-time)
  └─> GitHub Action: geoacademic-seed-sources.yml
  └─> Requires: GEOACADEMIC_DATABASE_URL secret
  └─> Action: Registers source URLs → Creates FETCH tasks
  └─> Sources: ISPRS, EGU, EarthObservations
  
Phase 2: Ingestion Burst (Scheduled - Recurring)
  └─> GitHub Action: geoacademic-ingestion.yml
  └─> Schedule: Every 2 hours (cron: "17 */2 * * *")
  └─> Manual: Can trigger from Actions tab
  └─> Actions: 
      ├─> Review job postings
      ├─> Fetch due sources
      ├─> Process fetched data
      └─> Refresh analytics
```

They don't run together because:
- Seeding is idempotent but rarely needed
- Ingestion runs on fixed schedule
- Concurrent execution would cause task conflicts

## Setup Checklist

### ✅ DONE - Local Environment
- [x] Added INGESTION_HOOK_SECRET to `.env`
- [x] Added GEOACADEMIC_BASE_URL to `.env`
- [x] Added GEOACADEMIC_DATABASE_URL to `.env`

### ⚠️ PENDING - GitHub Actions Secrets

You need to configure three secrets in your GitHub repository:

**Setting location:** 
https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions

**Required secrets:**

1. **INGESTION_HOOK_SECRET** (Required)
   ```
   Value: geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production
   ```
   (Use the same value as your `.env` file)

2. **GEOACADEMIC_DATABASE_URL** (Required for seeding)
   ```
   Value: postgresql://[user]:[password]@[host]:[port]/[database]
   ```
   Get this from: Supabase Dashboard → Project Settings → Database

3. **NVIDIA_API_KEY** (Optional)
   ```
   Value: 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
   ```

### Next Steps

1. **Add GitHub secrets** (see above)
2. **Manually trigger seed workflow:**
   - Go to: Actions tab → "GeoAcademic seed sources"
   - Click "Run workflow"
   - This registers initial sources and creates FETCH tasks

3. **Verify ingestion:**
   - Wait for next scheduled run (every 2 hours)
   - Or manually trigger: Actions tab → "GeoAcademic ingestion burst"

4. **Monitor progress:**
   - Check workflow logs in Actions tab
   - Database should start populating with data

## Lifecycle Policy Status

✅ **All lifecycle filters are correctly implemented:**
- Events: Exclude past events (end_date < today)
- Projects: Show only active/planned (hide completed)
- Courses: Exclude low-confidence records
- Opportunities: Already properly filtered

**Once data is ingested, the website will automatically show only lean, actionable data.**

## Local Testing (Optional)

To manually trigger ingestion locally:

```bash
# Test 1: Check worker status
INGESTION_HOOK_SECRET="geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production" \
node scripts/test-hook.mjs

# Test 2: Run ingestion worker
INGESTION_HOOK_SECRET="geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production" \
npm run worker:ingest
```

## Expected Timeline

- **Seed workflow:** ~2 minutes to register sources
- **First ingestion burst:** ~5 minutes to fetch initial data
- **Data visibility:** Within 10-15 minutes after ingestion
- **Ongoing:** Every 2 hours, 12 times per day (within GitHub Free tier)
