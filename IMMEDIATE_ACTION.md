# 🚀 IMMEDIATE ACTION: Populate Your Database (5 Minutes)

**Current Status**: Your tech stack is 100% working BUT the database is empty (0 institutions = 0 data)

## Why Website Shows No Data

**geoacademic.app** (old): Has data (22 institutions, 59 jobs) BUT uses different secret → workflows can't access it
**geoacademic-web.fly.dev** (new): Workflows work perfectly BUT database is empty → need to seed it

## SOLUTION: Seed Database Now (3 Steps)

### STEP 1: Open Supabase SQL Editor
Go to: **https://supabase.com/projects/rqalvagtdcqurubrsdnc**
Click: **SQL Editor** (left sidebar)
Click: **New Query**

### STEP 2: Copy & Run the SQL
Open the file: `seed-institutions.sql` in this repo
Copy ALL the SQL (150 lines)
Paste into Supabase SQL Editor
Click: **RUN** (or press Ctrl+Enter)

**Expected Output**:
```
total_institutions: 15
```

### STEP 3: Trigger Ingestion (PowerShell)
```powershell
cd "E:\web Git VS\research-pulse-global-f9b8742f"

# A. Commit the seed file
git add seed-institutions.sql IMMEDIATE_ACTION.md
git commit -m "Add database seed and immediate action guide"
git push origin main

# B. Trigger discovery (after SQL is run)
curl.exe -X POST https://geoacademic-web.fly.dev/api/public/hooks/ingest-batch `
  -H "x-ingestion-secret: <ROTATED-SECRET-DO-NOT-COMMIT>" `
  -H "Content-Type: application/json" `
  -d '{\"action\":\"enqueue-discovery\",\"limit\":50}'

# C. Process the queue
curl.exe -X POST https://geoacademic-web.fly.dev/api/public/hooks/ingest-batch `
  -H "x-ingestion-secret: <ROTATED-SECRET-DO-NOT-COMMIT>" `
  -H "Content-Type: application/json" `
  -d '{\"action\":\"drain\",\"limit\":100}'

# D. Verify data appeared
curl.exe -s https://geoacademic-web.fly.dev/api/public/data-health | ConvertFrom-Json
```

**Expected After 5 Minutes**:
- ✅ Institutions: 15
- ✅ Sources: 50-100
- ✅ Opportunities: 100-200
- ✅ Events: 20-50

## AFTER THIS: Automatic Forever

Once seeded, GitHub Actions runs every 2 hours automatically:
- Next run: **04:17 UTC** (in ~1 hour 45 minutes)
- Adds 50-100 records per cycle
- 600-1,200 records per day
- Fully automated 24/7

## Alternative: Skip Manual Seeding

Run the seed workflow (uses Python instead of SQL):
```powershell
gh workflow run geoacademic-seed-sources.yml
```

Wait 30 seconds, then run steps B, C, D above.

---

**Time Required**: 5 minutes
**Result**: Website populated with real data, auto-updating every 2 hours
**Cost**: $0 (all free tier)

## Current Time: 2026-08-31 02:31 UTC
**Next automated run**: 04:17 UTC (if database is seeded)
**Action needed**: Run the SQL in Supabase (Step 1-2 above)
