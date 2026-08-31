# GitHub Secrets - Copy & Paste Values

## URL to Add Secrets
https://github.com/ealins/research-pulse-global-f9b8742f/settings/secrets/actions

Click "New repository secret" for each one below.

---

## Secret 1: INGESTION_HOOK_SECRET

**Name (type this):**
```
INGESTION_HOOK_SECRET
```

**Value (copy this entire line):**
```
geoacademic-development-hook-secret-2026-08-31-v1-do-not-use-production
```

---

## Secret 2: GEOACADEMIC_DATABASE_URL

**Name (type this):**
```
GEOACADEMIC_DATABASE_URL
```

**Value (get from Supabase):**

1. Go to: https://supabase.com/dashboard/project/rqalvagtdcqurubrsdnc/settings/database
2. Find section: "Connection string"
3. Select: "URI" tab
4. Copy the connection string
5. It should look like:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**OR use this direct connection format:**
```
postgresql://postgres:postgres@db.rqalvagtdcqurubrsdnc.supabase.co:5432/postgres
```
(Replace `postgres` after the colon with your actual Supabase database password)

---

## Secret 3: NVIDIA_API_KEY

**Name (type this):**
```
NVIDIA_API_KEY
```

**Value (copy this entire line):**
```
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
```

---

## After Adding All 3 Secrets

### Step 2: Trigger Seed Workflow
1. Go to: https://github.com/ealins/research-pulse-global-f9b8742f/actions
2. Click on: "GeoAcademic seed sources" (left sidebar)
3. Click: "Run workflow" button (top right, gray button)
4. Click: Green "Run workflow" button in the dropdown
5. Wait ~2 minutes - refresh to see green checkmark

### Step 3: Trigger Ingestion Workflow  
1. Same page: https://github.com/ealins/research-pulse-global-f9b8742f/actions
2. Click on: "GeoAcademic ingestion burst" (left sidebar)
3. Click: "Run workflow" button
4. Click: Green "Run workflow" button
5. Wait ~5 minutes

### Step 4: Check Your Terminal
```bash
node scripts/ingestion-status.mjs status
```

You should see data counts increasing!

---

## Quick Checklist

- [ ] Add INGESTION_HOOK_SECRET to GitHub
- [ ] Add GEOACADEMIC_DATABASE_URL to GitHub
- [ ] Add NVIDIA_API_KEY to GitHub
- [ ] Run "GeoAcademic seed sources" workflow
- [ ] Run "GeoAcademic ingestion burst" workflow
- [ ] Verify with: `node scripts/ingestion-status.mjs status`

**Time to complete: ~15 minutes**
